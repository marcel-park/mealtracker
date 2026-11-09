import { describe, expect, it } from 'vitest'
import {
  NEW_EDITOR,
  UNIT_GRAM,
  UNIT_PORTION,
  bookingFor,
  convertQuantity,
  editorChanges,
  editorFor,
  isAdjusted,
  itemsOf,
  kcalOf,
  lastUsedVariation,
  mergeEditorItems,
  onePortion,
  recipeRequest,
  roundToOneDecimal,
  scaleItems,
  servingsOf,
  shareOf,
  suggestedVariationName,
  totalsOf,
  variationOf,
  variationRequest,
} from './recipes.js'

// ---------- test data ----------

const beans = { id: 1, name: 'Kidneybohnen', kcalPer100g: 100 }
const tomatoes = { id: 2, name: 'Tomaten', kcalPer100g: 20 }
const mince = { id: 3, name: 'Rinderhack', kcalPer100g: 250 }
const rice = { id: 4, name: 'Reis', kcalPer100g: 350 }

// Original: 400 g beans, 500 g tomatoes, 4 portions. Variation 7: 600 g beans, no tomatoes,
// 200 g mince added, 5 portions, 1200 g after cooking. Variation 7 was booked last.
const moreBeans = {
  id: 7,
  name: 'Mehr Bohnen',
  servings: 5,
  weightG: 1200,
  items: [
    { food: beans, amountG: 600 },
    { food: tomatoes, amountG: 0 },
    { food: mince, amountG: 200 },
  ],
}
const chili = {
  id: 50,
  name: 'Chili',
  servings: 4,
  owned: true,
  published: false,
  items: [
    { food: beans, amountG: 400 },
    { food: tomatoes, amountG: 500 },
  ],
  variations: [moreBeans],
  lastUsedVariationId: 7,
}

const amounts = (items) => items.map((item) => [item.food.name, item.amountG])

// ---------- arithmetic ----------

describe('arithmetic', () => {
  it('rounds to one decimal', () => {
    expect(roundToOneDecimal(133.333)).toBe(133.3)
    expect(roundToOneDecimal(0.05)).toBe(0.1)
  })

  it('computes kcal from the amount', () => {
    expect(kcalOf(mince, 200)).toBe(500)
  })

  it('adds up weight and kcal', () => {
    expect(totalsOf(chili.items)).toEqual({ amountG: 900, kcal: 500 })
    expect(totalsOf([])).toEqual({ amountG: 0, kcal: 0 })
  })

  it('books a share by portions or by grams of the finished dish', () => {
    expect(shareOf({ unit: UNIT_PORTION, quantity: 2, servings: 4, weightG: 1200 })).toBe(0.5)
    expect(shareOf({ unit: UNIT_GRAM, quantity: 300, servings: 4, weightG: 1200 })).toBe(0.25)
  })

  it('scales items and rounds the amounts', () => {
    expect(amounts(scaleItems(chili.items, 1 / 3))).toEqual([
      ['Kidneybohnen', 133.3],
      ['Tomaten', 166.7],
    ])
  })

  it('converts between portions and grams of the same share', () => {
    expect(convertQuantity({ fromUnit: UNIT_PORTION, quantity: 1, servings: 4, weightG: 1200 })).toBe(300)
    expect(convertQuantity({ fromUnit: UNIT_GRAM, quantity: 300, servings: 4, weightG: 1200 })).toBe(1)
  })
})

// ---------- variations ----------

describe('variations', () => {
  it('finds a variation by id, null if there is none', () => {
    expect(variationOf(chili, 7)).toBe(moreBeans)
    expect(variationOf(chili, 99)).toBeNull()
    expect(variationOf({ ...chili, variations: undefined }, 7)).toBeNull()
  })

  it('knows the variation booked last', () => {
    expect(lastUsedVariation(chili)).toBe(moreBeans)
    expect(lastUsedVariation({ ...chili, lastUsedVariationId: null })).toBeNull()
  })

  it('lists the original with its own amounts as reference', () => {
    expect(itemsOf(chili, null)).toEqual([
      { food: beans, originalG: 400, amountG: 400 },
      { food: tomatoes, originalG: 500, amountG: 500 },
    ])
  })

  it('applies a variation: changed, left out (0 g, still listed) and added ingredients', () => {
    expect(itemsOf(chili, moreBeans)).toEqual([
      { food: beans, originalG: 400, amountG: 600 },
      { food: tomatoes, originalG: 500, amountG: 0 },
      { food: mince, originalG: 0, amountG: 200 },
    ])
  })

  it('follows the original where the variation changes nothing', () => {
    const onlyMince = { id: 8, name: 'Mit Hack', items: [{ food: mince, amountG: 100 }] }
    expect(amounts(itemsOf(chili, onlyMince))).toEqual([
      ['Kidneybohnen', 400],
      ['Tomaten', 500],
      ['Rinderhack', 100],
    ])
  })

  it('takes the portions of the variation, or of the original', () => {
    expect(servingsOf(chili, null)).toBe(4)
    expect(servingsOf(chili, moreBeans)).toBe(5)
    expect(servingsOf(chili, { ...moreBeans, servings: null })).toBe(4)
  })

  it('"+" books one portion of the variation booked last, without left-out ingredients', () => {
    expect(amounts(onePortion(chili))).toEqual([
      ['Kidneybohnen', 120],
      ['Rinderhack', 40],
    ])
  })

  it('"+" books one portion of the original when it was booked last', () => {
    expect(amounts(onePortion({ ...chili, lastUsedVariationId: null }))).toEqual([
      ['Kidneybohnen', 100],
      ['Tomaten', 125],
    ])
  })
})

// ---------- booking view ----------

describe('booking view', () => {
  it('preselects the variation booked last with its portions and weight', () => {
    const booking = bookingFor(chili)
    expect(booking).toMatchObject({
      recipe: chili,
      variationId: 7,
      unit: UNIT_PORTION,
      quantityText: '1',
      servingsText: '5',
      weightText: '1200',
      layer: null,
      saved: { servingsText: '5', weightText: '1200' },
    })
    expect(booking.items.map((item) => item.savedG)).toEqual([600, 0, 200])
  })

  it('falls back to the original when the variation booked last is gone', () => {
    const booking = bookingFor({ ...chili, lastUsedVariationId: 99 })
    expect(booking.variationId).toBeNull()
    expect(booking.servingsText).toBe('4')
    expect(booking.weightText).toBeNull()
  })

  it('opens the original when asked to', () => {
    expect(bookingFor(chili, null).variationId).toBeNull()
  })

  it('is not adjusted right after loading', () => {
    expect(isAdjusted(bookingFor(chili))).toBe(false)
    expect(isAdjusted(bookingFor(chili, null))).toBe(false)
  })

  it('is adjusted after changing an amount, and no longer after changing it back', () => {
    const booking = bookingFor(chili, null)
    const changed = {
      ...booking,
      items: booking.items.map((item) => (item.food === beans ? { ...item, amountG: 500 } : item)),
    }
    expect(isAdjusted(changed)).toBe(true)

    const back = {
      ...changed,
      items: changed.items.map((item) => (item.food === beans ? { ...item, amountG: 400 } : item)),
    }
    expect(isAdjusted(back)).toBe(false)
  })

  it('is adjusted after changing portions or weight; "5" and "5.0" are the same', () => {
    const booking = bookingFor(chili)
    expect(isAdjusted({ ...booking, servingsText: '6' })).toBe(true)
    expect(isAdjusted({ ...booking, servingsText: '5.0' })).toBe(false)
    expect(isAdjusted({ ...booking, weightText: null })).toBe(true)
    expect(isAdjusted({ ...booking, weightText: '1300' })).toBe(true)
  })
})

// ---------- recipe editor ----------

describe('recipe editor', () => {
  it('shows the original, or a variation of it', () => {
    expect(editorFor(chili)).toMatchObject({
      id: 50,
      variationId: null,
      name: 'Chili',
      servingsText: '4',
      weightText: '',
      published: false,
      wasPublished: false,
    })
    expect(editorFor(chili, 7)).toMatchObject({
      variationId: 7,
      name: 'Mehr Bohnen',
      servingsText: '5',
      weightText: '1200',
    })
  })

  it('reports no changes right after loading', () => {
    expect(editorChanges(editorFor(chili))).toEqual({ items: false, any: false })
    expect(editorChanges(editorFor(chili, 7))).toEqual({ items: false, any: false })
  })

  it('counts name and visibility as changes, but not as changes a variation could hold', () => {
    const editor = editorFor(chili)
    expect(editorChanges({ ...editor, name: 'Chili sin Carne' })).toEqual({ items: false, any: true })
    expect(editorChanges({ ...editor, published: true })).toEqual({ items: false, any: true })
  })

  it('counts changed amounts, removed and added ingredients and portions as item changes', () => {
    const editor = editorFor(chili)
    const changedAmount = editor.items.map((item) => (item.food === beans ? { ...item, amountG: 450 } : item))
    expect(editorChanges({ ...editor, items: changedAmount }).items).toBe(true)
    expect(editorChanges({ ...editor, items: editor.items.slice(1) }).items).toBe(true)
    const added = mergeEditorItems(editor.items, [{ food: rice, amountG: 100 }], false)
    expect(editorChanges({ ...editor, items: added }).items).toBe(true)
    expect(editorChanges({ ...editor, servingsText: '6' }).items).toBe(true)
  })

  it('treats a new recipe as changed', () => {
    expect(editorChanges(NEW_EDITOR)).toEqual({ items: true, any: true })
  })

  it('adds foods from the search: same food adds up, new foods count from 0 g in a variation', () => {
    const items = itemsOf(chili, null)
    const added = [
      { food: beans, amountG: 50 },
      { food: rice, amountG: 100 },
    ]
    expect(mergeEditorItems(items, added, true)).toEqual([
      { food: beans, originalG: 400, amountG: 450 },
      { food: tomatoes, originalG: 500, amountG: 500 },
      { food: rice, originalG: 0, amountG: 100 },
    ])
    expect(mergeEditorItems(items, added, false).at(-1)).toEqual({ food: rice, originalG: 100, amountG: 100 })
    expect(items[0].amountG).toBe(400) // the input is not changed
  })
})

// ---------- requests ----------

describe('requests', () => {
  it('suggests a variation name with the date', () => {
    expect(suggestedVariationName('Gulasch', new Date(2026, 10, 9))).toBe('Gulasch, 09.11.')
    expect(suggestedVariationName('x'.repeat(120), new Date(2026, 10, 9))).toHaveLength(100)
  })

  it('builds a variation request; empty or missing weight means the sum of the ingredients', () => {
    const items = itemsOf(chili, moreBeans)
    expect(variationRequest(' Mehr Bohnen ', '5', '1300', items)).toEqual({
      name: 'Mehr Bohnen',
      servings: 5,
      weightG: 1300,
      items: [
        { foodId: 1, amountG: 600 },
        { foodId: 2, amountG: 0 },
        { foodId: 3, amountG: 200 },
      ],
    })
    expect(variationRequest('X', '5', null, items).weightG).toBeNull()
    expect(variationRequest('X', '5', '  ', items).weightG).toBeNull()
  })

  it('builds a recipe request without left-out ingredients', () => {
    expect(
      recipeRequest({
        name: ' Chili ',
        servingsText: '4',
        published: true,
        items: [
          { food: beans, amountG: 400 },
          { food: tomatoes, amountG: 0 },
        ],
      }),
    ).toEqual({ name: 'Chili', servings: 4, published: true, items: [{ foodId: 1, amountG: 400 }] })
  })
})
