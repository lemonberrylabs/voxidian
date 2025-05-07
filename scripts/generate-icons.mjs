import { mkdir } from 'fs/promises'
import sharp from 'sharp'

const sizes = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512]

async function generateIcons() {
  // Ensure directories exist
  await mkdir('public/icons', { recursive: true })
  await mkdir('public/screenshots', { recursive: true })

  // Generate all icon sizes
  for (const size of sizes) {
    await sharp('public/icons/base-icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}x${size}.png`)
  }

  // Generate shortcut icon
  await sharp('public/icons/base-icon.svg').resize(96, 96).png().toFile('public/icons/new-note-96x96.png')

  // Generate example screenshots (you may want to replace these with actual app screenshots later)
  // Narrow screenshot (mobile)
  await sharp('public/icons/base-icon.svg')
    .resize(540, 720)
    .extend({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile('public/screenshots/narrow.png')

  // Wide screenshot (desktop)
  await sharp('public/icons/base-icon.svg')
    .resize(720, 540)
    .extend({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile('public/screenshots/wide.png')

  console.log('Generated all icons and screenshots!')
}

generateIcons().catch(console.error)
