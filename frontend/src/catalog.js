// The filters of the search views (food database, booking, shopping list). Pure functions, see
// catalog.test.js.

// What a search shows: foods or recipes. KIND_USER_ITEMS ("Benutzeritems"): the user's items
// (only a name, e.g. "Spülmittel"), offered by the search behind "Hinzufügen" of the shopping list
// only, where it is preselected.
export const KIND_FOODS = 'foods'
export const KIND_RECIPES = 'recipes'
export const KIND_USER_ITEMS = 'userItems'

// Whose entries a search shows, as the backend names them. null (the "Alle" choice) means
// everything the user may see. RECENT ("Zuletzt"): the foods the user booked last (at most 30, see
// FoodService.RECENT_COUNT in the backend); recipes are not recorded as booked, so it is for foods
// only.
export const SCOPE_PUBLIC = 'PUBLIC'
export const SCOPE_OWN = 'OWN'
export const SCOPE_FRIENDS = 'FRIENDS'
export const SCOPE_RECENT = 'RECENT'

// The results come in pages of this size (?page=0, 1, ...); the next one is loaded while the
// list is scrolled. A page with fewer entries is the last one.
export const CATALOG_PAGE_SIZE = 50

// "Nur bestätigte" (values from an official source) is off when a search starts and is switched on
// by hand. Only foods can be confirmed, there are no confirmed recipes. For the user's own entries
// and those of friends the filter makes no sense either. Where it does not apply it cannot be
// switched on and is switched off, also when the search goes back to foods or to everything.
export function confirmedFilterAvailable({ kind, scope }) {
  return kind === KIND_FOODS && (scope === null || scope === SCOPE_PUBLIC)
}

// User items are never public and are not booked: only "Eigene" and "Freunde" apply to them.
// The search starts with "Eigene".
export const USER_ITEM_SCOPES = [SCOPE_OWN, SCOPE_FRIENDS]
export const USER_ITEM_DEFAULT_SCOPE = SCOPE_OWN

// Whether the scope (null: "Alle") can be chosen for the kind.
export function scopeAvailable(kind, scope) {
  if (kind === KIND_USER_ITEMS) return USER_ITEM_SCOPES.includes(scope)
  return scope !== SCOPE_RECENT || recentScopeAvailable(kind)
}

// The search the shopping list opens with: user items, own ones.
export const USER_ITEM_SEARCH = {
  query: '',
  scope: USER_ITEM_DEFAULT_SCOPE,
  confirmedOnly: false,
  kind: KIND_USER_ITEMS,
}

function withConfirmedFilterFitting(search) {
  return confirmedFilterAvailable(search) ? search : { ...search, confirmedOnly: false }
}

// "Zuletzt" only for foods, see SCOPE_RECENT.
export function recentScopeAvailable(kind) {
  return kind === KIND_FOODS
}

// The search after choosing another scope or kind, "Nur bestätigte" switched off if it no longer
// applies. Switching to recipes while "Zuletzt" is chosen goes back to "Alle". Switching to user
// items starts with "Eigene"; leaving them goes back to "Alle", like a new search of foods.
export function withScope(search, scope) {
  return withConfirmedFilterFitting({ ...search, scope })
}

export function withKind(search, kind) {
  let { scope } = search
  if (kind === KIND_USER_ITEMS) {
    if (search.kind !== KIND_USER_ITEMS || !scopeAvailable(kind, scope)) scope = USER_ITEM_DEFAULT_SCOPE
  } else if (search.kind === KIND_USER_ITEMS || !scopeAvailable(kind, scope)) {
    scope = null
  }
  return withConfirmedFilterFitting({ ...search, kind, scope })
}

// "+" next to the filters of the shopping list search creates a user item named as typed. Only
// for own user items, only with something typed, and only once the results for that text are
// there and none of them has exactly that name (any case), so no item is created twice. Items that
// merely contain the text ("Hafermilch" while "Milch" is typed) do not count.
export function canCreateUserItem(search, { entries, loaded }) {
  const name = search.query.trim()
  if (search.kind !== KIND_USER_ITEMS || search.scope !== SCOPE_OWN || name === '' || !loaded) return false
  const lower = name.toLocaleLowerCase()
  return !entries.some((entry) => entry.name.trim().toLocaleLowerCase() === lower)
}

// Nothing is searched before the first letter: the whole database is no useful list. "Zuletzt" is
// short and shows its foods right away, and so are the user's items, which typing filters.
export function isIdleSearch({ query, scope, kind }) {
  return query.trim() === '' && scope !== SCOPE_RECENT && kind !== KIND_USER_ITEMS
}

// The entries with the next page appended. An entry can come twice when something was added or
// renamed between two pages; it stays where it was.
export function appendPage(entries, page) {
  const ids = new Set(entries.map((entry) => entry.id))
  return [...entries, ...page.filter((entry) => !ids.has(entry.id))]
}

export function isLastPage(page) {
  return page.length < CATALOG_PAGE_SIZE
}

// Remembers the results of the last searches (key: kind, text, filters and version, see
// catalogKey), so going back to an earlier filter or text shows its list at once, with the pages
// already scrolled through. At most maxEntries searches, the least recently used ones go first;
// after maxAgeMs a search is loaded anew, so changes by others show up. now: the time in ms.
export function createCatalogCache({ maxEntries, maxAgeMs }) {
  const entries = new Map()
  return {
    get(key, now) {
      const entry = entries.get(key)
      if (!entry) return null
      entries.delete(key)
      if (now - entry.savedAt > maxAgeMs) return null
      entries.set(key, entry) // most recently used last
      return entry.value
    },
    set(key, value, now) {
      entries.delete(key)
      entries.set(key, { value, savedAt: now })
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value)
    },
    clear() {
      entries.clear()
    },
  }
}

// The search text counts as it is sent: without spaces around it.
export function catalogKey(kind, { query, scope, confirmedOnly }, version) {
  return JSON.stringify([kind, query.trim(), scope, confirmedOnly, version])
}
