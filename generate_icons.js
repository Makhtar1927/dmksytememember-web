import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceIcon = path.resolve(__dirname, '../member-web/public/icon.png');
console.log('Source icon:', sourceIcon);

if (!fs.existsSync(sourceIcon)) {
  console.error('Source icon does not exist!');
  process.exit(1);
}

// Android Mipmaps
const androidResDir = path.resolve(__dirname, 'android/app/src/main/res');
const androidSizes = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function generateAndroidIcons() {
  for (const item of androidSizes) {
    const targetDir = path.join(androidResDir, item.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const iconNames = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];
    for (const name of iconNames) {
      const targetPath = path.join(targetDir, name);
      await sharp(sourceIcon)
        .resize(item.size, item.size)
        .toFile(targetPath);
      console.log(`Generated Android: ${item.dir}/${name} (${item.size}x${item.size})`);
    }
  }
}

// iOS AppIcons
const iosAppIconDir = path.resolve(__dirname, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const iosSizes = [
  { name: 'AppIcon-20x20@2x.png', size: 40 },
  { name: 'AppIcon-20x20@3x.png', size: 60 },
  { name: 'AppIcon-29x29@1x.png', size: 29 },
  { name: 'AppIcon-29x29@2x.png', size: 58 },
  { name: 'AppIcon-29x29@3x.png', size: 87 },
  { name: 'AppIcon-40x40@1x.png', size: 40 },
  { name: 'AppIcon-40x40@2x.png', size: 80 },
  { name: 'AppIcon-40x40@3x.png', size: 120 },
  { name: 'AppIcon-60x60@2x.png', size: 120 },
  { name: 'AppIcon-60x60@3x.png', size: 180 },
  { name: 'AppIcon-76x76@1x.png', size: 76 },
  { name: 'AppIcon-76x76@2x.png', size: 152 },
  { name: 'AppIcon-83.5x83.5@2x.png', size: 167 },
  { name: 'AppIcon-512@2x.png', size: 1024 },
];

async function generateIosIcons() {
  if (!fs.existsSync(iosAppIconDir)) {
    fs.mkdirSync(iosAppIconDir, { recursive: true });
  }
  for (const item of iosSizes) {
    const targetPath = path.join(iosAppIconDir, item.name);
    await sharp(sourceIcon)
      .resize(item.size, item.size)
      .toFile(targetPath);
    console.log(`Generated iOS: ${item.name} (${item.size}x${item.size})`);
  }

  // Contents.json for iOS Xcode
  const contentsJson = {
    images: [
      { idiom: 'iphone', scale: '2x', size: '20x20', filename: 'AppIcon-20x20@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '20x20', filename: 'AppIcon-20x20@3x.png' },
      { idiom: 'iphone', scale: '1x', size: '29x29', filename: 'AppIcon-29x29@1x.png' },
      { idiom: 'iphone', scale: '2x', size: '29x29', filename: 'AppIcon-29x29@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '29x29', filename: 'AppIcon-29x29@3x.png' },
      { idiom: 'iphone', scale: '1x', size: '40x40', filename: 'AppIcon-40x40@1x.png' },
      { idiom: 'iphone', scale: '2x', size: '40x40', filename: 'AppIcon-40x40@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '40x40', filename: 'AppIcon-40x40@3x.png' },
      { idiom: 'iphone', scale: '2x', size: '60x60', filename: 'AppIcon-60x60@2x.png' },
      { idiom: 'iphone', scale: '3x', size: '60x60', filename: 'AppIcon-60x60@3x.png' },
      { idiom: 'ipad', scale: '1x', size: '76x76', filename: 'AppIcon-76x76@1x.png' },
      { idiom: 'ipad', scale: '2x', size: '76x76', filename: 'AppIcon-76x76@2x.png' },
      { idiom: 'ipad', scale: '2x', size: '83.5x83.5', filename: 'AppIcon-83.5x83.5@2x.png' },
      { idiom: 'ios-marketing', scale: '1x', size: '1024x1024', filename: 'AppIcon-512@2x.png' }
    ],
    info: { author: 'xcode', version: 1 }
  };
  fs.writeFileSync(path.join(iosAppIconDir, 'Contents.json'), JSON.stringify(contentsJson, null, 2));
}

async function main() {
  await generateAndroidIcons();
  await generateIosIcons();
  console.log('ALL ICONS GENERATED SUCCESSFULLY FROM member-web/public/icon.png!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
