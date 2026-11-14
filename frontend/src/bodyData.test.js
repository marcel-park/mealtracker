import { describe, expect, it } from 'vitest'
import { birthDateFromParts, birthDateParts, numberIn, sanitizeNumberInput, toFieldText } from './bodyData.js'

describe('sanitizeNumberInput', () => {
  it('keeps digits only for whole numbers', () => {
    expect(sanitizeNumberInput('1a2.3', 5)).toBe('123')
    expect(sanitizeNumberInput('1234567', 5)).toBe('12345')
  })

  it('allows one decimal comma and turns a point into it', () => {
    expect(sanitizeNumberInput('80.5', 3, 1)).toBe('80,5')
    expect(sanitizeNumberInput('80,55', 3, 1)).toBe('80,5')
    expect(sanitizeNumberInput('8,0,5', 3, 1)).toBe('8,0')
    expect(sanitizeNumberInput('1000,5', 3, 1)).toBe('100,5')
    expect(sanitizeNumberInput('80,', 3, 1)).toBe('80,')
  })
})

describe('numberIn', () => {
  it('reads a decimal comma and checks the range', () => {
    expect(numberIn('80,5', 30, 300)).toBe(80.5)
    expect(numberIn('29,9', 30, 300)).toBeNaN()
    expect(numberIn('', 30, 300)).toBeNaN()
    expect(numberIn('80,', 30, 300)).toBeNaN()
  })
})

describe('toFieldText', () => {
  it('shows a stored number with a decimal comma, and nothing for none', () => {
    expect(toFieldText(80.5)).toBe('80,5')
    expect(toFieldText(180)).toBe('180')
    expect(toFieldText(null)).toBe('')
  })
})

const TODAY = '2026-11-14'
const parts = (day, month, year) => ({ day, month, year })

describe('birthDateFromParts', () => {
  it('builds the date from day, month and four-digit year', () => {
    expect(birthDateFromParts(parts('14', '3', '1987'), TODAY)).toBe('1987-03-14')
    expect(birthDateFromParts(parts('01', '12', '1900'), TODAY)).toBe('1900-12-01')
    expect(birthDateFromParts(parts('29', '2', '2000'), TODAY)).toBe('2000-02-29')
  })

  it('is null while incomplete', () => {
    expect(birthDateFromParts(parts('', '3', '1987'), TODAY)).toBeNull()
    expect(birthDateFromParts(parts('14', '', '1987'), TODAY)).toBeNull()
    expect(birthDateFromParts(parts('14', '3', '87'), TODAY)).toBeNull()
  })

  it('refuses days that do not exist', () => {
    expect(birthDateFromParts(parts('31', '4', '1987'), TODAY)).toBeNull()
    expect(birthDateFromParts(parts('29', '2', '2001'), TODAY)).toBeNull()
    expect(birthDateFromParts(parts('0', '1', '1987'), TODAY)).toBeNull()
  })

  it('takes a date from 1900 to yesterday', () => {
    expect(birthDateFromParts(parts('13', '11', '2026'), TODAY)).toBe('2026-11-13')
    expect(birthDateFromParts(parts('14', '11', '2026'), TODAY)).toBeNull()
    expect(birthDateFromParts(parts('31', '12', '1899'), TODAY)).toBeNull()
  })
})

describe('birthDateParts', () => {
  it('splits a stored date for the fields, and is empty for none', () => {
    expect(birthDateParts('1987-03-04')).toEqual(parts('4', '3', '1987'))
    expect(birthDateParts(null)).toEqual(parts('', '', ''))
  })
})
