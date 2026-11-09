import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import './App.css'
import {
  API,
  clearToken,
  getServerUrl,
  isUnencrypted,
  loadSession,
  normalizeServerUrl,
  request,
  requestAt,
  saveSession,
  setUnauthorizedHandler,
} from './api.js'
import {
  convertQuantity,
  kcalOf,
  onePortion,
  roundToOneDecimal,
  scaleItems,
  shareOf,
  totalsOf,
} from './recipes.js'

const SEARCH_PARAM = 'query'
const SCOPE_PARAM = 'scope'

const IS_NATIVE = Capacitor.isNativePlatform() // true inside the Android app, false in a browser
const DEFAULT_AMOUNT_G = 100 // added by the + button, preset in the detail view
const SEARCH_DELAY_MS = 250 // search only once typing pauses
const ADDED_FEEDBACK_MS = 600 // how long the + button shows ✓
const MAX_TITLE_LENGTH = 100
const LOCALE = 'de-DE'
const DATE_TIME_FORMAT = { dateStyle: 'short', timeStyle: 'short' }

// Same rules as the backend (RegisterRequest, UserSettingsRequest).
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72 // bcrypt only uses the first 72 bytes, the backend rejects longer passwords
const MAX_CALORIE_TARGET = 20000

const COLOR_THEMES = [
  { value: 'LIGHT', label: 'Hell' },
  { value: 'DARK', label: 'Dunkel' },
]

// The meal being put together; mealId is null for a new meal.
// Entries are { food, amountG, baseG, labels }. baseG is the amount already saved in the meal,
// so amountG - baseG is what the preview shows as "+X g". labels are what the entry was added as
// (the food's own name, or the names of the recipes it came with); they make up the meal title.
const NEW_DRAFT = { mealId: null, entries: [] }

const NEW_FOOD = { id: null, owned: true, published: false }

// The recipe in the recipe editor. Items are { food, amountG }; their amounts cannot be changed
// once added, only removed and added again.
const NEW_RECIPE = {
  id: null,
  owned: true,
  name: '',
  servingsText: '1',
  published: false,
  wasPublished: false,
  items: [],
}

// The two kinds of entries in the search, and the filters that apply to both.
const KIND_FOODS = 'foods'
const KIND_RECIPES = 'recipes'
const CATALOG_KINDS = [
  { value: KIND_FOODS, label: 'Lebensmittel' },
  { value: KIND_RECIPES, label: 'Rezepte' },
]
const KIND_URLS = { [KIND_FOODS]: API.foods, [KIND_RECIPES]: API.recipes }

// At most one filter is active; without one the search shows everything the user may see
// (own entries, private ones included, and all public ones). Values as the backend expects them.
const SCOPE_FILTERS = [
  { value: 'PUBLIC', label: 'Öffentlich', Icon: GlobeIcon },
  { value: 'OWN', label: 'Eigene', Icon: PersonIcon },
  { value: 'CONFIRMED', label: 'Bestätigt', Icon: SealIcon, disabled: true }, // nobody confirms yet
  { value: 'FRIENDS', label: 'Freunde', Icon: PeopleIcon, disabled: true }, // no friends yet
]

const UNIT_PORTION = 'portion'
const UNIT_GRAM = 'gram'

function fetchCatalog(kind, query, scope, signal) {
  const params = new URLSearchParams()
  const search = query.trim()
  if (search) params.set(SEARCH_PARAM, search)
  if (scope) params.set(SCOPE_PARAM, scope)
  const paramText = params.toString()
  return request(paramText ? `${KIND_URLS[kind]}?${paramText}` : KIND_URLS[kind], { signal })
}

// Records without an id yet are created (POST), existing ones are replaced (PUT /{id}).
function createOrUpdate(url, id, data) {
  const body = JSON.stringify(data)
  return id === null
    ? request(url, { method: 'POST', body })
    : request(`${url}/${id}`, { method: 'PUT', body })
}

function mealRequest(entries) {
  const labels = [...new Set(entries.flatMap((entry) => entry.labels))]
  return {
    title: makeTitle(labels),
    items: entries.map((entry) => ({ foodId: entry.food.id, amountG: entry.amountG })),
  }
}

const toText = (value) => String(value ?? '')

const formatNumber = (n) => roundToOneDecimal(n).toLocaleString(LOCALE)
const formatKcal = (kcal) => `${Math.round(kcal).toLocaleString(LOCALE)} kcal`
const formatServings = (servings) =>
  `${formatNumber(servings)} ${servings === 1 ? 'Portion' : 'Portionen'}`

// e.g. "Apfel, Banane, Brot +2"
function makeTitle(names) {
  const shown = names.slice(0, 3).join(', ')
  const hiddenCount = names.length - 3
  const title = hiddenCount > 0 ? `${shown} +${hiddenCount}` : shown
  return title.slice(0, MAX_TITLE_LENGTH)
}

// label: what the amount is added as, see NEW_DRAFT. Defaults to the food itself.
function addAmount(entries, food, amountG, label = food.name) {
  if (!entries.some((entry) => entry.food.id === food.id)) {
    return [...entries, { food, amountG, baseG: 0, labels: [label] }]
  }
  return entries.map((entry) =>
    entry.food.id === food.id
      ? {
          ...entry,
          amountG: roundToOneDecimal(entry.amountG + amountG),
          labels: entry.labels.includes(label) ? entry.labels : [...entry.labels, label],
        }
      : entry,
  )
}

// A booked recipe: all its (scaled) foods, labelled with the recipe name.
function addRecipeItems(entries, items, recipeName) {
  return items
    .filter((item) => item.amountG > 0)
    .reduce((result, item) => addAmount(result, item.food, item.amountG, recipeName), entries)
}

// Meal items only carry the kcal of their amount, so the value per 100 g is derived from it.
// A meal whose title is not the one made from its foods was booked from a recipe (or several):
// its items keep that title as their label, so it survives editing the meal.
function entriesFromMeal(meal) {
  const titleFromFoods = makeTitle(meal.items.map((item) => item.foodName))
  const keepsTitle = meal.title !== titleFromFoods
  return meal.items.map((item) => {
    const kcalPer100g = item.amountG > 0 ? (item.kcal / item.amountG) * 100 : 0
    return {
      food: { id: item.foodId, name: item.foodName, kcalPer100g },
      amountG: item.amountG,
      baseG: item.amountG,
      labels: [keepsTitle ? meal.title : item.foodName],
    }
  })
}

// Same food twice: the amounts are added up, like in the backend.
function mergeItems(items, added) {
  const merged = items.map((item) => ({ ...item }))
  for (const { food, amountG } of added) {
    const existing = merged.find((item) => item.food.id === food.id)
    if (existing) existing.amountG = roundToOneDecimal(existing.amountG + amountG)
    else merged.push({ food, amountG })
  }
  return merged
}

function recipeDraftFrom(recipe) {
  return {
    id: recipe.id,
    owned: recipe.owned,
    name: recipe.name,
    servingsText: String(recipe.servings),
    published: recipe.published,
    wasPublished: recipe.published,
    items: recipe.items.map((item) => ({ food: item.food, amountG: item.amountG })),
  }
}

function recipeRequest(draft) {
  return {
    name: draft.name.trim(),
    servings: parseFloat(draft.servingsText),
    published: draft.published,
    items: draft.items.map((item) => ({ foodId: item.food.id, amountG: item.amountG })),
  }
}

const iconProps = {
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function FoodDbIcon() {
  return (
    <svg viewBox="0 0 48 24" width="48" {...iconProps}>
      <path d="M12 8.2C10.8 7.2 9 6.8 7.4 7.4 5.2 8.2 4 10.3 4 12.8 4 16.6 6.6 21 9 21c1.2 0 1.8-.6 3-.6s1.8.6 3 .6c2.4 0 5-4.4 5-8.2 0-2.5-1.2-4.6-3.4-5.4-1.6-.6-3.4-.2-4.6.8z" />
      <path d="M12 8.2C12 5.8 13 4.2 14.8 3" />
      <ellipse cx="36" cy="6.5" rx="7" ry="2.8" />
      <path d="M29 6.5v11c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-11" />
      <path d="M29 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" {...iconProps}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
      <path d="M3.5 3.5v5h5" />
    </svg>
  )
}

function AvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" {...iconProps}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.3 18.6c1.3-2.2 3.3-3.4 5.7-3.4s4.4 1.2 5.7 3.4" />
    </svg>
  )
}

function PlusIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} {...iconProps} height={size} strokeWidth={2.4}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" {...iconProps} height="22">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

// Small monochrome line icons of the filter buttons, the unit selects and the "private" mark.
const smallIconProps = { ...iconProps, width: 16, height: 16, viewBox: '0 0 24 24' }

function GlobeIcon() {
  return (
    <svg {...smallIconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg {...smallIconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  )
}

function SealIcon() {
  return (
    <svg {...smallIconProps}>
      <path d="M12 2.8l2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.9 2.7.9 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.2l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.9-2.7-.9-2.7 2.3-1.6.9-2.7 2.8.2z" />
      <path d="M8.8 12.2l2.2 2.2 4.2-4.6" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg {...smallIconProps}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c1.1-3.2 3.4-5 6.5-5s5.4 1.8 6.5 5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M17.8 15.4c1.7.7 3 2.3 3.7 4.6" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg {...smallIconProps}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg {...smallIconProps} width="13" height="13" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

// Marks entries only the owner can see.
function PrivateMark({ entry }) {
  if (entry.published) return null
  return (
    <span className="private-mark" title="Privat" aria-label="privat">
      <LockIcon />
    </span>
  )
}

// Foods or recipes (kind) matching `query` and the filter `scope`, loaded once typing pauses.
// A change of `version` loads them again, e.g. after something was saved.
// onError must be stable (e.g. a state setter), otherwise every render restarts the request.
function useCatalog(kind, query, scope, version, onError) {
  // Results remember their kind: right after switching, the old list must not be shown as the new kind.
  const [result, setResult] = useState({ kind, entries: [] })

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setResult({ kind, entries: await fetchCatalog(kind, query, scope, controller.signal) })
        onError(null)
      } catch (error) {
        if (!controller.signal.aborted) onError(error.message)
      }
    }, SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [kind, query, scope, version, onError])

  return result.kind === kind ? result.entries : []
}

// Runs one backend action at a time: clicks while a request is still running are ignored
// (no double submits), and a failure is shown in the error banner instead of being thrown.
function useActionRunner(onError) {
  const isRunning = useRef(false)

  return async function runAction(action) {
    if (isRunning.current) return
    isRunning.current = true
    try {
      await action()
    } catch (error) {
      onError(error.message)
    } finally {
      isRunning.current = false
    }
  }
}

function KcalPer100g({ kcal }) {
  return <>{Math.round(kcal)} kcal pro 100 g</>
}

function CrossButton({ label, onClick }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      ×
    </button>
  )
}

// The "×" left of a search field: outlined square, as tall as the field.
function FramedCloseButton({ label, onClick }) {
  return (
    <button type="button" className="frame-btn" title={label} aria-label={label} onClick={onClick}>
      <CloseIcon />
    </button>
  )
}

function TopBar({ title, closeLabel, onClose, centered = false }) {
  return (
    <div className={centered ? 'topbar centered' : 'topbar'}>
      <CrossButton label={closeLabel} onClick={onClose} />
      <h1>{title}</h1>
    </div>
  )
}

// Search field with the filter row below it. Both stick to the top while the list scrolls.
// children: extra buttons right of the kind select (the "+" of the food database).
function CatalogHeader({ search, onSearchChange, closeLabel, onClose, kindLocked = false, children }) {
  const { query, scope, kind } = search
  const placeholder = kind === KIND_RECIPES ? 'Rezepte suchen' : 'Lebensmittel suchen'

  return (
    <div className="search-head">
      <div className="search">
        <FramedCloseButton label={closeLabel} onClick={onClose} />
        <input
          type="search"
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          autoFocus
          value={query}
          onChange={(event) => onSearchChange({ ...search, query: event.target.value })}
        />
      </div>
      <div className="catalog-filter">
        <div className="filter-pills" role="group" aria-label="Filter">
          {SCOPE_FILTERS.map(({ value, label, Icon, disabled }) => (
            <button
              key={value}
              type="button"
              className="pill"
              aria-pressed={scope === value}
              disabled={disabled}
              title={disabled ? `${label}: kommt bald` : undefined}
              onClick={() => onSearchChange({ ...search, scope: scope === value ? null : value })}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <div className="filter-end">
          <SelectBox
            label="Art"
            value={kindLocked ? KIND_FOODS : kind}
            options={CATALOG_KINDS}
            disabled={kindLocked}
            onChange={(value) => onSearchChange({ ...search, kind: value })}
          />
          {children}
        </div>
      </div>
    </div>
  )
}

const NEW_SEARCH = { query: '', scope: null, kind: KIND_FOODS }

// A native select (for the phone's own picker) with a monochrome chevron.
function SelectBox({ label, value, options, disabled = false, className = '', onChange }) {
  return (
    <span className={`select-box ${className}`}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon />
    </span>
  )
}

// Two-option switch between private and public.
function VisibilitySwitch({ published, disabled = false, onChange }) {
  const labelId = useId()
  const options = [
    { value: false, label: 'Privat' },
    { value: true, label: 'Öffentlich' },
  ]
  return (
    <div className="field">
      <span id={labelId}>Sichtbarkeit</span>
      <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={published === option.value}
            className={published === option.value ? 'selected' : undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// tone: 'danger' for destructive actions, 'primary' otherwise.
function ConfirmDialog({ title, text, confirmLabel, tone = 'danger', onConfirm, onClose }) {
  const titleId = useId()
  const textId = useId()

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  // Only a click on the dark backdrop itself closes the dialog, not one inside it.
  function closeOnBackdropClick(event) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="overlay" onClick={closeOnBackdropClick}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={textId}>{text}</p>
        <div className="actions">
          <button type="button" className="btn" autoFocus onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className={`btn ${tone}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function MealList({ meals, onAdd, onEdit, onDelete, onDeleteAll, onOpenFoods, onOpenProfile }) {
  const totalKcal = meals.reduce((sum, meal) => sum + meal.kcal, 0)

  return (
    <section>
      <div className="list-head">
        <div className="toolbar">
          <button
            type="button"
            className="tool-btn"
            title="Lebensmitteldatenbank"
            aria-label="Lebensmitteldatenbank"
            onClick={onOpenFoods}
          >
            <FoodDbIcon />
          </button>
          <button
            type="button"
            className="tool-btn danger"
            title="Alle Mahlzeiten löschen"
            aria-label="Alle Mahlzeiten löschen"
            disabled={meals.length === 0}
            onClick={onDeleteAll}
          >
            <ResetIcon />
          </button>
          <button
            type="button"
            className="tool-btn"
            title="Profil"
            aria-label="Profil"
            onClick={onOpenProfile}
          >
            <AvatarIcon />
          </button>
        </div>
        <div className="total" role="status" aria-label="Gesamtkalorien">
          <span className="total-value">{Math.round(totalKcal).toLocaleString(LOCALE)}</span>
          <span className="total-unit">kcal</span>
        </div>
      </div>

      {meals.length > 0 && (
        <div className="rows">
          {meals.map((meal) => (
            <MealRow key={meal.id} meal={meal} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}

      <div className="bar">
        <button type="button" className="btn primary" onClick={onAdd}>
          Mahlzeit buchen
        </button>
      </div>
    </section>
  )
}

function MealRow({ meal, onEdit, onDelete }) {
  const bookedAt = new Date(meal.bookedAt).toLocaleString(LOCALE, DATE_TIME_FORMAT)
  const items = meal.items
    .map((item) => `${item.foodName} ${Math.round(item.amountG)} g`)
    .join(', ')

  return (
    <div className="row">
      <button type="button" className="row-open" onClick={() => onEdit(meal)}>
        <span className="main">
          <span className="name">{meal.title}</span>
          <span className="sub">{bookedAt}</span>
          <span className="sub">{items}</span>
        </span>
        <span className="kcal">{Math.round(meal.kcal)} kcal</span>
      </button>
      <CrossButton label="Mahlzeit stornieren" onClick={() => onDelete(meal.id)} />
    </div>
  )
}

// The search behind "Mahlzeit buchen", and the one that adds foods to a recipe (kindLocked:
// recipes cannot contain recipes). Stays mounted while hidden, so search and filter survive.
function FoodSearch({
  visible,
  kindLocked = false,
  draftCount,
  submitLabel,
  closeLabel = 'Abbrechen',
  onOpenFood,
  onAddFood,
  onOpenRecipe,
  onAddRecipe,
  onPreview,
  onSubmit,
  onClose,
  onError,
}) {
  const [search, setSearch] = useState(NEW_SEARCH)
  const kind = kindLocked ? KIND_FOODS : search.kind
  const entries = useCatalog(kind, search.query, search.scope, 0, onError)

  return (
    <section hidden={!visible}>
      <CatalogHeader
        search={search}
        onSearchChange={setSearch}
        kindLocked={kindLocked}
        closeLabel={closeLabel}
        onClose={onClose}
      />
      {entries.length === 0 ? (
        <p className="empty">
          {kind === KIND_RECIPES ? 'Kein Rezept gefunden.' : 'Kein Lebensmittel gefunden.'}
        </p>
      ) : (
        <div className="rows">
          {kind === KIND_RECIPES
            ? entries.map((recipe) => (
                <RecipeSearchRow
                  key={recipe.id}
                  recipe={recipe}
                  onOpen={onOpenRecipe}
                  onAdd={onAddRecipe}
                />
              ))
            : entries.map((food) => (
                <FoodSearchRow key={food.id} food={food} onOpen={onOpenFood} onAdd={onAddFood} />
              ))}
        </div>
      )}
      <div className="bar">
        <button type="button" className="btn small" onClick={onPreview}>
          Vorschau ({draftCount})
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={draftCount === 0}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </section>
  )
}

// The "+" of a search row, showing ✓ for a moment after a click.
function QuickAddButton({ label, onAdd }) {
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [justAdded])

  function add() {
    onAdd()
    setJustAdded(true)
  }

  return (
    <button type="button" className="add" aria-label={label} onClick={add}>
      {justAdded ? '✓' : '+'}
    </button>
  )
}

function FoodSearchRow({ food, onOpen, onAdd }) {
  return (
    <div className="row">
      <button type="button" className="row-open wrap" onClick={() => onOpen(food)}>
        <span className="main">
          <span className="name">
            {food.name}
            <PrivateMark entry={food} />
          </span>
          <span className="sub">
            <KcalPer100g kcal={food.kcalPer100g} />
          </span>
        </span>
        <span className="amount">{`${DEFAULT_AMOUNT_G} g`}</span>
      </button>
      <QuickAddButton
        label={`${food.name} hinzufügen`}
        onAdd={() => onAdd(food, DEFAULT_AMOUNT_G)}
      />
    </div>
  )
}

function RecipeSummary({ recipe }) {
  return (
    <>
      {formatKcal(recipe.kcal / recipe.servings)} pro Portion · {formatServings(recipe.servings)}
    </>
  )
}

// "+" books one portion as saved in the recipe; the row itself opens the booking view.
function RecipeSearchRow({ recipe, onOpen, onAdd }) {
  return (
    <div className="row">
      <button type="button" className="row-open wrap" onClick={() => onOpen(recipe)}>
        <span className="main">
          <span className="name">
            {recipe.name}
            <PrivateMark entry={recipe} />
          </span>
          <span className="sub">
            <RecipeSummary recipe={recipe} />
          </span>
        </span>
        <span className="amount">1 Portion</span>
      </button>
      <QuickAddButton label={`Eine Portion ${recipe.name} hinzufügen`} onAdd={() => onAdd(recipe)} />
    </div>
  )
}

function MealEditor({ entries, onOpenEntry, onRemoveEntry, onAddMore, onClose }) {
  return (
    <section>
      <TopBar title="Mahlzeit bearbeiten" closeLabel="Bearbeiten abbrechen" onClose={onClose} />
      <EntryList entries={entries} onOpen={onOpenEntry} onRemove={onRemoveEntry} />
      <div className="bar">
        <button type="button" className="btn primary" onClick={onAddMore}>
          Weiteres hinzufügen
        </button>
      </div>
    </section>
  )
}

function DraftPreview({ entries, showDelta, onRemoveEntry, onClose }) {
  return (
    <section>
      <TopBar title="Vorschau" closeLabel="Zurück zur Suche" onClose={onClose} />
      <EntryList entries={entries} showDelta={showDelta} onRemove={onRemoveEntry} />
    </section>
  )
}

// Without onOpen (preview) the rows are read-only.
function EntryList({ entries, showDelta = false, onOpen, onRemove }) {
  if (entries.length === 0) {
    return <p className="empty">Noch nichts hinzugefügt.</p>
  }

  return (
    <div className="rows">
      {entries.map((entry) => (
        <EntryRow
          key={entry.food.id}
          entry={entry}
          showDelta={showDelta}
          onOpen={onOpen}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function EntryRow({ entry, showDelta, onOpen, onRemove }) {
  const { food, amountG, baseG } = entry
  const addedG = roundToOneDecimal(amountG - baseG)
  const content = (
    <>
      <span className="main">
        <span className="name">{food.name}</span>
      </span>
      {showDelta && addedG > 0 && <span className="delta">+{addedG} g</span>}
      <span className="amount">{roundToOneDecimal(amountG)} g</span>
    </>
  )

  return (
    <div className="row">
      {onOpen ? (
        <button type="button" className="row-open wrap" onClick={() => onOpen(entry)}>
          {content}
        </button>
      ) : (
        <div className="row-open wrap">{content}</div>
      )}
      <CrossButton label={`${food.name} entfernen`} onClick={() => onRemove(food.id)} />
    </div>
  )
}

function FoodDetail({ food, initialAmountG, confirmLabel, onConfirm, onClose }) {
  const [amountText, setAmountText] = useState(String(initialAmountG))
  const amountG = parseFloat(amountText)
  const isValid = amountG > 0

  function submit(event) {
    event.preventDefault()
    if (isValid) onConfirm(food, amountG)
  }

  return (
    <section>
      <TopBar title={food.name} closeLabel="Schließen" onClose={onClose} centered />
      <p className="detail-line">
        <KcalPer100g kcal={food.kcalPer100g} />
      </p>
      <form onSubmit={submit}>
        <div className="detail-amount">
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            min="1"
            step="any"
            autoFocus
            value={amountText}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setAmountText(event.target.value)}
            aria-label="Menge in Gramm"
          />
          <span>g</span>
        </div>
        <button type="submit" className="btn primary wide" disabled={!isValid}>
          {confirmLabel}
        </button>
      </form>
    </section>
  )
}

// Foods and recipes, to look at, add and edit. Stays mounted while a form is open (hidden),
// so the search survives. version: reloads the list when it changes (after saving).
function FoodDatabase({ hidden, version, onOpenFood, onOpenRecipe, onClose, onError }) {
  const [search, setSearch] = useState(NEW_SEARCH)
  const entries = useCatalog(search.kind, search.query, search.scope, version, onError)
  const isRecipes = search.kind === KIND_RECIPES
  const addLabel = isRecipes ? 'Rezept anlegen' : 'Lebensmittel hinzufügen'

  return (
    <section hidden={hidden}>
      <CatalogHeader
        search={search}
        onSearchChange={setSearch}
        closeLabel="Schließen"
        onClose={onClose}
      >
        <button
          type="button"
          className="add"
          title={addLabel}
          aria-label={addLabel}
          onClick={() => (isRecipes ? onOpenRecipe(null) : onOpenFood(NEW_FOOD))}
        >
          <PlusIcon size={22} />
        </button>
      </CatalogHeader>
      {entries.length === 0 ? (
        <p className="empty">{isRecipes ? 'Kein Rezept gefunden.' : 'Kein Lebensmittel gefunden.'}</p>
      ) : (
        <div className="rows">
          {isRecipes
            ? entries.map((recipe) => (
                <DatabaseRow
                  key={recipe.id}
                  entry={recipe}
                  sub={<RecipeSummary recipe={recipe} />}
                  onOpen={onOpenRecipe}
                />
              ))
            : entries.map((food) => (
                <DatabaseRow
                  key={food.id}
                  entry={food}
                  sub={<KcalPer100g kcal={food.kcalPer100g} />}
                  onOpen={onOpenFood}
                />
              ))}
        </div>
      )}
    </section>
  )
}

function DatabaseRow({ entry, sub, onOpen }) {
  return (
    <div className="row">
      <button type="button" className="row-open" onClick={() => onOpen(entry)}>
        <span className="main">
          <span className="name">
            {entry.name}
            <PrivateMark entry={entry} />
          </span>
          <span className="sub">{sub}</span>
        </span>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  )
}

// Who may change an entry, as a line above a read-only form.
function NotOwnedHint({ what }) {
  return (
    <p className="hint read-only-hint">
      Dieses {what} gehört dir nicht. Du kannst es verwenden, aber nicht ändern.
    </p>
  )
}

// Only the owner can edit; everybody else sees the values read-only.
function FoodForm({ food, onSave, onDelete, onClose }) {
  const isNew = food.id === null
  const readOnly = !food.owned
  const [name, setName] = useState(toText(food.name))
  const [kcal, setKcal] = useState(toText(food.kcalPer100g))
  const [protein, setProtein] = useState(toText(food.protein))
  const [carbs, setCarbs] = useState(toText(food.carbs))
  const [fat, setFat] = useState(toText(food.fat))
  const [published, setPublished] = useState(food.published)

  // Field names as the backend expects them.
  const values = {
    name: name.trim(),
    kcalPer100g: parseFloat(kcal),
    protein: parseFloat(protein),
    carbs: parseFloat(carbs),
    fat: parseFloat(fat),
    published,
  }
  const numbers = [values.kcalPer100g, values.protein, values.carbs, values.fat]
  // An empty field parses to NaN, and NaN >= 0 is false.
  const isValid = values.name !== '' && numbers.every((n) => n >= 0)
  const becomesPrivate = !isNew && food.published && !published

  function submit(event) {
    event.preventDefault()
    if (isValid && !readOnly) onSave(food.id, values)
  }

  let title = 'Lebensmittel bearbeiten'
  if (isNew) title = 'Lebensmittel hinzufügen'
  else if (readOnly) title = 'Lebensmittel'

  return (
    <section>
      <TopBar title={title} closeLabel="Schließen" onClose={onClose} />
      {readOnly && <NotOwnedHint what="Lebensmittel" />}
      <form onSubmit={submit}>
        <fieldset className="plain" disabled={readOnly}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoFocus={!readOnly}
              autoComplete="off"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <NumberField label="Kalorien pro 100 g (kcal)" value={kcal} onChange={setKcal} />
          <NumberField label="Protein" value={protein} onChange={setProtein} />
          <NumberField label="Kohlenhydrate" value={carbs} onChange={setCarbs} />
          <NumberField label="Fett" value={fat} onChange={setFat} />
          <VisibilitySwitch published={published} disabled={readOnly} onChange={setPublished} />
          {becomesPrivate && (
            <p className="hint switch-hint">
              Verwendet schon jemand anderes dieses Lebensmittel, bleibt es für alle öffentlich und
              gehört dann niemandem mehr. Du bekommst eine private Kopie. Deine öffentlichen Rezepte
              damit werden sonst ebenfalls privat.
            </p>
          )}
        </fieldset>
        {!readOnly && (
          <div className="bar">
            {!isNew && (
              <button type="button" className="btn danger-outline" onClick={() => onDelete(food)}>
                Löschen
              </button>
            )}
            <button type="submit" className="btn primary" disabled={!isValid}>
              Speichern
            </button>
          </div>
        )}
      </form>
    </section>
  )
}

// Name, portions, visibility and the foods of a recipe. Added foods can only be removed, not
// changed: remove and add again. Recipes of others are shown read-only.
function RecipeEditor({ draft, onChange, onAddFoods, onSave, onDelete, onClose }) {
  const isNew = draft.id === null
  const readOnly = !draft.owned
  const servings = parseFloat(draft.servingsText)
  const totals = totalsOf(draft.items)
  const isValid = draft.name.trim() !== '' && servings > 0 && draft.items.length > 0

  function update(changes) {
    onChange({ ...draft, ...changes })
  }

  function submit(event) {
    event.preventDefault()
    if (isValid && !readOnly) onSave()
  }

  let title = 'Rezept bearbeiten'
  if (isNew) title = 'Rezept anlegen'
  else if (readOnly) title = 'Rezept'

  return (
    <section>
      <TopBar title={title} closeLabel="Schließen" onClose={onClose} />
      {readOnly && <NotOwnedHint what="Rezept" />}
      <form onSubmit={submit}>
        <fieldset className="plain" disabled={readOnly}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoFocus={isNew}
              autoComplete="off"
              maxLength={100}
              value={draft.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Portionen</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={draft.servingsText}
              onChange={(event) => update({ servingsText: event.target.value })}
            />
            <span className="hint">So viele Portionen ergeben die Mengen unten.</span>
          </label>
          <VisibilitySwitch published={draft.published} onChange={(published) => update({ published })} />
          {draft.published && !draft.wasPublished && (
            <p className="hint switch-hint">
              Deine privaten Lebensmittel in diesem Rezept werden beim Speichern mit veröffentlicht.
            </p>
          )}
        </fieldset>

        <div className="section-head">
          <h2>Zutaten</h2>
          <span className="section-meta">
            {draft.items.length > 0 &&
              `${formatNumber(totals.amountG)} g · ${formatKcal(totals.kcal)}` +
                (servings > 0 ? ` · ${formatKcal(totals.kcal / servings)} pro Portion` : '')}
          </span>
        </div>
        {draft.items.length === 0 ? (
          <p className="empty">Noch keine Lebensmittel.</p>
        ) : (
          <div className="rows">
            {draft.items.map((item) => (
              <div className="row" key={item.food.id}>
                <div className="row-open wrap">
                  <span className="main">
                    <span className="name">
                      {item.food.name}
                      <PrivateMark entry={item.food} />
                    </span>
                    <span className="sub">{formatKcal(kcalOf(item.food, item.amountG))}</span>
                  </span>
                  <span className="amount">{formatNumber(item.amountG)} g</span>
                </div>
                {!readOnly && (
                  <CrossButton
                    label={`${item.food.name} entfernen`}
                    onClick={() =>
                      update({ items: draft.items.filter((other) => other.food.id !== item.food.id) })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {!readOnly && (
          <button type="button" className="btn add-more" onClick={onAddFoods}>
            <PlusIcon size={18} />
            Lebensmittel hinzufügen
          </button>
        )}

        {!readOnly && (
          <div className="bar">
            {!isNew && (
              <button type="button" className="btn danger-outline" onClick={onDelete}>
                Löschen
              </button>
            )}
            <button type="submit" className="btn primary" disabled={!isValid}>
              Rezept speichern
            </button>
          </div>
        )}
      </form>
    </section>
  )
}

const BOOKING_UNITS = [
  { value: UNIT_PORTION, label: 'Portion' },
  { value: UNIT_GRAM, label: 'Gramm' },
]

// Books a recipe into the meal draft: as portions, or as grams of the finished dish. The amounts
// and, depending on the unit, the number of portions or the weight of the dish can be adjusted for
// this one booking; the recipe itself stays as it is. Only the setting that matters for the chosen
// unit is shown. The weight follows the ingredients until it is typed in by hand (e.g. after
// weighing the pot), and follows them again after "Aus Zutaten berechnen".
function RecipeBooking({ recipe, onConfirm, onClose }) {
  const [unit, setUnit] = useState(UNIT_PORTION)
  const [quantityText, setQuantityText] = useState('1')
  const [servingsText, setServingsText] = useState(String(recipe.servings))
  const [items, setItems] = useState(() =>
    recipe.items.map((item) => ({ food: item.food, amountText: String(roundToOneDecimal(item.amountG)) })),
  )
  const [weightText, setWeightText] = useState(null) // null: sum of the ingredients

  const amounts = items.map((item) => ({ food: item.food, amountG: parseFloat(item.amountText) }))
  const amountsValid = amounts.length > 0 && amounts.every((item) => item.amountG >= 0)
  const totals = totalsOf(amountsValid ? amounts : [])
  const weightG = weightText === null ? totals.amountG : parseFloat(weightText)
  const servings = parseFloat(servingsText)
  const quantity = parseFloat(quantityText)
  const isValid = amountsValid && totals.amountG > 0 && servings > 0 && weightG > 0 && quantity > 0
  const share = isValid ? shareOf({ unit, quantity, servings, weightG }) : 0

  function changeUnit(newUnit) {
    if (newUnit === unit) return
    if (isValid) {
      const converted = convertQuantity({ fromUnit: unit, quantity, servings, weightG })
      setQuantityText(String(newUnit === UNIT_GRAM ? Math.round(converted) : roundToOneDecimal(converted)))
    }
    setUnit(newUnit)
  }

  function changeAmount(foodId, amountText) {
    setItems((current) =>
      current.map((item) => (item.food.id === foodId ? { ...item, amountText } : item)),
    )
    setWeightText(null)
  }

  function removeItem(foodId) {
    setItems((current) => current.filter((item) => item.food.id !== foodId))
    setWeightText(null)
  }

  function submit(event) {
    event.preventDefault()
    if (isValid) onConfirm(scaleItems(amounts, share), recipe.name)
  }

  return (
    <section>
      <TopBar title={recipe.name} closeLabel="Schließen" onClose={onClose} centered />
      <p className="detail-line">
        {!isValid && 'Bitte prüfe die Angaben unten.'}
        {isValid &&
          (unit === UNIT_PORTION
            ? `${formatServings(servings)} · ${formatKcal(totals.kcal / servings)} pro Portion`
            : `${formatNumber(weightG)} g · ${formatKcal((totals.kcal / weightG) * 100)} pro 100 g`)}
      </p>
      <form onSubmit={submit}>
        <div className="detail-amount book-amount">
          <SelectBox label="Einheit" value={unit} options={BOOKING_UNITS} onChange={changeUnit} />
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            min="0"
            step="any"
            value={quantityText}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setQuantityText(event.target.value)}
            aria-label={unit === UNIT_PORTION ? 'Anzahl Portionen' : 'Menge in Gramm'}
          />
        </div>
        <p className="book-result" role="status">
          {isValid ? formatKcal(totals.kcal * share) : '–'}
        </p>

        <div className="section-head">
          <h2>Für diese Buchung anpassen</h2>
        </div>
        {unit === UNIT_PORTION ? (
          <label className="field">
            <span>Portionen gesamt</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={servingsText}
              onChange={(event) => setServingsText(event.target.value)}
            />
          </label>
        ) : (
          <label className="field">
            <span>Gesamtgewicht (g)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={weightText ?? String(roundToOneDecimal(totals.amountG))}
              onChange={(event) => setWeightText(event.target.value)}
            />
            {weightText === null ? (
              <span className="hint">Summe der Zutaten. Gewicht nach dem Kochen hier eintragen.</span>
            ) : (
              <button type="button" className="link-btn" onClick={() => setWeightText(null)}>
                Aus Zutaten berechnen
              </button>
            )}
          </label>
        )}

        <div className="rows">
          {items.map((item) => (
            <div className="row" key={item.food.id}>
              <span className="main">
                <span className="name wrap-name">{item.food.name}</span>
                <span className="sub">
                  {parseFloat(item.amountText) >= 0
                    ? formatKcal(kcalOf(item.food, parseFloat(item.amountText)))
                    : '–'}
                </span>
              </span>
              <span className="amount-input">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={item.amountText}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) => changeAmount(item.food.id, event.target.value)}
                  aria-label={`Menge ${item.food.name} in Gramm`}
                />
                <span>g</span>
              </span>
              <CrossButton label={`${item.food.name} weglassen`} onClick={() => removeItem(item.food.id)} />
            </div>
          ))}
        </div>

        <div className="bar">
          <button type="submit" className="btn primary" disabled={!isValid}>
            Zur Mahlzeit hinzufügen
          </button>
        </div>
      </form>
    </section>
  )
}

function NumberField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ProfilePage({ user, onUserChange, onLogout, onClose, onError }) {
  const [targetText, setTargetText] = useState(String(user.calorieTarget))
  const runAction = useActionRunner(onError)
  const themeLabelId = useId()

  const target = Number(targetText)
  const isValid = targetText !== '' && Number.isInteger(target) && target >= 1 && target <= MAX_CALORIE_TARGET
  const isChanged = target !== user.calorieTarget

  function save(event) {
    event.preventDefault()
    if (!isValid || !isChanged) return
    runAction(async () => {
      // The color theme cannot be changed yet, so the current value is sent back unchanged.
      const updated = await request(API.me, {
        method: 'PUT',
        body: JSON.stringify({ calorieTarget: target, colorTheme: user.colorTheme }),
      })
      onUserChange(updated)
      onError(null)
    })
  }

  return (
    <section>
      <TopBar title="Profil" closeLabel="Schließen" onClose={onClose} />
      <p className="profile-email">
        {user.email}
        <br />
        <span className="profile-server">{getServerUrl() || window.location.origin}</span>
      </p>

      <form onSubmit={save}>
        <label className="field">
          <span>Kalorienziel (kcal)</span>
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            min="1"
            max={MAX_CALORIE_TARGET}
            step="1"
            value={targetText}
            onChange={(event) => setTargetText(event.target.value)}
          />
        </label>
        <button type="submit" className="btn primary wide" disabled={!isValid || !isChanged}>
          Speichern
        </button>
      </form>

      {/* Shown but not usable yet: the backend stores the value, the app does not use it so far. */}
      <div className="field theme-field">
        <span id={themeLabelId}>Farbschema</span>
        <div className="segmented" role="radiogroup" aria-labelledby={themeLabelId} aria-disabled="true">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={user.colorTheme === theme.value}
              className={user.colorTheme === theme.value ? 'selected' : undefined}
              disabled
            >
              {theme.label}
            </button>
          ))}
        </div>
        <span className="hint">Kommt bald.</span>
      </div>

      <div className="bar">
        <button type="button" className="btn danger wide" onClick={onLogout}>
          Abmelden
        </button>
      </div>
    </section>
  )
}

// German messages for the answers of the login and register endpoints. 403 only means
// "account disabled" for a login; elsewhere it can also be e.g. a rejected CORS request.
const AUTH_ERRORS = {
  400: 'Bitte prüfe E-Mail-Adresse und Passwort.',
  401: 'E-Mail-Adresse oder Passwort ist falsch.',
  404: 'Unter dieser Adresse läuft kein Mealtracker-Server.',
  405: 'Unter dieser Adresse läuft kein Mealtracker-Server.',
  409: 'Für diese E-Mail-Adresse gibt es schon ein Konto.',
}

// fetch() itself throws (without status) when the server cannot be reached at all.
function authErrorMessage(error, path) {
  if (error.status === undefined) return 'Der Server ist nicht erreichbar. Bitte prüfe die Adresse.'
  if (error.status === 403 && path === API.login) return 'Dieses Konto ist deaktiviert.'
  return AUTH_ERRORS[error.status] ?? error.message
}

function passwordProblem(password, passwordRepeat) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return 'Das Passwort ist zu lang.'
  }
  if (password !== passwordRepeat) return 'Die Passwörter stimmen nicht überein.'
  return null
}

// "Anmelden" logs in. "Registrieren" first only shows the "repeat password" field and registers
// on the second click. Enter in a field triggers the highlighted button.
// The server field is pre-filled with the server used last; another address only replaces it
// once a login there succeeded.
function LoginPage({ onLoggedIn }) {
  const [server, setServer] = useState(getServerUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState(null)
  const runAction = useActionRunner(setError)

  const hasCredentials = email.trim() !== '' && password !== ''

  function authenticate(path) {
    const serverUrl = normalizeServerUrl(server)
    if (serverUrl === null) {
      setError('Bitte gib eine gültige Serveradresse ein, z. B. https://mealtracker.example.org.')
      return
    }
    runAction(async () => {
      let response
      try {
        response = await requestAt(serverUrl, path, {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password }),
        })
      } catch (error) {
        throw new Error(authErrorMessage(error, path))
      }
      await onLoggedIn(serverUrl, response.token, response.user)
    })
  }

  function logIn() {
    setIsRegistering(false)
    if (!hasCredentials) {
      setError('Bitte gib E-Mail-Adresse und Passwort ein.')
      return
    }
    authenticate(API.login)
  }

  function register() {
    if (!isRegistering) {
      setIsRegistering(true)
      setError(null)
      return
    }
    const problem =
      email.trim() === ''
        ? 'Bitte gib eine E-Mail-Adresse ein.'
        : passwordProblem(password, passwordRepeat)
    if (problem) {
      setError(problem)
      return
    }
    authenticate(API.register)
  }

  const primaryAction = isRegistering ? register : logIn

  // Both buttons are plain buttons: switching a button's type to "submit" inside its own click
  // handler would make the browser submit the form right away. With two or more fields and no
  // submit button the browser does not submit on Enter either, so Enter is handled here.
  function submitOnEnter(event) {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault()
      primaryAction()
    }
  }

  return (
    <main className="app login">
      <h1 className="login-title">Mealtracker</h1>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {/* noValidate: the checks above show German messages instead of the browser's own. */}
      <form onKeyDown={submitOnEnter} onSubmit={(event) => event.preventDefault()} noValidate>
        <label className="field">
          <span>Server</span>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://mealtracker.example.org"
            autoFocus={server === ''}
            value={server}
            onChange={(event) => setServer(event.target.value)}
          />
          {isUnencrypted(server) && (
            <span className="hint warning">
              Unverschlüsselte Verbindung (http). Nur in einem vertrauenswürdigen Netz oder über
              VPN verwenden.
            </span>
          )}
        </label>
        <label className="field">
          <span>E-Mail-Adresse</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus={server !== ''}
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Passwort</span>
          <input
            type="password"
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            enterKeyHint="go"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {isRegistering && (
          <label className="field">
            <span>Passwort wiederholen</span>
            <input
              type="password"
              autoComplete="new-password"
              enterKeyHint="go"
              autoFocus
              value={passwordRepeat}
              onChange={(event) => setPasswordRepeat(event.target.value)}
            />
            <span className="hint">Mindestens {MIN_PASSWORD_LENGTH} Zeichen.</span>
          </label>
        )}
        <div className="login-actions">
          <button type="button" className={isRegistering ? 'btn' : 'btn primary'} onClick={logIn}>
            Anmelden
          </button>
          <button type="button" className={isRegistering ? 'btn primary' : 'btn'} onClick={register}>
            Registrieren
          </button>
        </div>
      </form>
    </main>
  )
}

// Shown while the stored login is checked, and when the server cannot be reached at app start.
function StartupScreen({ isOffline, onRetry }) {
  return (
    <main className="app startup">
      {isOffline ? (
        <>
          <p>Der Server ist nicht erreichbar.</p>
          <button type="button" className="btn primary" onClick={onRetry}>
            Erneut versuchen
          </button>
        </>
      ) : (
        <p>Lädt …</p>
      )}
    </main>
  )
}

// Lets the system back button step back inside the app instead of leaving it.
// Native app: the hardware back button arrives as a Capacitor event.
// Browser: while anything above the main view is shown, one extra history entry sits
// on top of the app's entry; pressing back removes it and runs goBack instead.
function useBackNavigation(isNested, goBack) {
  const [hasEntry, setHasEntry] = useState(false)
  const hasEntryRef = useRef(false) // hasEntry for the unmount cleanup below
  const isRemovingEntry = useRef(false) // true while our own history.back() is in flight
  const goBackRef = useRef(goBack)
  const isNestedRef = useRef(isNested)

   useEffect(() => {
    goBackRef.current = goBack
    hasEntryRef.current = hasEntry
    isNestedRef.current = isNested
  })

  // Unmounted while a nested view is open (e.g. logout from the profile): remove the extra
  // browser history entry as well. In the native app there is none (hasEntry stays false).
  useEffect(() => {
    return () => {
      if (hasEntryRef.current) history.back()
    }
  }, [])

  // Native app
  useEffect(() => {
    if (!IS_NATIVE) return
    const listener = CapacitorApp.addListener('backButton', () => {
      if (isNestedRef.current) goBackRef.current()
      else CapacitorApp.exitApp()
    })
    return () => {
      listener.then((handle) => handle.remove())
    }
  }, [])

  // Browser
  useEffect(() => {
    if (IS_NATIVE) return
    function onPopState() {
      setHasEntry(false)
      if (isRemovingEntry.current) isRemovingEntry.current = false
      else goBackRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (IS_NATIVE) return
    if (isNested && !hasEntry) {
      history.pushState(null, '')
      setHasEntry(true)
    } else if (!isNested && hasEntry && !isRemovingEntry.current) {
      // left the nested view by other means (e.g. "×"): drop the unused entry
      isRemovingEntry.current = true
      history.back()
    }
  }, [isNested, hasEntry])

  useEffect(() => {
    if (IS_NATIVE) return
    history.scrollRestoration = 'manual'
    return () => {
      history.scrollRestoration = 'auto'
    }
  }, [])
}

// The app after login. Keyed by the user id in App, so nothing carries over to another account.
function MealTracker({ user, onUserChange, onLogout }) {
  const [view, setView] = useState('list') // 'list' | 'edit' | 'search' | 'preview' | 'foods' | 'profile'
  const [meals, setMeals] = useState([])
  const [draft, setDraft] = useState(NEW_DRAFT)
  const [detail, setDetail] = useState(null) // null or { food, mode: 'add' | 'set' | 'recipe-add', amountG }
  const [recipeBooking, setRecipeBooking] = useState(null) // recipe shown for booking
  const [foodForm, setFoodForm] = useState(null) // food shown in the food database form
  const [recipeEditor, setRecipeEditor] = useState(null) // recipe draft, see NEW_RECIPE
  const [recipeSearch, setRecipeSearch] = useState(null) // null or { entries, previewing }: foods about to be added to the recipe
  const [catalogVersion, setCatalogVersion] = useState(0) // reloads the food database list
  const [confirm, setConfirm] = useState(null) // props of the open ConfirmDialog
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const runAction = useActionRunner(setError)

  const isEditing = draft.mealId !== null

  const loadMeals = useCallback(async () => {
    setMeals(await request(API.meals))
    setError(null)
  }, [])

  useEffect(() => {
    loadMeals().catch((error) => setError(error.message))
  }, [loadMeals])

  const reloadCatalog = () => setCatalogVersion((version) => version + 1)

  // ----- meals -----

  function startNewMeal() {
    setDraft(NEW_DRAFT)
    setView('search')
  }

  function editMeal(meal) {
    setDraft({ mealId: meal.id, entries: entriesFromMeal(meal) })
    setView('edit')
  }

  function discardDraft() {
    setDraft(NEW_DRAFT)
    setError(null)
    setView('list')
  }

  function addToDraft(food, amountG) {
    setDraft((current) => ({ ...current, entries: addAmount(current.entries, food, amountG) }))
  }

  function addRecipeToDraft(items, recipeName) {
    setDraft((current) => ({ ...current, entries: addRecipeItems(current.entries, items, recipeName) }))
  }

  function addRecipePortion(recipe) {
    addRecipeToDraft(onePortion(recipe), recipe.name)
  }

  function confirmRecipeBooking(items, recipeName) {
    addRecipeToDraft(items, recipeName)
    setRecipeBooking(null)
  }

  function removeFromDraft(foodId) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.food.id !== foodId),
    }))
  }

  function submitMeal() {
    runAction(async () => {
      await createOrUpdate(API.meals, draft.mealId, mealRequest(draft.entries))
      setDraft(NEW_DRAFT)
      setView('list')
      await loadMeals()
    })
  }

  async function saveEditedEntries(entries) {
    const { mealId } = draft
    await createOrUpdate(API.meals, mealId, mealRequest(entries))
    // The saved amounts are the new baseline. Skip this if another meal was opened meanwhile.
    setDraft((current) =>
      current.mealId === mealId
        ? { mealId, entries: entries.map((entry) => ({ ...entry, baseG: entry.amountG })) }
        : current,
    )
  }

  function removeEntryFromMeal(foodId) {
    runAction(async () => {
      await saveEditedEntries(draft.entries.filter((entry) => entry.food.id !== foodId))
      await loadMeals()
    })
  }

  function saveEntryAmount(food, amountG) {
    runAction(async () => {
      await saveEditedEntries(
        draft.entries.map((entry) => (entry.food.id === food.id ? { ...entry, amountG } : entry)),
      )
      setDetail(null)
      await loadMeals()
    })
  }

  function openFoodDetail(food) {
    setDetail({ food, mode: 'add', amountG: DEFAULT_AMOUNT_G })
  }

  function openRecipeFoodDetail(food) {
    setDetail({ food, mode: 'recipe-add', amountG: DEFAULT_AMOUNT_G })
  }

  function openEntryDetail(entry) {
    setDetail({ food: entry.food, mode: 'set', amountG: entry.amountG })
  }

  function addFromDetail(food, amountG) {
    if (detail.mode === 'recipe-add') addToRecipeSearch(food, amountG)
    else addToDraft(food, amountG)
    setDetail(null)
  }

  function deleteMeal(id) {
    runAction(async () => {
      await request(`${API.meals}/${id}`, { method: 'DELETE' })
      await loadMeals()
    })
  }

  function askDeleteAllMeals() {
    setConfirm({
      title: 'Alle Mahlzeiten löschen?',
      text: `Alle ${meals.length} gebuchten Mahlzeiten werden endgültig gelöscht.`,
      confirmLabel: 'Alle löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(API.meals, { method: 'DELETE' })
          await loadMeals()
        }),
    })
  }

  // ----- food database: foods -----

  function openFood(food) {
    setNotice(null)
    setFoodForm(food)
  }

  function saveFood(id, values) {
    runAction(async () => {
      const saved = await createOrUpdate(API.foods, id, values)
      // Made private while others use it: the server kept the public food and made a copy.
      if (id !== null && saved.id !== id) {
        setNotice(
          'Andere verwenden dieses Lebensmittel bereits. Für sie bleibt es öffentlich; du hast jetzt eine private Kopie.',
        )
      }
      setFoodForm(null)
      reloadCatalog()
      setError(null)
    })
  }

  function askDeleteFood(food) {
    setConfirm({
      title: 'Lebensmittel löschen?',
      text:
        'Steckt es noch in einer Mahlzeit oder einem Rezept, bleibt es dort erhalten und für alle ' +
        'öffentlich, gehört dir dann aber nicht mehr. Sonst wird es endgültig gelöscht.',
      confirmLabel: 'Löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(`${API.foods}/${food.id}`, { method: 'DELETE' })
          setFoodForm(null)
          reloadCatalog()
          setError(null)
        }),
    })
  }

  // ----- food database: recipes -----

  function openRecipe(recipe) {
    setNotice(null)
    setRecipeEditor(recipe === null ? NEW_RECIPE : recipeDraftFrom(recipe))
  }

  function openRecipeSearch() {
    setRecipeSearch({ entries: [], previewing: false })
  }

  function addToRecipeSearch(food, amountG) {
    setRecipeSearch((current) => ({ ...current, entries: addAmount(current.entries, food, amountG) }))
  }

  function removeFromRecipeSearch(foodId) {
    setRecipeSearch((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.food.id !== foodId),
    }))
  }

  function applyRecipeSearch() {
    const added = recipeSearch.entries
    setRecipeEditor((current) => ({ ...current, items: mergeItems(current.items, added) }))
    setRecipeSearch(null)
  }

  function saveRecipe() {
    const recipe = recipeEditor
    function save() {
      runAction(async () => {
        setConfirm(null)
        await createOrUpdate(API.recipes, recipe.id, recipeRequest(recipe))
        setRecipeEditor(null)
        reloadCatalog()
        setError(null)
      })
    }

    // Publishing also publishes the user's private foods in it (done by the server).
    const privateFoods = recipe.items
      .filter((item) => item.food.owned && !item.food.published)
      .map((item) => item.food.name)
    if (!recipe.published || (recipe.wasPublished && privateFoods.length === 0)) {
      save()
      return
    }
    setConfirm({
      title: 'Rezept veröffentlichen?',
      text:
        'Alle können das Rezept dann sehen und buchen.' +
        (privateFoods.length > 0
          ? ` Dafür werden auch diese Lebensmittel von dir veröffentlicht: ${privateFoods.join(', ')}.`
          : ''),
      confirmLabel: 'Veröffentlichen',
      tone: 'primary',
      onConfirm: save,
    })
  }

  function askDeleteRecipe() {
    const recipe = recipeEditor
    setConfirm({
      title: 'Rezept löschen?',
      text:
        (recipe.wasPublished ? 'Danach kann es auch sonst niemand mehr buchen. ' : '') +
        'Bereits gebuchte Mahlzeiten bleiben unverändert.',
      confirmLabel: 'Löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(`${API.recipes}/${recipe.id}`, { method: 'DELETE' })
          setRecipeEditor(null)
          reloadCatalog()
          setError(null)
        }),
    })
  }

  // ----- views -----

  function openFoods() {
    setError(null)
    setView('foods')
  }

  function closeFoods() {
    setError(null)
    setView('list')
  }

  function openProfile() {
    setError(null)
    setView('profile')
  }

  function closeProfile() {
    setError(null)
    setView('list')
  }

  // One handler for every "×" and for the system back button: close the topmost layer.
  function goBack() {
    setNotice(null)
    if (confirm) setConfirm(null)
    else if (detail) setDetail(null)
    else if (recipeBooking) setRecipeBooking(null)
    else if (recipeSearch?.previewing) setRecipeSearch({ ...recipeSearch, previewing: false })
    else if (recipeSearch) setRecipeSearch(null)
    else if (recipeEditor) setRecipeEditor(null)
    else if (foodForm) setFoodForm(null)
    else if (view === 'preview') setView('search')
    else if (view === 'search' || view === 'edit') discardDraft()
    else if (view === 'foods') closeFoods()
    else if (view === 'profile') closeProfile()
  }

  useBackNavigation(view !== 'list' || detail !== null || confirm !== null, goBack)

  return (
    <main className="app">
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      {view === 'list' && (
        <MealList
          meals={meals}
          onAdd={startNewMeal}
          onEdit={editMeal}
          onDelete={deleteMeal}
          onDeleteAll={askDeleteAllMeals}
          onOpenFoods={openFoods}
          onOpenProfile={openProfile}
        />
      )}

      {view === 'profile' && (
        <ProfilePage
          user={user}
          onUserChange={onUserChange}
          onLogout={onLogout}
          onClose={goBack}
          onError={setError}
        />
      )}

      {/* Stays mounted (only hidden) under the preview and the detail views,
          so the search text, filter and results survive. */}
      {(view === 'search' || view === 'preview') && (
        <FoodSearch
          visible={view === 'search' && !detail && !recipeBooking}
          draftCount={draft.entries.length}
          submitLabel={isEditing ? 'Mahlzeit speichern' : 'Mahlzeit hinzufügen'}
          onOpenFood={openFoodDetail}
          onAddFood={addToDraft}
          onOpenRecipe={setRecipeBooking}
          onAddRecipe={addRecipePortion}
          onPreview={() => setView('preview')}
          onSubmit={submitMeal}
          onClose={goBack}
          onError={setError}
        />
      )}

      {view === 'search' && recipeBooking && (
        <RecipeBooking
          key={recipeBooking.id}
          recipe={recipeBooking}
          onConfirm={confirmRecipeBooking}
          onClose={goBack}
        />
      )}

      {view === 'edit' && !detail && (
        <MealEditor
          entries={draft.entries}
          onOpenEntry={openEntryDetail}
          onRemoveEntry={removeEntryFromMeal}
          onAddMore={() => setView('search')}
          onClose={goBack}
        />
      )}

      {view === 'preview' && !detail && (
        <DraftPreview
          entries={draft.entries}
          showDelta={isEditing}
          onRemoveEntry={removeFromDraft}
          onClose={goBack}
        />
      )}

      {view === 'foods' && (
        <>
          <FoodDatabase
            hidden={foodForm !== null || recipeEditor !== null}
            version={catalogVersion}
            onOpenFood={openFood}
            onOpenRecipe={openRecipe}
            onClose={goBack}
            onError={setError}
          />
          {foodForm && (
            <FoodForm
              key={foodForm.id ?? 'new'}
              food={foodForm}
              onSave={saveFood}
              onDelete={askDeleteFood}
              onClose={goBack}
            />
          )}
          {recipeEditor && !recipeSearch && (
            <RecipeEditor
              draft={recipeEditor}
              onChange={setRecipeEditor}
              onAddFoods={openRecipeSearch}
              onSave={saveRecipe}
              onDelete={askDeleteRecipe}
              onClose={goBack}
            />
          )}
          {/* Recipes cannot contain recipes, so this search only offers foods. */}
          {recipeSearch && (
            <FoodSearch
              visible={!recipeSearch.previewing && !detail}
              kindLocked
              draftCount={recipeSearch.entries.length}
              submitLabel="Hinzufügen"
              closeLabel="Zurück zum Rezept"
              onOpenFood={openRecipeFoodDetail}
              onAddFood={addToRecipeSearch}
              onPreview={() => setRecipeSearch({ ...recipeSearch, previewing: true })}
              onSubmit={applyRecipeSearch}
              onClose={goBack}
              onError={setError}
            />
          )}
          {recipeSearch?.previewing && !detail && (
            <DraftPreview
              entries={recipeSearch.entries}
              showDelta={false}
              onRemoveEntry={removeFromRecipeSearch}
              onClose={goBack}
            />
          )}
        </>
      )}

      {detail && (
        <FoodDetail
          food={detail.food}
          initialAmountG={detail.amountG}
          confirmLabel={detail.mode === 'set' ? 'Übernehmen' : 'Hinzufügen'}
          onConfirm={detail.mode === 'set' ? saveEntryAmount : addFromDetail}
          onClose={goBack}
        />
      )}

      {confirm && <ConfirmDialog {...confirm} onClose={goBack} />}
    </main>
  )
}

const LOADING = { status: 'loading', user: null }
const LOGGED_OUT = { status: 'loggedOut', user: null }

// Decides between login page and app. A token stored on this device keeps the user logged in
// across app restarts: at start the token is checked once against the server (GET /api/users/me).
export default function App() {
  // status: 'loading' | 'offline' | 'loggedOut' | 'loggedIn'
  const [auth, setAuth] = useState(LOADING)

  const logOutLocally = useCallback(async () => {
    await clearToken()
    setAuth(LOGGED_OUT)
  }, [])

  const restoreLogin = useCallback(async () => {
    try {
      if (!(await loadSession())) {
        setAuth(LOGGED_OUT)
        return
      }
      setAuth({ status: 'loggedIn', user: await request(API.me) })
    } catch (error) {
      // A rejected token (401) is handled by the unauthorized handler: token removed, login shown.
      // Anything else, e.g. no network: keep the token, the user is still logged in, just offline.
      if (error.status !== 401) setAuth({ status: 'offline', user: null })
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logOutLocally)
  }, [logOutLocally])

  useEffect(() => {
    restoreLogin()
  }, [restoreLogin])

  async function logIn(serverUrl, token, user) {
    await saveSession(serverUrl, token)
    setAuth({ status: 'loggedIn', user })
  }

  async function logOut() {
    try {
      await request(API.logout, { method: 'POST' })
    } catch {
      // Logged out on this device anyway. If the server was unreachable, the token stays valid
      // there, but nobody has it any more once it is removed here.
    }
    await logOutLocally()
  }

  function retry() {
    setAuth(LOADING)
    restoreLogin()
  }

  if (auth.status === 'loading' || auth.status === 'offline') {
    return <StartupScreen isOffline={auth.status === 'offline'} onRetry={retry} />
  }
  if (auth.status === 'loggedOut') {
    return <LoginPage onLoggedIn={logIn} />
  }
  return (
    <MealTracker
      key={auth.user.id}
      user={auth.user}
      onUserChange={(user) => setAuth({ status: 'loggedIn', user })}
      onLogout={logOut}
    />
  )
}
