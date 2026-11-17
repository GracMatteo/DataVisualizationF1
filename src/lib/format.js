import { format } from 'd3'

const int = format(',')
export const fmtInt = (n) => (n == null ? 'n/d' : int(n).replace(/,/g, ' '))
export const fmtCompact = (n) => (n >= 1000 ? format('.2~s')(n).replace('k', 'K') : String(n))
export const fmtPct = (n) => (n == null || !Number.isFinite(n) ? 'n/d' : `${(n * 100).toFixed(1).replace('.', ',')} %`)
export const fmtPoints = (n) => (n == null ? 'n/d' : Number.isInteger(n) ? fmtInt(n) : String(n).replace('.', ','))

// 83452 -> "1:23.452"
export function fmtLap(ms) {
  if (ms == null) return 'n/d'
  const m = Math.floor(ms / 60000)
  const s = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : `${(ms / 1000).toFixed(3)} s`
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
export const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : 'n/d')
