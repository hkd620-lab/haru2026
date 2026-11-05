// HWP 5 본문 레코드: https://tech.hancom.com/python-hwp-parsing-2/
// 원본은 보존하며 스크립트·매크로를 실행하지 않고 본문만 추출한다.
import { OleFileIO } from 'office-crypto';
import JSZip from 'jszip';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { inflateRawSync } from 'zlib';
export const HARULAW_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 16 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
export function isHaruLawDocumentMime(mime: string): boolean {
  return ['application/x-hwp', 'application/vnd.hancom.hwpx', 'text/plain'].includes(mime);
}
const unreadable = (): never => { throw new Error('ATTACHMENT_CONTENT_UNREADABLE'); };
function finishText(text: string): string {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.trim() || text.length > MAX_TEXT_CHARS || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) return unreadable();
  return text;
}
function decodeText(bytes: Buffer): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('euc-kr', { fatal: true }).decode(bytes); }
}
function hwpParagraph(bytes: Buffer): string {
  if (bytes.length % 2) return unreadable();
  let text = '';
  const extended = new Set([1, 2, 3, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  for (let offset = 0; offset < bytes.length; offset += 2) {
    const code = bytes.readUInt16LE(offset);
    if (extended.has(code)) {
      if (offset + 16 > bytes.length) return unreadable();
      if (code === 9) text += '\t';
      offset += 14;
    } else if (code === 10 || code === 13) text += '\n';
    else if (code === 30 || code === 31) text += ' ';
    else if (code >= 32) text += String.fromCharCode(code);
  }
  return text;
}
function extractHwp(bytes: Buffer): string {
  const ole = new OleFileIO(bytes);
  const header = Buffer.from(ole.openstream('FileHeader').getValue());
  if (header.length < 40 || header.subarray(0, 17).toString('ascii') !== 'HWP Document File' || header[35] !== 5) return unreadable();
  const flags = header.readUInt32LE(36);
  if (flags & (2 | 4 | 16)) return unreadable(); // 암호·배포용·DRM
  const sections = ole.listdir().filter(parts => parts.length === 2 && parts[0] === 'BodyText' && /^Section\d+$/.test(parts[1]))
    .sort((a, b) => Number(a[1].slice(7)) - Number(b[1].slice(7)));
  if (!sections.length || sections.length > 128) return unreadable();
  let expanded = 0, text = '';
  for (const section of sections) {
    const raw = Buffer.from(ole.openstream(section).getValue());
    const data = flags & 1 ? inflateRawSync(raw, { maxOutputLength: MAX_EXPANDED_BYTES - expanded }) : raw;
    expanded += data.length;
    if (expanded > MAX_EXPANDED_BYTES) return unreadable();
    let offset = 0;
    while (offset < data.length) {
      if (offset + 4 > data.length) return unreadable();
      const record = data.readUInt32LE(offset); offset += 4;
      let size = record >>> 20;
      if (size === 0xfff) {
        if (offset + 4 > data.length) return unreadable();
        size = data.readUInt32LE(offset); offset += 4;
      }
      if (offset + size > data.length) return unreadable();
      if ((record & 0x3ff) === 0x43) text += hwpParagraph(data.subarray(offset, offset + size)) + '\n';
      if (text.length > MAX_TEXT_CHARS) return unreadable();
      offset += size;
    }
  }
  return finishText(text);
}
async function readZipEntry(entry: JSZip.JSZipObject, remaining: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = entry.nodeStream();
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > remaining) { stream.pause(); reject(new Error('ATTACHMENT_CONTENT_UNREADABLE')); }
      else chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
async function extractHwpx(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  if (Object.keys(zip.files).length > 512 || !zip.file('Contents/content.hpf')) return unreadable();
  const mimeEntry = zip.file('mimetype');
  if (!mimeEntry || (await readZipEntry(mimeEntry, 128)).toString('utf8').trim() !== 'application/hwp+zip') return unreadable();
  const manifestBytes = await readZipEntry(zip.file('Contents/content.hpf')!, 1024 * 1024);
  const manifestXml = new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(manifestXml) || XMLValidator.validate(manifestXml) !== true) return unreadable();
  const manifest = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false }).parse(manifestXml)?.package;
  const asArray = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];
  const items = asArray(manifest?.manifest?.item);
  const spine = asArray(manifest?.spine?.itemref);
  const sections: JSZip.JSZipObject[] = [];
  for (const ref of spine) {
    const item = items.find(item => item['@_id'] === ref['@_idref']);
    const href = String(item?.['@_href'] || '');
    // 한글이 저장한 문서는 header도 spine에 넣으며 href에 Contents/를 포함한다.
    // 경로 이동·외부 URI는 허용하지 않고, 알려진 메타데이터만 본문에서 제외한다.
    if (!/^(?:Contents\/)?(?:section\d+|header|settings)\.xml$/.test(href)) return unreadable();
    const entry = zip.file(href) || zip.file('Contents/' + href);
    if (!entry) return unreadable();
    if (/^(?:Contents\/)?(?:header|settings)\.xml$/.test(href)) continue;
    if (!entry || sections.includes(entry)) return unreadable();
    sections.push(entry);
  }
  const sectionCount = Object.keys(zip.files).filter(name => /^Contents\/section\d+\.xml$/.test(name)).length;
  if (!sections.length || sections.length > 128 || sections.length !== sectionCount) return unreadable();
  const parser = new XMLParser({ preserveOrder: true, removeNSPrefix: true, parseTagValue: false, trimValues: false, ignoreAttributes: false, processEntities: true });
  let expanded = manifestBytes.length, text = '';
  const visit = (nodes: any[], inText = false): void => {
    for (const node of nodes) for (const [key, value] of Object.entries(node)) {
      if (key === '#text' && inText) {
        text += String(value);
      } else if (Array.isArray(value)) {
        visit(value, key === 't' || inText);
        if (key === 'p' || key === 'lineBreak') text += '\n';
        if (key === 'tab') text += '\t';
      }
      if (text.length > MAX_TEXT_CHARS) return unreadable();
    }
  };
  for (const section of sections) {
    const data = await readZipEntry(section, MAX_EXPANDED_BYTES - expanded); expanded += data.length;
    const xml = new TextDecoder('utf-8', {fatal:true}).decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return unreadable();
    visit(parser.parse(xml));
  }
  return finishText(text);
}
export async function extractHaruLawDocumentText(mime: string, bytes: Buffer): Promise<string> {
  if (!bytes.length || bytes.length > HARULAW_DOCUMENT_MAX_BYTES) return unreadable();
  try {
    if (mime === 'text/plain') return finishText(decodeText(bytes));
    if (mime === 'application/x-hwp') return extractHwp(bytes);
    if (mime === 'application/vnd.hancom.hwpx') return await extractHwpx(bytes);
    return unreadable();
  } catch { return unreadable(); }
}
