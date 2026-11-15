// The filters of the search views (food database, booking, shopping list). Pure functions, see
// catalog.test.js.

// What a search shows: foods or recipes.
export const KIND_FOODS = 'foods'
export const KIND_RECIPES = 'recipes'

// Whose entries a search shows, as the backend names them. null (the "Alle" choice) means
// everything the user may see.
export const SCOPE_PUBLIC = 'PUBLIC'
export const SCOPE_OWN = 'OWN'
export const SCOPE_FRIENDS = 'FRIENDS'

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

// The search after choosing another scope or kind, "Nur bestätigte" switched off if it no longer
// applies.
export function withScope(search, scope) {
  return withConfirmedFilterFitting({ ...search, scope })
}

export function withKind(search, kind) {
  return withConfirmedFilterFitting({ ...search, kind })
}
