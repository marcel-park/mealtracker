// The meal being put together in the app (the "draft") and what is sent to the backend.
// Pure functions, see meals.test.js.

import { roundToOneDecimal } from './recipes.js'

export const MAX_TITLE_LENGTH = 100

// e.g. "Apfel, Banane, Brot +2"
export function makeTitle(names) {
  const shown = names.slice(0, 3).join(', ')
  const hiddenCount = names.length - 3
  const title = hiddenCount > 0 ? `${shown} +${hiddenCount}` : shown
  return title.slice(0, MAX_TITLE_LENGTH)
}

// label: what the amount is added as (see NEW_DRAFT in App.jsx). Defaults to the food itself.
export function addAmount(entries, food, amountG, label = food.name) {
  if (!entries.some((entry) => entry.food.id === food.id)) {
    return [...entries, { food, amountG, baseG: 0, labels: [label] }]
  }
  return entries.map((entry) =>
    entry.food.id === food.id
      ? {
          ...entry,
          amountG: roundToOneDecimal(entry.amountG + amountG),
          labels: entry.labels.includes(label) ? entry.labels : [...entry.labels, label],
        }
      : entry,
  )
}

// A booked recipe: all its (scaled) foods, labelled with the recipe name.
export function addRecipeItems(entries, items, recipeName) {
  return items
    .filter((item) => item.amountG > 0)
    .reduce((result, item) => addAmount(result, item.food, item.amountG, recipeName), entries)
}

// Meal items only carry the kcal of their amount, so the value per 100 g is derived from it.
// A meal whose title is not the one made from its foods was booked from a recipe (or several):
// its items keep that title as their label, so it survives editing the meal.
export function entriesFromMeal(meal) {
  const titleFromFoods = makeTitle(meal.items.map((item) => item.foodName))
  const keepsTitle = meal.title !== titleFromFoods
  return meal.items.map((item) => {
    const kcalPer100g = item.amountG > 0 ? (item.kcal / item.amountG) * 100 : 0
    return {
      food: { id: item.foodId, name: item.foodName, kcalPer100g },
      amountG: item.amountG,
      baseG: item.amountG,
      labels: [keepsTitle ? meal.title : item.foodName],
    }
  })
}

// Only recipes that still have something in the meal count as booked.
export function mealRequest(entries, recipeUses = []) {
  const labels = [...new Set(entries.flatMap((entry) => entry.labels))]
  return {
    title: makeTitle(labels),
    items: entries.map((entry) => ({ foodId: entry.food.id, amountG: entry.amountG })),
    recipes: recipeUses
      .filter((use) => labels.includes(use.label))
      .map(({ recipeId, variationId }) => ({ recipeId, variationId })),
  }
}
