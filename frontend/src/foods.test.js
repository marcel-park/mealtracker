import { describe, expect, it } from 'vitest'
import {
  CHOICE_UNIT,
  amountChoices,
  amountOf,
  quantityFor,
  draftPortions,
  formatAmount,
  initialAmountInput,
  isPortionNameTaken,
  portionRequests,
  quickAdd,
  removePortion,
  savePortion,
  setFavoritePortion,
} from './foods.js'

// As the backend sends them: the favorite first, the others in the order they were added.
const quark = {
  id: 1,
  name: 'Magerquark',
  unit: 'G',
  kcalPer100: 67,
  portions: [
    { id: 12, name: 'Packung', amount: 250, favorite: true },
    { id: 10, name: 'Löffel', amount: 15, favorite: false },
    { id: 11, name: 'Becher', amount: 500, favorite: false },
  ],
}
const beer = { id: 2, name: 'Bier', unit: 'ML', kcalPer100: 42, portions: [] }

describe('formatAmount', () => {
  it('writes the amount in the unit of the food', () => {
    expect(formatAmount(250, 'G')).toBe('250 g')
    expect(formatAmount(330.04, 'ML')).toBe('330 ml')
    expect(formatAmount(12.5, 'G')).toBe('12,5 g')
  })
})

describe('quickAdd', () => {
  it('books one default portion', () => {
    expect(quickAdd(quark)).toEqual({ amount: 250, label: 'Packung (250 g)' })
  })

  it('books 100 g or ml without portions', () => {
    expect(quickAdd(beer)).toEqual({ amount: 100, label: '100 ml' })
  })
})

describe('amountChoices', () => {
  it('offers the portions in their order, then the unit itself', () => {
    expect(amountChoices(quark).map((choice) => choice.label)).toEqual([
      'Packung (250 g)',
      'Löffel (15 g)',
      'Becher (500 g)',
      'Gramm',
    ])
    expect(amountChoices(beer)).toEqual([{ value: CHOICE_UNIT, label: 'Milliliter' }])
  })
})

describe('initialAmountInput', () => {
  it('starts with one default portion', () => {
    expect(initialAmountInput(quark)).toEqual({ choice: 12, quantityText: '1' })
  })

  it('starts with 100 in the unit without portions, or when asked for the unit', () => {
    expect(initialAmountInput(beer)).toEqual({ choice: CHOICE_UNIT, quantityText: '100' })
    expect(initialAmountInput(quark, { asUnit: true })).toEqual({ choice: CHOICE_UNIT, quantityText: '100' })
  })

  it('shows a given amount in the unit, e.g. when an amount is changed', () => {
    expect(initialAmountInput(quark, { asUnit: true, amount: 312.54 })).toEqual({
      choice: CHOICE_UNIT,
      quantityText: '312.5',
    })
  })
})

describe('amountOf', () => {
  it('multiplies a number of portions by their amount', () => {
    expect(amountOf(quark, 12, 2)).toBe(500)
    expect(amountOf(quark, CHOICE_UNIT, 80)).toBe(80)
  })

  it('is NaN for a portion the food does not have', () => {
    expect(amountOf(quark, 99, 1)).toBeNaN()
  })
})

describe('quantityFor', () => {
  it('shows an amount as a number of portions or in the unit', () => {
    expect(quantityFor(quark, CHOICE_UNIT, 500)).toBe(500)
    expect(quantityFor(quark, 12, 400)).toBe(1.6)
    expect(quantityFor(quark, 10, 500)).toBe(33.33)
    expect(quantityFor(quark, CHOICE_UNIT, 99.96)).toBe(100)
  })
})

describe('editing portions', () => {
  it('restores the order in which the portions were added, favorite first', () => {
    const drafts = draftPortions(quark)
    expect(drafts.map((portion) => [portion.name, portion.order])).toEqual([
      ['Packung', 2],
      ['Löffel', 0],
      ['Becher', 1],
    ])
  })

  it('makes the first portion of a food its favorite and adds others behind it', () => {
    let portions = savePortion([], { key: 'a', name: ' Flasche ', amount: 500 })
    portions = savePortion(portions, { key: 'b', name: 'Dose', amount: 330 })
    expect(portions.map((portion) => [portion.name, portion.favorite])).toEqual([
      ['Flasche', true],
      ['Dose', false],
    ])
  })

  it('changes a portion in place', () => {
    const portions = savePortion(draftPortions(quark), { key: 'saved-10', name: 'Esslöffel', amount: 20 })
    expect(portions[1]).toMatchObject({ id: 10, name: 'Esslöffel', amount: 20, favorite: false })
  })

  it('moves a new favorite to the top and the old one back to its place', () => {
    const portions = setFavoritePortion(draftPortions(quark), 'saved-11')
    expect(portions.map((portion) => [portion.name, portion.favorite])).toEqual([
      ['Becher', true],
      ['Löffel', false],
      ['Packung', false],
    ])
  })

  it('gives the favorite to the oldest portion when the favorite is removed', () => {
    const portions = removePortion(draftPortions(quark), 'saved-12')
    expect(portions.map((portion) => [portion.name, portion.favorite])).toEqual([
      ['Löffel', true],
      ['Becher', false],
    ])
    expect(removePortion(portions, 'saved-10').map((portion) => portion.favorite)).toEqual([true])
    expect(removePortion(removePortion(portions, 'saved-10'), 'saved-11')).toEqual([])
  })

  it('finds names already taken, ignoring case, accents and spaces', () => {
    const portions = draftPortions(quark)
    expect(isPortionNameTaken(portions, ' packung')).toBe(true)
    expect(isPortionNameTaken(portions, 'Löffel')).toBe(true)
    expect(isPortionNameTaken(portions, 'LOFFEL')).toBe(true)
    expect(isPortionNameTaken(portions, 'Packung', 'saved-12')).toBe(false)
    expect(isPortionNameTaken(portions, 'Glas')).toBe(false)
  })

  it('sends id, name, amount and favorite', () => {
    const portions = savePortion(draftPortions(beer), { key: 'new-1', name: 'Flasche', amount: 500 })
    expect(portionRequests(portions)).toEqual([{ id: null, name: 'Flasche', amount: 500, favorite: true }])
  })
})
