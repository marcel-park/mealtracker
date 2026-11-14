// Units and portions of foods. Pure functions, see foods.test.js.
//
// Every amount of a food is in its unit (g or ml), and so are the amounts of its portions. Items can
// be booked as a number of portions ("2 Packung"), see quantities.js. The backend lists the portions
// of a food favorite first, then in the order they were added, so the first portion is the default
// when booking.

import { roundToOneDecimal } from './numbers.js'

// The unit of a food, as the backend names it. (Not to be confused with the units of the recipe
// booking, UNIT_PORTION and UNIT_GRAM in recipes.js.)
export const FOOD_UNIT_G = 'G'
export const FOOD_UNIT_ML = 'ML'

// Same limit as the backend (FoodPortion.MAX_NAME_LENGTH). It keeps "Name (1000 ml) · 1234 kcal"
// in one line of a search row even on a 360 px wide phone, see FoodSearchRow.
export const MAX_PORTION_NAME_LENGTH = 20

// Amount booked without a portion, and preset when the amount is typed in g or ml.
export const DEFAULT_AMOUNT = 100

// Value of the unit itself (g or ml) in the choice next to the amount, see amountChoices. Portions
// use their id as value; ids are numbers, so this cannot clash.
export const CHOICE_UNIT = 'unit'

// "g" or "ml"
export function unitSymbol(unit) {
  return unit === FOOD_UNIT_ML ? 'ml' : 'g'
}

// "Gramm" or "Milliliter", where the unit stands on its own (the choice next to an amount).
export function unitName(unit) {
  return unit === FOOD_UNIT_ML ? 'Milliliter' : 'Gramm'
}

// e.g. "250 g" or "330 ml". Amounts always stay in the unit of the food (no "0,33 l").
export function formatAmount(amount, unit) {
  return `${roundToOneDecimal(amount).toLocaleString('de-DE')} ${unitSymbol(unit)}`
}

// e.g. "Packung (250 g)"
export function portionLabel(portion, unit) {
  return `${portion.name} (${formatAmount(portion.amount, unit)})`
}

// The portion offered first when booking, or null for a food without portions.
export function defaultPortion(food) {
  return food.portions?.[0] ?? null
}

// What one tap on "+" in the search books: one default portion, or 100 g / ml, as a quantity (see
// quantities.js). label: e.g. "Packung (250 g)" or "100 g".
export function quickAdd(food) {
  const portion = defaultPortion(food)
  return portion
    ? { amount: portion.amount, portionId: portion.id, count: 1, label: portionLabel(portion, food.unit) }
    : { amount: DEFAULT_AMOUNT, portionId: null, count: null, label: formatAmount(DEFAULT_AMOUNT, food.unit) }
}

// The options next to the amount field: the portions of the food, then the unit itself. Portions
// by name only, the select is narrow; whoever needs the amount there puts it into the name.
export function amountChoices(food) {
  return [
    ...(food.portions ?? []).map((portion) => ({ value: portion.id, label: portion.name })),
    { value: CHOICE_UNIT, label: unitName(food.unit) },
  ]
}

// How the amount view starts: a number of the default portion (or 100 g / ml without one), the
// unit itself (asUnit: the scale button), or an existing quantity as it was booked (quantity, see
// quantities.js: its portion and count, or its amount).
export function initialAmountInput(food, { asUnit = false, amount = DEFAULT_AMOUNT, quantity = null } = {}) {
  if (quantity) {
    const booked = (food.portions ?? []).some((portion) => portion.id === quantity.portionId)
    return booked
      ? { choice: quantity.portionId, quantityText: String(quantity.count) }
      : { choice: CHOICE_UNIT, quantityText: String(roundToOneDecimal(quantity.amount)) }
  }
  const portion = asUnit ? null : defaultPortion(food)
  return portion
    ? { choice: portion.id, quantityText: '1' }
    : { choice: CHOICE_UNIT, quantityText: String(roundToOneDecimal(amount)) }
}

// The amount in g or ml that `quantity` of `choice` stands for. NaN for an unknown portion.
export function amountOf(food, choice, quantity) {
  if (choice === CHOICE_UNIT) return quantity
  const portion = (food.portions ?? []).find((other) => other.id === choice)
  return portion ? quantity * portion.amount : NaN
}

// How an amount in g or ml is shown as a quantity of `choice`, e.g. 500 g as 2 of "Packung
// (250 g)". Portions get up to two decimals (1,25 Packungen), g and ml one. Only for showing:
// the amount view keeps the exact amount, so switching back and forth does not change it.
export function quantityFor(food, choice, amount) {
  if (choice === CHOICE_UNIT) return roundToOneDecimal(amount)
  return Math.round((amount / amountOf(food, choice, 1)) * 100) / 100
}

// ----- Editing the portions of a food (FoodForm) -----
// Draft portions are { key, id, name, amount, favorite, order }. key identifies a draft portion in
// the form (new ones have no id yet), order is the position in which it was added. Lists are
// always kept sorted like the backend sorts them: favorite first, then by order.

const byFavoriteThenOrder = (a, b) => Number(b.favorite) - Number(a.favorite) || a.order - b.order

// The portions of a saved food as drafts. The backend sends the favorite first, the rest in the
// order they were added; ordering by id restores the order of all of them.
export function draftPortions(food) {
  return [...(food.portions ?? [])]
    .sort((a, b) => a.id - b.id)
    .map((portion, index) => ({ ...portion, key: `saved-${portion.id}`, order: index }))
    .sort(byFavoriteThenOrder)
}

// A portion name as the backend compares it (FoodService.comparableName): trimmed, without
// accents, in lower case.
const comparableName = (name) => name.trim().normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()

// A name already used by another portion of the food, ignoring case and accents as the backend
// and the database do ("Gläs" is taken by "Glas").
export function isPortionNameTaken(portions, name, exceptKey = null) {
  const wanted = comparableName(name)
  return portions.some((portion) => portion.key !== exceptKey && comparableName(portion.name) === wanted)
}

// Adds a new portion, or changes the one with the same key. The first portion of a food becomes
// its favorite.
export function savePortion(portions, { key, name, amount }) {
  const existing = portions.find((portion) => portion.key === key)
  if (existing) {
    return portions.map((portion) =>
      portion.key === key ? { ...portion, name: name.trim(), amount } : portion,
    )
  }
  const order = Math.max(-1, ...portions.map((portion) => portion.order)) + 1
  const added = { key, id: null, name: name.trim(), amount, favorite: portions.length === 0, order }
  return [...portions, added].sort(byFavoriteThenOrder)
}

// Makes a portion the favorite: it moves to the top, the previous favorite back to its place.
export function setFavoritePortion(portions, key) {
  return portions
    .map((portion) => ({ ...portion, favorite: portion.key === key }))
    .sort(byFavoriteThenOrder)
}

// Removes a portion. Without the removed favorite, the oldest remaining portion becomes it, as the
// backend would decide as well.
export function removePortion(portions, key) {
  const rest = portions.filter((portion) => portion.key !== key)
  if (rest.length === 0 || rest.some((portion) => portion.favorite)) return rest
  const oldest = rest.reduce((a, b) => (b.order < a.order ? b : a))
  return setFavoritePortion(rest, oldest.key)
}

// The portions as the backend expects them in a FoodRequest.
export function portionRequests(portions) {
  return portions.map(({ id, name, amount, favorite }) => ({ id, name, amount, favorite }))
}
