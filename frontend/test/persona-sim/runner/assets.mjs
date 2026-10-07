// 테스트용 이미지 생성 — 외부 라이브러리 없이 PNG를 직접 만든다(그라데이션, 압축이 잘 되는 단순 이미지).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ensureDir, outRoot } from './lib.mjs';

function crc32(buf) {
  let c; let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n += 1) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function makePng(file, { width = 640, height = 480, hue = 120 } = {}) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x += 1) {
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = (hue + x / 4) % 256; raw[o + 1] = (180 + y / 8) % 256; raw[o + 2] = (100 + (x + y) / 6) % 256;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, png);
  return file;
}
export function testImage(name, hue) {
  return makePng(path.join(outRoot, 'assets', `${name}.png`), { hue });
}
