import { describe, expect, it } from 'vitest'
import { DARK, LIGHT, SYSTEM, resolveTheme } from './theme.js'

describe('resolveTheme', () => {
  it('fixes light and dark whatever the device says', () => {
    expect(resolveTheme(LIGHT, true)).toBe('light')
    expect(resolveTheme(DARK, false)).toBe('dark')
  })

  it('follows the device for SYSTEM', () => {
    expect(resolveTheme(SYSTEM, true)).toBe('dark')
    expect(resolveTheme(SYSTEM, false)).toBe('light')
  })
})
