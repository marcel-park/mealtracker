// Arithmetic for recipes. A recipe is booked as its foods: every amount is scaled by the share of
// the recipe that was eaten, so meals never reference a recipe (see RecipeService in the backend).

export const roundToOneDecimal = (n) => Math.round(n * 10) / 10

export function kcalOf(food, amountG) {
  return (amountG * food.kcalPer100g) / 100
}

// items: [{ food, amountG }]
export function totalsOf(items) {
  return items.reduce(
    (totals, item) => ({
      amountG: totals.amountG + item.amountG,
      kcal: totals.kcal + kcalOf(item.food, item.amountG),
    }),
    { amountG: 0, kcal: 0 },
  )
}

// Which share of the recipe is booked. "portion": quantity portions of `servings`.
// "gram": quantity grams of the finished dish, which weighs weightG (cooking changes the weight,
// so it can differ from the sum of the ingredients).
export function shareOf({ unit, quantity, servings, weightG }) {
  return unit === 'portion' ? quantity / servings : quantity / weightG
}

export function scaleItems(items, share) {
  return items.map((item) => ({ food: item.food, amountG: roundToOneDecimal(item.amountG * share) }))
}

// The same amount of the dish in the other unit, e.g. when the unit select is switched.
export function convertQuantity({ fromUnit, quantity, servings, weightG }) {
  return fromUnit === 'portion' ? (quantity * weightG) / servings : (quantity * servings) / weightG
}

// One portion with the amounts as saved in the recipe: what the + in the search adds.
export function onePortion(recipe) {
  return scaleItems(recipe.items, 1 / recipe.servings)
}
