import sharp from 'sharp';

// 서버 내부(오픈소스 libheif WASM 해독 + sharp JPEG 인코딩)에서 HEIC를 JPEG로 바꾼다.
// 외부 네트워크·외부 저장소를 쓰지 않는다. 응답 계약(키·6MiB·직렬화 상한)은
// heicConversionCore의 convertHeicLocallyToJpegBase64 / buildConvertHeicResponse가 맡는다.

export const HEIC_OUTPUT_MAX_DIMENSION = 2560;
export const HEIC_OUTPUT_JPEG_QUALITY = 80;
// 해독 전에 확인하는 원본 크기 상한. 48MP(8064x6048) 촬영본을 허용하고 그보다 큰 입력은 해독하지 않는다.
export const HEIC_DECODE_MAX_PIXELS = 50_000_000;
export const HEIC_DECODE_MAX_SIDE = 16_384;
const HEIC_EXIF_MAX_BYTES = 1024 * 1024;
const HEIC_MAX_METADATA_BLOCKS = 16;

export class HeicInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeicInputError';
  }
}

export type DecodedHeic = {
  data: Buffer;
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Exif(TIFF IFD0) Orientation 해석 — 경계 검사만 하는 좁은 파서
// ---------------------------------------------------------------------------

function readTiffOrientation(bytes: Uint8Array, tiffStart: number): number {
  if (tiffStart < 0 || tiffStart + 8 > bytes.length) return 1;
  const b0 = bytes[tiffStart];
  const b1 = bytes[tiffStart + 1];
  let little: boolean;
  if (b0 === 0x49 && b1 === 0x49) little = true;
  else if (b0 === 0x4d && b1 === 0x4d) little = false;
  else return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(tiffStart + 2, little) !== 42) return 1;
  const ifdOffset = view.getUint32(tiffStart + 4, little);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdOffset < 8 || ifdStart + 2 > bytes.length) return 1;
  const entryCount = view.getUint16(ifdStart, little);
  const maxEntries = Math.floor((bytes.length - ifdStart - 2) / 12);
  const count = Math.min(entryCount, maxEntries);
  for (let index = 0; index < count; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (view.getUint16(entry, little) !== 0x0112) continue;
    const type = view.getUint16(entry + 2, little);
    const valueCount = view.getUint32(entry + 4, little);
    if (type !== 3 || valueCount < 1) return 1;
    const orientation = view.getUint16(entry + 8, little);
    return orientation >= 1 && orientation <= 8 ? orientation : 1;
  }
  return 1;
}

// HEIF Exif 항목(ISO/IEC 23008-12 Annex A): 4바이트 big-endian exif_tiff_header_offset 다음에
// (선택적 "Exif\0\0" 머리말 등) 뒤 TIFF 헤더가 온다. 형식이 어긋나면 회전 없음(1)으로 본다.
export function parseHeifExifOrientation(payload: Uint8Array): number {
  if (!payload || payload.length < 4 + 8) return 1;
  const offset = ((payload[0] << 24) >>> 0) + (payload[1] << 16) + (payload[2] << 8) + payload[3];
  let tiffStart = 4 + offset;
  if (offset > payload.length) return 1;
  const isExifPreamble = (at: number) => at + 6 <= payload.length &&
    payload[at] === 0x45 && payload[at + 1] === 0x78 && payload[at + 2] === 0x69 &&
    payload[at + 3] === 0x66 && payload[at + 4] === 0 && payload[at + 5] === 0;
  if (isExifPreamble(tiffStart)) tiffStart += 6;
  return readTiffOrientation(payload, tiffStart);
}

// ---------------------------------------------------------------------------
// 화면 방향 적용(RGBA, 연속 배치). Exif 1~8 정의를 그대로 따른다.
// ---------------------------------------------------------------------------

export function orientedDimensions(width: number, height: number, orientation: number) {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

// src: stride 바이트 간격의 RGBA 행. 결과는 화면 방향으로 배치된 연속 RGBA Buffer 하나.
export function copyRgbaWithOrientation(
  src: Uint8Array,
  width: number,
  height: number,
  stride: number,
  orientation: number,
): DecodedHeic {
  if (!(orientation >= 1 && orientation <= 8)) orientation = 1;
  if (stride < width * 4 || src.length < stride * (height - 1) + width * 4) {
    throw new Error('HEIF decoded plane is smaller than expected');
  }
  const out = orientedDimensions(width, height, orientation);
  const buffer = new ArrayBuffer(out.width * out.height * 4);
  const dest = new Uint8Array(buffer);

  if (orientation === 1) {
    for (let y = 0; y < height; y += 1) {
      dest.set(src.subarray(stride * y, stride * y + width * 4), y * width * 4);
    }
    return { data: Buffer.from(buffer), width, height };
  }

  const aligned = src.byteOffset % 4 === 0 && stride % 4 === 0;
  const src32 = aligned ? new Uint32Array(src.buffer, src.byteOffset, Math.floor(src.length / 4)) : null;
  const dest32 = new Uint32Array(buffer);
  const srcStride32 = stride / 4;
  const W = out.width;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let X: number;
      let Y: number;
      switch (orientation) {
        case 2: X = width - 1 - x; Y = y; break;
        case 3: X = width - 1 - x; Y = height - 1 - y; break;
        case 4: X = x; Y = height - 1 - y; break;
        case 5: X = y; Y = x; break;
        case 6: X = height - 1 - y; Y = x; break;
        case 7: X = height - 1 - y; Y = width - 1 - x; break;
        default: X = y; Y = width - 1 - x; break; // 8
      }
      if (src32) {
        dest32[Y * W + X] = src32[y * srcStride32 + x];
      } else {
        const s = y * stride + x * 4;
        const d = (Y * W + X) * 4;
        dest[d] = src[s];
        dest[d + 1] = src[s + 1];
        dest[d + 2] = src[s + 2];
        dest[d + 3] = src[s + 3];
      }
    }
  }
  return { data: Buffer.from(buffer), width: out.width, height: out.height };
}

export function assertDecodableDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width <= 0 || height <= 0 ||
    width > HEIC_DECODE_MAX_SIDE || height > HEIC_DECODE_MAX_SIDE ||
    width * height > HEIC_DECODE_MAX_PIXELS
  ) {
    throw new HeicInputError('HEIF image dimensions are outside the supported range');
  }
}

// ---------------------------------------------------------------------------
// libheif-js(WASM) 해독
// ---------------------------------------------------------------------------

let libheifPromise: Promise<any> | null = null;

async function loadLibheif(): Promise<any> {
  if (!libheifPromise) {
    libheifPromise = (async () => {
      // @ts-ignore libheif-js는 타입 정의를 제공하지 않는다.
      const imported: any = await import('libheif-js/wasm-bundle.js');
      const candidate = imported && imported.default ? imported.default : imported;
      return await candidate;
    })();
    libheifPromise.catch(() => { libheifPromise = null; });
  }
  return libheifPromise;
}

function writeCString(heif: any, value: string): number {
  const bytes = Buffer.from(`${value}\0`, 'ascii');
  const ptr = heif._malloc(bytes.length);
  if (!ptr) throw new Error('HEIF allocation failed');
  heif.HEAPU8.set(bytes, ptr);
  return ptr;
}

function readPrimaryExifOrientation(heif: any, handlePtr: number): number {
  const required = [
    '_heif_image_handle_get_number_of_metadata_blocks',
    '_heif_image_handle_get_list_of_metadata_block_IDs',
    '_heif_image_handle_get_metadata_size',
    '_heif_image_handle_get_metadata',
    '_malloc',
    '_free',
  ];
  for (const name of required) {
    if (typeof heif[name] !== 'function') throw new Error(`libheif export missing: ${name}`);
  }
  const pointers: number[] = [];
  const alloc = (size: number) => {
    const ptr = heif._malloc(size);
    if (!ptr) throw new Error('HEIF allocation failed');
    pointers.push(ptr);
    return ptr;
  };
  try {
    const filterPtr = writeCString(heif, 'Exif');
    pointers.push(filterPtr);
    const count = heif._heif_image_handle_get_number_of_metadata_blocks(handlePtr, filterPtr);
    if (!(count > 0)) return 1;
    const capped = Math.min(count, HEIC_MAX_METADATA_BLOCKS);
    const idsPtr = alloc(capped * 4);
    const filled = heif._heif_image_handle_get_list_of_metadata_block_IDs(handlePtr, filterPtr, idsPtr, capped);
    const ids: number[] = [];
    for (let i = 0; i < Math.min(filled, capped); i += 1) ids.push(heif.HEAPU32[(idsPtr >>> 2) + i]);
    for (const id of ids) {
      const size = heif._heif_image_handle_get_metadata_size(handlePtr, id);
      if (!(size > 0) || size > HEIC_EXIF_MAX_BYTES) continue;
      const outPtr = alloc(size);
      const errorPtr = alloc(16);
      heif._heif_image_handle_get_metadata(errorPtr, handlePtr, id, outPtr);
      if (heif.HEAPU32[errorPtr >>> 2] !== 0) continue;
      const payload = Uint8Array.from(heif.HEAPU8.subarray(outPtr, outPtr + size));
      return parseHeifExifOrientation(payload);
    }
    return 1;
  } finally {
    for (const ptr of pointers) heif._free(ptr);
  }
}

function primaryHasNativeTransform(heif: any, contextPtr: number, handlePtr: number): boolean {
  if (typeof heif._heif_image_handle_get_item_id !== 'function' ||
      typeof heif._heif_item_get_properties_of_type !== 'function' ||
      typeof heif.fourcc !== 'function') {
    throw new Error('libheif transform property API is unavailable');
  }
  const itemId = heif._heif_image_handle_get_item_id(handlePtr);
  return ['irot', 'imir'].some((type) =>
    heif._heif_item_get_properties_of_type(contextPtr, itemId, heif.fourcc(type), 0, 0) > 0);
}

// 대표(primary) 이미지만 해독. libheif가 irot/imir/clap 변환을 적용하므로,
// 그 변환이 있으면 Exif Orientation은 다시 적용하지 않는다(이중 회전 방지).
// 변환 속성이 없을 때만 대표 항목 Exif의 Orientation을 적용한다.
export async function decodeHeicPrimaryImage(input: Buffer): Promise<DecodedHeic> {
  const heif = await loadLibheif();
  const context = heif.heif_context_alloc();
  if (!context) throw new Error('HEIF context allocation failed');
  let handle: any;
  let decoded: any;
  try {
    if (typeof heif._heif_context_set_maximum_image_size_limit === 'function' && context.$$?.ptr) {
      heif._heif_context_set_maximum_image_size_limit(context.$$.ptr, HEIC_DECODE_MAX_SIDE);
    }
    const readError = heif.heif_context_read_from_memory(context, input);
    if (!readError || readError.code !== heif.heif_error_Ok) {
      throw new HeicInputError('HEIF container could not be read');
    }
    handle = heif.heif_js_context_get_primary_image_handle(context);
    if (!handle || handle.code !== undefined || !handle.$$?.ptr) {
      handle = undefined;
      throw new HeicInputError('HEIF primary image is missing');
    }
    const width = heif.heif_image_handle_get_width(handle);
    const height = heif.heif_image_handle_get_height(handle);
    assertDecodableDimensions(width, height);

    const orientation = primaryHasNativeTransform(heif, context.$$.ptr, handle.$$.ptr)
      ? 1
      : readPrimaryExifOrientation(heif, handle.$$.ptr);

    decoded = heif.heif_js_decode_image2(handle, heif.heif_colorspace_RGB, heif.heif_chroma_interleaved_RGBA);
    const channel = decoded?.channels?.[0];
    if (!decoded || decoded.code !== undefined || !channel || !channel.data ||
        decoded.width !== width || decoded.height !== height) {
      throw new HeicInputError('HEIF image could not be decoded');
    }
    return copyRgbaWithOrientation(channel.data, width, height, channel.stride, orientation);
  } finally {
    if (decoded?.image) heif.heif_image_release(decoded.image);
    if (handle) heif.heif_image_handle_release(handle);
    heif.heif_context_free(context);
  }
}

export async function encodeOrientedRgbaToJpeg(decoded: DecodedHeic): Promise<Buffer> {
  // 출력에는 메타데이터를 넣지 않는다(sharp 기본 동작: Exif·ICC 미포함). 방향은 이미 픽셀에 반영됨.
  return sharp(decoded.data, {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
    limitInputPixels: HEIC_DECODE_MAX_PIXELS,
  })
    .resize({
      width: HEIC_OUTPUT_MAX_DIMENSION,
      height: HEIC_OUTPUT_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: HEIC_OUTPUT_JPEG_QUALITY })
    .toBuffer();
}

// 인스턴스 안에서 해독은 한 번에 하나만(WASM 힙·메모리 상한 보호).
let conversionQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = conversionQueue.then(task, task);
  conversionQueue = run.catch(() => undefined);
  return run;
}

export async function convertHeicBufferToJpeg(input: Buffer): Promise<Buffer> {
  if (!Buffer.isBuffer(input) || input.length < 12) {
    throw new HeicInputError('HEIF container could not be read');
  }
  return runExclusive(async () => encodeOrientedRgbaToJpeg(await decodeHeicPrimaryImage(input)));
}
