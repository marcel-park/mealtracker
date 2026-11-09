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

// ----- Variations -----
// A variation (only the owner gets them) lists only the ingredients it changes, with their amount
// in the variation (0: left out). Everything else is taken from the original.

export function variationOf(recipe, variationId) {
  return (recipe.variations ?? []).find((variation) => variation.id === variationId) ?? null
}

// The variation booked last, preselected when booking. null: the original.
export function lastUsedVariation(recipe) {
  return variationOf(recipe, recipe.lastUsedVariationId)
}

// The ingredients of the original (variation null) or of a variation, each with the amount of the
// original next to it (originalG, 0 for foods only the variation contains). Left-out ingredients
// stay in the list with 0 g, so the difference to the original can be shown.
export function itemsOf(recipe, variation) {
  const changed = new Map((variation?.items ?? []).map((item) => [item.food.id, item.amountG]))
  const items = recipe.items.map((item) => ({
    food: item.food,
    originalG: item.amountG,
    amountG: changed.get(item.food.id) ?? item.amountG,
  }))
  for (const item of variation?.items ?? []) {
    if (!recipe.items.some((original) => original.food.id === item.food.id)) {
      items.push({ food: item.food, originalG: 0, amountG: item.amountG })
    }
  }
  return items
}

export function servingsOf(recipe, variation) {
  return variation?.servings ?? recipe.servings
}

// One portion of what is preselected (the variation booked last, or the original):
// what the + in the search adds.
export function onePortion(recipe) {
  const variation = lastUsedVariation(recipe)
  const items = itemsOf(recipe, variation).filter((item) => item.amountG > 0)
  return scaleItems(items, 1 / servingsOf(recipe, variation))
}
