import { describe, expect, it } from 'vitest'
import {
  CATALOG_PAGE_SIZE,
  USER_ITEM_SEARCH,
  KIND_USER_ITEMS,
  KIND_FOODS,
  KIND_RECIPES,
  SCOPE_FRIENDS,
  SCOPE_OWN,
  SCOPE_PUBLIC,
  SCOPE_RECENT,
  appendPage,
  canCreateUserItem,
  catalogKey,
  confirmedFilterAvailable,
  defaultScope,
  createCatalogCache,
  isIdleSearch,
  isLastPage,
  NEW_SEARCH,
  recentScopeAvailable,
  scopeAvailable,
  withKind,
  withQuery,
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

  it('empties the text for "Zuletzt", so its list shows', () => {
    expect(withScope(search, SCOPE_RECENT)).toEqual({ ...search, query: '', scope: SCOPE_RECENT, confirmedOnly: false })
  })
})

describe('withKind', () => {
  const search = { query: 'quark', scope: SCOPE_PUBLIC, confirmedOnly: true, kind: KIND_FOODS }

  it('switches to "Eigene" and "only confirmed" off for recipes, and keeps the text', () => {
    expect(withKind(search, KIND_RECIPES)).toEqual({
      query: 'quark',
      scope: SCOPE_OWN,
      confirmedOnly: false,
      kind: KIND_RECIPES,
    })
  })

  it('switches to "Eigene" for recipes from every filter', () => {
    for (const scope of [null, SCOPE_PUBLIC, SCOPE_OWN, SCOPE_FRIENDS, SCOPE_RECENT]) {
      expect(withKind({ ...search, scope }, KIND_RECIPES).scope).toBe(SCOPE_OWN)
    }
  })

  it('goes to "Zuletzt" without "only confirmed" when switching from recipes to foods', () => {
    const recipes = { ...withKind(search, KIND_RECIPES), query: '' }
    expect(withKind({ ...recipes, scope: SCOPE_PUBLIC }, KIND_FOODS)).toEqual({
      query: '',
      scope: SCOPE_RECENT,
      confirmedOnly: false,
      kind: KIND_FOODS,
    })
  })

  it('goes to "Alle" instead when switching to foods with a search text', () => {
    const recipes = withKind(search, KIND_RECIPES)
    expect(withKind({ ...recipes, scope: SCOPE_PUBLIC }, KIND_FOODS)).toEqual({
      query: 'quark',
      scope: null,
      confirmedOnly: false,
      kind: KIND_FOODS,
    })
  })

  it('changes nothing when the kind shown is chosen again', () => {
    expect(withKind(search, KIND_FOODS)).toEqual(search)
    const publicRecipes = { ...search, scope: SCOPE_PUBLIC, confirmedOnly: false, kind: KIND_RECIPES }
    expect(withKind(publicRecipes, KIND_RECIPES)).toEqual(publicRecipes)
  })

  it('has "Zuletzt" as the default for foods and "Eigene" for recipes and user items', () => {
    expect(defaultScope(KIND_FOODS)).toBe(SCOPE_RECENT)
    expect(defaultScope(KIND_RECIPES)).toBe(SCOPE_OWN)
    expect(defaultScope(KIND_USER_ITEMS)).toBe(SCOPE_OWN)
  })
})

describe('recent scope', () => {
  it('is for foods only', () => {
    expect(recentScopeAvailable(KIND_FOODS)).toBe(true)
    expect(recentScopeAvailable(KIND_RECIPES)).toBe(false)
  })

  it('is left for "Eigene" when switching to recipes', () => {
    const recent = { query: '', scope: SCOPE_RECENT, confirmedOnly: false, kind: KIND_FOODS }
    expect(withKind(recent, KIND_RECIPES)).toEqual({ ...recent, kind: KIND_RECIPES, scope: SCOPE_OWN })
  })

  it('is where the food searches start', () => {
    expect(NEW_SEARCH).toEqual({ query: '', scope: SCOPE_RECENT, confirmedOnly: false, kind: KIND_FOODS })
  })
})

describe('withQuery', () => {
  it('switches from "Zuletzt" to "Alle" with the first letter, and stays there when emptied', () => {
    const typed = withQuery(NEW_SEARCH, 'm')
    expect(typed).toEqual({ ...NEW_SEARCH, query: 'm', scope: null })
    expect(withQuery(typed, '')).toEqual({ ...NEW_SEARCH, scope: null })
  })

  it('switches for a scanned EAN too, but not for spaces only', () => {
    expect(withQuery(NEW_SEARCH, '4006040001234').scope).toBe(null)
    expect(withQuery(NEW_SEARCH, '  ')).toEqual({ ...NEW_SEARCH, query: '  ' })
  })

  it('switches again after "Zuletzt" was chosen once more', () => {
    const recentAgain = withScope(withQuery(NEW_SEARCH, 'milch'), SCOPE_RECENT)
    expect(recentAgain).toEqual(NEW_SEARCH)
    expect(withQuery(recentAgain, 'k').scope).toBe(null)
  })

  it('keeps every other filter and "only confirmed"', () => {
    for (const scope of [null, SCOPE_PUBLIC, SCOPE_OWN, SCOPE_FRIENDS]) {
      expect(withQuery({ ...NEW_SEARCH, scope }, 'milch').scope).toBe(scope)
    }
    const confirmed = { ...NEW_SEARCH, scope: SCOPE_PUBLIC, confirmedOnly: true }
    expect(withQuery(confirmed, 'milch')).toEqual({ ...confirmed, query: 'milch' })
    expect(withQuery({ ...NEW_SEARCH, kind: KIND_RECIPES, scope: SCOPE_OWN }, 'k').scope).toBe(SCOPE_OWN)
    expect(withQuery(USER_ITEM_SEARCH, 'k')).toEqual({ ...USER_ITEM_SEARCH, query: 'k' })
  })
})

describe('isIdleSearch', () => {
  it('waits for the first letter for all foods and public foods', () => {
    expect(isIdleSearch({ query: '', scope: null, kind: KIND_FOODS })).toBe(true)
    expect(isIdleSearch({ query: '  ', scope: SCOPE_PUBLIC, kind: KIND_FOODS })).toBe(true)
    expect(isIdleSearch({ query: 'a', scope: null, kind: KIND_FOODS })).toBe(false)
    expect(isIdleSearch({ query: 'a', scope: SCOPE_PUBLIC, kind: KIND_FOODS })).toBe(false)
  })

  it('shows own foods, those of friends and the recently booked ones right away', () => {
    for (const scope of [SCOPE_OWN, SCOPE_FRIENDS, SCOPE_RECENT]) {
      expect(isIdleSearch({ query: '', scope, kind: KIND_FOODS })).toBe(false)
      expect(isIdleSearch({ query: '  ', scope, kind: KIND_FOODS })).toBe(false)
    }
  })

  it('lists recipes right away with every filter', () => {
    for (const scope of [null, SCOPE_PUBLIC, SCOPE_OWN, SCOPE_FRIENDS]) {
      expect(isIdleSearch({ query: '', scope, kind: KIND_RECIPES })).toBe(false)
    }
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

describe('user items', () => {
  it('start with "Eigene" in the shopping list search', () => {
    expect(USER_ITEM_SEARCH).toEqual({ query: '', scope: SCOPE_OWN, confirmedOnly: false, kind: KIND_USER_ITEMS })
  })

  it('only offer "Eigene" and "Freunde"', () => {
    expect(scopeAvailable(KIND_USER_ITEMS, SCOPE_OWN)).toBe(true)
    expect(scopeAvailable(KIND_USER_ITEMS, SCOPE_FRIENDS)).toBe(true)
    for (const scope of [null, SCOPE_PUBLIC, SCOPE_RECENT]) {
      expect(scopeAvailable(KIND_USER_ITEMS, scope)).toBe(false)
    }
  })

  it('never offer "Nur bestätigte"', () => {
    for (const scope of [null, SCOPE_OWN, SCOPE_FRIENDS]) {
      expect(confirmedFilterAvailable({ kind: KIND_USER_ITEMS, scope })).toBe(false)
    }
  })

  it('leave the scopes of foods and recipes as they were', () => {
    for (const scope of [null, SCOPE_PUBLIC, SCOPE_OWN, SCOPE_FRIENDS, SCOPE_RECENT]) {
      expect(scopeAvailable(KIND_FOODS, scope)).toBe(true)
    }
    expect(scopeAvailable(KIND_RECIPES, SCOPE_RECENT)).toBe(false)
    expect(scopeAvailable(KIND_RECIPES, SCOPE_PUBLIC)).toBe(true)
  })

  it('switch to "Eigene" and "Nur bestätigte" off when chosen', () => {
    const foods = { query: 'milch', scope: SCOPE_PUBLIC, confirmedOnly: true, kind: KIND_FOODS }
    expect(withKind(foods, KIND_USER_ITEMS)).toEqual({ query: 'milch', scope: SCOPE_OWN, confirmedOnly: false, kind: KIND_USER_ITEMS })
    expect(withKind({ ...foods, scope: null }, KIND_USER_ITEMS).scope).toBe(SCOPE_OWN)
    expect(withKind({ ...foods, scope: SCOPE_RECENT }, KIND_USER_ITEMS).scope).toBe(SCOPE_OWN)
  })

  it('go to "Alle" for foods with a text and to "Eigene" for recipes when switching', () => {
    const userItems = { ...USER_ITEM_SEARCH, query: 'milch' }
    expect(withKind(userItems, KIND_FOODS)).toEqual({ query: 'milch', scope: null, confirmedOnly: false, kind: KIND_FOODS })
    expect(withKind({ ...userItems, scope: SCOPE_FRIENDS }, KIND_FOODS).scope).toBe(null)
    expect(withKind({ ...userItems, scope: SCOPE_FRIENDS }, KIND_RECIPES).scope).toBe(SCOPE_OWN)
  })

  it('show all own items right away, without typing', () => {
    expect(isIdleSearch(USER_ITEM_SEARCH)).toBe(false)
    expect(isIdleSearch({ ...USER_ITEM_SEARCH, kind: KIND_FOODS, scope: null })).toBe(true)
  })
})

describe('canCreateUserItem', () => {
  const search = { ...USER_ITEM_SEARCH, query: ' Milch ' }
  const loaded = (...names) => ({ loaded: true, entries: names.map((name, id) => ({ id, name })) })

  it('allows a name that no own item has, even if others contain it', () => {
    expect(canCreateUserItem(search, loaded())).toBe(true)
    expect(canCreateUserItem(search, loaded('Hafermilch', 'Milchreis'))).toBe(true)
  })

  it('refuses a name an own item has already, in any case', () => {
    expect(canCreateUserItem(search, loaded('milch'))).toBe(false)
    expect(canCreateUserItem(search, loaded('Hafermilch', 'MILCH'))).toBe(false)
  })

  it('waits for the results of the text', () => {
    expect(canCreateUserItem(search, { loaded: false, entries: [] })).toBe(false)
  })

  it('needs a name', () => {
    expect(canCreateUserItem({ ...search, query: '   ' }, loaded())).toBe(false)
  })

  it('is only for own user items', () => {
    expect(canCreateUserItem({ ...search, scope: SCOPE_FRIENDS }, loaded())).toBe(false)
    expect(canCreateUserItem({ ...search, kind: KIND_FOODS, scope: SCOPE_OWN }, loaded())).toBe(false)
  })
})
