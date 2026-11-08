import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
const crc = buffer => {
  let c = 0xffffffff;
  for (const value of buffer) { c ^= value; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
await mkdir('public/icons', { recursive: true });
for (const size of [192, 512]) {
  const row = size * 4 + 1, data = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x * 192 / size, py = y * 192 / size;
    let ink = false;
    for (const [cx, top, bottom] of [[49,83,109],[73,59,133],[96,40,152],[119,59,133],[143,83,109]]) {
      if (Math.hypot(px - cx, py - Math.max(top, Math.min(bottom, py))) < 5) ink = true;
    }
    const color = ink ? [217,239,174] : [24,63,53];
    const at = y * row + 1 + x * 4;
    data[at] = color[0]; data[at+1] = color[1]; data[at+2] = color[2]; data[at+3] = 255;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  await writeFile(`public/icons/icon-${size}.png`, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header), chunk('IDAT',deflateSync(data)), chunk('IEND',Buffer.alloc(0))]));
}
