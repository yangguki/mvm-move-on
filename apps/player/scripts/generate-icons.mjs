import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const svgContent = readFileSync(join(publicDir, "icon.svg"), "utf-8");

async function generatePng(size) {
  try {
    const sharp = (await import("sharp")).default;
    const buffer = await sharp(Buffer.from(svgContent))
      .resize(size, size)
      .png()
      .toBuffer();
    writeFileSync(join(publicDir, `icon-${size}.png`), buffer);
    console.log(`Generated icon-${size}.png with sharp`);
  } catch {
    console.log(`sharp not available, creating placeholder icon-${size}.png`);
    const placeholder = createPlaceholderPng(size);
    writeFileSync(join(publicDir, `icon-${size}.png`), placeholder);
    console.log(`Generated placeholder icon-${size}.png`);
  }
}

function createPlaceholderPng(size) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  
  function crc32(data) {
    let crc = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const crcVal = Buffer.alloc(4);
    crcVal.writeUInt32BE(crc32(typeData));
    return Buffer.concat([len, typeData, crcVal]);
  }
  
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  
  const bgColor = [10, 10, 10];
  const playColor = [200, 243, 29];
  const rawData = [];
  const center = size / 2;
  const triLeft = size * 0.35;
  const triRight = size * 0.75;
  const triTop = size * 0.25;
  const triBottom = size * 0.75;
  
  for (let y = 0; y < size; y++) {
    rawData.push(0);
    for (let x = 0; x < size; x++) {
      const inTriX = x >= triLeft && x <= triRight;
      const triHeight = triBottom - triTop;
      const triWidth = triRight - triLeft;
      const relY = y - triTop;
      const expectedX = triLeft + (relY / triHeight) * triWidth * 0.5;
      const maxX = triLeft + triWidth - (relY / triHeight) * triWidth * 0.5;
      const inTri = y >= triTop && y <= triBottom && x >= expectedX && x <= maxX && inTriX;
      
      if (inTri) {
        rawData.push(...playColor);
      } else {
        rawData.push(...bgColor);
      }
    }
  }
  
  const compressed = deflateSync(Buffer.from(rawData));
  
  return Buffer.concat([
    pngSignature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await generatePng(192);
await generatePng(512);
