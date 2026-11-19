/** Canonical country key and French label. The CSV is not rewritten. */
const COUNTRY_LABELS = Object.freeze({
  Argentina: ['argentina', 'Argentine'],
  Australia: ['australia', 'Australie'],
  Austria: ['austria', 'Autriche'],
  Azerbaijan: ['azerbaijan', 'Azerbaïdjan'],
  Bahrain: ['bahrain', 'Bahreïn'],
  Belgium: ['belgium', 'Belgique'],
  Brazil: ['brazil', 'Brésil'],
  Canada: ['canada', 'Canada'],
  China: ['china', 'Chine'],
  France: ['france', 'France'],
  Germany: ['germany', 'Allemagne'],
  Hungary: ['hungary', 'Hongrie'],
  India: ['india', 'Inde'],
  Italy: ['italy', 'Italie'],
  Japan: ['japan', 'Japon'],
  Korea: ['korea', 'Corée'],
  Malaysia: ['malaysia', 'Malaisie'],
  Mexico: ['mexico', 'Mexique'],
  Monaco: ['monaco', 'Monaco'],
  Morocco: ['morocco', 'Maroc'],
  Netherlands: ['netherlands', 'Pays-Bas'],
  Portugal: ['portugal', 'Portugal'],
  Qatar: ['qatar', 'Qatar'],
  Russia: ['russia', 'Russie'],
  'Saudi Arabia': ['saudi-arabia', 'Arabie saoudite'],
  Singapore: ['singapore', 'Singapour'],
  'South Africa': ['south-africa', 'Afrique du Sud'],
  Spain: ['spain', 'Espagne'],
  Sweden: ['sweden', 'Suède'],
  Switzerland: ['switzerland', 'Suisse'],
  Turkey: ['turkey', 'Turquie'],
  UAE: ['uae', 'Émirats arabes unis'],
  UK: ['uk', 'Royaume-Uni'],
  USA: ['united-states', 'États-Unis'],
  'United States': ['united-states', 'États-Unis'],
});

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** One identity for empty countries, and one shared identity for USA / United States. */
export function countryIdentity(country) {
  const text = country == null ? '' : String(country).trim();
  if (!text) return { key: 'unknown', label: 'Pays non enregistré' };
  const known = COUNTRY_LABELS[text];
  if (known) return { key: known[0], label: known[1] };
  return { key: `other:${slug(text) || 'blank'}`, label: text };
}
