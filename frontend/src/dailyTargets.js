// The daily targets of the further nutrients (see NUTRIENT_GROUPS), computed from the profile:
// age (from the birth date), sex and calorie target. Not typed in by the user. Pure functions, see
// dailyTargets.test.js.
//
// Source: the DGE/ÖGE reference values for adults (Referenzwerte für die Nährstoffzufuhr,
// 3rd edition 2025, www.dge.de/wissenschaft/referenzwerte). Where the DGE gives a range
// (copper, manganese) the lower end is taken; where it depends on the diet (zinc: phytate intake)
// the value for a mixed diet ("mittlere Phytatzufuhr"). Iron for women: 16 mg before 51 years,
// 14 mg from 51 on (the DGE distinguishes before and after menopause). Sex "DIVERSE": the higher
// of the values for men and women.
//
// The fats, sugar and fibre follow the calorie target, as shares of it (see ENERGY_SHARES):
// saturated fat at most 10 %, polyunsaturated 7 %, omega-3 0.5 %, monounsaturated the rest of
// the user's fat share, sugar at most 10 % (the DGE limit is for free sugars; foods state all of
// their sugar, so this limit is the stricter one), fibre at least 30 g and 14.6 g per 1000 kcal.
// Salt: at most 6 g.
//
// Vitamin A: the DGE values are retinol activity equivalents (RAE, β-carotene / 12); the food
// data mostly states retinol equivalents (RE, β-carotene / 6), which count plant foods higher.

// Adults are grouped by age: 19 to under 25, 25 to under 51, 51 to under 65, 65 and older.
export const AGE_GROUPS = [
  { below: 25, label: '19–24 Jahre' },
  { below: 51, label: '25–50 Jahre' },
  { below: 65, label: '51–64 Jahre' },
  { below: Infinity, label: 'ab 65 Jahre' },
]

// The DGE starts its adult values at 19; younger users get those of the youngest adults.
export const ADULT_AGE = 19

// Per nutrient: [men, women], each either one value for every age group or one per age group.
const REFERENCE_VALUES = {
  VITAMIN_A: [[850, 850, 850, 800], 700],
  VITAMIN_D: [20, 20],
  VITAMIN_E: [8, 8],
  VITAMIN_K: [[70, 70, 80, 80], [60, 60, 65, 65]],
  VITAMIN_C: [110, 95],
  VITAMIN_B1: [[1.3, 1.2, 1.2, 1.1], 1.0],
  VITAMIN_B2: [[1.4, 1.4, 1.3, 1.3], [1.1, 1.1, 1.0, 1.0]],
  VITAMIN_B3: [[16, 15, 15, 14], [13, 12, 11, 11]],
  VITAMIN_B5: [5, 5],
  VITAMIN_B6: [1.6, 1.4],
  VITAMIN_B7: [40, 40],
  VITAMIN_B9: [300, 300],
  VITAMIN_B12: [4, 4],
  POTASSIUM: [4000, 4000],
  CALCIUM: [1000, 1000],
  MAGNESIUM: [350, 300],
  PHOSPHORUS: [550, 550],
  IRON: [11, [16, 16, 14, 14]],
  ZINC: [14, 8],
  IODINE: [150, 150],
  SELENIUM: [70, 60],
  COPPER: [1.0, 1.0],
  MANGANESE: [2.0, 2.0],
  SALT: [6, 6],
}

// Energy of one gram, in kcal.
const KCAL_PER_GRAM_FAT = 9
const KCAL_PER_GRAM_SUGAR = 4

// Percent of the calories.
export const ENERGY_SHARES = { SATURATED_FAT: 10, POLYUNSATURATED_FAT: 7, OMEGA_3: 0.5, SUGAR: 10 }

const FIBER_MIN = 30
const FIBER_PER_1000_KCAL = 14.6

// Full years on `today`; both as "YYYY-MM-DD". Born on 29 February: a year older on 1 March.
export function ageOn(birthDate, today) {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years
}

// Index into AGE_GROUPS.
export function ageGroupIndex(age) {
  return AGE_GROUPS.findIndex(({ below }) => age < below)
}

const valueFor = (values, group) => (Array.isArray(values) ? values[group] : values)

function referenceValue([men, women], sex, group) {
  if (sex === 'MALE') return valueFor(men, group)
  if (sex === 'FEMALE') return valueFor(women, group)
  return Math.max(valueFor(men, group), valueFor(women, group))
}

// Grams with one decimal.
const roundGrams = (grams) => Math.round(grams * 10) / 10

// Grams of fat that `percent` of the calories stand for.
const fatGrams = (calorieTarget, percent) => roundGrams((calorieTarget * percent) / 100 / KCAL_PER_GRAM_FAT)

// { targets: { VITAMIN_C: 110, ... } with every nutrient, ageGroup: index into AGE_GROUPS,
// isUnderAdultAge }, or null while birth date or sex are missing (users from before they were
// asked for). user: birthDate, sex and fatPercent of the profile. calorieTarget: the one of the
// day, which grows with the activity, like the targets of carbs, protein and fat.
export function dailyNutrientTargets({ birthDate, sex, fatPercent }, calorieTarget, today) {
  if (!birthDate || !sex) return null
  const age = ageOn(birthDate, today)
  const group = ageGroupIndex(Math.max(age, ADULT_AGE))
  const targets = Object.fromEntries(
    Object.entries(REFERENCE_VALUES).map(([key, values]) => [key, referenceValue(values, sex, group)]),
  )
  const unsaturatedPercent = ENERGY_SHARES.SATURATED_FAT + ENERGY_SHARES.POLYUNSATURATED_FAT
  Object.assign(targets, {
    FIBER: Math.max(FIBER_MIN, roundGrams((calorieTarget * FIBER_PER_1000_KCAL) / 1000)),
    SUGAR: roundGrams((calorieTarget * ENERGY_SHARES.SUGAR) / 100 / KCAL_PER_GRAM_SUGAR),
    SATURATED_FAT: fatGrams(calorieTarget, ENERGY_SHARES.SATURATED_FAT),
    POLYUNSATURATED_FAT: fatGrams(calorieTarget, ENERGY_SHARES.POLYUNSATURATED_FAT),
    OMEGA_3: fatGrams(calorieTarget, ENERGY_SHARES.OMEGA_3),
    MONOUNSATURATED_FAT: fatGrams(calorieTarget, Math.max(fatPercent - unsaturatedPercent, 0)),
  })
  return { targets, ageGroup: group, isUnderAdultAge: age < ADULT_AGE }
}
