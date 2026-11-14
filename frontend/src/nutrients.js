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
      // Niacin-Äquivalent: das Niacin des Lebensmittels plus das, was der Körper aus seinem Tryptophan
      // bildet (60 mg Tryptophan = 1 mg Niacin). So geben es der BLS und die DGE-Referenzwerte an.
      { key: 'VITAMIN_B3', label: 'Vitamin B3 (Niacin-Äquivalent)', unit: 'mg' },
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

// The nutrient profile of a food as the fields of the food form hold it, for "Nährstoffprofil
// ableiten": the unit, kcal and macros per 100 g / ml, and every optional nutrient that is stated.
// The values are copied, not referenced: a later change of the source does not reach the copy.
// Nutrients the source does not state stay empty (unknown).
export function nutrientProfileTexts(food) {
  return {
    unit: food.unit,
    kcal: String(food.kcalPer100),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    nutrients: nutrientTexts(food.nutrients),
  }
}

// Whether a nutrient field of the food form holds anything (kcal, macros, optional nutrients):
// copying a profile would replace it, so the form asks first.
export function hasTypedNutrients({ kcal, protein, carbs, fat, nutrients }) {
  return [kcal, protein, carbs, fat, ...Object.values(nutrients)].some((text) => text.trim() !== '')
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

// What the meals contain of each nutrient: { VITAMIN_C: 42.5, ... } with every key, 0 where no
// item states it. A food without a value adds nothing, it is not known.
export function bookedNutrients(meals) {
  const totals = Object.fromEntries(NUTRIENTS.map(({ key }) => [key, 0]))
  for (const meal of meals) {
    for (const item of meal.items) {
      for (const [key, amount] of Object.entries(item.food.nutrients ?? {})) {
        if (key in totals) totals[key] += (item.amount * amount) / 100
      }
    }
  }
  return totals
}

// e.g. "1.500" or "0,06", without unit
export const formatNutrientAmount = (amount) =>
  amount.toLocaleString('de-DE', { maximumFractionDigits: NUTRIENT_DECIMALS })

// e.g. "0,06 mg"
export const formatNutrient = (amount, unit) => `${formatNutrientAmount(amount)} ${unit}`
