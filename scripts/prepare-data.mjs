// Splits the 25 MB lap_times.csv into one small file per race (loaded on demand
// by the Race view) and precomputes a per-race lap summary used by the Circuit view.
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'public', 'data', 'lap_times.csv')
const outDir = join(root, 'public', 'data', 'laps')
const summaryFile = join(root, 'public', 'data', 'lap_summary.csv')

if (existsSync(summaryFile) && statSync(summaryFile).mtimeMs > statSync(src).mtimeMs) {
  console.log('[prepare-data] lap files up to date')
  process.exit(0)
}

mkdirSync(outDir, { recursive: true })

// raceId,driverId,lap,position,time,milliseconds
const lines = readFileSync(src, 'utf8').split(/\r?\n/)
const byRace = new Map()
for (let i = 1; i < lines.length; i++) {
  const line = lines[i]
  if (!line) continue
  const [raceId, driverId, lap, position, , ms] = line.split(',')
  if (!byRace.has(raceId)) byRace.set(raceId, [])
  byRace.get(raceId).push([driverId, lap, position, ms])
}

const summary = ['raceId,lapRecords,bestLapMs,bestLapDriverId,bestLapNumber,meanLapMs']
for (const [raceId, rows] of byRace) {
  writeFileSync(
    join(outDir, `${raceId}.csv`),
    'driverId,lap,position,milliseconds\n' + rows.map((r) => r.join(',')).join('\n'),
  )
  let best = null
  let sum = 0
  for (const r of rows) {
    const ms = +r[3]
    sum += ms
    if (!best || ms < +best[3]) best = r
  }
  summary.push([raceId, rows.length, best[3], best[0], best[1], Math.round(sum / rows.length)].join(','))
}
writeFileSync(summaryFile, summary.join('\n'))
console.log(`[prepare-data] wrote ${byRace.size} race lap files`)
