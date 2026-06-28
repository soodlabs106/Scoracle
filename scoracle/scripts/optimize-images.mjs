import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const jobs = [
  { directory: 'public/team-crests', width: 96, quality: 82 },
  { directory: 'public/player-photos', width: 256, quality: 82 },
]

for (const job of jobs) {
  const files = await readdir(job.directory)

  for (const file of files.filter((name) => extname(name).toLowerCase() === '.png')) {
    const source = join(job.directory, file)
    const output = join(job.directory, `${basename(file, '.png')}.webp`)
    await sharp(source)
      .resize({ width: job.width, withoutEnlargement: true })
      .webp({ quality: job.quality })
      .toFile(output)
  }
}

console.log('Optimized Scoracle crests and player photos.')
