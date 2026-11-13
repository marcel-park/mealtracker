// Daily targets for calories, carbs, protein and fat, and what is booked of them. Pure functions,
// see nutrition.test.js.
//
// The user sets a calorie target and how it splits into the three nutrients, in whole percent of
// the calories (together 100). A nutrient's target in grams is its share of the calories divided by
// the energy of one gram (the usual Atwater factors): 2000 kcal × 40 % carbs = 800 kcal = 200 g.
//
// The booked grams come from the foods (protein, carbs and fat per 100 g or ml). They do not add up
// to the booked kcal exactly: the kcal of a food are taken from its label and also include e.g.
// fibre and alcohol, which none of the three bars shows.

// Energy of one gram, in kcal.
const KCAL_PER_GRAM = { carbs: 4, protein: 4, fat: 9 }

// The three nutrients in the order they are shown, with the user fields of their share.
export const MACROS = [
  { key: 'carbs', label: 'Kohlenhydrate', percentField: 'carbsPercent' },
  { key: 'protein', label: 'Eiweiß', percentField: 'proteinPercent' },
  { key: 'fat', label: 'Fett', percentField: 'fatPercent' },
]

// Grams of a nutrient that `percent` of `calorieTarget` stand for.
export function macroTargetGrams(calorieTarget, percent, key) {
  return (calorieTarget * percent) / 100 / KCAL_PER_GRAM[key]
}

// { carbs, protein, fat } in grams, for a user (or the values typed in the profile).
export function macroTargets({ calorieTarget, carbsPercent, proteinPercent, fatPercent }) {
  const percents = { carbs: carbsPercent, protein: proteinPercent, fat: fatPercent }
  return Object.fromEntries(
    MACROS.map(({ key }) => [key, macroTargetGrams(calorieTarget, percents[key], key)]),
  )
}

// { carbs, protein, fat } in grams booked in the given meals. Each meal item carries its food,
// whose values are per 100 of its unit, like the amount.
export function bookedMacros(meals) {
  const totals = { carbs: 0, protein: 0, fat: 0 }
  for (const meal of meals) {
    for (const item of meal.items) {
      for (const { key } of MACROS) totals[key] += (item.amount * item.food[key]) / 100
    }
  }
  return totals
}

// What is left of the calorie target. Negative: that much too much.
export function remainingKcal(calorieTarget, meals) {
  return calorieTarget - meals.reduce((sum, meal) => sum + meal.kcal, 0)
}
