const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'public', 'favicon.svg');
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const FAVICON_PATH = path.join(__dirname, '..', 'public', 'favicon.ico');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const APPLE_TOUCH_SIZE = 180;

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Generate all standard icon sizes
  for (const size of ICON_SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}x${size}.png`));
    console.log(`Generated icon-${size}x${size}.png`);
  }

  // Generate apple-touch-icon
  await sharp(svgBuffer)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
    .png()
    .toFile(path.join(ICONS_DIR, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Copy 96x96 as shortcut icons
  const icon96 = path.join(ICONS_DIR, 'icon-96x96.png');
  fs.copyFileSync(icon96, path.join(ICONS_DIR, 'create-shortcut.png'));
  fs.copyFileSync(icon96, path.join(ICONS_DIR, 'join-shortcut.png'));
  console.log('Generated create-shortcut.png and join-shortcut.png');

  // Generate favicon.ico (32x32 PNG saved as .ico)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(FAVICON_PATH);
  console.log('Generated favicon.ico');

  console.log('\nAll icons generated successfully!');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
