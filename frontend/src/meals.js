// The meal being put together in the app (the "draft") and what is sent to the backend.
// Pure functions, see meals.test.js.

import { addQuantities, quantityFields, quantityFromItem, toQuantity } from './quantities.js'

export const MAX_TITLE_LENGTH = 100

// e.g. "Apfel, Banane, Brot +2"
export function makeTitle(names) {
  const shown = names.slice(0, 3).join(', ')
  const hiddenCount = names.length - 3
  const title = hiddenCount > 0 ? `${shown} +${hiddenCount}` : shown
  return title.slice(0, MAX_TITLE_LENGTH)
}

// Entries are { food, amount, portionId, count, baseAmount, labels }: a quantity of the food (see
// quantities.js), the amount booked before editing started (baseAmount, to show what was added),
// and the names the meal title is made of.
//
// quantity: what is added, a quantity or an amount in g or ml. The same food again is added to
// its entry, in the unit of that entry (2 Stück + 30 g = 2,5 Stück). label: what the amount is
// added as (see NEW_DRAFT in App.jsx). Defaults to the food itself.
export function addAmount(entries, food, quantity, label = food.name) {
  const added = toQuantity(food, quantity)
  if (!entries.some((entry) => entry.food.id === food.id)) {
    return [...entries, { food, ...added, baseAmount: 0, labels: [label] }]
  }
  return entries.map((entry) =>
    entry.food.id === food.id
      ? {
          ...entry,
          ...addQuantities(food, toQuantity(food, entry), added),
          labels: entry.labels.includes(label) ? entry.labels : [...entry.labels, label],
        }
      : entry,
  )
}

// A booked recipe: all its (scaled) foods, labelled with the recipe name (for the title) and
// marked with the recipe id in recipeIds (to know which recipes are still in the meal, see
// mealRequest; names are not unique, a food may be called like a recipe).
export function addRecipeItems(entries, items, recipeName, recipeId) {
  const booked = items.filter((item) => item.amount > 0)
  const bookedFoodIds = new Set(booked.map((item) => item.food.id))
  return booked
    .reduce((result, item) => addAmount(result, item.food, item, recipeName), entries)
    .map((entry) => {
      const recipeIds = entry.recipeIds ?? []
      return bookedFoodIds.has(entry.food.id) && !recipeIds.includes(recipeId)
        ? { ...entry, recipeIds: [...recipeIds, recipeId] }
        : entry
    })
}

// Meal items carry their whole food (unit and portions included), so an amount can be changed
// the same way as when booking. A meal whose title is not the one made from its foods was booked
// from a recipe (or several): its items keep that title as their label, so it survives editing
// the meal.
export function entriesFromMeal(meal) {
  const titleFromFoods = makeTitle(meal.items.map((item) => item.food.name))
  const keepsTitle = meal.title !== titleFromFoods
  return meal.items.map((item) => ({
    food: item.food,
    ...quantityFromItem(item.food, item),
    baseAmount: item.amount,
    labels: [keepsTitle ? meal.title : item.food.name],
  }))
}

// recipeUses: [{ recipeId, variationId }] of the recipes added to the draft. Only recipes that
// still have a food in the meal count as booked (the user may have removed them again).
export function mealRequest(entries, recipeUses = []) {
  const labels = [...new Set(entries.flatMap((entry) => entry.labels))]
  return {
    title: makeTitle(labels),
    items: entries.map((entry) => ({ foodId: entry.food.id, ...quantityFields(entry) })),
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
