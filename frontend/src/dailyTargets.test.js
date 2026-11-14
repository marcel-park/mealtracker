import { describe, expect, it } from 'vitest'
import { NUTRIENTS } from './nutrients.js'
import { ageGroupIndex, ageOn, dailyNutrientTargets } from './dailyTargets.js'

const TODAY = '2026-11-14'
const man39 = { birthDate: '1987-03-14', sex: 'MALE', fatPercent: 30 }

describe('ageOn', () => {
  it('counts full years', () => {
    expect(ageOn('1987-03-14', TODAY)).toBe(39)
    expect(ageOn('1987-11-14', TODAY)).toBe(39)
    expect(ageOn('1987-11-15', TODAY)).toBe(38)
  })

  it('makes those born on 29 February a year older on 1 March', () => {
    expect(ageOn('2000-02-29', '2025-02-28')).toBe(24)
    expect(ageOn('2000-02-29', '2025-03-01')).toBe(25)
  })
})

describe('ageGroupIndex', () => {
  it('follows the DGE groups 19–24, 25–50, 51–64, 65+', () => {
    expect(ageGroupIndex(24)).toBe(0)
    expect(ageGroupIndex(25)).toBe(1)
    expect(ageGroupIndex(50)).toBe(1)
    expect(ageGroupIndex(51)).toBe(2)
    expect(ageGroupIndex(65)).toBe(3)
    expect(ageGroupIndex(99)).toBe(3)
  })
})

describe('dailyNutrientTargets', () => {
  it('is null without birth date or sex', () => {
    expect(dailyNutrientTargets({ ...man39, birthDate: null }, 2500, TODAY)).toBeNull()
    expect(dailyNutrientTargets({ ...man39, sex: null }, 2500, TODAY)).toBeNull()
  })

  it('has a target above 0 for every nutrient', () => {
    const { targets } = dailyNutrientTargets(man39, 2500, TODAY)
    for (const { key } of NUTRIENTS) expect(targets[key], key).toBeGreaterThan(0)
  })

  it('takes the reference values of a man aged 25 to 50', () => {
    const { targets, ageGroup, isUnderAdultAge } = dailyNutrientTargets(man39, 2500, TODAY)
    expect(ageGroup).toBe(1)
    expect(isUnderAdultAge).toBe(false)
    expect(targets).toMatchObject({
      VITAMIN_A: 850, VITAMIN_C: 110, VITAMIN_B1: 1.2, VITAMIN_B3: 15, VITAMIN_K: 70,
      MAGNESIUM: 350, IRON: 11, ZINC: 14, IODINE: 150, SELENIUM: 70, SALT: 6,
    })
  })

  it('follows age and sex', () => {
    const woman = { ...man39, sex: 'FEMALE' }
    expect(dailyNutrientTargets(woman, 2000, TODAY).targets.IRON).toBe(16)
    expect(dailyNutrientTargets({ ...woman, birthDate: '1970-01-01' }, 2000, TODAY).targets.IRON).toBe(14)
    expect(dailyNutrientTargets({ ...man39, birthDate: '1950-01-01' }, 2000, TODAY).targets.VITAMIN_A).toBe(800)
    expect(dailyNutrientTargets({ ...man39, birthDate: '2005-01-01' }, 2000, TODAY).targets.VITAMIN_B3).toBe(16)
  })

  it('takes the higher value of men and women for "DIVERSE"', () => {
    const { targets } = dailyNutrientTargets({ ...man39, sex: 'DIVERSE' }, 2000, TODAY)
    expect(targets.IRON).toBe(16)
    expect(targets.MAGNESIUM).toBe(350)
    expect(targets.VITAMIN_C).toBe(110)
  })

  it('gives the values of the youngest adults below 19, and says so', () => {
    const result = dailyNutrientTargets({ ...man39, birthDate: '2010-01-01' }, 2000, TODAY)
    expect(result.ageGroup).toBe(0)
    expect(result.isUnderAdultAge).toBe(true)
  })

  it('computes fats, sugar and fibre from the calorie target', () => {
    const { targets } = dailyNutrientTargets(man39, 2700, TODAY)
    expect(targets.SATURATED_FAT).toBe(30) // 10 % of 2700 kcal / 9
    expect(targets.POLYUNSATURATED_FAT).toBe(21) // 7 %
    expect(targets.OMEGA_3).toBe(1.5) // 0.5 %
    expect(targets.MONOUNSATURATED_FAT).toBe(39) // 30 % fat − 17 %
    expect(targets.SUGAR).toBe(67.5) // 10 % / 4
    expect(targets.FIBER).toBe(39.4) // 14.6 g per 1000 kcal
  })

  it('keeps at least 30 g of fibre, and no negative share of monounsaturated fat', () => {
    const { targets } = dailyNutrientTargets({ ...man39, fatPercent: 15 }, 1500, TODAY)
    expect(targets.FIBER).toBe(30)
    expect(targets.MONOUNSATURATED_FAT).toBe(0)
  })
})
