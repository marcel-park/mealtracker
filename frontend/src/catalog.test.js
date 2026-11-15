import { describe, expect, it } from 'vitest'
import {
  CATALOG_PAGE_SIZE,
  KIND_FOODS,
  KIND_RECIPES,
  SCOPE_FRIENDS,
  SCOPE_OWN,
  SCOPE_PUBLIC,
  SCOPE_RECENT,
  appendPage,
  catalogKey,
  confirmedFilterAvailable,
  createCatalogCache,
  isIdleSearch,
  isLastPage,
  recentScopeAvailable,
  withKind,
  withScope,
} from './catalog.js'

describe('confirmedFilterAvailable', () => {
  it('is available for foods of everybody and public foods', () => {
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: null })).toBe(true)
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_PUBLIC })).toBe(true)
  })

  it('is not available for own foods, those of friends and the recently booked ones', () => {
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_OWN })).toBe(false)
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_FRIENDS })).toBe(false)
    expect(confirmedFilterAvailable({ kind: KIND_FOODS, scope: SCOPE_RECENT })).toBe(false)
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

describe('recent scope', () => {
  it('is for foods only', () => {
    expect(recentScopeAvailable(KIND_FOODS)).toBe(true)
    expect(recentScopeAvailable(KIND_RECIPES)).toBe(false)
  })

  it('goes back to everything when switching to recipes', () => {
    const recent = { query: '', scope: SCOPE_RECENT, confirmedOnly: false, kind: KIND_FOODS }
    expect(withKind(recent, KIND_RECIPES)).toEqual({ ...recent, kind: KIND_RECIPES, scope: null })
  })

  it('keeps other scopes when switching to recipes', () => {
    const own = { query: '', scope: SCOPE_OWN, confirmedOnly: false, kind: KIND_FOODS }
    expect(withKind(own, KIND_RECIPES).scope).toBe(SCOPE_OWN)
  })
})

describe('isIdleSearch', () => {
  it('waits for the first letter', () => {
    expect(isIdleSearch({ query: '', scope: null })).toBe(true)
    expect(isIdleSearch({ query: '  ', scope: SCOPE_PUBLIC })).toBe(true)
    expect(isIdleSearch({ query: 'a', scope: null })).toBe(false)
  })

  it('shows the recently booked foods right away', () => {
    expect(isIdleSearch({ query: '', scope: SCOPE_RECENT })).toBe(false)
  })
})

describe('pages', () => {
  const page = (from, count) => Array.from({ length: count }, (_, i) => ({ id: from + i }))

  it('appends the next page and keeps an entry that comes twice where it was', () => {
    expect(appendPage([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }])).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('takes a short page for the last one', () => {
    expect(isLastPage(page(1, CATALOG_PAGE_SIZE))).toBe(false)
    expect(isLastPage(page(1, CATALOG_PAGE_SIZE - 1))).toBe(true)
    expect(isLastPage([])).toBe(true)
  })
})

describe('createCatalogCache', () => {
  it('returns what was saved until it is too old', () => {
    const cache = createCatalogCache({ maxEntries: 5, maxAgeMs: 1000 })
    cache.set('a', [1], 0)
    expect(cache.get('a', 1000)).toEqual([1])
    expect(cache.get('a', 1001)).toBeNull()
    expect(cache.get('b', 0)).toBeNull()
  })

  it('drops the least recently used search when full', () => {
    const cache = createCatalogCache({ maxEntries: 2, maxAgeMs: 1000 })
    cache.set('a', 'A', 0)
    cache.set('b', 'B', 0)
    cache.get('a', 0) // a is now used more recently than b
    cache.set('c', 'C', 0)
    expect(cache.get('b', 0)).toBeNull()
    expect(cache.get('a', 0)).toBe('A')
    expect(cache.get('c', 0)).toBe('C')
  })

  it('forgets everything on clear', () => {
    const cache = createCatalogCache({ maxEntries: 2, maxAgeMs: 1000 })
    cache.set('a', 'A', 0)
    cache.clear()
    expect(cache.get('a', 0)).toBeNull()
  })
})

describe('catalogKey', () => {
  const search = { query: ' quark ', scope: null, confirmedOnly: false }

  it('ignores spaces around the text, as they are not sent', () => {
    expect(catalogKey(KIND_FOODS, search, 0)).toBe(catalogKey(KIND_FOODS, { ...search, query: 'quark' }, 0))
  })

  it('differs by kind, filters and version', () => {
    const key = catalogKey(KIND_FOODS, search, 0)
    expect(catalogKey(KIND_RECIPES, search, 0)).not.toBe(key)
    expect(catalogKey(KIND_FOODS, { ...search, scope: SCOPE_OWN }, 0)).not.toBe(key)
    expect(catalogKey(KIND_FOODS, { ...search, confirmedOnly: true }, 0)).not.toBe(key)
    expect(catalogKey(KIND_FOODS, search, 1)).not.toBe(key)
  })
})
