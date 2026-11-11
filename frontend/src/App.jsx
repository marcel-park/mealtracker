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
  addAmount,
  addRecipeItems,
  entriesFromMeal,
  mealRequest,
} from './meals.js'
import {
  NEW_EDITOR,
  UNIT_GRAM,
  UNIT_PORTION,
  bookingFor,
  addToBookingItems,
  bookingSelection,
  convertQuantity,
  editorChanges,
  editorFor,
  isAdjusted,
  itemsOf,
  kcalOf,
  lastUsedVariation,
  mergeEditorItems,
  onePortion,
  recipeRequest,
  roundToOneDecimal,
  scaleItems,
  servingsOf,
  shareOf,
  suggestedVariationName,
  totalsOf,
  variationOf,
  variationRequest,
} from './recipes.js'

const SEARCH_PARAM = 'query'
const SCOPE_PARAM = 'scope'
const CONFIRMED_PARAM = 'confirmed'

const IS_NATIVE = Capacitor.isNativePlatform() // true inside the Android app, false in a browser
const DEFAULT_AMOUNT_G = 100 // added by the + button, preset in the detail view
const SEARCH_DELAY_MS = 250 // search only once typing pauses
const ADDED_FEEDBACK_MS = 600 // how long the + button shows ✓
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
// recipeUses: which recipes were added, in which variation ({ recipeId, variationId }); sent
// with the meal so the variation is preselected next time. Entries added from a recipe also carry
// recipeIds, see addRecipeItems.
const NEW_DRAFT = { mealId: null, entries: [], recipeUses: [] }

const NEW_FOOD = { id: null, owned: true, published: false }


// The two kinds of entries in the search, and the filters that apply to both.
const KIND_FOODS = 'foods'
const KIND_RECIPES = 'recipes'
const CATALOG_KINDS = [
  { value: KIND_FOODS, label: 'Lebensmittel' },
  { value: KIND_RECIPES, label: 'Rezepte' },
]
const KIND_URLS = { [KIND_FOODS]: API.foods, [KIND_RECIPES]: API.recipes }

// Whose entries the search shows. "Alle": everything the user may see (own entries, private
// ones included, and all public ones). Values as the backend expects them ('' = no scope).
// "Nur bestätigte" is a separate toggle that combines with any of these.
const SCOPE_OPTIONS = [
  { value: '', label: 'Alle', Icon: AllIcon },
  { value: 'PUBLIC', label: 'Öffentlich', Icon: GlobeIcon },
  { value: 'OWN', label: 'Eigene', Icon: PersonIcon },
  { value: 'FRIENDS', label: 'Freunde', Icon: PeopleIcon, disabled: true }, // no friends yet
]


// GET /api/foods or /api/recipes with the search text and the filters, if any.
function fetchCatalog(kind, { query, scope, confirmedOnly }, signal) {
  const params = new URLSearchParams()
  const search = query.trim()
  if (search) params.set(SEARCH_PARAM, search)
  if (scope) params.set(SCOPE_PARAM, scope)
  if (confirmedOnly) params.set(CONFIRMED_PARAM, 'true')
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


const toText = (value) => String(value ?? '')

const formatNumber = (n) => roundToOneDecimal(n).toLocaleString(LOCALE)
const formatKcal = (kcal) => `${Math.round(kcal).toLocaleString(LOCALE)} kcal`
const formatServings = (servings) =>
  `${formatNumber(servings)} ${servings === 1 ? 'Portion' : 'Portionen'}`














const iconProps = {
  height: 24,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" {...iconProps}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
      <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" />
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

function SealIcon({ size = 16 }) {
  return (
    <svg {...smallIconProps} width={size} height={size}>
      {/* round seal: 12 even points around the centre */}
      <path d="M12 2.4L14.07 4.27L16.8 3.69L17.66 6.34L20.31 7.2L19.73 9.93L21.6 12L19.73 14.07L20.31 16.8L17.66 17.66L16.8 20.31L14.07 19.73L12 21.6L9.93 19.73L7.2 20.31L6.34 17.66L3.69 16.8L4.27 14.07L2.4 12L4.27 9.93L3.69 7.2L6.34 6.34L7.2 3.69L9.93 4.27Z" />
      <path d="M8.6 12.2l2.4 2.4 4.4-4.8" />
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

// "Alle" in the filter select: four squares.
function AllIcon() {
  return (
    <svg {...smallIconProps}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" {...iconProps} height="22" strokeWidth={2.4}>
      <path d="M5 12h14" />
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

// Foods or recipes (kind) matching the search (text and filters, see NEW_SEARCH), loaded once
// typing pauses. A change of `version` loads them again, e.g. after something was saved.
// onError must be stable (e.g. a state setter), otherwise every render restarts the request.
function useCatalog(kind, { query, scope, confirmedOnly }, version, onError) {
  // Results remember their kind: right after switching, the old list must not be shown as the new kind.
  const [result, setResult] = useState({ kind, entries: [] })

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const entries = await fetchCatalog(kind, { query, scope, confirmedOnly }, controller.signal)
        setResult({ kind, entries })
        onError(null)
      } catch (error) {
        if (!controller.signal.aborted) onError(error.message)
      }
    }, SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [kind, query, scope, confirmedOnly, version, onError])

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
// Filter row: "only confirmed" toggle, whose entries, foods or recipes; the two selects share the
// width. children: extra buttons at the end (the "+" of the food database).
function CatalogHeader({ search, onSearchChange, closeLabel, onClose, kindLocked = false, children }) {
  const { query, scope, confirmedOnly, kind } = search
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
        {/* Disabled until foods and recipes can be confirmed; the backend filter exists. */}
        <button
          type="button"
          className="toggle-btn"
          aria-pressed={confirmedOnly}
          title="Nur bestätigte: kommt bald"
          aria-label="Nur bestätigte"
          disabled
          onClick={() => onSearchChange({ ...search, confirmedOnly: !confirmedOnly })}
        >
          <SealIcon size={22} />
        </button>
        <SelectBox
          label="Filter"
          className="fill"
          value={scope ?? ''}
          options={SCOPE_OPTIONS}
          onChange={(value) => onSearchChange({ ...search, scope: value === '' ? null : value })}
        />
        <SelectBox
          label="Art"
          className="fill fill-more"
          value={kindLocked ? KIND_FOODS : kind}
          options={CATALOG_KINDS}
          disabled={kindLocked}
          onChange={(value) => onSearchChange({ ...search, kind: value })}
        />
        {children}
      </div>
    </div>
  )
}

// Search text, whose entries (scope, null: everything the user may see), "only confirmed" and
// kind of a search view.
const NEW_SEARCH = { query: '', scope: null, confirmedOnly: false, kind: KIND_FOODS }

const DROPDOWN_MAX_HEIGHT = 280
const DROPDOWN_SCREEN_MARGIN = 16 // distance the open list keeps from the screen edge

// A select that opens as a list right below (or, without room there, above) itself. A native
// <select> would open as a dialog with radio buttons in the middle of the screen on Android.
// options: [{ value, label, Icon?, disabled? }]. Keyboard: arrows, Enter/Space, Escape.
function SelectBox({ label, value, options, disabled = false, className = '', onChange }) {
  const [open, setOpen] = useState(null) // null, or { up, alignEnd, maxWidth } of the open list
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value)

  // A tap anywhere else closes the list.
  useEffect(() => {
    if (!open) return
    function closeOnOutsideTap(event) {
      if (!rootRef.current.contains(event.target)) setOpen(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideTap)
    return () => document.removeEventListener('pointerdown', closeOnOutsideTap)
  }, [open])

  function openList() {
    const box = rootRef.current.getBoundingClientRect()
    const roomBelow = window.innerHeight - box.bottom
    // Grow towards the side with more room; long names wrap instead of leaving the screen.
    const roomRight = window.innerWidth - box.left - DROPDOWN_SCREEN_MARGIN
    const roomLeft = box.right - DROPDOWN_SCREEN_MARGIN
    setOpen({
      up: roomBelow < DROPDOWN_MAX_HEIGHT && box.top > roomBelow,
      alignEnd: roomLeft > roomRight,
      maxWidth: Math.max(roomLeft, roomRight),
    })
    setActiveIndex(options.indexOf(selected))
  }

  function choose(option) {
    if (option.disabled) return
    setOpen(null)
    if (option.value !== value) onChange(option.value)
  }

  // The next option that can be chosen, from activeIndex in direction step (+1 / -1).
  function nextEnabled(step) {
    for (let i = activeIndex + step; i >= 0 && i < options.length; i += step) {
      if (!options[i].disabled) return i
    }
    return activeIndex
  }

  function onKeyDown(event) {
    const opening = ['ArrowDown', 'ArrowUp', 'Enter', ' ']
    if (!open) {
      if (opening.includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(null)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(nextEnabled(event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (options[activeIndex]) choose(options[activeIndex])
    } else if (event.key === 'Tab') {
      setOpen(null)
    }
  }

  const listClass = ['select-list', open?.up ? 'up' : '', open?.alignEnd ? 'align-end' : '']
    .join(' ')
    .trim()

  return (
    <span className={`select-box ${className}`} ref={rootRef}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open !== null}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected?.label ?? ''}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(null) : openList())}
        onKeyDown={onKeyDown}
      >
        {selected?.Icon && <selected.Icon />}
        <span className="select-value">{selected?.label}</span>
        <span className="select-chevron">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={listClass}
          style={{ maxWidth: open.maxWidth }}
        >
          {options.map((option, index) => (
            <li
              key={String(option.value)}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              className={index === activeIndex ? 'active' : undefined}
              onPointerEnter={() => !option.disabled && setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              {option.Icon && <option.Icon />}
              <span>{option.label}</span>
              {option.disabled && <span className="soon">bald</span>}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

// A field with a few side-by-side options to pick one of (a radio group), e.g. private / public.
// children: e.g. a hint below the options.
function SegmentedChoice({ label, options, value, disabled = false, onChange, children }) {
  const labelId = useId()
  return (
    <div className="field">
      <span id={labelId}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? 'selected' : undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}

const VISIBILITY_OPTIONS = [
  { value: false, label: 'Privat' },
  { value: true, label: 'Öffentlich' },
]

function VisibilitySwitch({ published, disabled = false, onChange }) {
  return (
    <SegmentedChoice
      label="Sichtbarkeit"
      options={VISIBILITY_OPTIONS}
      value={published}
      disabled={disabled}
      onChange={onChange}
    />
  )
}

// Closes a dialog with the Escape key.
function useCloseOnEscape(onClose) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
}

// tone: 'danger' for destructive actions, 'primary' otherwise.
function ConfirmDialog({ title, text, confirmLabel, tone = 'danger', onConfirm, onClose }) {
  const titleId = useId()
  const textId = useId()
  useCloseOnEscape(onClose)

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
            title="Datenbank"
            aria-label="Datenbank"
            onClick={onOpenFoods}
          >
            <DatabaseIcon />
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
  version = 0,
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
  const entries = useCatalog(kind, search, version, onError)

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

// variation: describe that variation instead of the original.
function RecipeSummary({ recipe, variation = null }) {
  const servings = servingsOf(recipe, variation)
  const kcal = variation ? totalsOf(itemsOf(recipe, variation)).kcal : recipe.kcal
  return (
    <>
      {variation && `${variation.name} · `}
      {formatKcal(kcal / servings)} pro Portion · {formatServings(servings)}
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
            <RecipeSummary recipe={recipe} variation={lastUsedVariation(recipe)} />
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
  const entries = useCatalog(search.kind, search, version, onError)
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

// A food or recipe in the database list; sub is the second line (kcal, portions).
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

// Difference to the original recipe: green "+100 g", red "−100 g", nothing when equal.
function Deviation({ amountG, originalG }) {
  const difference = roundToOneDecimal(amountG - originalG)
  if (difference === 0) return null
  return (
    <span className={difference > 0 ? 'delta' : 'delta minus'}>
      {difference > 0 ? '+' : '−'}
      {formatNumber(Math.abs(difference))} g
    </span>
  )
}

// One ingredient of a recipe or variation. Without onOpen the row is read-only; without
// onRemove there is no "×". A left-out ingredient (0 g) stays listed, greyed.
function IngredientRow({ item, showDeviation, onOpen, onRemove }) {
  const isLeftOut = item.amountG === 0
  const content = (
    <>
      <span className="main">
        <span className="name">
          {item.food.name}
          <PrivateMark entry={item.food} />
        </span>
        <span className="sub">{formatKcal(kcalOf(item.food, item.amountG))}</span>
      </span>
      {showDeviation && <Deviation amountG={item.amountG} originalG={item.originalG} />}
      <span className="amount">{formatNumber(item.amountG)} g</span>
    </>
  )

  return (
    <div className={isLeftOut ? 'row left-out' : 'row'}>
      {onOpen ? (
        <button type="button" className="row-open wrap" onClick={onOpen}>
          {content}
        </button>
      ) : (
        <div className="row-open wrap">{content}</div>
      )}
      {onRemove && !isLeftOut && (
        <CrossButton label={`${item.food.name} weglassen`} onClick={onRemove} />
      )}
    </div>
  )
}

// Dialog with form fields (children). Enter confirms.
function FormDialog({ title, confirmLabel, canConfirm, onConfirm, onClose, children }) {
  const titleId = useId()
  useCloseOnEscape(onClose)

  function submit(event) {
    event.preventDefault()
    if (canConfirm) onConfirm()
  }

  return (
    <div className="overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn primary" disabled={!canConfirm}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

// Asks for the name of a new variation, suggesting recipe name and date.
function SaveVariationDialog({ recipeName, onSave, onClose }) {
  const [name, setName] = useState(() => suggestedVariationName(recipeName))
  return (
    <FormDialog
      title="Variation erstellen"
      confirmLabel="Erstellen"
      canConfirm={name.trim() !== ''}
      onConfirm={() => onSave(name)}
      onClose={onClose}
    >
      <label className="field">
        <span>Name der Variation</span>
        <input
          type="text"
          autoFocus
          maxLength={100}
          value={name}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
    </FormDialog>
  )
}

const COPY_OPTIONS = [
  { value: false, label: 'Original' },
  { value: true, label: 'Variation' },
]

// Copying a recipe of somebody else. Adjusted: the adjustments become the copy's original, or
// a variation of an unchanged copy.
function CopyRecipeDialog({ recipeName, isAdjusted, onCopy, onClose }) {
  const [name, setName] = useState(recipeName)
  const [asVariation, setAsVariation] = useState(false)
  const [variationName, setVariationName] = useState(() => suggestedVariationName(recipeName))
  const canConfirm = name.trim() !== '' && (!asVariation || variationName.trim() !== '')

  return (
    <FormDialog
      title="Als eigenes Rezept speichern"
      confirmLabel="Speichern"
      canConfirm={canConfirm}
      onConfirm={() => onCopy({ name, asVariation: isAdjusted && asVariation, variationName })}
      onClose={onClose}
    >
      <p>Du bekommst eine private Kopie, die du bearbeiten und variieren kannst.</p>
      <label className="field">
        <span>Name des Rezepts</span>
        <input
          type="text"
          autoFocus
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {isAdjusted && (
        <SegmentedChoice
          label="Deine Anpassungen speichern als"
          options={COPY_OPTIONS}
          value={asVariation}
          onChange={setAsVariation}
        >
          <span className="hint">
            {asVariation
              ? 'Das Original wird unverändert kopiert, deine Anpassungen werden seine erste Variation.'
              : 'Die Kopie übernimmt deine angepassten Mengen als Original.'}
          </span>
        </SegmentedChoice>
      )}
      {isAdjusted && asVariation && (
        <label className="field">
          <span>Name der Variation</span>
          <input
            type="text"
            maxLength={100}
            value={variationName}
            onChange={(event) => setVariationName(event.target.value)}
          />
        </label>
      )}
    </FormDialog>
  )
}

// Name, portions, visibility and the foods of a recipe, or one of its variations (owner only).
// Tapping a food changes its amount. Switching between original and variations drops unsaved
// changes. Recipes of others are shown read-only.
//
// Buttons, stacked at the bottom: a new recipe is saved as it is. A changed original is either
// saved as a new variation or overwritten (red, with a confirmation). A variation is saved into
// itself. "Löschen" (red, with a confirmation) comes last.
function RecipeEditor({
  editor,
  onChange,
  onSelectVariation,
  onAddFoods,
  onSave,
  onSaveAsVariation,
  onOverwrite,
  onDelete,
  onClose,
}) {
  const servingsId = useId()
  const { recipe, variationId, items, layer } = editor
  const isNew = editor.id === null
  const readOnly = !editor.owned
  const isVariation = variationId !== null
  const variations = recipe?.variations ?? []
  const servings = parseFloat(editor.servingsText)
  const weightG = editor.weightText.trim() === '' ? null : parseFloat(editor.weightText)
  const totals = totalsOf(items)
  const isValid =
    editor.name.trim() !== '' &&
    servings > 0 &&
    (weightG === null || weightG > 0) &&
    items.some((item) => item.amountG > 0)

  function setAmount(foodId, amountG) {
    onChange({
      items: items.map((item) => (item.food.id === foodId ? { ...item, amountG } : item)),
      layer: null,
    })
  }

  // "−" / "+" next to the portions: one less or more, never 0 or below.
  function stepServings(step) {
    const next = roundToOneDecimal((servings > 0 ? servings : 0) + step)
    if (next > 0) onChange({ servingsText: String(next) })
  }

  // In a variation, an ingredient of the original stays listed with 0 g.
  function remove(item) {
    onChange({
      items:
        isVariation && item.originalG > 0
          ? items.map((other) => (other === item ? { ...other, amountG: 0 } : other))
          : items.filter((other) => other !== item),
    })
  }

  const changes = editorChanges(editor)
  const isSavedOriginal = !isNew && !isVariation

  // Enter saves only where there is just one way to save.
  function submit(event) {
    event.preventDefault()
    if (isValid && !readOnly && !isSavedOriginal) onSave()
  }

  if (layer?.type === 'amount') {
    const item = items.find((other) => other.food.id === layer.foodId)
    return (
      <FoodDetail
        food={item.food}
        initialAmountG={item.amountG || item.originalG || DEFAULT_AMOUNT_G}
        confirmLabel="Übernehmen"
        onConfirm={(food, amountG) => setAmount(food.id, amountG)}
        onClose={() => onChange({ layer: null })}
      />
    )
  }

  let title = 'Rezept bearbeiten'
  if (isNew) title = 'Rezept anlegen'
  else if (readOnly) title = 'Rezept'
  else if (isVariation) title = 'Variation bearbeiten'

  return (
    <section>
      <TopBar title={title} closeLabel="Schließen" onClose={onClose} />
      {readOnly && <NotOwnedHint what="Rezept" />}
      <form onSubmit={submit}>
        {!readOnly && variations.length > 0 && (
          <div className="field">
            <span>Variation</span>
            <SelectBox
              label="Original oder Variation"
              className="wide"
              value={String(variationId ?? '')}
              options={[
                { value: '', label: 'Original' },
                ...variations.map((variation) => ({ value: String(variation.id), label: variation.name })),
              ]}
              onChange={(value) => onSelectVariation(value === '' ? null : Number(value))}
            />
          </div>
        )}
        <fieldset className="plain" disabled={readOnly}>
          <label className="field">
            <span>{isVariation ? 'Name der Variation' : 'Name'}</span>
            <input
              type="text"
              autoFocus={isNew}
              autoComplete="off"
              maxLength={100}
              value={editor.name}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </label>
          <div className="field">
            <label htmlFor={servingsId}>Portionen gesamt</label>
            <div className="stepper">
              <input
                id={servingsId}
                type="number"
                inputMode="decimal"
                enterKeyHint="done"
                min="0"
                step="any"
                value={editor.servingsText}
                onFocus={(event) => event.target.select()}
                onChange={(event) => onChange({ servingsText: event.target.value })}
              />
              <button
                type="button"
                className="frame-btn"
                aria-label="Eine Portion weniger"
                disabled={!(servings - 1 > 0)}
                onClick={() => stepServings(-1)}
              >
                <MinusIcon />
              </button>
              <button
                type="button"
                className="frame-btn"
                aria-label="Eine Portion mehr"
                onClick={() => stepServings(1)}
              >
                <PlusIcon size={22} />
              </button>
            </div>
          </div>
          {isVariation ? (
            <label className="field">
              <span>Gesamtgewicht (g)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder={formatNumber(totals.amountG)}
                value={editor.weightText}
                onChange={(event) => onChange({ weightText: event.target.value })}
              />
            </label>
          ) : (
            <>
              <VisibilitySwitch
                published={editor.published}
                onChange={(published) => onChange({ published })}
              />
              {editor.published && !editor.wasPublished && (
                <p className="hint switch-hint">
                  Deine privaten Lebensmittel in diesem Rezept werden beim Speichern mit
                  veröffentlicht. Variationen bleiben privat.
                </p>
              )}
            </>
          )}
        </fieldset>

        <div className="section-head">
          <h2>Zutaten</h2>
          <span className="section-meta">
            {items.length > 0 &&
              `${formatNumber(totals.amountG)} g · ${formatKcal(totals.kcal)}` +
                (servings > 0 ? ` · ${formatKcal(totals.kcal / servings)} pro Portion` : '')}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="empty">Noch keine Lebensmittel.</p>
        ) : (
          <div className="rows">
            {items.map((item) => (
              <IngredientRow
                key={item.food.id}
                item={item}
                showDeviation={isVariation}
                onOpen={readOnly ? undefined : () => onChange({ layer: { type: 'amount', foodId: item.food.id } })}
                onRemove={readOnly ? undefined : () => remove(item)}
              />
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
          <div className={isNew ? 'bar' : 'bar stacked'}>
            {isSavedOriginal ? (
              <>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!isValid || !changes.items}
                  onClick={() => onChange({ layer: { type: 'saveVariation' } })}
                >
                  Variation erstellen
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={!isValid || !changes.any}
                  onClick={onOverwrite}
                >
                  Original überschreiben
                </button>
              </>
            ) : (
              <button type="submit" className="btn primary" disabled={!isValid}>
                {isVariation ? 'Variation speichern' : 'Rezept speichern'}
              </button>
            )}
            {!isNew && (
              <button type="button" className="btn danger" onClick={onDelete}>
                {isVariation ? 'Variation löschen' : 'Rezept löschen'}
              </button>
            )}
          </div>
        )}
      </form>

      {layer?.type === 'saveVariation' && (
        <SaveVariationDialog
          recipeName={recipe.name}
          onSave={onSaveAsVariation}
          onClose={() => onChange({ layer: null })}
        />
      )}
    </section>
  )
}

const BOOKING_UNITS = [
  { value: UNIT_PORTION, label: 'Portion' },
  { value: UNIT_GRAM, label: 'Gramm' },
]

// Books a recipe into the meal draft: as portions, or as grams of the finished dish. Controlled:
// the state (see bookingFor) lives in MealTracker, onChange merges changes into it.
//
// "Dieses Rezept variieren": amounts, portions and the weight of the dish can be changed and foods
// added, also just for this one booking. Once something is changed, a save button appears: changes
// to the original become a new variation ("Variation erstellen"), changes to a variation update
// that variation ("Variation speichern"). Recipes of
// others have no variations; they can be copied ("Als eigenes Rezept speichern") and then booked
// and varied as the user's own.
function RecipeBooking({ booking, onChange, onAddFoods, onConfirm, onSaveVariation, onCopy, onClose }) {
  const { recipe, unit, quantityText, servingsText, weightText, items, variationId, layer } = booking
  const isVariation = variationId !== null
  const totals = totalsOf(items)
  const weightG = weightText === null ? totals.amountG : parseFloat(weightText)
  const servings = parseFloat(servingsText)
  const quantity = parseFloat(quantityText)
  const isValid = totals.amountG > 0 && servings > 0 && weightG > 0 && quantity > 0
  const share = isValid ? shareOf({ unit, quantity, servings, weightG }) : 0
  const adjusted = isAdjusted(booking)

  function changeUnit(newUnit) {
    if (newUnit === unit) return
    const changes = { unit: newUnit }
    if (isValid) {
      const converted = convertQuantity({ fromUnit: unit, quantity, servings, weightG })
      changes.quantityText = String(
        newUnit === UNIT_GRAM ? Math.round(converted) : roundToOneDecimal(converted),
      )
    }
    onChange(changes)
  }

  // Changing an ingredient makes the weight follow the ingredients again.
  function setAmount(foodId, amountG) {
    onChange({
      items: items.map((item) => (item.food.id === foodId ? { ...item, amountG } : item)),
      weightText: null,
      layer: null,
    })
  }

  // A new variation needs a name; an existing one is updated right away.
  function save() {
    if (isVariation) onSaveVariation(null)
    else onChange({ layer: { type: 'saveVariation' } })
  }

  // The "−" / "+" next to the portions to book: one portion less or more, never 0 or below.
  function stepQuantity(step) {
    const next = roundToOneDecimal((quantity > 0 ? quantity : 0) + step)
    if (next > 0) onChange({ quantityText: String(next) })
  }

  function submit(event) {
    event.preventDefault()
    if (!isValid) return
    const booked = scaleItems(
      items.filter((item) => item.amountG > 0),
      share,
    )
    onConfirm(booked, recipe.name, { recipeId: recipe.id, variationId })
  }

  if (layer?.type === 'amount') {
    const item = items.find((other) => other.food.id === layer.foodId)
    return (
      <FoodDetail
        food={item.food}
        initialAmountG={item.amountG || item.originalG}
        confirmLabel="Übernehmen"
        onConfirm={(food, amountG) => setAmount(food.id, amountG)}
        onClose={() => onChange({ layer: null })}
      />
    )
  }

  // Tapping a number field selects its value, so typing replaces it right away.
  const settingInput =
    unit === UNIT_PORTION ? (
      <label className="field">
        <span>Portionen</span>
        <input
          type="number"
          inputMode="decimal"
          enterKeyHint="done"
          min="0"
          step="any"
          value={servingsText}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ servingsText: event.target.value })}
        />
      </label>
    ) : (
      <label className="field">
        <span>Gewicht (g)</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          enterKeyHint="done"
          value={weightText ?? String(roundToOneDecimal(totals.amountG))}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange({ weightText: event.target.value })}
        />
      </label>
    )

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
            onChange={(event) => onChange({ quantityText: event.target.value })}
            aria-label={unit === UNIT_PORTION ? 'Anzahl Portionen' : 'Menge in Gramm'}
          />
          {unit === UNIT_PORTION && (
            <>
              <button
                type="button"
                className="frame-btn"
                aria-label="Eine Portion weniger"
                disabled={!(quantity - 1 > 0)}
                onClick={() => stepQuantity(-1)}
              >
                <MinusIcon />
              </button>
              <button
                type="button"
                className="frame-btn"
                aria-label="Eine Portion mehr"
                onClick={() => stepQuantity(1)}
              >
                <PlusIcon size={22} />
              </button>
            </>
          )}
        </div>
        <p className="book-result" role="status">
          {isValid ? formatKcal(totals.kcal * share) : '–'}
        </p>

        <div className="section-head">
          <h2>Dieses Rezept variieren</h2>
        </div>
        <div
          className={[
            'variation-row',
            unit === UNIT_GRAM ? 'gram' : '',
            recipe.owned ? '' : 'foreign',
          ].join(' ')}
        >
          {settingInput}
          {recipe.owned && (
            <div className="field">
              <SelectBox
                label="Variation"
                className="wide"
                value={String(variationId ?? '')}
                options={[
                  { value: '', label: 'Original' },
                  ...recipe.variations.map((variation) => ({
                    value: String(variation.id),
                    label: variation.name,
                  })),
                ]}
                onChange={(value) => onChange(bookingSelection(recipe, value === '' ? null : Number(value)))}
              />
            </div>
          )}
        </div>
        {unit === UNIT_GRAM && (
          <p className="variation-hint">
            {weightText === null ? (
              <span className="hint">Summe der Zutaten. Gewicht nach dem Kochen hier eintragen.</span>
            ) : (
              <button type="button" className="link-btn" onClick={() => onChange({ weightText: null })}>
                Aus Zutaten berechnen
              </button>
            )}
          </p>
        )}

        <div className="rows">
          {items.map((item) => (
            <IngredientRow
              key={item.food.id}
              item={item}
              showDeviation
              onOpen={() => onChange({ layer: { type: 'amount', foodId: item.food.id } })}
              onRemove={() => setAmount(item.food.id, 0)}
            />
          ))}
        </div>
        <button type="button" className="btn add-more" onClick={onAddFoods}>
          <PlusIcon size={18} />
          Lebensmittel hinzufügen
        </button>

        {/* Saving is offered once something was changed; booking works either way. Recipes of
            others can always be copied. */}
        <div className={adjusted || !recipe.owned ? 'bar stacked' : 'bar'}>
          {recipe.owned && adjusted && (
            <button type="button" className="btn" disabled={!isValid} onClick={save}>
              {isVariation ? 'Variation speichern' : 'Variation erstellen'}
            </button>
          )}
          {!recipe.owned && (
            <button
              type="button"
              className="btn"
              disabled={!isValid}
              onClick={() => onChange({ layer: { type: 'copy' } })}
            >
              Als eigenes Rezept speichern
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!isValid}>
            Zur Mahlzeit hinzufügen
          </button>
        </div>
      </form>

      {layer?.type === 'saveVariation' && (
        <SaveVariationDialog
          recipeName={recipe.name}
          onSave={onSaveVariation}
          onClose={() => onChange({ layer: null })}
        />
      )}
      {layer?.type === 'copy' && (
        <CopyRecipeDialog
          recipeName={recipe.name}
          isAdjusted={adjusted}
          onCopy={onCopy}
          onClose={() => onChange({ layer: null })}
        />
      )}
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
        throw new Error(authErrorMessage(error, path), { cause: error })
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
  // Whether our extra history entry exists. A ref, not state: it is changed by the effect below,
  // and setting state there would render again for nothing. popCount (changed only in the popstate
  // handler) makes that effect run again after the entry was used up.
  const hasEntry = useRef(false)
  const [popCount, setPopCount] = useState(0)
  const isRemovingEntry = useRef(false) // true while our own history.back() is in flight
  const goBackRef = useRef(goBack)
  const isNestedRef = useRef(isNested)

  useEffect(() => {
    goBackRef.current = goBack
    isNestedRef.current = isNested
  })

  // Unmounted while a nested view is open (e.g. logout from the profile): remove the extra
  // browser history entry as well. In the native app there is none (hasEntry stays false).
  useEffect(() => {
    return () => {
      if (hasEntry.current) history.back()
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
      hasEntry.current = false
      setPopCount((count) => count + 1)
      if (isRemovingEntry.current) isRemovingEntry.current = false
      else goBackRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (IS_NATIVE) return
    if (isNested && !hasEntry.current) {
      history.pushState(null, '')
      hasEntry.current = true
    } else if (!isNested && hasEntry.current && !isRemovingEntry.current) {
      // left the nested view by other means (e.g. "×"): drop the unused entry
      isRemovingEntry.current = true
      history.back()
    }
  }, [isNested, popCount])

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
  const [recipeBooking, setRecipeBooking] = useState(null) // booking view of a recipe, see bookingFor
  const [foodForm, setFoodForm] = useState(null) // food shown in the food database form
  const [recipeEditor, setRecipeEditor] = useState(null) // recipe editor, see NEW_EDITOR
  // Food search on top of the recipe editor or the booking view: null or { target, entries,
  // previewing }, target 'editor' | 'booking'; entries are the foods about to be added.
  const [recipeSearch, setRecipeSearch] = useState(null)
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

  // First load. State is only set once the request is done (not synchronously in the effect);
  // a late answer after unmounting is ignored.
  useEffect(() => {
    let isCurrent = true
    request(API.meals)
      .then((loaded) => {
        if (!isCurrent) return
        setMeals(loaded)
        setError(null)
      })
      .catch((error) => {
        if (isCurrent) setError(error.message)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  const reloadCatalog = () => setCatalogVersion((version) => version + 1)

  // ----- meals -----

  function startNewMeal() {
    setDraft(NEW_DRAFT)
    setView('search')
  }

  function editMeal(meal) {
    setDraft({ mealId: meal.id, entries: entriesFromMeal(meal), recipeUses: [] })
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

  // use: { recipeId, variationId }, remembered for the preselection next time.
  function addRecipeToDraft(items, recipeName, use) {
    setDraft((current) => ({
      ...current,
      entries: addRecipeItems(current.entries, items, recipeName, use.recipeId),
      // the same recipe added twice: the variation added last counts
      recipeUses: [...current.recipeUses.filter((other) => other.recipeId !== use.recipeId), use],
    }))
  }

  // The + in the search: one portion of the preselected variation (or the original).
  function addRecipePortion(recipe) {
    const variation = lastUsedVariation(recipe)
    addRecipeToDraft(onePortion(recipe), recipe.name, {
      recipeId: recipe.id,
      variationId: variation?.id ?? null,
    })
  }

  function openRecipeBooking(recipe) {
    setRecipeBooking(bookingFor(recipe))
  }

  function updateBooking(changes) {
    setRecipeBooking((current) => ({ ...current, ...changes }))
  }

  function confirmRecipeBooking(items, recipeName, use) {
    addRecipeToDraft(items, recipeName, use)
    setRecipeBooking(null)
  }

  // Saves the changes in the booking view: changes to the original as a new variation (name from
  // the dialog), changes to a variation into that variation (name null: keeps its name). Shows the
  // saved variation afterwards, keeping unit and quantity.
  function saveBookingVariation(name) {
    const booking = recipeBooking
    const { recipe: before, variationId } = booking
    runAction(async () => {
      const existing = variationOf(before, variationId)
      const body = JSON.stringify(
        variationRequest(name ?? existing.name, booking.servingsText, booking.weightText, booking.items),
      )
      const variation = existing
        ? await request(`${API.recipes}/${before.id}/variations/${existing.id}`, { method: 'PUT', body })
        : await request(`${API.recipes}/${before.id}/variations`, { method: 'POST', body })
      const recipe = {
        ...before,
        variations: existing
          ? before.variations.map((other) => (other.id === variation.id ? variation : other))
          : [...before.variations, variation],
      }
      setRecipeBooking({
        ...bookingFor(recipe, variation.id),
        unit: booking.unit,
        quantityText: booking.quantityText,
      })
      setCatalogVersion((version) => version + 1)
      setError(null)
    })
  }

  // A recipe of somebody else becomes the user's own (private) recipe: either with the adjusted
  // amounts as its original, or unchanged with the adjustments as its first variation.
  function copyBookingRecipe({ name, asVariation, variationName }) {
    const booking = recipeBooking
    const { recipe: source } = booking
    runAction(async () => {
      const original = asVariation
        ? { name, servingsText: String(source.servings), published: false, items: itemsOf(source, null) }
        : { name, servingsText: booking.servingsText, published: false, items: booking.items }
      let copy = await request(API.recipes, {
        method: 'POST',
        body: JSON.stringify(recipeRequest(original)),
      })
      let variationId = null
      if (asVariation) {
        const variation = await request(`${API.recipes}/${copy.id}/variations`, {
          method: 'POST',
          body: JSON.stringify(
            variationRequest(variationName, booking.servingsText, booking.weightText, booking.items),
          ),
        })
        copy = { ...copy, variations: [variation] }
        variationId = variation.id
      }
      setRecipeBooking({
        ...bookingFor(copy, variationId),
        unit: booking.unit,
        quantityText: booking.quantityText,
        // the weight of the dish is not part of a recipe, only of variations
        ...(asVariation ? {} : { weightText: booking.weightText }),
      })
      setNotice(`„${copy.name}“ ist jetzt dein eigenes Rezept.`)
      setCatalogVersion((version) => version + 1)
      setError(null)
    })
  }

  function removeFromDraft(foodId) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.food.id !== foodId),
    }))
  }

  function submitMeal() {
    runAction(async () => {
      await createOrUpdate(API.meals, draft.mealId, mealRequest(draft.entries, draft.recipeUses))
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
        ? {
            mealId,
            entries: entries.map((entry) => ({ ...entry, baseG: entry.amountG })),
            recipeUses: [],
          }
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
    setRecipeEditor(recipe === null ? NEW_EDITOR : editorFor(recipe))
  }

  function updateEditor(changes) {
    setRecipeEditor((current) => ({ ...current, ...changes }))
  }

  // Switching drops unsaved changes: the editor starts over from the saved recipe.
  function selectEditorVariation(variationId) {
    setRecipeEditor((current) => editorFor(current.recipe, variationId))
  }

  function openRecipeSearch(target) {
    setRecipeSearch({ target, entries: [], previewing: false })
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

  // In the booking view the weight follows the ingredients again, as after changing an amount.
  function applyRecipeSearch() {
    const { target, entries: added } = recipeSearch
    if (target === 'booking') {
      setRecipeBooking((current) => ({
        ...current,
        items: addToBookingItems(current.items, added),
        weightText: null,
      }))
    } else {
      setRecipeEditor((current) => ({
        ...current,
        items: mergeEditorItems(current.items, added, current.variationId !== null),
      }))
    }
    setRecipeSearch(null)
  }

  // A new recipe, or the variation shown in the editor.
  function saveRecipe() {
    const editor = recipeEditor
    if (editor.variationId === null) {
      saveOriginal(false)
      return
    }
    runAction(async () => {
      await request(`${API.recipes}/${editor.id}/variations/${editor.variationId}`, {
        method: 'PUT',
        body: JSON.stringify(
          variationRequest(editor.name, editor.servingsText, editor.weightText, editor.items),
        ),
      })
      setRecipeEditor(null)
      reloadCatalog()
      setError(null)
    })
  }

  // Saves the original: a new recipe right away (unless it is published), an existing one only
  // after confirming that it is overwritten.
  function saveOriginal(overwrite) {
    const editor = recipeEditor
    function save() {
      runAction(async () => {
        setConfirm(null)
        await createOrUpdate(API.recipes, editor.id, recipeRequest(editor))
        setRecipeEditor(null)
        reloadCatalog()
        setError(null)
      })
    }

    // Publishing also publishes the user's private foods in it (done by the server).
    const privateFoods = editor.items
      .filter((item) => item.food.owned && !item.food.published)
      .map((item) => item.food.name)
    const publishes = editor.published && (!editor.wasPublished || privateFoods.length > 0)
    if (!overwrite && !publishes) {
      save()
      return
    }

    const texts = []
    if (overwrite) {
      texts.push(
        'Deine Änderungen ersetzen das Original' +
          (editor.wasPublished ? ', auch für alle, die es öffentlich nutzen' : '') +
          '. Deine Variationen übernehmen die geänderten Zutaten, soweit sie diese nicht selbst angepasst haben.',
      )
    }
    if (publishes) {
      texts.push(
        (editor.wasPublished ? '' : 'Alle können das Rezept dann sehen und buchen, deine Variationen bleiben privat. ') +
          (privateFoods.length > 0
            ? `Dafür werden auch diese Lebensmittel von dir veröffentlicht: ${privateFoods.join(', ')}.`
            : ''),
      )
    }
    setConfirm({
      title: overwrite ? 'Original überschreiben?' : 'Rezept veröffentlichen?',
      text: texts.join(' ').trim(),
      confirmLabel: overwrite ? 'Überschreiben' : 'Veröffentlichen',
      tone: overwrite ? 'danger' : 'primary',
      onConfirm: save,
    })
  }

  // The changes made to the original become a new variation instead; the editor then shows it.
  // Ingredients removed from the list are left out (0 g) in the variation.
  function saveEditorAsVariation(name) {
    const editor = recipeEditor
    const { recipe } = editor
    const shown = new Set(editor.items.map((item) => item.food.id))
    const leftOut = recipe.items
      .filter((item) => !shown.has(item.food.id))
      .map((item) => ({ food: item.food, amountG: 0 }))
    runAction(async () => {
      const variation = await request(`${API.recipes}/${recipe.id}/variations`, {
        method: 'POST',
        body: JSON.stringify(
          variationRequest(name, editor.servingsText, null, [...editor.items, ...leftOut]),
        ),
      })
      setRecipeEditor(editorFor({ ...recipe, variations: [...recipe.variations, variation] }, variation.id))
      reloadCatalog()
      setError(null)
    })
  }

  // Deletes the variation shown in the editor (back to the original), or the whole recipe.
  function askDeleteRecipe() {
    const editor = recipeEditor
    if (editor.variationId !== null) {
      setConfirm({
        title: 'Variation löschen?',
        text: `„${editor.recipe.variations.find((v) => v.id === editor.variationId).name}“ wird gelöscht. Das Original bleibt unverändert.`,
        confirmLabel: 'Löschen',
        onConfirm: () =>
          runAction(async () => {
            setConfirm(null)
            await request(`${API.recipes}/${editor.id}/variations/${editor.variationId}`, {
              method: 'DELETE',
            })
            const recipe = {
              ...editor.recipe,
              variations: editor.recipe.variations.filter((v) => v.id !== editor.variationId),
              lastUsedVariationId:
                editor.recipe.lastUsedVariationId === editor.variationId
                  ? null
                  : editor.recipe.lastUsedVariationId,
            }
            setRecipeEditor(editorFor(recipe))
            reloadCatalog()
            setError(null)
          }),
      })
      return
    }
    setConfirm({
      title: 'Rezept löschen?',
      text:
        (editor.wasPublished ? 'Danach kann es auch sonst niemand mehr buchen. ' : '') +
        (editor.recipe?.variations.length > 0 ? 'Alle Variationen werden mit gelöscht. ' : '') +
        'Bereits gebuchte Mahlzeiten bleiben unverändert.',
      confirmLabel: 'Löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(`${API.recipes}/${editor.id}`, { method: 'DELETE' })
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
    else if (recipeSearch?.previewing) setRecipeSearch({ ...recipeSearch, previewing: false })
    else if (recipeSearch) setRecipeSearch(null)
    else if (recipeBooking?.layer) updateBooking({ layer: null })
    else if (recipeBooking) setRecipeBooking(null)
    else if (recipeEditor?.layer) updateEditor({ layer: null })
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
          version={catalogVersion}
          draftCount={draft.entries.length}
          submitLabel={isEditing ? 'Mahlzeit speichern' : 'Mahlzeit buchen'}
          onOpenFood={openFoodDetail}
          onAddFood={addToDraft}
          onOpenRecipe={openRecipeBooking}
          onAddRecipe={addRecipePortion}
          onPreview={() => setView('preview')}
          onSubmit={submitMeal}
          onClose={goBack}
          onError={setError}
        />
      )}

      {view === 'search' && recipeBooking && !recipeSearch && (
        <RecipeBooking
          booking={recipeBooking}
          onChange={updateBooking}
          onAddFoods={() => openRecipeSearch('booking')}
          onConfirm={confirmRecipeBooking}
          onSaveVariation={saveBookingVariation}
          onCopy={copyBookingRecipe}
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
              editor={recipeEditor}
              onChange={updateEditor}
              onSelectVariation={selectEditorVariation}
              onAddFoods={() => openRecipeSearch('editor')}
              onSave={saveRecipe}
              onSaveAsVariation={saveEditorAsVariation}
              onOverwrite={() => saveOriginal(true)}
              onDelete={askDeleteRecipe}
              onClose={goBack}
            />
          )}
        </>
      )}

      {/* Adds foods to the recipe editor or the booking view. Recipes cannot contain recipes,
          so this search only offers foods. */}
      {recipeSearch && (
        <FoodSearch
          visible={!recipeSearch.previewing && !detail}
          kindLocked
          draftCount={recipeSearch.entries.length}
          submitLabel="Hinzufügen"
          closeLabel={recipeSearch.target === 'booking' ? 'Zurück zur Buchung' : 'Zurück zum Rezept'}
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
const OFFLINE = { status: 'offline', user: null }

// Checks the login stored on this device against the server (GET /api/users/me) and returns the
// resulting state. null: the token was rejected (401); the unauthorized handler has already
// removed it and shows the login page.
async function checkStoredLogin() {
  try {
    if (!(await loadSession())) return LOGGED_OUT
    return { status: 'loggedIn', user: await request(API.me) }
  } catch (error) {
    // Anything but 401, e.g. no network: keep the token, the user is still logged in, just offline.
    return error.status === 401 ? null : OFFLINE
  }
}

// Decides between login page and app. A token stored on this device keeps the user logged in
// across app restarts: at start the token is checked once against the server (GET /api/users/me).
export default function App() {
  // status: 'loading' | 'offline' | 'loggedOut' | 'loggedIn'
  const [auth, setAuth] = useState(LOADING)

  const logOutLocally = useCallback(async () => {
    await clearToken()
    setAuth(LOGGED_OUT)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logOutLocally)
  }, [logOutLocally])

  useEffect(() => {
    let isCurrent = true
    checkStoredLogin().then((next) => {
      if (isCurrent && next) setAuth(next)
    })
    return () => {
      isCurrent = false
    }
  }, [])

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
    checkStoredLogin().then((next) => {
      if (next) setAuth(next)
    })
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
