/**
 * generate-android-icons.js
 * 
 * Génère toutes les icônes Android à partir du icon.png PWA.
 * L'octogone est placé sur un fond blanc avec 12% de padding
 * de chaque côté pour qu'il soit entièrement visible
 * après tout masque Android (rond, squircle, carré arrondi).
 * 
 * Tailles Android :
 *  mdpi    : 48x48
 *  hdpi    : 72x72
 *  xhdpi   : 96x96
 *  xxhdpi  : 144x144
 *  xxxhdpi : 192x192
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_ICON = path.resolve(__dirname, '../member-web/public/icon.png');
const RES_DIR = path.resolve(__dirname, 'android/app/src/main/res');

// Facteur de padding : l'octogone occupe (1 - 2*PADDING) de la taille finale
// 12% de chaque côté = octogone à 76% = toujours visible dans un masque circulaire
// (un cercle inscrit dans un carré touche à 50% des bords, mais le masque Android
//  safe zone est 66% du carré, soit 33% de marge. 12% est suffisant et garde l'icône grande)
const PADDING_FACTOR = 0.10; // 10% de chaque côté

const SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// Couleur de fond — blanc pur pour correspondre au fond du PWA
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

    // Créer le fond blanc et composer le logo centré
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
      console.log(`✅ ${dir}/${name} (${size}x${size}px, logo ${logoSize}px)`);
    }
  }

  console.log('\n🎉 Toutes les icônes Android ont été générées avec l\'octogone complet!');
  console.log('👉 Reconstruire l\'APK avec: .\\gradlew.bat assembleRelease');
}

generateIcons().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
