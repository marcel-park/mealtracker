import { describe, expect, it } from 'vitest'
import { CHOICE_UNIT } from './foods.js'
import {
  addQuantities,
  formatQuantity,
  portionQuantity,
  quantityDifference,
  quantityFields,
  quantityFromItem,
  quantityOfInput,
  sameQuantity,
  scaleQuantity,
  toQuantity,
  unitQuantity,
  zeroQuantity,
} from './quantities.js'

const egg = {
  id: 1,
  name: 'Ei',
  unit: 'G',
  kcalPer100: 144,
  portions: [
    { id: 10, name: 'Stück', amount: 60, favorite: true },
    { id: 11, name: 'Packung', amount: 600, favorite: false },
  ],
}
const milk = { id: 2, name: 'Milch', unit: 'ML', kcalPer100: 64, portions: [] }

describe('quantities', () => {
  it('keeps portions with two decimals and their amount in g', () => {
    expect(portionQuantity(egg, 10, 2.254)).toEqual({ amount: 135, portionId: 10, count: 2.25 })
    expect(unitQuantity(120.04)).toEqual({ amount: 120, portionId: null, count: null })
  })

  it('takes a number as an amount and drops portions the food does not have', () => {
    expect(toQuantity(egg, 50)).toEqual({ amount: 50, portionId: null, count: null })
    expect(toQuantity(egg, { amount: 120, portionId: 99, count: 2 })).toEqual({
      amount: 120,
      portionId: null,
      count: null,
    })
  })

  it('reads an item of the backend', () => {
    expect(quantityFromItem(egg, { amount: 150, portionId: 10, portionCount: 2.5 })).toEqual({
      amount: 150,
      portionId: 10,
      count: 2.5,
    })
    expect(quantityFromItem(milk, { amount: 200, portionId: null, portionCount: null })).toEqual({
      amount: 200,
      portionId: null,
      count: null,
    })
  })

  it('sends either the amount or portion and count', () => {
    expect(quantityFields(unitQuantity(200))).toEqual({ amount: 200 })
    expect(quantityFields(portionQuantity(egg, 10, 2))).toEqual({ portionId: 10, portionCount: 2 })
  })
})

describe('addQuantities', () => {
  it('adds amounts to amounts', () => {
    expect(addQuantities(egg, unitQuantity(120), portionQuantity(egg, 10, 0.5))).toEqual(unitQuantity(150))
  })

  it('adds counts of the same portion', () => {
    expect(addQuantities(egg, portionQuantity(egg, 10, 2), portionQuantity(egg, 10, 0.5))).toEqual(
      portionQuantity(egg, 10, 2.5),
    )
  })

  it('converts anything else into the portion already there', () => {
    expect(addQuantities(egg, portionQuantity(egg, 10, 2), unitQuantity(30))).toEqual(portionQuantity(egg, 10, 2.5))
    expect(addQuantities(egg, portionQuantity(egg, 11, 1), portionQuantity(egg, 10, 1))).toEqual(
      portionQuantity(egg, 11, 1.1),
    )
    // 25 g of 60 g eggs are 0,42 Stück
    expect(addQuantities(egg, portionQuantity(egg, 10, 0), unitQuantity(25)).count).toBe(0.42)
  })
})

describe('scaling and comparing', () => {
  it('scales in the unit of the quantity', () => {
    expect(scaleQuantity(egg, portionQuantity(egg, 10, 4), 0.5625)).toEqual(portionQuantity(egg, 10, 2.25))
    expect(scaleQuantity(milk, unitQuantity(500), 0.25)).toEqual(unitQuantity(125))
    expect(zeroQuantity(egg, portionQuantity(egg, 10, 3))).toEqual({ amount: 0, portionId: 10, count: 0 })
  })

  it('compares the way it is written, not only the amount', () => {
    expect(sameQuantity(portionQuantity(egg, 10, 2), portionQuantity(egg, 10, 2))).toBe(true)
    expect(sameQuantity(portionQuantity(egg, 10, 2), unitQuantity(120))).toBe(false)
  })
})

describe('formatting', () => {
  it('writes portions by name and amounts in the unit', () => {
    expect(formatQuantity(egg, portionQuantity(egg, 10, 2.25))).toBe('2,25 Stück')
    expect(formatQuantity(milk, unitQuantity(330))).toBe('330 ml')
  })

  it('writes the difference to another amount in the unit of the quantity', () => {
    expect(quantityDifference(egg, portionQuantity(egg, 11, 2), 600)).toEqual({ positive: true, text: '+1 Packung' })
    expect(quantityDifference(milk, unitQuantity(170), 200)).toMatchObject({ positive: false, text: '−30 ml' })
    expect(quantityDifference(milk, unitQuantity(200), 200)).toBeNull()
  })
})

describe('quantityOfInput', () => {
  it('reads the typed number as portions or as the unit', () => {
    expect(quantityOfInput(egg, 10, '2.5')).toEqual(portionQuantity(egg, 10, 2.5))
    expect(quantityOfInput(egg, CHOICE_UNIT, '150')).toEqual(unitQuantity(150))
  })

  it('converts an exact amount, so switching back and forth does not drift', () => {
    expect(quantityOfInput(egg, 10, '', 100)).toEqual(portionQuantity(egg, 10, 1.67))
    expect(quantityOfInput(egg, CHOICE_UNIT, '1.67', 100)).toEqual(unitQuantity(100))
  })
})
