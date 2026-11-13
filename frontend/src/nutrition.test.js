import { describe, expect, it } from 'vitest'
import { bookedMacros, macroTargetGrams, macroTargets, remainingKcal } from './nutrition.js'

const user = { calorieTarget: 2000, carbsPercent: 40, proteinPercent: 30, fatPercent: 30 }

const oats = { id: 1, name: 'Haferflocken', unit: 'G', kcalPer100: 372, carbs: 58.7, protein: 13.5, fat: 7 }
const milk = { id: 2, name: 'Milch', unit: 'ML', kcalPer100: 64, carbs: 4.8, protein: 3.4, fat: 3.5 }

describe('macroTargets', () => {
  it('turns the share of the calories into grams: 4 kcal per g of carbs and protein, 9 of fat', () => {
    const targets = macroTargets(user)
    expect(targets.carbs).toBe(200)
    expect(targets.protein).toBe(150)
    expect(targets.fat).toBeCloseTo(66.67, 2)
  })

  it('follows the calorie target', () => {
    expect(macroTargetGrams(1800, 50, 'carbs')).toBe(225)
    expect(macroTargetGrams(1800, 0, 'fat')).toBe(0)
  })
})

describe('bookedMacros', () => {
  it('adds up the nutrients of all items of all meals, per 100 g or ml of each food', () => {
    const meals = [
      { kcal: 686, items: [{ food: oats, amount: 150 }, { food: milk, amount: 200 }] },
      { kcal: 372, items: [{ food: oats, amount: 100 }] },
    ]
    const booked = bookedMacros(meals)
    expect(booked.carbs).toBeCloseTo(250 * 0.587 + 200 * 0.048, 6)
    expect(booked.protein).toBeCloseTo(250 * 0.135 + 200 * 0.034, 6)
    expect(booked.fat).toBeCloseTo(250 * 0.07 + 200 * 0.035, 6)
  })

  it('is 0 for a day without meals', () => {
    expect(bookedMacros([])).toEqual({ carbs: 0, protein: 0, fat: 0 })
  })
})

describe('remainingKcal', () => {
  it('is what is left of the target, negative when there is too much', () => {
    expect(remainingKcal(2000, [{ kcal: 686 }, { kcal: 372 }])).toBe(942)
    expect(remainingKcal(2000, [{ kcal: 2100.4 }])).toBeCloseTo(-100.4, 6)
  })
})
