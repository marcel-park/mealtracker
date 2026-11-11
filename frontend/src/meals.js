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

// A booked recipe: all its (scaled) foods, labelled with the recipe name (for the title) and
// marked with the recipe id in recipeIds (to know which recipes are still in the meal, see
// mealRequest; names are not unique, a food may be called like a recipe).
export function addRecipeItems(entries, items, recipeName, recipeId) {
  const booked = items.filter((item) => item.amountG > 0)
  const bookedFoodIds = new Set(booked.map((item) => item.food.id))
  return booked
    .reduce((result, item) => addAmount(result, item.food, item.amountG, recipeName), entries)
    .map((entry) => {
      const recipeIds = entry.recipeIds ?? []
      return bookedFoodIds.has(entry.food.id) && !recipeIds.includes(recipeId)
        ? { ...entry, recipeIds: [...recipeIds, recipeId] }
        : entry
    })
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

// recipeUses: [{ recipeId, variationId }] of the recipes added to the draft. Only recipes that
// still have a food in the meal count as booked (the user may have removed them again).
export function mealRequest(entries, recipeUses = []) {
  const labels = [...new Set(entries.flatMap((entry) => entry.labels))]
  return {
    title: makeTitle(labels),
    items: entries.map((entry) => ({ foodId: entry.food.id, amountG: entry.amountG })),
    recipes: recipeUses.filter((use) =>
      entries.some((entry) => (entry.recipeIds ?? []).includes(use.recipeId)),
    ),
  }
}

// The day the meal list shows, as sent to GET /api/meals?date=, e.g. "2026-11-11". Local time of
// the device: the list starts empty at midnight where the user is.
export function localDate(now) {
  const pad = (number) => String(number).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Milliseconds until the next local midnight (on DST days not always 24 h after the last one).
export function msUntilMidnight(now) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return midnight.getTime() - now.getTime()
}
