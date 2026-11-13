import { describe, expect, it } from 'vitest'
import {
  addAmount,
  addRecipeItems,
  entriesFromMeal,
  localDate,
  makeTitle,
  mealRequest,
  msUntilMidnight,
} from './meals.js'

const apple = { id: 1, name: 'Apfel', kcalPer100: 52 }
const banana = { id: 2, name: 'Banane', kcalPer100: 89 }
const beans = { id: 3, name: 'Bohnen', kcalPer100: 100 }

describe('makeTitle', () => {
  it('lists up to three names', () => {
    expect(makeTitle(['Apfel', 'Banane', 'Brot'])).toBe('Apfel, Banane, Brot')
  })

  it('counts the rest', () => {
    expect(makeTitle(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2')
  })

  it('stays within 100 characters', () => {
    expect(makeTitle(['x'.repeat(150)])).toHaveLength(100)
  })
})

describe('addAmount', () => {
  it('adds a new food labelled with its own name', () => {
    expect(addAmount([], apple, 100)).toEqual([{ food: apple, amount: 100, baseAmount: 0, labels: ['Apfel'] }])
  })

  it('adds up amounts of the same food (rounded) and keeps each label once', () => {
    let entries = addAmount([], apple, 100)
    entries = addAmount(entries, apple, 50.04)
    entries = addAmount(entries, apple, 10, 'Obstsalat')
    entries = addAmount(entries, apple, 10, 'Obstsalat')
    expect(entries).toEqual([{ food: apple, amount: 170, baseAmount: 0, labels: ['Apfel', 'Obstsalat'] }])
  })
})

describe('addRecipeItems', () => {
  it('adds the scaled foods labelled with the recipe and marked with its id, skipping left-out ones', () => {
    const entries = addRecipeItems(
      addAmount([], banana, 100),
      [
        { food: beans, amount: 120 },
        { food: apple, amount: 0 },
        { food: banana, amount: 20 },
      ],
      'Chili',
      50,
    )
    expect(entries.map((entry) => [entry.food.name, entry.amount, entry.labels, entry.recipeIds])).toEqual([
      ['Banane', 120, ['Banane', 'Chili'], [50]],
      ['Bohnen', 120, ['Chili'], [50]],
    ])
  })

  it('marks each recipe only once per food', () => {
    let entries = addRecipeItems([], [{ food: beans, amount: 100 }], 'Chili', 50)
    entries = addRecipeItems(entries, [{ food: beans, amount: 100 }], 'Chili', 50)
    entries = addRecipeItems(entries, [{ food: beans, amount: 100 }], 'Bohnensalat', 51)
    expect(entries[0].recipeIds).toEqual([50, 51])
    expect(entries[0].amount).toBe(300)
  })
})

describe('entriesFromMeal', () => {
  it('takes the food of each item and labels a meal named after its foods with the food names', () => {
    const entries = entriesFromMeal({
      title: 'Apfel, Banane',
      items: [
        { food: apple, amount: 200, kcal: 104 },
        { food: banana, amount: 50, kcal: 44.5 },
      ],
    })
    expect(entries).toEqual([
      { food: apple, amount: 200, baseAmount: 200, labels: ['Apfel'] },
      { food: banana, amount: 50, baseAmount: 50, labels: ['Banane'] },
    ])
  })

  it('keeps the title of a meal booked from a recipe', () => {
    const entries = entriesFromMeal({
      title: 'Chili',
      items: [{ food: beans, amount: 100, kcal: 100 }],
    })
    expect(entries[0].labels).toEqual(['Chili'])
  })
})

describe('mealRequest', () => {
  it('builds the title from the labels and lists the foods', () => {
    const entries = addAmount(addRecipeItems([], [{ food: beans, amount: 150 }], 'Chili', 50), apple, 100)
    expect(mealRequest(entries)).toEqual({
      title: 'Chili, Apfel',
      items: [
        { foodId: 3, amount: 150 },
        { foodId: 1, amount: 100 },
      ],
      recipes: [],
    })
  })

  it('only reports recipes that still have something in the meal', () => {
    const entries = addRecipeItems([], [{ food: beans, amount: 150 }], 'Chili', 50)
    const uses = [
      { recipeId: 50, variationId: 7 },
      { recipeId: 51, variationId: null },
    ]
    expect(mealRequest(entries, uses).recipes).toEqual([{ recipeId: 50, variationId: 7 }])
  })

  it('does not mistake a food named like a removed recipe for that recipe', () => {
    // Recipe "Chili" was added and its foods removed again; a food called "Chili" stays.
    const chiliPepper = { id: 9, name: 'Chili', kcalPer100: 40 }
    const entries = addAmount([], chiliPepper, 5)
    expect(mealRequest(entries, [{ recipeId: 50, variationId: 7 }]).recipes).toEqual([])
  })
})

describe('localDate', () => {
  it('pads month and day', () => {
    expect(localDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })

  it('uses local time, not UTC', () => {
    expect(localDate(new Date(2026, 10, 11, 0, 30))).toBe('2026-11-11')
    expect(localDate(new Date(2026, 10, 11, 23, 59))).toBe('2026-11-11')
  })
})

describe('msUntilMidnight', () => {
  it('counts to the next local midnight', () => {
    expect(msUntilMidnight(new Date(2026, 10, 11, 23, 59, 30))).toBe(30_000)
  })

  it('is a whole day right at midnight', () => {
    const now = new Date(2026, 10, 11, 0, 0)
    expect(msUntilMidnight(now)).toBe(new Date(2026, 10, 12).getTime() - now.getTime())
  })
})
