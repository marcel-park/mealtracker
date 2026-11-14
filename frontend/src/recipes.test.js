import { describe, expect, it } from 'vitest'
import {
  NEW_EDITOR,
  addToBookingItems,
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

const beans = { id: 1, name: 'Kidneybohnen', kcalPer100: 100 }
const tomatoes = { id: 2, name: 'Tomaten', kcalPer100: 20 }
const mince = { id: 3, name: 'Rinderhack', kcalPer100: 250 }
const rice = { id: 4, name: 'Reis', kcalPer100: 350 }

// Original: 400 g beans, 500 g tomatoes, 4 portions. Variation 7: 600 g beans, no tomatoes,
// 200 g mince added, 5 portions, 1200 g after cooking. Variation 7 was booked last.
const moreBeans = {
  id: 7,
  name: 'Mehr Bohnen',
  servings: 5,
  weightG: 1200,
  items: [
    { food: beans, amount: 600 },
    { food: tomatoes, amount: 0 },
    { food: mince, amount: 200 },
  ],
}
const chili = {
  id: 50,
  name: 'Chili',
  servings: 4,
  owned: true,
  published: false,
  items: [
    { food: beans, amount: 400 },
    { food: tomatoes, amount: 500 },
  ],
  variations: [moreBeans],
  lastUsedVariationId: 7,
}

const amounts = (items) => items.map((item) => [item.food.name, item.amount])

// What items in g or ml carry besides their amount (no portion, see quantities.js).
const inUnit = { portionId: null, count: null }

// A food with portions: eggs of 60 g, booked as "Stück".
const eggs = {
  id: 5,
  name: 'Ei',
  kcalPer100: 144,
  portions: [{ id: 50, name: 'Stück', amount: 60, favorite: true }],
}

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
    expect(totalsOf(chili.items)).toEqual({ amount: 900, kcal: 500 })
    expect(totalsOf([])).toEqual({ amount: 0, kcal: 0 })
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
      { food: beans, originalAmount: 400, amount: 400, ...inUnit },
      { food: tomatoes, originalAmount: 500, amount: 500, ...inUnit },
    ])
  })

  it('applies a variation: changed, left out (0 g, still listed) and added ingredients', () => {
    expect(itemsOf(chili, moreBeans)).toEqual([
      { food: beans, originalAmount: 400, amount: 600, ...inUnit },
      { food: tomatoes, originalAmount: 500, amount: 0, ...inUnit },
      { food: mince, originalAmount: 0, amount: 200, ...inUnit },
    ])
  })

  it('follows the original where the variation changes nothing', () => {
    const onlyMince = { id: 8, name: 'Mit Hack', items: [{ food: mince, amount: 100 }] }
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
    expect(booking.items.map((item) => item.savedAmount)).toEqual([600, 0, 200])
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
      items: booking.items.map((item) => (item.food === beans ? { ...item, amount: 500 } : item)),
    }
    expect(isAdjusted(changed)).toBe(true)

    const back = {
      ...changed,
      items: changed.items.map((item) => (item.food === beans ? { ...item, amount: 400 } : item)),
    }
    expect(isAdjusted(back)).toBe(false)
  })

  it('adds foods: same food adds up, a new one counts as a change', () => {
    const booking = bookingFor(chili, null)
    const items = addToBookingItems(booking.items, [
      { food: beans, amount: 50 },
      { food: rice, amount: 100 },
    ])
    expect(items.map((item) => [item.food.name, item.amount, item.originalAmount, item.savedAmount])).toEqual([
      ['Kidneybohnen', 450, 400, 400],
      ['Tomaten', 500, 500, 500],
      ['Reis', 100, 0, 0],
    ])
    expect(isAdjusted({ ...booking, items })).toBe(true)
    expect(booking.items[0].amount).toBe(400) // the input is not changed
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
    const changedAmount = editor.items.map((item) => (item.food === beans ? { ...item, amount: 450 } : item))
    expect(editorChanges({ ...editor, items: changedAmount }).items).toBe(true)
    expect(editorChanges({ ...editor, items: editor.items.slice(1) }).items).toBe(true)
    const added = mergeEditorItems(editor.items, [{ food: rice, amount: 100 }], false)
    expect(editorChanges({ ...editor, items: added }).items).toBe(true)
    expect(editorChanges({ ...editor, servingsText: '6' }).items).toBe(true)
  })

  it('treats a new recipe as changed', () => {
    expect(editorChanges(NEW_EDITOR)).toEqual({ items: true, any: true })
  })

  it('adds foods from the search: same food adds up, new foods count from 0 g in a variation', () => {
    const items = itemsOf(chili, null)
    const added = [
      { food: beans, amount: 50 },
      { food: rice, amount: 100 },
    ]
    expect(mergeEditorItems(items, added, true)).toEqual([
      { food: beans, originalAmount: 400, amount: 450, ...inUnit },
      { food: tomatoes, originalAmount: 500, amount: 500, ...inUnit },
      { food: rice, originalAmount: 0, amount: 100, ...inUnit },
    ])
    expect(mergeEditorItems(items, added, false).at(-1)).toEqual({
      food: rice,
      originalAmount: 100,
      amount: 100,
      ...inUnit,
    })
    expect(items[0].amount).toBe(400) // the input is not changed
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
        { foodId: 1, amount: 600 },
        { foodId: 2, amount: 0 },
        { foodId: 3, amount: 200 },
      ],
    })
    // items booked as portions send portion and count instead
    const egg = { food: eggs, amount: 120, portionId: 50, count: 2 }
    expect(variationRequest('X', '5', null, [egg]).items).toEqual([{ foodId: 5, portionId: 50, portionCount: 2 }])
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
          { food: beans, amount: 400 },
          { food: tomatoes, amount: 0 },
        ],
      }),
    ).toEqual({ name: 'Chili', servings: 4, published: true, items: [{ foodId: 1, amount: 400 }] })
  })
})

// ---------- portions ----------

describe('items booked as portions', () => {
  // Omelette: 4 eggs (as portions) and 100 ml... of rice for the sake of it, 2 portions.
  const omelette = {
    id: 60,
    name: 'Omelette',
    servings: 2,
    owned: true,
    published: false,
    items: [
      { food: eggs, amount: 240, portionId: 50, portionCount: 4 },
      { food: rice, amount: 100, portionId: null, portionCount: null },
    ],
    variations: [
      {
        id: 61,
        name: 'Mehr Ei',
        servings: null,
        weightG: null,
        items: [{ food: eggs, amount: 300, portionId: 50, portionCount: 5 }],
      },
    ],
    lastUsedVariationId: null,
  }

  it('keeps portion and count next to the amount, also in a variation', () => {
    expect(itemsOf(omelette, null)[0]).toEqual({ food: eggs, amount: 240, portionId: 50, count: 4, originalAmount: 240 })
    expect(itemsOf(omelette, omelette.variations[0])[0]).toMatchObject({ portionId: 50, count: 5, originalAmount: 240 })
  })

  it('scales portions as portions with two decimals', () => {
    const [egg, riceItem] = scaleItems(itemsOf(omelette, null), 0.5625)
    expect(egg).toEqual({ food: eggs, amount: 135, portionId: 50, count: 2.25 })
    expect(riceItem).toEqual({ food: rice, amount: 56.3, ...inUnit })
  })

  it('adds grams to an ingredient in portions as portions', () => {
    const items = addToBookingItems(bookingFor(omelette, null).items, [{ food: eggs, amount: 30, ...inUnit }])
    expect(items[0]).toMatchObject({ portionId: 50, count: 4.5, amount: 270 })
  })

  it('counts the same amount written another way as a change', () => {
    const booking = bookingFor(omelette, null)
    const asGrams = { ...booking.items[0], portionId: null, count: null }
    expect(isAdjusted({ ...booking, items: [asGrams, booking.items[1]] })).toBe(true)
  })
})
