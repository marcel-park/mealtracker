import { describe, expect, it } from 'vitest'
import {
  NUTRIENTS,
  bookedNutrients,
  formatNutrient,
  hasTypedNutrients,
  nutrientAmounts,
  nutrientPartProblems,
  nutrientProfileTexts,
  nutrientTexts,
  sameNutrientAmounts,
  statedNutrientGroups,
} from './nutrients.js'

describe('NUTRIENTS', () => {
  it('lists every nutrient of the backend once', () => {
    const keys = NUTRIENTS.map(({ key }) => key)
    expect(keys).toHaveLength(30)
    expect(new Set(keys).size).toBe(30)
  })
})

describe('nutrientProfileTexts', () => {
  const carrot = {
    id: 7,
    name: 'Möhre (Karotte)',
    unit: 'G',
    kcalPer100: 36,
    protein: 0.94,
    carbs: 7.2,
    fat: 0.24,
    nutrients: { VITAMIN_A: 835.5, POTASSIUM: 320 },
    portions: [{ id: 3, name: 'Stück', amount: 60, favorite: true }],
    published: true,
    confirmed: true,
  }

  it('copies unit, kcal, macros and the stated nutrients as field texts', () => {
    expect(nutrientProfileTexts(carrot)).toEqual({
      unit: 'G',
      kcal: '36',
      protein: '0.94',
      carbs: '7.2',
      fat: '0.24',
      nutrients: { VITAMIN_A: '835,5', POTASSIUM: '320' },
    })
  })

  it('takes nothing else of the source, and no reference to it', () => {
    const profile = nutrientProfileTexts(carrot)
    expect(Object.keys(profile)).not.toContain('name')
    expect(Object.keys(profile)).not.toContain('portions')
    profile.nutrients.IRON = '1'
    expect(carrot.nutrients).not.toHaveProperty('IRON')
  })

  it('leaves the optional nutrients empty when the source states none', () => {
    expect(nutrientProfileTexts({ ...carrot, nutrients: {} }).nutrients).toEqual({})
  })
})

describe('hasTypedNutrients', () => {
  const empty = { kcal: '', protein: '', carbs: '', fat: '', nutrients: {} }

  it('is false for an empty form, blanks included', () => {
    expect(hasTypedNutrients(empty)).toBe(false)
    expect(hasTypedNutrients({ ...empty, kcal: ' ', nutrients: { IRON: '' } })).toBe(false)
  })

  it('is true once kcal, a macro or an optional nutrient is typed', () => {
    expect(hasTypedNutrients({ ...empty, kcal: '0' })).toBe(true)
    expect(hasTypedNutrients({ ...empty, fat: '3,5' })).toBe(true)
    expect(hasTypedNutrients({ ...empty, nutrients: { IRON: '1,2' } })).toBe(true)
  })
})

describe('nutrientTexts', () => {
  it('turns amounts into field texts with a decimal comma', () => {
    expect(nutrientTexts({ VITAMIN_C: 12.5, IRON: 2 })).toEqual({ VITAMIN_C: '12,5', IRON: '2' })
  })

  it('has no texts without amounts', () => {
    expect(nutrientTexts(undefined)).toEqual({})
  })
})

describe('nutrientAmounts', () => {
  it('leaves out empty fields and parses the comma', () => {
    expect(nutrientAmounts({ VITAMIN_C: '12,5', IRON: '', ZINC: ' ' })).toEqual({
      amounts: { VITAMIN_C: 12.5 },
      invalid: [],
    })
  })

  it('accepts 0 for foods', () => {
    expect(nutrientAmounts({ SUGAR: '0' }).amounts).toEqual({ SUGAR: 0 })
  })

  it('rejects 0 for daily targets', () => {
    expect(nutrientAmounts({ SUGAR: '0' }, { allowZero: false })).toEqual({ amounts: {}, invalid: ['SUGAR'] })
  })

  it('rejects a trailing comma', () => {
    expect(nutrientAmounts({ SALT: '1,' }).invalid).toEqual(['SALT'])
  })
})

describe('nutrientPartProblems', () => {
  const salmon = { carbs: 2, fat: 13 }

  it('accepts parts up to their whole, each on its own', () => {
    const nutrients = { SUGAR: 2, SATURATED_FAT: 13, MONOUNSATURATED_FAT: 13, POLYUNSATURATED_FAT: 3, OMEGA_3: 3 }
    expect(nutrientPartProblems({ ...salmon, nutrients })).toEqual([])
  })

  it('reports sugar above the carbs', () => {
    expect(nutrientPartProblems({ ...salmon, nutrients: { SUGAR: 2.1 } })).toEqual([
      'Zucker ist mehr als die Kohlenhydrate.',
    ])
  })

  it('reports a fatty acid above the fat', () => {
    expect(nutrientPartProblems({ ...salmon, nutrients: { MONOUNSATURATED_FAT: 14 } })).toEqual([
      'Einfach ungesättigte Fettsäuren sind mehr als das Fett.',
    ])
  })

  it('compares omega-3 with the polyunsaturated fat, or the fat if that is unknown', () => {
    expect(nutrientPartProblems({ ...salmon, nutrients: { POLYUNSATURATED_FAT: 3, OMEGA_3: 3.1 } })).toEqual([
      'Omega-3 ist mehr als die mehrfach ungesättigten Fettsäuren.',
    ])
    expect(nutrientPartProblems({ ...salmon, nutrients: { OMEGA_3: 13 } })).toEqual([])
    expect(nutrientPartProblems({ ...salmon, nutrients: { OMEGA_3: 13.1 } })).toEqual(['Omega-3 ist mehr als das Fett.'])
  })

  it('does not compare with a whole not typed yet', () => {
    expect(nutrientPartProblems({ carbs: NaN, fat: NaN, nutrients: { SUGAR: 5, SALT: 1 } })).toEqual([])
  })
})

describe('statedNutrientGroups', () => {
  it('keeps only stated nutrients and groups that have one', () => {
    const groups = statedNutrientGroups({ IRON: 2, FIBER: 0 })
    expect(groups.map((group) => group.title)).toEqual(['Makronährstoffe', 'Spurenelemente'])
    expect(groups[1].nutrients.map(({ key }) => key)).toEqual(['IRON'])
  })

  it('is empty without amounts', () => {
    expect(statedNutrientGroups(undefined)).toEqual([])
  })
})

describe('formatNutrient', () => {
  it('shows up to two decimals with the unit', () => {
    expect(formatNutrient(0.06, 'mg')).toBe('0,06 mg')
    expect(formatNutrient(1500, 'mg')).toBe('1.500 mg')
  })
})

describe('sameNutrientAmounts', () => {
  it('compares every nutrient, a missing one as none', () => {
    expect(sameNutrientAmounts({ IRON: 11 }, { IRON: 11 })).toBe(true)
    expect(sameNutrientAmounts({}, undefined)).toBe(true)
    expect(sameNutrientAmounts({ IRON: 11 }, { IRON: 15 })).toBe(false)
    expect(sameNutrientAmounts({ IRON: 11 }, { IRON: 11, SALT: 6 })).toBe(false)
  })
})

describe('bookedNutrients', () => {
  const egg = { nutrients: { VITAMIN_D: 2.9, IRON: 1.8 } }
  const milk = { nutrients: { VITAMIN_D: 0.1 } }
  const oats = {}

  it('adds up the amounts of all items per 100 g or ml', () => {
    const meals = [
      { items: [{ food: egg, amount: 120 }, { food: milk, amount: 200 }] },
      { items: [{ food: oats, amount: 50 }] },
    ]
    const totals = bookedNutrients(meals)
    expect(totals.VITAMIN_D).toBeCloseTo(3.68)
    expect(totals.IRON).toBeCloseTo(2.16)
    expect(totals.ZINC).toBe(0)
    expect(Object.keys(totals)).toHaveLength(30)
  })
})
