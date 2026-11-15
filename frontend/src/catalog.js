// The filters of the search views (food database, booking, shopping list). Pure functions, see
// catalog.test.js.

// What a search shows: foods or recipes.
export const KIND_FOODS = 'foods'
export const KIND_RECIPES = 'recipes'

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

function withConfirmedFilterFitting(search) {
  return confirmedFilterAvailable(search) ? search : { ...search, confirmedOnly: false }
}

// "Zuletzt" only for foods, see SCOPE_RECENT.
export function recentScopeAvailable(kind) {
  return kind === KIND_FOODS
}

// The search after choosing another scope or kind, "Nur bestätigte" switched off if it no longer
// applies. Switching to recipes while "Zuletzt" is chosen goes back to "Alle".
export function withScope(search, scope) {
  return withConfirmedFilterFitting({ ...search, scope })
}

export function withKind(search, kind) {
  const scope = search.scope === SCOPE_RECENT && !recentScopeAvailable(kind) ? null : search.scope
  return withConfirmedFilterFitting({ ...search, kind, scope })
}

// Nothing is searched before the first letter: the whole database is no useful list. "Zuletzt" is
// short and shows its foods right away.
export function isIdleSearch({ query, scope }) {
  return query.trim() === '' && scope !== SCOPE_RECENT
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
