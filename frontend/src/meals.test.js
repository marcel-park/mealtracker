import { describe, expect, it } from 'vitest'
import { addAmount, addRecipeItems, entriesFromMeal, makeTitle, mealRequest } from './meals.js'

const apple = { id: 1, name: 'Apfel', kcalPer100g: 52 }
const banana = { id: 2, name: 'Banane', kcalPer100g: 89 }
const beans = { id: 3, name: 'Bohnen', kcalPer100g: 100 }

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
    expect(addAmount([], apple, 100)).toEqual([{ food: apple, amountG: 100, baseG: 0, labels: ['Apfel'] }])
  })

  it('adds up amounts of the same food (rounded) and keeps each label once', () => {
    let entries = addAmount([], apple, 100)
    entries = addAmount(entries, apple, 50.04)
    entries = addAmount(entries, apple, 10, 'Obstsalat')
    entries = addAmount(entries, apple, 10, 'Obstsalat')
    expect(entries).toEqual([{ food: apple, amountG: 170, baseG: 0, labels: ['Apfel', 'Obstsalat'] }])
  })
})

describe('addRecipeItems', () => {
  it('adds the scaled foods labelled with the recipe and marked with its id, skipping left-out ones', () => {
    const entries = addRecipeItems(
      addAmount([], banana, 100),
      [
        { food: beans, amountG: 120 },
        { food: apple, amountG: 0 },
        { food: banana, amountG: 20 },
      ],
      'Chili',
      50,
    )
    expect(entries.map((entry) => [entry.food.name, entry.amountG, entry.labels, entry.recipeIds])).toEqual([
      ['Banane', 120, ['Banane', 'Chili'], [50]],
      ['Bohnen', 120, ['Chili'], [50]],
    ])
  })

  it('marks each recipe only once per food', () => {
    let entries = addRecipeItems([], [{ food: beans, amountG: 100 }], 'Chili', 50)
    entries = addRecipeItems(entries, [{ food: beans, amountG: 100 }], 'Chili', 50)
    entries = addRecipeItems(entries, [{ food: beans, amountG: 100 }], 'Bohnensalat', 51)
    expect(entries[0].recipeIds).toEqual([50, 51])
    expect(entries[0].amountG).toBe(300)
  })
})

describe('entriesFromMeal', () => {
  it('derives kcal per 100 g and labels a meal named after its foods with the food names', () => {
    const entries = entriesFromMeal({
      title: 'Apfel, Banane',
      items: [
        { foodId: 1, foodName: 'Apfel', amountG: 200, kcal: 104 },
        { foodId: 2, foodName: 'Banane', amountG: 0, kcal: 0 },
      ],
    })
    expect(entries).toEqual([
      { food: { id: 1, name: 'Apfel', kcalPer100g: 52 }, amountG: 200, baseG: 200, labels: ['Apfel'] },
      { food: { id: 2, name: 'Banane', kcalPer100g: 0 }, amountG: 0, baseG: 0, labels: ['Banane'] },
    ])
  })

  it('keeps the title of a meal booked from a recipe', () => {
    const entries = entriesFromMeal({
      title: 'Chili',
      items: [{ foodId: 3, foodName: 'Bohnen', amountG: 100, kcal: 100 }],
    })
    expect(entries[0].labels).toEqual(['Chili'])
  })
})

describe('mealRequest', () => {
  it('builds the title from the labels and lists the foods', () => {
    const entries = addAmount(addRecipeItems([], [{ food: beans, amountG: 150 }], 'Chili', 50), apple, 100)
    expect(mealRequest(entries)).toEqual({
      title: 'Chili, Apfel',
      items: [
        { foodId: 3, amountG: 150 },
        { foodId: 1, amountG: 100 },
      ],
      recipes: [],
    })
  })

  it('only reports recipes that still have something in the meal', () => {
    const entries = addRecipeItems([], [{ food: beans, amountG: 150 }], 'Chili', 50)
    const uses = [
      { recipeId: 50, variationId: 7 },
      { recipeId: 51, variationId: null },
    ]
    expect(mealRequest(entries, uses).recipes).toEqual([{ recipeId: 50, variationId: 7 }])
  })

  it('does not mistake a food named like a removed recipe for that recipe', () => {
    // Recipe "Chili" was added and its foods removed again; a food called "Chili" stays.
    const chiliPepper = { id: 9, name: 'Chili', kcalPer100g: 40 }
    const entries = addAmount([], chiliPepper, 5)
    expect(mealRequest(entries, [{ recipeId: 50, variationId: 7 }]).recipes).toEqual([])
  })
})
