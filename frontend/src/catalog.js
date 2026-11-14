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

// "Nur bestätigte" follows the scope: on for everything and for public entries, where the
// confirmed ones (values from an official source) are what one looks for; off for the user's own
// entries and those of friends, which are rarely confirmed. It can still be switched by hand.
export function confirmedByDefault(scope) {
  return scope === null || scope === SCOPE_PUBLIC
}

// The search after choosing another scope, with "Nur bestätigte" set to fit it.
export function withScope(search, scope) {
  return { ...search, scope, confirmedOnly: confirmedByDefault(scope) }
}

// Only foods can be confirmed so far, recipes not. For recipes "Nur bestätigte" is therefore greyed
// out and not sent with the search. The choice is kept and applies again once the search switches
// back to foods.
export function confirmedFilterApplies(kind) {
  return kind === KIND_FOODS
}
