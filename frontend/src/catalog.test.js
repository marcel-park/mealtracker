import { describe, expect, it } from 'vitest'
import {
  KIND_FOODS,
  KIND_RECIPES,
  SCOPE_FRIENDS,
  SCOPE_OWN,
  SCOPE_PUBLIC,
  confirmedFilterAvailable,
  withKind,
  withScope,
} from './catalog.js'

describe('confirmedFilterAvailable', () => {
  it('is available for foods of everybody and public foods', () => {
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: null })).toBe(true)
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_PUBLIC })).toBe(true)
  })

  it('is not available for own foods and those of friends', () => {
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_OWN })).toBe(false)
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_FRIENDS })).toBe(false)
  })

  it('is never available for recipes, there are no confirmed recipes', () => {
    for (const scope of [null, SCOPE_PUBLIC, SCOPE_OWN, SCOPE_FRIENDS]) {
      expect(confirmedFilterAvailable({ kind: KIND_RECIPES, scope })).toBe(false)
    }
  })
})

describe('withScope', () => {
  const search = { query: 'quark', scope: null, confirmedOnly: true, kind: KIND_FOODS }

  it('keeps "only confirmed" when switching between everything and public entries', () => {
    expect(withScope(search, SCOPE_PUBLIC)).toEqual({ ...search, scope: SCOPE_PUBLIC })
    expect(withScope({ ...search, scope: SCOPE_PUBLIC }, null)).toEqual(search)
  })

  it('switches it off for own entries and those of friends and keeps the rest', () => {
    expect(withScope(search, SCOPE_OWN)).toEqual({ ...search, scope: SCOPE_OWN, confirmedOnly: false })
    expect(withScope(search, SCOPE_FRIENDS).confirmedOnly).toBe(false)
  })

  it('leaves it off when going back to public entries or everything', () => {
    const own = withScope(search, SCOPE_OWN)
    expect(withScope(own, SCOPE_PUBLIC).confirmedOnly).toBe(false)
    expect(withScope(own, null).confirmedOnly).toBe(false)
  })
})

describe('withKind', () => {
  const search = { query: 'quark', scope: SCOPE_PUBLIC, confirmedOnly: true, kind: KIND_FOODS }

  it('switches "only confirmed" off for recipes and keeps the rest', () => {
    expect(withKind(search, KIND_RECIPES)).toEqual({ ...search, kind: KIND_RECIPES, confirmedOnly: false })
  })

  it('leaves it off when going back to foods', () => {
    expect(withKind(withKind(search, KIND_RECIPES), KIND_FOODS).confirmedOnly).toBe(false)
  })
})
