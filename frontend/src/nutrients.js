// The optional nutrients of a food besides kcal, protein, carbs and fat, and the user's daily
// target for each. Keys as the backend names them (enum Nutrient); the units are fixed, as on
// nutrition labels. A food states them per 100 g or 100 ml; only stated ones are sent and stored,
// a missing one is unknown, not 0.

// Typed with up to two decimals, e.g. "0,06 mg" thiamine or "0,5 µg" vitamin B12.
export const NUTRIENT_DECIMALS = 2
export const NUTRIENT_MAX_DIGITS = 5

// limit: the daily value is an upper limit, not a target to reach.
export const NUTRIENT_GROUPS = [
  {
    title: 'Makronährstoffe',
    nutrients: [
      { key: 'FIBER', label: 'Ballaststoffe', unit: 'g' },
      { key: 'SUGAR', label: 'Zucker', unit: 'g', limit: true },
      { key: 'SATURATED_FAT', label: 'Gesättigte Fettsäuren', unit: 'g', limit: true },
      { key: 'MONOUNSATURATED_FAT', label: 'Einfach ungesättigte Fettsäuren', unit: 'g' },
      { key: 'POLYUNSATURATED_FAT', label: 'Mehrfach ungesättigte Fettsäuren', unit: 'g' },
      { key: 'OMEGA_3', label: 'davon Omega-3', unit: 'g' },
      { key: 'SALT', label: 'Salz', unit: 'g', limit: true },
    ],
  },
  {
    title: 'Vitamine',
    nutrients: [
      { key: 'VITAMIN_A', label: 'Vitamin A', unit: 'µg' },
      { key: 'VITAMIN_D', label: 'Vitamin D', unit: 'µg' },
      { key: 'VITAMIN_E', label: 'Vitamin E', unit: 'mg' },
      { key: 'VITAMIN_K', label: 'Vitamin K', unit: 'µg' },
      { key: 'VITAMIN_C', label: 'Vitamin C', unit: 'mg' },
      { key: 'VITAMIN_B1', label: 'Vitamin B1 (Thiamin)', unit: 'mg' },
      { key: 'VITAMIN_B2', label: 'Vitamin B2 (Riboflavin)', unit: 'mg' },
      { key: 'VITAMIN_B3', label: 'Vitamin B3 (Niacin)', unit: 'mg' },
      { key: 'VITAMIN_B5', label: 'Vitamin B5 (Pantothensäure)', unit: 'mg' },
      { key: 'VITAMIN_B6', label: 'Vitamin B6', unit: 'mg' },
      { key: 'VITAMIN_B7', label: 'Vitamin B7 (Biotin)', unit: 'µg' },
      { key: 'VITAMIN_B9', label: 'Vitamin B9 (Folat)', unit: 'µg' },
      { key: 'VITAMIN_B12', label: 'Vitamin B12', unit: 'µg' },
    ],
  },
  {
    title: 'Mineralstoffe',
    nutrients: [
      { key: 'POTASSIUM', label: 'Kalium', unit: 'mg' },
      { key: 'CALCIUM', label: 'Calcium', unit: 'mg' },
      { key: 'MAGNESIUM', label: 'Magnesium', unit: 'mg' },
      { key: 'PHOSPHORUS', label: 'Phosphor', unit: 'mg' },
    ],
  },
  {
    title: 'Spurenelemente',
    nutrients: [
      { key: 'IRON', label: 'Eisen', unit: 'mg' },
      { key: 'ZINC', label: 'Zink', unit: 'mg' },
      { key: 'IODINE', label: 'Jod', unit: 'µg' },
      { key: 'SELENIUM', label: 'Selen', unit: 'µg' },
      { key: 'COPPER', label: 'Kupfer', unit: 'mg' },
      { key: 'MANGANESE', label: 'Mangan', unit: 'mg' },
    ],
  },
]

export const NUTRIENTS = NUTRIENT_GROUPS.flatMap((group) => group.nutrients)

// Stored amounts as the texts of the fields: { VITAMIN_C: "12,5" }, unknown ones left out.
export function nutrientTexts(amounts) {
  return Object.fromEntries(
    Object.entries(amounts ?? {}).map(([key, amount]) => [key, String(amount).replace('.', ',')]),
  )
}

// The typed texts as amounts for the backend, empty fields left out. invalid: keys whose text is
// no number (a trailing comma) or below min (0 for foods; daily targets must be above 0).
export function nutrientAmounts(texts, { allowZero = true } = {}) {
  const amounts = {}
  const invalid = []
  for (const { key } of NUTRIENTS) {
    const text = (texts[key] ?? '').trim()
    if (text === '') continue
    const amount = text.endsWith(',') ? NaN : Number(text.replace(',', '.'))
    if (Number.isNaN(amount) || amount < 0 || (!allowZero && amount === 0)) invalid.push(key)
    else amounts[key] = amount
  }
  return { amounts, invalid }
}

// Whether two sets of amounts are the same; undefined counts as none.
export function sameNutrientAmounts(a, b) {
  const first = a ?? {}
  const second = b ?? {}
  return NUTRIENTS.every(({ key }) => first[key] === second[key])
}

// What a part exceeds, as the backend checks it (FoodRequest): sugar the carbs, each fatty acid
// the fat, omega-3 the polyunsaturated fat (or the fat, if that is unknown). Each part on its own:
// labels round every value, so the fatty acids may add up to a bit more than the fat. A missing
// value (undefined, or NaN while typing) compares as false, so it is never reported.
export function nutrientPartProblems({ carbs, fat, nutrients }) {
  const polyunsaturated = nutrients.POLYUNSATURATED_FAT
  const parts = [
    ['SUGAR', carbs, 'Zucker ist mehr als die Kohlenhydrate.'],
    ['SATURATED_FAT', fat, 'Gesättigte Fettsäuren sind mehr als das Fett.'],
    ['MONOUNSATURATED_FAT', fat, 'Einfach ungesättigte Fettsäuren sind mehr als das Fett.'],
    ['POLYUNSATURATED_FAT', fat, 'Mehrfach ungesättigte Fettsäuren sind mehr als das Fett.'],
    polyunsaturated === undefined
      ? ['OMEGA_3', fat, 'Omega-3 ist mehr als das Fett.']
      : ['OMEGA_3', polyunsaturated, 'Omega-3 ist mehr als die mehrfach ungesättigten Fettsäuren.'],
  ]
  return parts
    .filter(([key, whole]) => nutrients[key] > whole)
    .map(([, , message]) => message)
}

// The groups with only the nutrients that have an amount, empty groups left out.
export function statedNutrientGroups(amounts) {
  return NUTRIENT_GROUPS.map((group) => ({
    ...group,
    nutrients: group.nutrients.filter(({ key }) => amounts?.[key] !== undefined),
  })).filter((group) => group.nutrients.length > 0)
}

// e.g. "0,06 mg"
export const formatNutrient = (amount, unit) =>
  `${amount.toLocaleString('de-DE', { maximumFractionDigits: NUTRIENT_DECIMALS })} ${unit}`
