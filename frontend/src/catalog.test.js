import { describe, expect, it } from 'vitest'
import {
  KIND_FOODS,
  KIND_RECIPES,
  SCOPE_FRIENDS,
  SCOPE_OWN,
  SCOPE_PUBLIC,
  confirmedByDefault,
  confirmedFilterApplies,
  withScope,
} from './catalog.js'

describe('confirmedByDefault', () => {
  it('is on for everything and for public entries', () => {
    expect(confirmedByDefault(null)).toBe(true)
    expect(confirmedByDefault(SCOPE_PUBLIC)).toBe(true)
  })

  it('is off for own entries and those of friends', () => {
    expect(confirmedByDefault(SCOPE_OWN)).toBe(false)
    expect(confirmedByDefault(SCOPE_FRIENDS)).toBe(false)
  })
})

describe('withScope', () => {
  const search = { query: 'quark', scope: null, confirmedOnly: true, kind: 'foods' }

  it('switches "only confirmed" off for own entries and keeps the rest', () => {
    expect(withScope(search, SCOPE_OWN)).toEqual({ ...search, scope: SCOPE_OWN, confirmedOnly: false })
  })

  it('switches it on again for public entries or everything, even after it was turned off by hand', () => {
    const own = { ...search, scope: SCOPE_OWN, confirmedOnly: false }
    expect(withScope(own, SCOPE_PUBLIC).confirmedOnly).toBe(true)
    expect(withScope(own, null).confirmedOnly).toBe(true)
  })
})

describe('confirmedFilterApplies', () => {
  it('applies to foods only, recipes cannot be confirmed yet', () => {
    expect(confirmedFilterApplies(KIND_FOODS)).toBe(true)
    expect(confirmedFilterApplies(KIND_RECIPES)).toBe(false)
  })
})
