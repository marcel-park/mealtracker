import { describe, expect, it } from 'vitest'
import { numberIn, sanitizeNumberInput, toFieldText } from './bodyData.js'

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
