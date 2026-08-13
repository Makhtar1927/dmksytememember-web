/**
 * generate-android-icons.cjs
 * 
 * Génère toutes les icônes Android à partir du icon.png PWA.
 * L'octogone est placé sur un fond blanc avec du padding
 * pour qu'il soit entièrement visible et ne soit JAMAIS coupé
 * par les masques Android (rond, squircle, etc.).
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_ICON = path.resolve(__dirname, '../member-web/public/icon.png');
const RES_DIR = path.resolve(__dirname, 'android/app/src/main/res');

// Marge de 18% pour la zone de sécurité Adaptive Icon Android
// (La zone "safe" d'Android Adaptive Icon est un cercle central de 66% de l'image)
const PADDING_FACTOR = 0.17; 

const SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const BG_COLOR = { r: 255, g: 255, b: 255, alpha: 1 };

async function generateIcons() {
  console.log('📦 Source icon:', SOURCE_ICON);
  
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error('❌ Source icon not found:', SOURCE_ICON);
    process.exit(1);
  }

  for (const { dir, size } of SIZES) {
    const logoSize = Math.round(size * (1 - 2 * PADDING_FACTOR));
    const padding = Math.round((size - logoSize) / 2);

    // Créer le logo redimensionné
    const logoBuffer = await sharp(SOURCE_ICON)
      .resize(logoSize, logoSize, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();

    // Fond blanc + composition du logo centré
    const iconBuffer = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BG_COLOR,
      }
    })
      .composite([{
        input: logoBuffer,
        top: padding,
        left: padding,
      }])
      .png()
      .toBuffer();

    const outDir = path.join(RES_DIR, dir);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const names = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'];
    for (const name of names) {
      const outPath = path.join(outDir, name);
      fs.writeFileSync(outPath, iconBuffer);
      console.log(`✅ ${dir}/${name} (${size}x${size}px, octogone ${logoSize}px)`);
    }
  }

  // Également mettre à jour le fond xml background pour qu'il soit blanc
  const colorXmlPath = path.join(RES_DIR, 'values/ic_launcher_background.xml');
  const colorsXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>`;
  fs.writeFileSync(colorXmlPath, colorsXmlContent);
  console.log('✅ values/ic_launcher_background.xml (fond blanc #FFFFFF)');

  console.log('\n🎉 Icônes générées avec succès !');
}

generateIcons().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
