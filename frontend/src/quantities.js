// How much of a food an item holds. Pure functions, see quantities.test.js.
//
// A quantity is { amount, portionId, count }: amount is always in the unit of the food (g or ml),
// so kcal and totals never need to know about portions. Booked as portions, portionId is one of
// the food's portions and count how many of it (two decimals); the amount is then count × the
// portion's amount. Booked in the unit itself, portionId and count are null. The backend keeps
// the same distinction (Quantity.java) and sends both: the amount, and portion and count.

import { CHOICE_UNIT, formatAmount, quantityFor, unitSymbol } from './foods.js'
import { formatDecimal, roundCount, roundToOneDecimal } from './numbers.js'

export function portionById(food, portionId) {
  return (food.portions ?? []).find((portion) => portion.id === portionId) ?? null
}

export function unitQuantity(amount) {
  return { amount: roundToOneDecimal(amount), portionId: null, count: null }
}

// count of the portion; a portion the food does not have (any more) falls back to nothing.
export function portionQuantity(food, portionId, count) {
  const portion = portionById(food, portionId)
  if (!portion) return unitQuantity(0)
  const rounded = roundCount(count)
  return { amount: rounded * portion.amount, portionId, count: rounded }
}

// A number is an amount in g or ml; anything else is taken as a quantity (or an item carrying
// one). A portion the food no longer has turns into its amount.
export function toQuantity(food, value) {
  if (typeof value === 'number') return unitQuantity(value)
  const { amount, portionId = null, count = null } = value
  if (portionId !== null && portionById(food, portionId)) return portionQuantity(food, portionId, count)
  return { amount, portionId: null, count: null }
}

// An item as the backend sends it: amount, portionId, portionCount.
export function quantityFromItem(food, item) {
  return toQuantity(food, { amount: item.amount, portionId: item.portionId ?? null, count: item.portionCount })
}

// What the amount view (FoodDetail) stands for: the typed number of the chosen portion, or of the
// unit itself. exactAmount: the amount in g or ml the shown number was converted from (null once
// something was typed), so switching back and forth does not drift.
export function quantityOfInput(food, choice, quantityText, exactAmount = null) {
  if (choice === CHOICE_UNIT) return unitQuantity(exactAmount ?? parseFloat(quantityText))
  const count = exactAmount !== null ? quantityFor(food, choice, exactAmount) : parseFloat(quantityText)
  return portionQuantity(food, choice, count)
}

// The fields of a quantity for a request: { amount } or { portionId, portionCount }.
export function quantityFields(quantity) {
  return quantity.portionId == null
    ? { amount: quantity.amount }
    : { portionId: quantity.portionId, portionCount: quantity.count }
}

// What is already there plus what is added, in the unit of what is already there: amounts add up,
// portions add their counts, and anything else is converted into that portion (2 Stück + 30 g of
// 60 g eggs are 2,5 Stück).
export function addQuantities(food, existing, added) {
  if (existing.portionId == null) return unitQuantity(existing.amount + added.amount)
  if (added.portionId === existing.portionId) {
    return portionQuantity(food, existing.portionId, existing.count + added.count)
  }
  const portion = portionById(food, existing.portionId)
  return portionQuantity(food, existing.portionId, existing.count + added.amount / portion.amount)
}

// share of a quantity (e.g. 0.25 for one of four servings), staying in its unit.
export function scaleQuantity(food, quantity, share) {
  return quantity.portionId == null
    ? unitQuantity(quantity.amount * share)
    : portionQuantity(food, quantity.portionId, quantity.count * share)
}

// Nothing of it, in the same unit: a left-out ingredient of a variation.
export function zeroQuantity(food, quantity) {
  return scaleQuantity(food, quantity, 0)
}

// Same amount written the same way.
export function sameQuantity(a, b) {
  return a.portionId === b.portionId && (a.portionId == null ? a.amount === b.amount : a.count === b.count)
}

// e.g. "2,25 Stück" or "150 g"
export function formatQuantity(food, quantity) {
  const portion = quantity.portionId == null ? null : portionById(food, quantity.portionId)
  if (!portion) return formatAmount(quantity.amount, food.unit)
  return `${formatDecimal(roundCount(quantity.count))} ${portion.name}`
}

// The difference of a quantity to another amount in g or ml (the original, or what was booked
// before), in the unit of the quantity: "+0,5 Stück", "−30 g". null when there is none.
export function quantityDifference(food, quantity, otherAmount) {
  const portion = quantity.portionId == null ? null : portionById(food, quantity.portionId)
  const difference = portion
    ? roundCount((quantity.amount - otherAmount) / portion.amount)
    : roundToOneDecimal(quantity.amount - otherAmount)
  if (difference === 0) return null
  const sign = difference > 0 ? '+' : '−'
  const size = formatDecimal(Math.abs(difference))
  return {
    positive: difference > 0,
    text: portion ? `${sign}${size} ${portion.name}` : `${sign}${size} ${unitSymbol(food.unit)}`,
  }
}
