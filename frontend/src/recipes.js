// Arithmetic for recipes. A recipe is booked as its foods: every amount is scaled by the share of
// the recipe that was eaten, so meals never reference a recipe (see RecipeService in the backend).
//
// Items are { food, amount, portionId, count, ... }: a quantity of the food (see quantities.js),
// whose amount is always in the unit of the food. Scaling keeps portions as portions.

import {
  addQuantities,
  quantityFields,
  quantityFromItem,
  scaleQuantity,
  toQuantity,
} from './quantities.js'

export { roundToOneDecimal } from './numbers.js'

export function kcalOf(food, amount) {
  return (amount * food.kcalPer100) / 100
}

// items: [{ food, amount }], each amount in the unit of its food. The total amount adds g and ml
// alike (100 ml count as 100 g), so it can serve as the weight of the dish.
export function totalsOf(items) {
  return items.reduce(
    (totals, item) => ({
      amount: totals.amount + item.amount,
      kcal: totals.kcal + kcalOf(item.food, item.amount),
    }),
    { amount: 0, kcal: 0 },
  )
}

// Which share of the recipe is booked. "portion": quantity portions of `servings`.
// "gram": quantity grams of the finished dish, which weighs weightG (cooking changes the weight,
// so it can differ from the sum of the ingredients).
export function shareOf({ unit, quantity, servings, weightG }) {
  return unit === 'portion' ? quantity / servings : quantity / weightG
}

// The items with all quantities multiplied by share (e.g. 0.25 for one of four portions): amounts
// rounded to one decimal, portion counts to two.
export function scaleItems(items, share) {
  return items.map((item) => ({ food: item.food, ...scaleQuantity(item.food, toQuantity(item.food, item), share) }))
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
// original next to it (originalAmount in g or ml, 0 for foods only the variation contains).
// Left-out ingredients stay in the list with 0, so the difference to the original can be shown.
export function itemsOf(recipe, variation) {
  const changed = new Map((variation?.items ?? []).map((item) => [item.food.id, item]))
  const items = recipe.items.map((item) => ({
    food: item.food,
    ...quantityFromItem(item.food, changed.get(item.food.id) ?? item),
    originalAmount: item.amount,
  }))
  for (const item of variation?.items ?? []) {
    if (!recipe.items.some((original) => original.food.id === item.food.id)) {
      items.push({ food: item.food, ...quantityFromItem(item.food, item), originalAmount: 0 })
    }
  }
  return items
}

// Adds foods (quantities, e.g. from the search) to items: the same food adds up in the unit of the
// item already there, a new food comes with `extra` (its originalAmount and so on).
function addItems(items, added, extra) {
  const merged = items.map((item) => ({ ...item }))
  for (const entry of added) {
    const quantity = toQuantity(entry.food, entry)
    const index = merged.findIndex((item) => item.food.id === entry.food.id)
    if (index >= 0) {
      const existing = merged[index]
      merged[index] = { ...existing, ...addQuantities(existing.food, toQuantity(existing.food, existing), quantity) }
    } else {
      merged.push({ food: entry.food, ...quantity, ...extra(quantity) })
    }
  }
  return merged
}

// Changed against the saved version: another amount, or the same written another way (portions
// instead of grams).
const isItemChanged = (item) => item.amount !== item.savedAmount || item.portionId !== item.savedPortionId

// savedAmount, savedPortionId: the item as saved in the shown version (see isItemChanged).
const withSaved = (item) => ({ ...item, savedAmount: item.amount, savedPortionId: item.portionId })

// A variation without own number of portions has as many as the original.
export function servingsOf(recipe, variation) {
  return variation?.servings ?? recipe.servings
}

// One portion of what is preselected (the variation booked last, or the original):
// what the + in the search adds.
export function onePortion(recipe) {
  const variation = lastUsedVariation(recipe)
  const items = itemsOf(recipe, variation).filter((item) => item.amount > 0)
  return scaleItems(items, 1 / servingsOf(recipe, variation))
}

// ----- State of the booking view and the recipe editor -----
// Kept here, not in App.jsx, so it can be tested without rendering (recipes.test.js).

// Same limit as the backend (RecipeRequest, VariationRequest).
const MAX_NAME_LENGTH = 100

export const UNIT_PORTION = 'portion'
export const UNIT_GRAM = 'gram'

// The recipe editor: the original (variationId null) or one of its variations. Items are
// { food, amount, originalAmount }; originalAmount is the amount in the original, which a variation is
// compared with. layer: the amount view of one item ({ type: 'amount', foodId }) or null.
export const NEW_EDITOR = {
  recipe: null,
  id: null,
  owned: true,
  variationId: null,
  name: '',
  servingsText: '1',
  weightText: '',
  published: false,
  wasPublished: false,
  items: [],
  layer: null,
}

// Foods added to the recipe editor: same food twice adds up, in the unit already there. In a
// variation, a food the original does not contain is compared with 0 g.
export function mergeEditorItems(items, added, isVariation) {
  return addItems(items, added, (quantity) => ({ originalAmount: isVariation ? 0 : quantity.amount }))
}

// The editor showing the original (variationId null) or a variation of `recipe`. Switching
// starts over from the saved values, so unsaved changes are dropped.
export function editorFor(recipe, variationId = null) {
  const variation = variationOf(recipe, variationId)
  return {
    ...NEW_EDITOR,
    recipe,
    id: recipe.id,
    owned: recipe.owned,
    variationId: variation?.id ?? null,
    name: variation ? variation.name : recipe.name,
    servingsText: String(servingsOf(recipe, variation)),
    weightText: variation?.weightG != null ? String(variation.weightG) : '',
    published: recipe.published,
    wasPublished: recipe.published,
    // as saved in the shown version, to tell what was changed (see editorChanges)
    items: itemsOf(recipe, variation).map(withSaved),
  }
}

// What was changed in the editor since the shown version was loaded. items: the ingredients or
// portions (what a variation can hold); any: anything, name and visibility included.
export function editorChanges(editor) {
  const { recipe, variationId } = editor
  if (recipe === null) return { items: true, any: true }
  const variation = variationOf(recipe, variationId)
  const savedItemCount = itemsOf(recipe, variation).length
  const items =
    editor.items.some(isItemChanged) ||
    editor.items.filter((item) => item.savedAmount !== undefined).length !== savedItemCount ||
    parseFloat(editor.servingsText) !== servingsOf(recipe, variation)
  const any =
    items ||
    editor.name !== (variation ? variation.name : recipe.name) ||
    (variation === null && editor.published !== recipe.published)
  return { items, any }
}

// What the booking view shows for the original (null) or a variation; adjustments are dropped.
// saved: the values as saved, to tell whether something was changed since (see isAdjusted).
// Items keep savedAmount and savedPortionId (as in the shown version) next to originalAmount
// (amount in the original).
export function bookingSelection(recipe, variationId) {
  const variation = variationOf(recipe, variationId)
  const servingsText = String(servingsOf(recipe, variation))
  const weightText = variation?.weightG != null ? String(variation.weightG) : null
  return {
    variationId: variation?.id ?? null,
    servingsText,
    weightText,
    items: itemsOf(recipe, variation).map(withSaved),
    saved: { servingsText, weightText },
  }
}

// State of the booking view of a recipe, kept in MealTracker so it survives the amount view and
// the dialogs. weightText null: the sum of the ingredients. layer: null, { type: 'amount', foodId },
// { type: 'saveVariation' } or { type: 'copy' }.
export function bookingFor(recipe, variationId = recipe.lastUsedVariationId) {
  return {
    recipe,
    unit: UNIT_PORTION,
    quantityText: '1',
    layer: null,
    ...bookingSelection(recipe, variationId ?? null),
  }
}

// Foods added in the booking view: same food adds up (in the unit already there), a new food was
// in neither the original nor the shown version (originalAmount and savedAmount 0), so it counts as
// a change.
export function addToBookingItems(items, added) {
  return addItems(items, added, () => ({ originalAmount: 0, savedAmount: 0, savedPortionId: null }))
}

// Changed since the shown version (original or variation) was loaded or saved. Booking is only
// possible once that is saved: as a (new) variation, or as an own copy of somebody else's recipe.
export function isAdjusted(booking) {
  const { saved } = booking
  return (
    booking.items.some(isItemChanged) ||
    parseFloat(booking.servingsText) !== parseFloat(saved.servingsText) ||
    booking.weightText !== saved.weightText
  )
}

// e.g. "Gulasch, 09.11."
export function suggestedVariationName(recipeName, date = new Date()) {
  const day = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  return `${recipeName}, ${day}`.slice(0, MAX_NAME_LENGTH)
}

// weightText null or empty: the sum of the ingredients.
export function variationRequest(name, servingsText, weightText, items) {
  const weightG = weightText === null || weightText.trim() === '' ? null : parseFloat(weightText)
  return {
    name: name.trim(),
    servings: parseFloat(servingsText),
    weightG,
    items: items.map((item) => ({ foodId: item.food.id, ...quantityFields(item) })),
  }
}

// Body of POST/PUT /api/recipes. Left-out ingredients (0) are not part of an original.
export function recipeRequest({ name, servingsText, published, items }) {
  return {
    name: name.trim(),
    servings: parseFloat(servingsText),
    published,
    items: items
      .filter((item) => item.amount > 0)
      .map((item) => ({ foodId: item.food.id, ...quantityFields(item) })),
  }
}
