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

// 해독된 RGBA 평면. data는 WASM 힙을 가리키는 view이며, withDecodedHeicPrimary의
// 콜백 안에서만 유효하다(콜백이 끝나면 libheif 이미지를 해제한다). 밖으로 내보내지 않는다.
type DecodedPlane = {
  data: Uint8Array;
  width: number;
  height: number;
  stride: number;
  orientation: number;
};

// 대표(primary) 이미지만 해독. libheif가 irot/imir/clap 변환을 적용하므로,
// 그 변환이 있으면 Exif Orientation은 다시 적용하지 않는다(이중 회전 방지).
// 변환 속성이 없을 때만 대표 항목 Exif의 Orientation을 적용한다.
// 해독 이미지·handle·context는 use()의 await가 끝난 뒤 finally에서 해제한다.
// 호출은 convertHeicBufferToJpeg의 직렬 큐(인스턴스당 1건, concurrency 1) 안에서만 한다:
// 콜백이 도는 동안 다른 WASM 호출이 힙을 바꾸거나 키우지 않아야 view가 유효하다.
async function withDecodedHeicPrimary<T>(input: Buffer, use: (plane: DecodedPlane) => T | Promise<T>): Promise<T> {
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
    if (!(channel.data instanceof Uint8Array)) throw new HeicInputError('HEIF image could not be decoded');
    return await use({ data: channel.data, width, height, stride: channel.stride, orientation });
  } finally {
    if (decoded?.image) heif.heif_image_release(decoded.image);
    if (handle) heif.heif_image_handle_release(handle);
    heif.heif_context_free(context);
  }
}

// 시험·진단용: 화면 방향으로 배치한 연속 RGBA 사본을 돌려준다(WASM 힙과 분리된 메모리).
export async function decodeHeicPrimaryImage(input: Buffer): Promise<DecodedHeic> {
  // 운영 변환과 같은 대기열을 써서, sharp가 view를 읽는 동안 다른 해독이 WASM 힙을 키우지 못하게 한다.
  return runExclusive(() => withDecodedHeicPrimary(input, (plane) =>
    copyRgbaWithOrientation(plane.data, plane.width, plane.height, plane.stride, plane.orientation)));
}

type SharpPipeline = ReturnType<typeof sharp>;

// Exif Orientation 1~8 → sharp 연산. 측정상 sharp는 flip/flop을 rotate보다 먼저 적용한다.
// copyRgbaWithOrientation과 같은 결과인지 8방향 시험이 강제한다(sharp 동작이 바뀌면 시험이 실패).
const ORIENTATION_OPS: Record<number, { angle: number; flip?: boolean; flop?: boolean }> = {
  1: { angle: 0 },
  2: { angle: 0, flop: true },
  3: { angle: 180 },
  4: { angle: 0, flip: true },
  5: { angle: 90, flip: true },
  6: { angle: 90 },
  7: { angle: 90, flop: true },
  8: { angle: 270 },
};

// 해독 평면을 사본 없이 sharp raw 입력으로 연다(전체 크기 RGBA 사본 1개를 줄임). 방향은 적용하지 않는다.
// - stride가 4의 배수이고 stride*height 바이트가 모두 있으면: 그 영역을 그대로 view로 넘기고
//   행 끝 padding은 sharp extract로 잘라낸다.
// - 그 밖의 경우(검증할 수 없는 배치)만 연속 사본 1개를 만든다. 이것은 변경 전과 같은
//   메모리(전체 RGBA 사본 1개)이므로 변경 전 측정치를 넘지 않는다.
function rgbaPlaneInput(data: Uint8Array, width: number, height: number, stride: number): SharpPipeline {
  const rowBytes = width * 4;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
      !Number.isInteger(stride) || stride < rowBytes || data.length < stride * (height - 1) + rowBytes) {
    throw new Error('HEIF decoded plane is smaller than expected');
  }
  if (stride % 4 === 0 && data.length >= stride * height) {
    const view = Buffer.from(data.buffer, data.byteOffset, stride * height);
    const image = sharp(view, {
      raw: { width: stride / 4, height, channels: 4 },
      limitInputPixels: (stride / 4) * height,
    });
    return stride === rowBytes ? image : image.extract({ left: 0, top: 0, width, height });
  }
  const compact = copyRgbaWithOrientation(data, width, height, stride, 1);
  return sharp(compact.data, { raw: { width, height, channels: 4 }, limitInputPixels: HEIC_DECODE_MAX_PIXELS });
}

// 출력 상자는 정사각형(2560x2560 내접)이라, 방향 적용 전에 줄여도 결과 크기가 같다.
function resizeToOutputBox(image: SharpPipeline): SharpPipeline {
  return image.resize({
    width: HEIC_OUTPUT_MAX_DIMENSION,
    height: HEIC_OUTPUT_MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });
}

// Exif-only 방향(2~8) 경로: (1) 해독 평면 view → padding 제거 → 출력 크기로 축소한 raw(최대 2560²,
// WASM 힙과 분리) (2) 그 작은 raw에 rotate/flip/flop. sharp는 resize가 함께 있으면 extract와
// rotate의 적용 순서를 바꾸므로 두 단계로 나눠 그 내부 순서에 의존하지 않는다.
async function orientedResizedPipeline(
  data: Uint8Array,
  width: number,
  height: number,
  stride: number,
  orientation: number,
): Promise<SharpPipeline> {
  const resized = await resizeToOutputBox(rgbaPlaneInput(data, width, height, stride))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const op = ORIENTATION_OPS[orientation] ?? ORIENTATION_OPS[1];
  let image = sharp(resized.data, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  });
  if (op.angle) image = image.rotate(op.angle);
  if (op.flip) image = image.flip();
  if (op.flop) image = image.flop();
  return image;
}

// 시험용: Exif-only 경로의 축소·방향 적용 결과(raw RGBA).
export async function orientAndResizeRgbaPlane(
  data: Uint8Array,
  width: number,
  height: number,
  stride: number,
  orientation: number,
): Promise<DecodedHeic> {
  const oriented = await (await orientedResizedPipeline(data, width, height, stride, orientation))
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: oriented.data, width: oriented.info.width, height: oriented.info.height };
}

function encodeSharpToJpeg(image: SharpPipeline): Promise<Buffer> {
  // 출력에는 메타데이터를 넣지 않는다(sharp 기본 동작: Exif·ICC 미포함). 방향은 픽셀에 반영됨.
  return resizeToOutputBox(image)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: HEIC_OUTPUT_JPEG_QUALITY })
    .toBuffer();
}

export async function encodeOrientedRgbaToJpeg(decoded: DecodedHeic): Promise<Buffer> {
  return encodeSharpToJpeg(sharp(decoded.data, {
    raw: { width: decoded.width, height: decoded.height, channels: 4 },
    limitInputPixels: HEIC_DECODE_MAX_PIXELS,
  }));
}

// 운영 경로. 방향 1(irot/imir를 libheif가 이미 적용한 경우 포함)은 해독 평면 view에서 바로
// 한 번에 JPEG로 인코딩한다(변경 전과 같은 resize→flatten→JPEG 파이프라인, 사본 없음).
export async function encodeRgbaPlaneToJpeg(
  data: Uint8Array,
  width: number,
  height: number,
  stride: number,
  orientation: number,
): Promise<Buffer> {
  if (!(orientation >= 2 && orientation <= 8)) {
    return encodeSharpToJpeg(rgbaPlaneInput(data, width, height, stride));
  }
  // 2단계 파이프라인은 이미 출력 상자 안이므로 다시 축소하지 않는다.
  return (await orientedResizedPipeline(data, width, height, stride, orientation))
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
  // 해독 평면(WASM 힙 view)을 JPEG 인코딩이 끝날 때까지만 쓰고, 그 뒤에 libheif가 해제한다.
  return runExclusive(() => withDecodedHeicPrimary(input, (plane) =>
    encodeRgbaPlaneToJpeg(plane.data, plane.width, plane.height, plane.stride, plane.orientation)));
}
