/**
 * Icon generation script
 * Converts the SVG source icon to PNG/ICO formats needed by Electron.
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, '..', 'packages', 'main', 'build');
const svgPath = path.join(buildDir, 'icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generateIcons() {
  // 512x512 PNG for electron-builder (auto-generates platform icons)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(buildDir, 'icon.png'));
  console.log('✓ icon.png (512x512)');

  // 256x256 PNG for Linux and BrowserWindow fallback
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(buildDir, 'icon-256x256.png'));
  console.log('✓ icon-256x256.png');

  // 32x32 PNG for favicon
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(buildDir, 'favicon-32x32.png'));
  console.log('✓ favicon-32x32.png');

  // 16x16 PNG for favicon
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(buildDir, 'favicon-16x16.png'));
  console.log('✓ favicon-16x16.png');

  // ICO for Windows (contains 16x16, 32x32, 48x48, 256x256)
  // ICO format: header + directory entries + image data
  const sizes = [16, 32, 48, 256];
  const pngBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Build ICO file
  const icoHeaderSize = 6;
  const icoDirEntrySize = 16;
  const numImages = pngBuffers.length;
  const dirSize = numImages * icoDirEntrySize;
  let offset = icoHeaderSize + dirSize;

  const entries = pngBuffers.map(({ size, buf }) => {
    const entry = Buffer.alloc(icoDirEntrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0);  // width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1);  // height (0 = 256)
    entry.writeUInt8(0, 2);  // color palette
    entry.writeUInt8(0, 3);  // reserved
    entry.writeUInt16LE(1, 4);  // color planes
    entry.writeUInt16LE(32, 6);  // bits per pixel
    entry.writeUInt32LE(buf.length, 8);  // image data size
    entry.writeUInt32LE(offset, 12);  // image data offset
    offset += buf.length;
    return entry;
  });

  const header = Buffer.alloc(icoHeaderSize);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: 1 = ICO
  header.writeUInt16LE(numImages, 4);  // number of images

  const icoBuffer = Buffer.concat([
    header,
    ...entries,
    ...pngBuffers.map(({ buf }) => buf),
  ]);

  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log('✓ icon.ico (16,32,48,256)');

  console.log('\nAll icons generated in packages/main/build/');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
