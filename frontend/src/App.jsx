import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import './App.css'
import {
  API,
  ApiError,
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
  CHOICE_UNIT,
  DEFAULT_AMOUNT,
  FOOD_UNIT_G,
  FOOD_UNIT_ML,
  MAX_PORTION_NAME_LENGTH,
  amountChoices,
  draftPortions,
  EAN_MAX_LENGTH,
  eanCodeOf,
  isValidEan,
  formatAmount,
  initialAmountInput,
  isPortionNameTaken,
  portionRequests,
  quickAdd,
  removePortion,
  savePortion,
  setFavoritePortion,
  unitName,
  unitSymbol,
} from './foods.js'
import {
  addAmount,
  addRecipeItems,
  entriesFromMeal,
  daysBefore,
  localDate,
  mealRequest,
  msUntilMidnight,
} from './meals.js'
import {
  MACROS,
  bookedMacros,
  macroTargets,
  macrosOf,
  mealTotals,
  remainingKcal,
  scaleMacros,
} from './nutrition.js'
import { DARK, LIGHT, SYSTEM, applyColorTheme, storedColorTheme } from './theme.js'
import {
  NUTRIENT_DECIMALS,
  NUTRIENT_GROUPS,
  NUTRIENT_MAX_DIGITS,
  averageNutrients,
  bookedNutrients,
  formatNutrient,
  formatNutrientAmount,
  hasTypedNutrients,
  nutrientAmounts,
  nutrientPartProblems,
  nutrientProfileTexts,
  nutrientTexts,
  statedNutrientGroups,
} from './nutrients.js'
import { AGE_GROUPS, dailyNutrientTargets } from './dailyTargets.js'
import {
  formatQuantity,
  portionById,
  portionQuantity,
  quantityDifference,
  quantityFields,
  quantityFromItem,
  quantityOfInput,
  unitQuantity,
  zeroQuantity,
} from './quantities.js'
import { activitySummary } from './activity.js'
import {
  CAMERA_CONSTRAINTS,
  EAN_FORMATS,
  READS_NEEDED,
  canScanEan,
  focusAt,
  nextRead,
  pickBackCamera,
  pickEan,
  tuningFor,
} from './scanner.js'
import {
  NEW_SEARCH,
  USER_ITEM_SEARCH,
  KIND_USER_ITEMS,
  KIND_FOODS,
  KIND_RECIPES,
  SCOPE_FRIENDS,
  SCOPE_OWN,
  SCOPE_PUBLIC,
  SCOPE_RECENT,
  CATALOG_PAGE_SIZE,
  appendPage,
  canCreateUserItem,
  catalogKey,
  confirmedFilterAvailable,
  createCatalogCache,
  isIdleSearch,
  isLastPage,
  scopeAvailable,
  withKind,
  withQuery,
  withScope,
} from './catalog.js'
import { WEEKDAYS, canSaveTask, formatWeekdays, taskEditorFor, taskRequest, toggleWeekday } from './tasks.js'
import {
  HEIGHT_MAX,
  HEIGHT_MIN,
  MONTH_NAMES,
  SEX_OPTIONS,
  STEP_GOAL_MAX,
  WEIGHT_MAX,
  WEIGHT_MIN,
  birthDateFromParts,
  birthDateParts,
  numberIn,
  sanitizeNumberInput,
  toFieldText,
} from './bodyData.js'
import * as healthConnect from './healthConnect.js'
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
const PAGE_PARAM = 'page'
const SIZE_PARAM = 'size'

const IS_NATIVE = Capacitor.isNativePlatform() // true inside the Android app, false in a browser
const SEARCH_DELAY_MS = 250 // search only once typing pauses
const LOAD_AHEAD_PX = 1200 // the next page of results is loaded when the list ends this close below the screen
const CATALOG_CACHE = { maxEntries: 30, maxAgeMs: 5 * 60 * 1000 } // see createCatalogCache
const SCAN_NOT_FOUND_MS = 1200 // how long a scanned EAN that finds nothing stays in the field
const KEYBOARD_CLOSE_MOVE_PX = 10 // finger movement that closes the keyboard of a search, see useCloseKeyboardOnSwipe
const ADDED_FEEDBACK_MS = 600 // how long the + button shows ✓
const LOCALE = 'de-DE'
const DATE_TIME_FORMAT = { dateStyle: 'short', timeStyle: 'short' }

// Same rules as the backend (RegisterRequest, UserSettingsRequest, UserItem, ShoppingListCountRequest).
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_BYTES = 72 // bcrypt only uses the first 72 bytes, the backend rejects longer passwords
const MAX_CALORIE_TARGET = 20000
const MAX_USER_ITEM_NAME_LENGTH = 100 // UserItem.MAX_NAME_LENGTH
const MAX_USER_ITEM_COUNT = 999 // ShoppingListCountRequest.MAX_COUNT

const COLOR_THEMES = [
  { value: SYSTEM, label: 'System' },
  { value: LIGHT, label: 'Hell' },
  { value: DARK, label: 'Dunkel' },
]

// The meal being put together; mealId is null for a new meal.
// Entries are { food, amount, baseAmount, labels }, amounts in the unit of the food. baseAmount is
// the amount already saved in the meal, so amount - baseAmount is what the preview shows as
// "+X g". labels are what the entry was added as
// (the food's own name, or the names of the recipes it came with); they make up the meal title.
// recipeUses: which recipes were added, in which variation ({ recipeId, variationId }); sent
// with the meal so the variation is preselected next time. Entries added from a recipe also carry
// recipeIds, see addRecipeItems.
// Sharing the shopping list with friends; shown disabled until friends exist.
const SHARE_OPTIONS = [
  { value: false, label: 'Nicht teilen' },
  { value: true, label: 'Teilen' },
]

// Who sees the user's items (as the backend names it); user items are never public.
const USER_ITEM_VISIBILITIES = [
  { value: 'PRIVATE', label: 'Privat' },
  { value: 'FRIENDS', label: 'Freunde' },
]

const NEW_DRAFT = { mealId: null, entries: [], recipeUses: [] }

const NEW_FOOD = { id: null, owned: true, published: false, unit: FOOD_UNIT_G, portions: [] }


// The two kinds of entries in the search, and the filters that apply to both. The search behind
// "Hinzufügen" of the shopping list also offers the user's items ("Benutzeritems").
const CATALOG_KINDS = [
  { value: KIND_FOODS, label: 'Lebensmittel' },
  { value: KIND_RECIPES, label: 'Rezepte' },
]
const SHOPPING_KINDS = [...CATALOG_KINDS, { value: KIND_USER_ITEMS, label: 'Benutzeritems' }]
const KIND_URLS = { [KIND_FOODS]: API.foods, [KIND_RECIPES]: API.recipes, [KIND_USER_ITEMS]: API.userItems }

// Whose entries the search shows. "Alle": everything the user may see (own entries, private
// ones included, and all public ones). "Zuletzt": the foods booked last, for foods only and their
// default; typing switches it to "Alle" (see withQuery in catalog.js). Values as
// the backend expects them ('' = no scope). "Nur bestätigte" is a separate toggle for some of
// these (see catalog.js). soon: does not work yet, marked "bald".
const SCOPE_OPTIONS = [
  { value: '', label: 'Alle', Icon: AllIcon },
  { value: SCOPE_PUBLIC, label: 'Öffentlich', Icon: GlobeIcon },
  { value: SCOPE_OWN, label: 'Eigene', Icon: PersonIcon },
  { value: SCOPE_FRIENDS, label: 'Freunde', Icon: PeopleIcon, disabled: true, soon: true }, // no friends yet
  { value: SCOPE_RECENT, label: 'Zuletzt', Icon: ClockIcon },
]
// The scopes as offered for a kind: those that do not apply greyed out (see scopeAvailable).
const SCOPE_OPTIONS_BY_KIND = Object.fromEntries(
  [KIND_FOODS, KIND_RECIPES, KIND_USER_ITEMS].map((kind) => [
    kind,
    SCOPE_OPTIONS.map((option) =>
      scopeAvailable(kind, option.value === '' ? null : option.value) ? option : { ...option, disabled: true },
    ),
  ]),
)


// One page (0, 1, ...) of GET /api/foods or /api/recipes with the search text and the filters,
// if any. "Nur bestätigte" only where it applies (see confirmedFilterAvailable). Foods come without
// their nutrients and macros; details and form load the whole food with fetchFood.
function fetchCatalog(kind, { query, scope, confirmedOnly }, page, signal) {
  const params = new URLSearchParams()
  const search = query.trim()
  if (search) params.set(SEARCH_PARAM, search)
  if (scope) params.set(SCOPE_PARAM, scope)
  if (confirmedOnly && confirmedFilterAvailable({ kind, scope })) params.set(CONFIRMED_PARAM, 'true')
  params.set(PAGE_PARAM, String(page))
  params.set(SIZE_PARAM, String(CATALOG_PAGE_SIZE))
  return request(`${KIND_URLS[kind]}?${params}`, { signal })
}

function fetchFood(id) {
  return request(`${API.foods}/${id}`)
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
// The details below the name of an item: "135 g · 2,25 Stück · 194 kcal" for portions, "200 ml ·
// 128 kcal" for an amount. quantity: see quantities.js.
function amountPortionsAndKcal(food, quantity) {
  const portions = quantity.portionId != null ? ` · ${formatQuantity(food, quantity)}` : ''
  return `${formatAmount(quantity.amount, food.unit)}${portions} · ${formatKcal(kcalOf(food, quantity.amount))}`
}
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

// A clipboard with a tick: the checklist.
function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" {...iconProps}>
      <path d="M15 4.5h2a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="M9 13.5l2 2 4-4" />
    </svg>
  )
}

// Shopping cart: the shopping list.
function CartIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} {...iconProps} height={size}>
      <path d="M2.5 3.5h2.6l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1l1.8-6.8H6.3" />
      <circle cx="9.5" cy="19.8" r="1.4" />
      <circle cx="17" cy="19.8" r="1.4" />
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

// Favorite portion. filled: the favorite, outlined: the others.
function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="22" {...iconProps} height="22" fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" {...iconProps} height="20">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
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

// a torch with its beam
function TorchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} {...iconProps} height={22}>
      <path d="M8 3h8v3l-2 4v10a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10L8 6z" />
      <path d="M8 6h8M12 13v2" />
    </svg>
  )
}

// vertical bars of different width, like a barcode
function BarcodeIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} {...iconProps} height={size}>
      <path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12" />
      <path d="M2.5 4.5v-1h3M18.5 3.5h3v1M21.5 19.5v1h-3M5.5 20.5h-3v-1" strokeWidth="1.3" />
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

// "Zuletzt" in the filter select: a clock.
function ClockIcon() {
  return (
    <svg {...smallIconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
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

// The end of the detail line of a confirmed food in the search views: " · " and the seal, in the
// colour of the line. Nothing for foods that are not confirmed.
function ConfirmedMark({ entry }) {
  if (!entry.confirmed) return null
  return (
    <>
      <span className="booking-separator"> · </span>
      <span className="confirmed-mark" title="Bestätigt" aria-label="bestätigt">
        <SealIcon size={14} />
      </span>
    </>
  )
}

// The results of the last searches, shared by all search views; emptied on login and logout, as
// "owned" and the private entries depend on the user.
const catalogCache = createCatalogCache(CATALOG_CACHE)

function clearCatalogCache() {
  catalogCache.clear()
}

// Foods or recipes (kind) matching the search (text and filters, see NEW_SEARCH), loaded once
// typing pauses, a page at a time (see fetchCatalog). A change of `version` loads them again, e.g.
// after something was saved. onError must be stable (e.g. a state setter), otherwise every render
// restarts the request.
//
// Returns { entries, loadedQuery, idle, loaded, hasMore, loadMore }:
// - idle: nothing is searched yet (see isIdleSearch), entries is empty.
// - The previous list stays until the new one is there; loaded tells whether entries belong to
//   the current search, loadedQuery is the search text they were loaded for (null: none yet).
// - loadMore() appends the next page if hasMore (see LoadMoreSentinel); one request at a time.
// A search done before (see createCatalogCache) shows its list at once, with all pages loaded then.
function useCatalog(kind, { query, scope, confirmedOnly }, version, onError) {
  const idle = isIdleSearch({ query, scope, kind })
  const key = catalogKey(kind, { query, scope, confirmedOnly }, version)
  // { key, kind, query, entries, pages, hasMore }; it remembers its kind: right after switching,
  // the old list must not be shown as the new kind.
  const [result, setResult] = useState(null)
  const nextPage = useRef(null) // AbortController of the running loadMore request

  useEffect(() => {
    if (idle) return
    const controller = new AbortController()
    const cached = catalogCache.get(key, Date.now())
    const timer = setTimeout(
      async () => {
        if (cached) {
          setResult(cached)
          return
        }
        try {
          const entries = await fetchCatalog(kind, { query, scope, confirmedOnly }, 0, controller.signal)
          const loaded = { key, kind, query, entries, pages: 1, hasMore: !isLastPage(entries) }
          catalogCache.set(key, loaded, Date.now())
          setResult(loaded)
          onError(null)
        } catch (error) {
          if (!controller.signal.aborted) onError(error.message)
        }
      },
      cached ? 0 : SEARCH_DELAY_MS,
    )

    return () => {
      clearTimeout(timer)
      controller.abort()
      nextPage.current?.abort()
      nextPage.current = null
    }
  }, [idle, key, kind, query, scope, confirmedOnly, onError])

  const current = result?.key === key ? result : null

  function loadMore() {
    if (!current?.hasMore || nextPage.current) return
    const controller = new AbortController()
    nextPage.current = controller
    fetchCatalog(kind, { query, scope, confirmedOnly }, current.pages, controller.signal)
      .then((page) => {
        const loaded = {
          ...current,
          entries: appendPage(current.entries, page),
          pages: current.pages + 1,
          hasMore: !isLastPage(page),
        }
        catalogCache.set(key, loaded, Date.now())
        setResult((shown) => (shown?.key === key ? loaded : shown))
      })
      .catch((error) => {
        if (!controller.signal.aborted) onError(error.message)
      })
      .finally(() => {
        if (nextPage.current === controller) nextPage.current = null
      })
  }

  if (idle) return { entries: [], loadedQuery: null, idle, loaded: false, hasMore: false, loadMore }
  const shown = result?.kind === kind ? result : null
  return {
    entries: shown?.entries ?? [],
    loadedQuery: shown?.query ?? null,
    idle,
    loaded: current !== null,
    hasMore: current?.hasMore ?? false,
    loadMore,
  }
}

// Placed under a paged list: asks for the next page (onVisible) once the end of the list comes
// within LOAD_AHEAD_PX below the screen, so the rows are usually there before they are scrolled
// to. Pages are only appended below, so nothing on screen moves. Watched anew after each page
// (count): the observer only reports changes, and a short page can leave the end in reach.
function LoadMoreSentinel({ active, count, onVisible }) {
  const ref = useRef(null)
  const onVisibleRef = useRef(onVisible)
  useEffect(() => {
    onVisibleRef.current = onVisible
  })
  useEffect(() => {
    if (!active) return
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) onVisibleRef.current()
      },
      { rootMargin: `0px 0px ${LOAD_AHEAD_PX}px 0px` },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [active, count])
  return <div ref={ref} className="load-more" aria-hidden="true" />
}

// What a search view shows instead of rows: a hint before the first letter, nothing while the
// first results load, otherwise notFound (or that nothing was booked yet, for "Zuletzt", that
// there are no own foods / foods of friends or no recipes yet, or how to create the first user
// item).
function CatalogEmpty({ catalog, search, notFound }) {
  if (catalog.idle) return <p className="empty">Tippe, um die Suche zu starten.</p>
  if (!catalog.loaded) return null
  if (search.scope === SCOPE_RECENT && search.query.trim() === '') {
    return <p className="empty">Du hast noch keine Lebensmittel gebucht. Tippe, um alle Lebensmittel zu durchsuchen.</p>
  }
  if (search.kind === KIND_FOODS && search.query.trim() === '') {
    return (
      <p className="empty">
        {search.scope === SCOPE_OWN
          ? 'Du hast noch keine eigenen Lebensmittel.'
          : 'Deine Freunde haben noch keine Lebensmittel.'}
      </p>
    )
  }
  if (search.kind === KIND_RECIPES && search.query.trim() === '') {
    return (
      <p className="empty">
        {search.scope === SCOPE_OWN ? 'Du hast noch keine eigenen Rezepte.' : 'Noch keine Rezepte.'}
      </p>
    )
  }
  if (search.kind === KIND_USER_ITEMS && search.scope === SCOPE_OWN) {
    return (
      <p className="empty">
        {search.query.trim() === ''
          ? 'Noch keine eigenen Benutzeritems. Tippe einen Namen ein und lege das Item mit + an.'
          : 'Kein Item gefunden. Mit + legst du es an.'}
      </p>
    )
  }
  return <p className="empty">{notFound}</p>
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

function KcalPer100({ kcal, unit }) {
  return (
    <>
      {Math.round(kcal)} kcal pro 100 {unitSymbol(unit)}
    </>
  )
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

// Closes the on-screen keyboard as soon as the finger moves over the page (to scroll the list): the
// field (ref) loses its focus, its text stays; tapping it opens the keyboard again. Only touch
// counts: the page also scrolls by itself when the keyboard opens, which must not close it again,
// and on a computer the cursor stays in the field. A tap wobbles a few pixels, so only a move of
// more than KEYBOARD_CLOSE_MOVE_PX counts; moving the finger inside the field (placing the cursor,
// selecting text) does not.
function useCloseKeyboardOnSwipe(ref) {
  useEffect(() => {
    let start = null // where the current touch began, null: it does not count
    function onTouchStart(event) {
      const touch = event.touches[0]
      start = event.touches.length === 1 && !ref.current?.contains(event.target)
        ? { x: touch.clientX, y: touch.clientY }
        : null
    }
    function onTouchMove(event) {
      const field = ref.current
      if (!start || !field || document.activeElement !== field) return
      const touch = event.touches[0]
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > KEYBOARD_CLOSE_MOVE_PX) {
        start = null
        field.blur()
      }
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [ref])
}

// Search field with the filter row below it. Both stick to the top while the list scrolls.
// Filter row: "only confirmed" toggle, whose entries, foods or recipes; the two selects share the
// width. children: extra buttons at the end (the "+" of the food database and of the shopping list
// search). kinds: the choices of the kind select (the shopping list adds user items).
// filtersLocked: the filters are fixed by the view (see NutrientProfileSearch); they show what
// applies, greyed out, and cannot be changed. results: { query, count } of the list shown below,
// query the search text it was loaded for; a scan that finds nothing is cleared again with it.
// The field is focused when the search opens, after choosing another kind and after choosing a
// filter that needs typing; scrolling with the finger closes the keyboard (see
// useCloseKeyboardOnSwipe).
function CatalogHeader({
  search,
  onSearchChange,
  results,
  closeLabel,
  onClose,
  kindLocked = false,
  filtersLocked = false,
  kinds = CATALOG_KINDS,
  children,
}) {
  const { query, scope, confirmedOnly, kind } = search
  // "Nur bestätigte" only for public foods and foods of everybody, otherwise greyed out and off
  // (see confirmedFilterAvailable).
  const confirmable = confirmedFilterAvailable({ kind: kindLocked ? KIND_FOODS : kind, scope })
  const placeholder = SEARCH_PLACEHOLDERS[kindLocked ? KIND_FOODS : kind]
  const inputRef = useRef(null)
  useCloseKeyboardOnSwipe(inputRef)
  // The barcode button takes the place of the field's own "×" while nothing is typed, for foods only
  // and only where the device can scan (see scanner.js). A scanned EAN becomes the search text; the
  // backend finds the food by its EAN (also an unconfirmed one, see FoodRepository.search).
  const canScan = useCanScanEan()
  const [isScanning, setIsScanning] = useState(false)
  const showScan = canScan && query === '' && (kindLocked || kind === KIND_FOODS)
  // A scanned EAN that finds nothing: "nothing found" stays a moment, then the field is cleared, so
  // the scan button is right there again. Typing something else cancels it.
  const [scannedCode, setScannedCode] = useState(null)
  const isScanNotFound =
    scannedCode !== null && query === scannedCode && results?.query === scannedCode && results.count === 0
  const clearSearch = useRef(null)
  useEffect(() => {
    clearSearch.current = () => onSearchChange(withQuery(search, ''))
  })
  useEffect(() => {
    if (!isScanNotFound) return
    const timer = setTimeout(() => {
      setScannedCode(null)
      clearSearch.current()
    }, SCAN_NOT_FOUND_MS)
    return () => clearTimeout(timer)
  }, [isScanNotFound])

  return (
    <div className="search-head">
      <div className="search">
        <FramedCloseButton label={closeLabel} onClick={onClose} />
        <div className="search-input inline-btn-field">
          <input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            autoFocus
            value={query}
            onChange={(event) => {
              setScannedCode(null)
              onSearchChange(withQuery(search, event.target.value))
            }}
          />
          {showScan && (
            <button
              type="button"
              className="scan-btn"
              title="EAN scannen"
              aria-label="EAN scannen"
              onClick={() => setIsScanning(true)}
            >
              <BarcodeIcon />
            </button>
          )}
        </div>
      </div>
      {isScanning && (
        <BarcodeScanner
          onDetected={(code) => {
            setIsScanning(false)
            setScannedCode(code)
            onSearchChange(withQuery(search, code))
          }}
          onClose={() => setIsScanning(false)}
        />
      )}
      <div className="catalog-filter">
        <button
          type="button"
          className="toggle-btn"
          aria-pressed={confirmable && confirmedOnly}
          title={
            filtersLocked
              ? 'Nur bestätigte (hier immer an)'
              : confirmable
                ? 'Nur bestätigte'
                : 'Nur bestätigte (nur für öffentliche Lebensmittel)'
          }
          aria-label="Nur bestätigte"
          disabled={filtersLocked || !confirmable}
          onClick={() => onSearchChange({ ...search, confirmedOnly: !confirmedOnly })}
        >
          <SealIcon size={22} />
        </button>
        <SelectBox
          label="Filter"
          className="fill"
          value={scope ?? ''}
          options={SCOPE_OPTIONS_BY_KIND[kindLocked ? KIND_FOODS : kind]}
          disabled={filtersLocked}
          onChange={(value) => {
            const changed = withScope(search, value === '' ? null : value)
            onSearchChange(changed)
            // A filter whose list only comes with typing ("Alle" or "Öffentlich" for foods, see
            // isIdleSearch): the field gets the focus back from the select, as for the kind below.
            if (isIdleSearch({ ...changed, kind: kindLocked ? KIND_FOODS : changed.kind })) {
              inputRef.current?.focus()
            }
          }}
        />
        <SelectBox
          label="Art"
          className="fill fill-more"
          value={kindLocked ? KIND_FOODS : kind}
          options={kinds}
          disabled={kindLocked || filtersLocked}
          onChange={(value) => {
            onSearchChange(withKind(search, value))
            // The select took the focus; typing right away should search the new kind. Still within
            // the tap, so the phone opens its keyboard too.
            inputRef.current?.focus()
          }}
        />
        {children}
      </div>
    </div>
  )
}

const SEARCH_PLACEHOLDERS = {
  [KIND_FOODS]: 'Lebensmittel suchen',
  [KIND_RECIPES]: 'Rezepte suchen',
  [KIND_USER_ITEMS]: 'Benutzeritems suchen oder anlegen',
}

// Whether this device can scan EANs (see canScanEan); asked once, false until the answer is there.
let canScanEanPromise = null
function useCanScanEan() {
  const [canScan, setCanScan] = useState(false)
  useEffect(() => {
    let isCurrent = true
    canScanEanPromise ??= canScanEan()
    canScanEanPromise.then((result) => isCurrent && setCanScan(result))
    return () => {
      isCurrent = false
    }
  }, [])
  return canScan
}

// Focuses the text field after `input` in its form (e.g. the kcal after the EAN); stays on `input`
// if there is none.
function focusNextField(input) {
  if (!input?.form) return
  const fields = [...input.form.elements].filter(
    (element) => element.tagName === 'INPUT' && !element.disabled && element.type !== 'hidden',
  )
  const next = fields[fields.indexOf(input) + 1]
  ;(next ?? input).focus()
}

// Views inside a view that the back button closes first (the barcode scanner); the last one opened
// is the first one closed. MealTracker's goBack asks closeInnerView before anything else.
const innerViews = []
function closeInnerView() {
  const close = innerViews.at(-1)
  if (!close) return false
  close()
  return true
}
function useInnerView(close) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    const entry = () => closeRef.current()
    innerViews.push(entry)
    return () => {
      innerViews.splice(innerViews.indexOf(entry), 1)
    }
  }, [])
}

// The camera across the whole screen with a frame to hold the barcode in. Reads several times a
// second; a valid EAN read READS_NEEDED times in a row is handed to onDetected. Sharp pictures
// matter most: the main rear camera in full HD (not the ultra-wide one, which cannot focus close),
// continuous autofocus, a slight zoom so the code can be held a hand's width away, focus on a tapped
// point, and the torch where there is one. All of it only where the device offers it (see scanner.js).
// The app asks for the camera permission the first time. "×" or back closes it.
function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)
  const [problem, setProblem] = useState(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  })
  useInnerView(onClose)

  useEffect(() => {
    let stream = null
    let timer = null
    let isCurrent = true
    let reads = { code: null, count: 0 }
    const detector = new window.BarcodeDetector({ formats: EAN_FORMATS })
    const open = (video) => navigator.mediaDevices.getUserMedia({ video, audio: false })
    const stop = (mediaStream) => mediaStream?.getTracks().forEach((track) => track.stop())

    async function scan() {
      const video = videoRef.current
      if (!isCurrent || !video) return
      try {
        if (video.readyState >= 2) {
          reads = nextRead(reads, pickEan(await detector.detect(video)))
          if (reads.count >= READS_NEEDED) {
            onDetectedRef.current(reads.code)
            return
          }
        }
      } catch {
        // a frame that cannot be read yet; try the next one
      }
      if (isCurrent) timer = setTimeout(scan, 120)
    }

    async function start() {
      stream = await open(CAMERA_CONSTRAINTS)
      // Only now, with the permission, do the cameras have names: switch to the main one if needed.
      const mainId = pickBackCamera(await navigator.mediaDevices.enumerateDevices())
      const currentId = stream.getVideoTracks()[0]?.getSettings?.().deviceId
      if (isCurrent && mainId && mainId !== currentId) {
        stop(stream)
        const mainCamera = { ...CAMERA_CONSTRAINTS, facingMode: undefined, deviceId: { exact: mainId } }
        stream = await open(mainCamera).catch(() => open(CAMERA_CONSTRAINTS))
      }
      if (!isCurrent) return stop(stream)
      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      const capabilities = track.getCapabilities?.() ?? {}
      const tuning = tuningFor(capabilities)
      if (tuning) await track.applyConstraints(tuning).catch(() => {})
      setHasTorch(Boolean(capabilities.torch))
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      scan()
    }

    start().catch((error) => {
      if (!isCurrent) return
      setProblem(
        error?.name === 'NotAllowedError'
          ? 'Kein Zugriff auf die Kamera. Bitte erlaube ihn in den Einstellungen der App.'
          : 'Die Kamera lässt sich nicht starten.',
      )
    })

    return () => {
      isCurrent = false
      clearTimeout(timer)
      trackRef.current = null
      stop(stream)
    }
  }, [])

  // Tap to focus there; after a moment the camera goes back to continuous focus.
  function focusOnTap(event) {
    const track = trackRef.current
    if (!track) return
    const capabilities = track.getCapabilities?.() ?? {}
    const rect = event.currentTarget.getBoundingClientRect()
    const constraints = focusAt(
      capabilities,
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    )
    if (!constraints) return
    track
      .applyConstraints(constraints)
      .then(() => new Promise((resolve) => setTimeout(resolve, 1500)))
      .then(() => {
        const tuning = tuningFor(capabilities)
        if (trackRef.current === track && tuning) return track.applyConstraints(tuning)
      })
      .catch(() => {})
  }

  function toggleTorch() {
    const track = trackRef.current
    if (!track) return
    const torch = !isTorchOn
    track
      .applyConstraints({ advanced: [{ torch }] })
      .then(() => setIsTorchOn(torch))
      .catch(() => setHasTorch(false))
  }

  // Into the body: the sticky search head would otherwise keep it below the bottom bar.
  return createPortal(
    <div className="scanner" role="dialog" aria-modal="true" aria-label="EAN scannen">
      <video ref={videoRef} className="scanner-video" playsInline muted onClick={focusOnTap} />
      <div className="scanner-frame" aria-hidden="true" />
      <p className="scanner-hint">
        {problem ?? 'Strichcode in den Rahmen halten, etwa eine Handbreit entfernt. Antippen stellt scharf.'}
      </p>
      <div className="scanner-close">
        <FramedCloseButton label="Scannen beenden" onClick={onClose} />
      </div>
      {hasTorch && (
        <button
          type="button"
          className={isTorchOn ? 'frame-btn scanner-torch on' : 'frame-btn scanner-torch'}
          aria-pressed={isTorchOn}
          aria-label="Licht"
          title="Licht"
          onClick={toggleTorch}
        >
          <TorchIcon />
        </button>
      )}
    </div>,
    document.body,
  )
}

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
              {option.soon && <span className="soon">bald</span>}
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

// What the main view shows of today's activity (see useActivity). null: nothing known (browser,
// still loading, or reading failed without data from earlier today), shown as "–". Not connected:
// 0 steps and +0 kcal, the same as a day without activity.
function shownActivity(activity, user) {
  if (activity.status === 'disconnected') return { steps: 0, stepKcal: 0, activityKcal: 0 }
  return activity.data ? activitySummary(activity.data, user) : null
}

// The calorie target of today: the one of the profile plus all activity (see activitySummary).
function dayCalorieTarget(user, shown) {
  return user.calorieTarget + (shown?.activityKcal ?? 0)
}

// Today at a glance. On top, side by side: steps (green once the step goal is reached), the
// calories left, and the kcal of all activity (steps and workouts, see activitySummary). The calorie target grows by
// that activity, and so do the macro targets below, as they are shares of the calories.
// meals: today's meals. activity: see useActivity.
// Tapped anywhere (or Enter / Space), it opens the daily targets of the further nutrients
// (onOpen, see NutrientOverview).
function DaySummary({ user, meals, activity, onOpen }) {
  const shown = shownActivity(activity, user)
  const target = dayCalorieTarget(user, shown)
  const remaining = Math.round(remainingKcal(target, meals))
  const isOver = remaining < 0
  const targets = macroTargets({ ...user, calorieTarget: target })
  const booked = bookedMacros(meals)
  const reachedStepGoal = shown !== null && shown.steps >= user.stepGoal

  function onKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen()
  }

  return (
    <div className="day-summary" role="button" tabIndex={0} title="Tagesbedarf heute" onClick={onOpen} onKeyDown={onKeyDown}>
      <div className="day-top">
        <div className="day-side">
          <span className="day-side-label">Schritte</span>
          <span className={reachedStepGoal ? 'day-side-value earned' : 'day-side-value'}>
            {shown ? Math.round(shown.steps).toLocaleString(LOCALE) : '–'}
          </span>
        </div>
        <div className="kcal-left" role="status" aria-label="Kalorien heute">
          <span className={isOver ? 'kcal-left-value over' : 'kcal-left-value'}>
            {Math.abs(remaining).toLocaleString(LOCALE)}
          </span>
          <span className="kcal-left-label">{isOver ? 'kcal zu viel' : 'kcal übrig'}</span>
        </div>
        <div className="day-side">
          <span className="day-side-label">Aktivität</span>
          <span className="day-side-value activity earned">{shown ? earnedKcal(shown.activityKcal) : '–'}</span>
        </div>
      </div>
      <div className="macro-bars">
        {MACROS.map(({ key, label }) => (
          <MacroBar key={key} label={label} booked={booked[key]} target={targets[key]} />
        ))}
      </div>
    </div>
  )
}

// e.g. "+233 kcal"
const earnedKcal = (kcal) => `+${Math.round(kcal).toLocaleString(LOCALE)} kcal`

// Today's amount of every further nutrient next to the daily target, grouped as in the food form,
// each with a bar below. The targets are computed (see dailyTargets.js) with today's calorie
// target, which grows with the activity. Without birth date or sex in the profile there are none:
// "300 / 0 mg" with an empty bar, and a hint. Protein, carbs and fat are not repeated here, the
// main view shows them. A small mark on each bar shows the average of the last week (see
// useWeekAverage). activity: see useActivity. today: "YYYY-MM-DD".
function NutrientOverview({ user, meals, activity, today, onClose }) {
  const booked = bookedNutrients(meals)
  const weekAverage = useWeekAverage(today)
  const calorieTarget = Math.round(dayCalorieTarget(user, shownActivity(activity, user)))
  const computed = dailyNutrientTargets(user, calorieTarget, today)
  const targets = computed?.targets ?? {}
  return (
    <section>
      <TopBar title="Tagesbedarf heute" closeLabel="Schließen" onClose={onClose} />
      {computed ? (
        <p className="hint nutrient-note">
          DGE/ÖGE-Referenzwerte für {TARGET_SEX_LABELS[user.sex]}, {AGE_GROUPS[computed.ageGroup].label}, bei{' '}
          {calorieTarget.toLocaleString(LOCALE)} kcal heute.
          {computed.isUnderAdultAge && ' Unter 19 Jahren gelten eigene Werte; gezeigt werden die ab 19.'} Berechnet
          aus deinem Profil.
        </p>
      ) : (
        <p className="hint warning nutrient-note">{MISSING_TARGETS_HINT}</p>
      )}
      {weekAverage && (
        <p className="hint nutrient-note">
          Der Strich zeigt deinen Schnitt der letzten 7 Tage (ohne heute,{' '}
          {weekAverage.days === 1 ? '1 Tag' : `${weekAverage.days} Tage`} mit Einträgen).
        </p>
      )}
      {NUTRIENT_GROUPS.map((group) => (
        <div key={group.title} className="nutrient-group">
          <h3>{group.title}</h3>
          <div className="nutrient-bars">
            {group.nutrients.map(({ key, label, unit, limit }) => (
              <NutrientBar
                key={key}
                label={limit ? `${label} (höchstens)` : label}
                unit={unit}
                booked={booked[key]}
                average={weekAverage?.amounts[key] ?? null}
                target={targets[key] ?? 0}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// The days of the week average: the 7 before today. Today is still running and would pull it down.
const WEEK_DAYS = 7

// What the last week contained of each nutrient on average per tracked day (see averageNutrients),
// loaded when the overview opens. null while loading, if it fails (the mark is only extra
// information, so no error is shown) or if nothing was booked in that week.
function useWeekAverage(today) {
  const [average, setAverage] = useState(null)
  useEffect(() => {
    let isCurrent = true
    Promise.all(daysBefore(today, WEEK_DAYS).map((day) => request(`${API.meals}?date=${day}`)))
      .then((mealsByDay) => isCurrent && setAverage(averageNutrients(mealsByDay)))
      .catch(() => isCurrent && setAverage(null))
    return () => {
      isCurrent = false
    }
  }, [today])
  return average
}

// One nutrient: name and "300 / 5.000 mg" in a line, the bar below, filled by the share of the
// target that is booked (full at the target and above). No colors for now. average: the week
// average (or null), shown as a thin mark across the bar, at the end if it reaches the target.
function NutrientBar({ label, unit, booked, average, target }) {
  const share = target > 0 ? Math.min(booked / target, 1) : 0
  const value = `${formatNutrientAmount(booked)} / ${formatNutrientAmount(target)} ${unit}`
  const averageShare = average !== null && target > 0 ? Math.min(average / target, 1) : null
  const averageText = average === null ? '' : `, Wochenschnitt ${formatNutrient(average, unit)}`
  return (
    <div className="nutrient-bar">
      <div className="nutrient-bar-head">
        <span className="nutrient-bar-label">{label}</span>
        <span className="nutrient-bar-value">{value}</span>
      </div>
      <span className="nutrient-track">
        <span
          className="macro-track"
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(booked, target)}
          aria-valuetext={value + averageText}
        >
          <span className="macro-fill" style={{ width: `${share * 100}%` }} />
        </span>
        {averageShare !== null && (
          // Kept inside the bar: at 100 % it ends flush with the right edge.
          <span
            className="week-mark"
            style={{ left: `calc(${averageShare * 100}% - ${averageShare * 2}px)` }}
            aria-hidden="true"
          />
        )}
      </span>
    </div>
  )
}

// One nutrient: its name, a bar filled by the share of the target that is booked, and below it
// "30 / 200 g". With a target of 0 g any booked amount counts as too much.
function MacroBar({ label, booked, target }) {
  const bookedGrams = Math.round(booked)
  const targetGrams = Math.round(target)
  const share = target > 0 ? booked / target : booked > 0 ? Infinity : 0
  const isOver = share > 1
  return (
    <div className={isOver ? 'macro over' : 'macro'}>
      <span className="macro-label">{label}</span>
      <span
        className="macro-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={targetGrams}
        aria-valuenow={bookedGrams}
        aria-valuetext={`${bookedGrams} von ${targetGrams} g`}
      >
        <span className="macro-fill" style={{ width: `${Math.min(share, 1) * 100}%` }} />
      </span>
      <span className="macro-value">
        {bookedGrams.toLocaleString(LOCALE)} / {targetGrams.toLocaleString(LOCALE)} g
      </span>
    </div>
  )
}

function MealList({
  user,
  meals,
  activity,
  onAdd,
  onEdit,
  onDelete,
  onOpenChecklist,
  hasOpenShopping,
  hasOpenTasks,
  onOpenFoods,
  onOpenShoppingList,
  onOpenProfile,
  onOpenNutrients,
}) {
  return (
    <section>
      <div className="list-head">
        <div className="toolbar">
          {/* Orange while something is left to do; otherwise like the other buttons, never green. */}
          <button
            type="button"
            className={hasOpenShopping ? 'tool-btn attention' : 'tool-btn'}
            title={hasOpenShopping ? 'Einkaufsliste: noch nicht alles abgehakt' : 'Einkaufsliste'}
            aria-label={hasOpenShopping ? 'Einkaufsliste, noch offen' : 'Einkaufsliste'}
            onClick={onOpenShoppingList}
          >
            <CartIcon />
          </button>
          <button
            type="button"
            className={hasOpenTasks ? 'tool-btn attention' : 'tool-btn'}
            title={hasOpenTasks ? 'Checkliste: Aufgaben offen' : 'Checkliste'}
            aria-label={hasOpenTasks ? 'Checkliste, Aufgaben offen' : 'Checkliste'}
            onClick={onOpenChecklist}
          >
            <ChecklistIcon />
          </button>
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
            className="tool-btn"
            title="Profil"
            aria-label="Profil"
            onClick={onOpenProfile}
          >
            <AvatarIcon />
          </button>
        </div>
        <DaySummary user={user} meals={meals} activity={activity} onOpen={onOpenNutrients} />
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

// Three lines next to the "×": the title over the whole width, the date and time, the kcal.
function MealRow({ meal, onEdit, onDelete }) {
  const bookedAt = new Date(meal.bookedAt).toLocaleString(LOCALE, DATE_TIME_FORMAT)

  return (
    <div className="row">
      <button type="button" className="row-open" onClick={() => onEdit(meal)}>
        <span className="main">
          <span className="name">{meal.title}</span>
          <span className="sub">{bookedAt}</span>
          <span className="kcal">{Math.round(meal.kcal)} kcal</span>
        </span>
      </button>
      <CrossButton label="Mahlzeit löschen" onClick={() => onDelete(meal)} />
    </div>
  )
}

// The search behind "Mahlzeit buchen", and the one that adds foods to a recipe (kindLocked:
// recipes cannot contain recipes). Stays mounted while hidden, so search and filter survive.
// onOpenFood(food, { asUnit }): the amount view of a food, with its default portion preselected,
// or (asUnit, the scale button) its unit.
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
  const catalog = useCatalog(kind, search, version, onError)
  const { entries, loadedQuery } = catalog

  return (
    <section hidden={!visible}>
      <CatalogHeader
        search={search}
        onSearchChange={setSearch}
        results={{ query: loadedQuery, count: entries.length }}
        kindLocked={kindLocked}
        closeLabel={closeLabel}
        onClose={onClose}
      />
      {entries.length === 0 ? (
        <CatalogEmpty
          catalog={catalog}
          search={search}
          notFound={kind === KIND_RECIPES ? 'Kein Rezept gefunden.' : 'Kein Lebensmittel gefunden.'}
        />
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
      <LoadMoreSentinel active={catalog.hasMore} count={entries.length} onVisible={catalog.loadMore} />
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

// Scale: type the amount in g or ml (see FoodSearchRow).
function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" {...iconProps} height="22">
      <path d="M12 4v16" />
      <path d="M8 20h8" />
      <path d="M5 7h14" />
      <path d="M5 7l-3 7a3.5 3.5 0 0 0 6 0z" />
      <path d="M19 7l-3 7a3.5 3.5 0 0 0 6 0z" />
    </svg>
  )
}

// One food in the search. The second line says what "+" books: one default portion (or 100 g / ml
// without portions) and its kcal. The row opens the amount view with that portion preselected,
// the scale button with g / ml preselected, for those who mostly book exact amounts.
//
// Room: on a 360 px wide phone about 200 px are left for the text next to the two buttons, and
// "(1000 ml) · 1234 kcal" alone takes about 160 px at the size of the second line. Like every row of
// the search views (.search-row) it is of fixed height, so the second line stays one line: should
// both pieces not fit, the portion is cut off with "…" and the kcal always show. The name takes at
// most two lines.
function FoodSearchRow({ food, onOpen, onAdd }) {
  const booked = quickAdd(food)
  return (
    <div className="row search-row">
      <button type="button" className="row-open wrap" onClick={() => onOpen(food)}>
        <span className="main">
          <span className="name">
            {food.name}
            <PrivateMark entry={food} />
          </span>
          <span className="sub booking-sub">
            <span className="booking-part">{booked.label}</span>
            <span className="booking-separator"> · </span>
            <span className="booking-part">{formatKcal(kcalOf(food, booked.amount))}</span>
            <ConfirmedMark entry={food} />
          </span>
        </span>
      </button>
      <div className="row-actions">
        <QuickAddButton label={`${booked.label} ${food.name} hinzufügen`} onAdd={() => onAdd(food, booked)} />
        <button
          type="button"
          className="weigh-btn"
          title={`Menge in ${unitName(food.unit)} eingeben`}
          aria-label={`Menge von ${food.name} eingeben`}
          onClick={() => onOpen(food, { asUnit: true })}
        >
          <ScaleIcon />
        </button>
      </div>
    </div>
  )
}

// The detail line of a recipe in the search results: its kcal per portion, short enough for one
// line. variation: describe that variation instead of the original (its name first).
function RecipeSummary({ recipe, variation = null }) {
  const servings = servingsOf(recipe, variation)
  const kcal = variation ? totalsOf(itemsOf(recipe, variation)).kcal : recipe.kcal
  return (
    <>
      {variation && `${variation.name} · `}
      {formatKcal(kcal / servings)} pro Portion
    </>
  )
}

// "+" books one portion as saved in the recipe; the row itself opens the booking view.
function RecipeSearchRow({ recipe, onOpen, onAdd }) {
  return (
    <div className="row search-row">
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

// A booked meal: its totals at the top (MealSummary), then its items, with "Weiteres hinzufügen"
// right below them. bookedAt: when the meal was booked, shown in the title ("Mahlzeit um 13:23 Uhr").
// fromTask: booked by ticking off a task; such a meal can only be deleted as a whole (from the
// list), so here it is only shown.
function MealEditor({ entries, bookedAt, fromTask, onOpenEntry, onRemoveEntry, onAddMore, onClose }) {
  const time = bookedAt
    ? new Date(bookedAt).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <section>
      <TopBar
        title={time ? `Mahlzeit um ${time} Uhr` : 'Mahlzeit bearbeiten'}
        closeLabel="Bearbeiten abbrechen"
        onClose={onClose}
      />
      <MealSummary entries={entries} />
      {fromTask ? (
        <>
          <EntryList entries={entries} />
          <p className="hint task-meal-hint">Aus der Checkliste gebucht.</p>
        </>
      ) : (
        <>
          <EntryList entries={entries} onOpen={onOpenEntry} onRemove={onRemoveEntry} />
          <button type="button" className="btn add-more" onClick={onAddMore}>
            <PlusIcon size={18} />
            Weiteres hinzufügen
          </button>
        </>
      )}
    </section>
  )
}

// What one meal adds up to, in a box like the summary of the day: the kcal large in the middle,
// below them carbs, protein and fat in grams. Only totals, no targets and no bars.
function MealSummary({ entries }) {
  const totals = mealTotals(entries)
  return (
    <div className="day-summary meal-summary">
      <div className="kcal-left">
        <span className="kcal-left-value">{Math.round(totals.kcal).toLocaleString(LOCALE)}</span>
        <span className="kcal-left-label">kcal</span>
      </div>
      <div className="macro-bars">
        {MACROS.map(({ key, label }) => (
          <div key={key} className="macro">
            <span className="macro-label">{label}</span>
            <span className="meal-macro-value">{Math.round(totals[key]).toLocaleString(LOCALE)} g</span>
          </div>
        ))}
      </div>
    </div>
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

// Without onOpen (preview) the rows cannot be opened, without onRemove they have no "×".
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

// Two lines that never grow: the name (one line, cut off with "…") next to the "×", and below it
// amount, portions (if booked as portions) and kcal: "135 g · 2,25 Stück · 194 kcal". showDelta:
// what was added to an already saved meal, in the unit of the entry, in green behind it.
function EntryRow({ entry, showDelta, onOpen, onRemove }) {
  const { food, baseAmount } = entry
  const added = showDelta ? quantityDifference(food, entry, baseAmount) : null
  const content = (
    <>
      <span className="name">{food.name}</span>
      <span className="sub">
        {amountPortionsAndKcal(food, entry)}
        {added?.positive && <span className="delta"> {added.text}</span>}
      </span>
    </>
  )

  return (
    <div className="row two-line">
      {onOpen ? (
        <button type="button" className="row-open" onClick={() => onOpen(entry)}>
          {content}
        </button>
      ) : (
        <div className="row-open">{content}</div>
      )}
      {onRemove && <CrossButton label={`${food.name} entfernen`} onClick={() => onRemove(food.id)} />}
    </div>
  )
}

// The amount of a food to add, or to change an amount to. It is typed as a number of one of the
// food's portions or in its unit (g / ml), chosen next to the number (a field for "9999.99", the
// select takes the rest); switching converts the number. onConfirm gets the quantity as chosen
// (see quantities.js): a number of the portion, or an amount in g or ml.
// initial: { choice, quantityText }, see initialAmountInput.
function FoodDetail({ food, initial, confirmLabel, onConfirm, onClose }) {
  const [choice, setChoice] = useState(initial.choice)
  const [quantityText, setQuantityText] = useState(initial.quantityText)
  // The amount in g / ml the shown number was converted from, or null once something was typed.
  // The shown number is rounded, so converting it back would drift: 100 g -> 3,33 × 30 g -> 99,9 g.
  const [exactAmount, setExactAmount] = useState(null)
  const inputRef = useRef(null)
  // Rounded as it is sent, so a tiny amount that rounds to 0 cannot be confirmed.
  const quantity = quantityOfInput(food, choice, quantityText, exactAmount)
  const amount = quantity.amount
  const isValid = amount > 0

  // At the start and after every switch the number is focused and selected, so typing replaces it.
  // An effect, because the converted number is only in the field after rendering.
  useEffect(() => {
    inputRef.current.focus()
    inputRef.current.select()
  }, [choice])

  // The exact amount is kept across switches, the shown number is rounded for the new choice.
  function changeChoice(newChoice) {
    if (isValid) {
      const exact = exactAmount ?? amount
      const converted = quantityOfInput(food, newChoice, '', exact)
      setQuantityText(String(newChoice === CHOICE_UNIT ? converted.amount : converted.count))
      setExactAmount(exact)
    }
    setChoice(newChoice)
  }

  function changeQuantity(text) {
    setQuantityText(text)
    setExactAmount(null)
  }

  function submit(event) {
    event.preventDefault()
    if (isValid) onConfirm(food, quantity)
  }

  return (
    <section>
      <TopBar title={food.name} closeLabel="Schließen" onClose={onClose} centered />
      <div className="detail-nutrition">
        <p className="detail-line">
          <KcalPer100 kcal={food.kcalPer100} unit={food.unit} />
        </p>
        <MacroValues grams={macrosOf(food, 100)} />
      </div>
      <form onSubmit={submit}>
        <div className="detail-amount portion-amount">
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            min="0"
            step="any"
            value={quantityText}
            onFocus={(event) => event.target.select()}
            onChange={(event) => changeQuantity(event.target.value)}
            aria-label={choice === CHOICE_UNIT ? `Menge in ${unitName(food.unit)}` : 'Anzahl Portionen'}
          />
          <SelectBox label="Portion" value={choice} options={amountChoices(food)} onChange={changeChoice} />
        </div>
        <BookResult
          kcal={isValid ? kcalOf(food, amount) : null}
          grams={isValid ? macrosOf(food, amount) : null}
        />
        <button type="submit" className="btn primary wide" disabled={!isValid}>
          {confirmLabel}
        </button>
      </form>
    </section>
  )
}

// Carbs, protein and fat side by side in three columns like the bars of the main view, without
// bars: the grams centered above their name. grams: { carbs, protein, fat } (see macrosOf); null,
// or a value that is no number, shows "–" (no valid amount typed, a value missing).
function MacroValues({ grams }) {
  return (
    <div className="macro-bars macro-values">
      {MACROS.map(({ key, label }) => (
        <div key={key} className="macro">
          <span className="macro-grams">
            {grams !== null && Number.isFinite(grams[key]) ? `${formatNumber(grams[key])} g` : '–'}
          </span>
          <span className="macro-label">{label}</span>
        </div>
      ))}
    </div>
  )
}

// What booking a recipe or an amount of a food adds, below the amount: the kcal number large and
// centred on its own, "kcal" beside it; below them carbs, protein and fat in three columns, the grams in one row and
// the names centred below. kcal and grams null: nothing valid typed, "–".
function BookResult({ kcal, grams }) {
  const isValid = kcal !== null && grams !== null
  return (
    <div className="book-result" role="status">
      <p className="book-kcal">
        <span className="book-kcal-number">{isValid ? Math.round(kcal).toLocaleString(LOCALE) : '–'}</span>
        <span className="book-kcal-label">kcal</span>
      </p>
      <div className="book-macros">
        {MACROS.map(({ key }) => (
          <span key={key} className="book-number">
            {isValid && Number.isFinite(grams[key]) ? formatNumber(grams[key]) : '–'}
            <span className="book-unit"> g</span>
          </span>
        ))}
        {MACROS.map(({ key, label }) => (
          <span key={key} className="book-label">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// A wide block in an info card (FoodInfo, RecipeInfo): its name above, the macros below.
function MacroInfo({ label, grams }) {
  return (
    <div className="info wide">
      <span className="info-label">{label}</span>
      <MacroValues grams={grams} />
    </div>
  )
}

// Foods and recipes in a searchable list. Stays mounted while something is opened on top of it
// (hidden), so the search survives. version: reloads the list when it changes (after saving).
// Tapping a row opens its details (onOpen). The button at the right of a row depends on mode:
// - 'manage' (food database): edit, greyed out for entries of others (onEdit); "+" in the header
//   creates a new food or recipe (onNew);
// - 'shop' (adding to the shopping list): the cart (onAddToList); addedToList: { kind, id } of
//   the entry just put on the list, whose cart shows ✓ for a moment, like "+" when booking.
//   This search also offers the user's items ("Benutzeritems", preselected with
//   "Eigene", see USER_ITEM_SEARCH). Their rows are one line, with the pencil (onEditUserItem) left of
//   the cart; tapping one is the same as its cart. "+" in the header creates a user item named as
//   typed (onNewUserItem); it is always there but only works for own user items and only while no
//   item of exactly that name exists (see canCreateUserItem).
// All callbacks get the kind (KIND_FOODS, KIND_RECIPES or KIND_USER_ITEMS) and the entry.
function FoodDatabase({
  hidden,
  version,
  mode,
  addedToList = null,
  closeLabel = 'Schließen',
  onOpen,
  onEdit,
  onAddToList,
  onNew,
  onNewUserItem,
  onEditUserItem,
  onClose,
  onError,
}) {
  const isShop = mode === 'shop'
  const [search, setSearch] = useState(isShop ? USER_ITEM_SEARCH : NEW_SEARCH)
  const catalog = useCatalog(search.kind, search, version, onError)
  const { entries, loadedQuery } = catalog
  const { kind } = search
  const isRecipes = kind === KIND_RECIPES
  const isUserItem = kind === KIND_USER_ITEMS
  const newLabel = isRecipes ? 'Rezept anlegen' : 'Lebensmittel hinzufügen'
  const canCreateNew = isShop && canCreateUserItem(search, catalog)
  const justAdded = (entry) => addedToList?.kind === kind && addedToList.id === entry.id
  const notFound = isUserItem ? 'Kein Item gefunden.' : isRecipes ? 'Kein Rezept gefunden.' : 'Kein Lebensmittel gefunden.'

  return (
    <section hidden={hidden}>
      <CatalogHeader
        search={search}
        onSearchChange={setSearch}
        results={{ query: loadedQuery, count: entries.length }}
        kinds={isShop ? SHOPPING_KINDS : CATALOG_KINDS}
        closeLabel={closeLabel}
        onClose={onClose}
      >
        {mode === 'manage' && (
          <button
            type="button"
            className="add"
            title={newLabel}
            aria-label={newLabel}
            onClick={() => onNew(kind)}
          >
            <PlusIcon size={22} />
          </button>
        )}
        {isShop && (
          <button
            type="button"
            className="add"
            title={
              canCreateNew
                ? `„${search.query.trim()}“ als Item anlegen`
                : 'Item anlegen (Benutzeritems und Eigene wählen, einen neuen Namen tippen)'
            }
            aria-label="Benutzeritem anlegen"
            disabled={!canCreateNew}
            onClick={() => onNewUserItem(search.query.trim())}
          >
            <PlusIcon size={22} />
          </button>
        )}
      </CatalogHeader>
      {entries.length === 0 ? (
        <CatalogEmpty catalog={catalog} search={search} notFound={notFound} />
      ) : isUserItem ? (
        <div className="rows">
          {entries.map((entry) => (
            <UserItemRow
              key={entry.id}
              item={entry}
              justAdded={justAdded(entry)}
              onEdit={() => onEditUserItem(entry)}
              onAddToList={() => onAddToList(KIND_USER_ITEMS, entry)}
            />
          ))}
        </div>
      ) : (
        <div className="rows">
          {entries.map((entry) => (
            <DatabaseRow
              key={entry.id}
              entry={entry}
              sub={
                isRecipes ? (
                  <RecipeSummary recipe={entry} />
                ) : (
                  <>
                    <KcalPer100 kcal={entry.kcalPer100} unit={entry.unit} />
                    <ConfirmedMark entry={entry} />
                  </>
                )
              }
              onOpen={() => onOpen(kind, entry)}
            >
              {mode === 'manage' ? (
                <button
                  type="button"
                  className="weigh-btn"
                  title={entry.owned ? 'Bearbeiten' : 'Gehört dir nicht'}
                  aria-label={`${entry.name} bearbeiten`}
                  disabled={!entry.owned}
                  onClick={() => onEdit(kind, entry)}
                >
                  <PencilIcon />
                </button>
              ) : (
                <CartButton name={entry.name} justAdded={justAdded(entry)} onClick={() => onAddToList(kind, entry)} />
              )}
            </DatabaseRow>
          ))}
        </div>
      )}
      <LoadMoreSentinel active={catalog.hasMore} count={entries.length} onVisible={catalog.loadMore} />
    </section>
  )
}

// The cart at the right of a row in the shopping list search; ✓ for a moment after a tap.
function CartButton({ name, justAdded, onClick }) {
  return (
    <button
      type="button"
      className="weigh-btn"
      title="Zur Einkaufsliste"
      aria-label={`${name} zur Einkaufsliste hinzufügen`}
      onClick={onClick}
    >
      {justAdded ? '✓' : <CartIcon size={22} />}
    </button>
  )
}

// A user item in the shopping list search: its name (at most two lines, no second line, so lower
// than the rows of foods and recipes, all user item rows equally high), the pencil (name, delete)
// and the cart (count, then onto the list). The buttons are as big as in the other search rows.
// Tapping the name is the same as the cart.
function UserItemRow({ item, justAdded, onEdit, onAddToList }) {
  return (
    <div className="row search-row user-item-row">
      <button type="button" className="row-open" onClick={onAddToList}>
        <span className="name">{item.name}</span>
      </button>
      <div className="row-actions">
        <button
          type="button"
          className="weigh-btn"
          title={item.owned ? 'Bearbeiten' : 'Gehört dir nicht'}
          aria-label={`${item.name} bearbeiten`}
          disabled={!item.owned}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
        <CartButton name={item.name} justAdded={justAdded} onClick={onAddToList} />
      </div>
    </div>
  )
}

// Renaming or deleting a user item. Its only field is the name; "Löschen" (with a confirmation,
// onDelete) takes it off the shopping list too. onSave(name) gets the trimmed name.
function UserItemForm({ item, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name)
  const trimmed = name.trim()
  const canSave = trimmed !== '' && trimmed !== item.name

  function submit(event) {
    event.preventDefault()
    if (canSave) onSave(trimmed)
  }

  return (
    <section>
      <TopBar title="Item bearbeiten" closeLabel="Schließen" onClose={onClose} />
      <form onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
            maxLength={MAX_USER_ITEM_NAME_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="bar">
          <button type="button" className="btn danger-outline" onClick={onDelete}>
            Löschen
          </button>
          <button type="submit" className="btn primary" disabled={!canSave}>
            Speichern
          </button>
        </div>
      </form>
    </section>
  )
}

// How many of a user item go on the shopping list (initialCount preselected), with "−" / "+" like
// the portions of a recipe. Whole numbers from 1 to MAX_USER_ITEM_COUNT. Used to put an item on
// the list and to change the count of one that is on it (confirmLabel). onConfirm(count).
function UserItemCount({ name, initialCount = 1, confirmLabel, onConfirm, onClose }) {
  const countId = useId()
  const [countText, setCountText] = useState(String(initialCount))
  const count = Number(countText)
  const isValid = Number.isInteger(count) && count >= 1 && count <= MAX_USER_ITEM_COUNT

  function step(by) {
    const next = (Number.isInteger(count) ? count : 0) + by
    if (next >= 1 && next <= MAX_USER_ITEM_COUNT) setCountText(String(next))
  }

  function submit(event) {
    event.preventDefault()
    if (isValid) onConfirm(count)
  }

  return (
    <section>
      <TopBar title={name} closeLabel="Schließen" onClose={onClose} centered />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor={countId}>Anzahl</label>
          <div className="stepper">
            <input
              id={countId}
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min="1"
              max={MAX_USER_ITEM_COUNT}
              step="1"
              value={countText}
              onFocus={(event) => event.target.select()}
              onChange={(event) => setCountText(event.target.value)}
            />
            <button
              type="button"
              className="frame-btn"
              aria-label="Eins weniger"
              disabled={!(count > 1)}
              onClick={() => step(-1)}
            >
              <MinusIcon />
            </button>
            <button
              type="button"
              className="frame-btn"
              aria-label="Eins mehr"
              disabled={!(count < MAX_USER_ITEM_COUNT)}
              onClick={() => step(1)}
            >
              <PlusIcon size={22} />
            </button>
          </div>
        </div>
        {!isValid && <p className="hint warning">Bitte eine ganze Zahl von 1 bis {MAX_USER_ITEM_COUNT}.</p>}
        <div className="bar">
          <button type="submit" className="btn primary" disabled={!isValid}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </section>
  )
}

// A food or recipe in a database list; sub is the second line (kcal, portions), children the
// button at the right. Tapping the row opens the details. Fixed height, see .search-row.
function DatabaseRow({ entry, sub, onOpen, children }) {
  return (
    <div className="row search-row">
      <button type="button" className="row-open" onClick={onOpen}>
        <span className="main">
          <span className="name">
            {entry.name}
            <PrivateMark entry={entry} />
          </span>
          <span className="sub">{sub}</span>
        </span>
      </button>
      {children}
    </div>
  )
}

const FOOD_UNIT_OPTIONS = [
  { value: FOOD_UNIT_G, label: 'Gramm' },
  { value: FOOD_UNIT_ML, label: 'Milliliter' },
]

// Creating or editing a food of the user's own (foods of others only have details, see FoodInfo).
//
// Nutrition values are per 100 g or 100 ml, as the unit select next to the calories says. The unit
// may change even when the food is used (booked, or in a recipe): the amounts there keep their
// numbers, 100 g become 100 ml.
//
// Portions are listed at the bottom, favorite first. Each has an edit button (opens the portion
// view, layer { type: 'portion', key }, key null for a new one) and a star that makes it the
// favorite. They are saved together with the food. The layer lives in MealTracker, so the back
// button closes the portion view; everything else stays in this component, which stays mounted
// meanwhile, so nothing typed is lost.
//
// "Nährstoffprofil ableiten", first in "Weitere Nährwerte", opens the search of confirmed public
// foods (layer { type: 'derive' }, see NutrientProfileSearch). The picked food's unit, kcal, macros
// and optional nutrients are copied into the fields: a hard copy, no reference, so they can be
// changed afterwards and a later change of the source does not reach this food. If something is
// typed already, onAsk (the ConfirmDialog of MealTracker) asks before it is replaced.
function FoodForm({ food, layer, onLayerChange, onSave, onDelete, onAsk, onClose, onError }) {
  const isNew = food.id === null
  const [name, setName] = useState(toText(food.name))
  const [ean, setEan] = useState(food.eanCode ?? '') // digits only, see isValidEan
  const eanRef = useRef(null)
  const canScan = useCanScanEan()
  const [isScanningEan, setIsScanningEan] = useState(false)
  const [unit, setUnit] = useState(food.unit)
  const [kcal, setKcal] = useState(toText(food.kcalPer100))
  const [protein, setProtein] = useState(toText(food.protein))
  const [carbs, setCarbs] = useState(toText(food.carbs))
  const [fat, setFat] = useState(toText(food.fat))
  const [nutrientTextsByKey, setNutrientTextsByKey] = useState(() => nutrientTexts(food.nutrients))
  const [published, setPublished] = useState(food.published)
  const [portions, setPortions] = useState(() => draftPortions(food))
  const newPortionCount = useRef(0) // for the keys of new portions, see foods.js
  // The name of a new food is focused when the form opens, but not again when it comes back from
  // the portion view: autoFocus would jump to the top and open the keyboard once more.
  const [focusName, setFocusName] = useState(isNew)
  // "Weitere Nährwerte" is open again when the form comes back from the profile search.
  const [nutrientsOpen, setNutrientsOpen] = useState(false)
  const [derivedFrom, setDerivedFrom] = useState(null) // name of the food whose profile was copied

  const { amounts: nutrients, invalid: invalidNutrients } = nutrientAmounts(nutrientTextsByKey)
  // Field names as the backend expects them.
  const values = {
    name: name.trim(),
    unit,
    kcalPer100: parseFloat(kcal),
    protein: parseFloat(protein),
    carbs: parseFloat(carbs),
    fat: parseFloat(fat),
    nutrients,
    published,
    portions: portionRequests(portions),
    eanCode: eanCodeOf(ean),
  }
  const partProblems = nutrientPartProblems(values)
  const isEanValid = ean === '' || isValidEan(ean)
  const numbers = [values.kcalPer100, values.protein, values.carbs, values.fat]
  // An empty field parses to NaN, and NaN >= 0 is false.
  const isValid =
    values.name !== '' &&
    numbers.every((n) => n >= 0) &&
    invalidNutrients.length === 0 &&
    partProblems.length === 0 &&
    isEanValid
  const becomesPrivate = !isNew && food.published && !published
  const symbol = unitSymbol(unit)

  function submit(event) {
    event.preventDefault()
    if (isValid) onSave(food.id, values)
  }

  // key null: a new portion
  function openPortion(key) {
    setFocusName(false)
    onLayerChange({ type: 'portion', key })
  }

  function openProfileSearch() {
    setFocusName(false)
    setNutrientsOpen(true)
    onLayerChange({ type: 'derive' })
  }

  function copyProfile(source) {
    const profile = nutrientProfileTexts(source)
    setUnit(profile.unit)
    setKcal(profile.kcal)
    setProtein(profile.protein)
    setCarbs(profile.carbs)
    setFat(profile.fat)
    setNutrientTextsByKey(profile.nutrients)
    setDerivedFrom(source.name)
  }

  function pickProfile(source) {
    onLayerChange(null)
    if (!hasTypedNutrients({ kcal, protein, carbs, fat, nutrients: nutrientTextsByKey })) {
      copyProfile(source)
      return
    }
    const unitNote = source.unit !== unit ? ` Die Einheit wird ${unitName(source.unit)}.` : ''
    onAsk({
      title: 'Nährstoffprofil übernehmen?',
      text: `Die Nährwerte von „${source.name}“ ersetzen alle eingetragenen Nährwerte.${unitNote}`,
      confirmLabel: 'Übernehmen',
      tone: 'primary',
      onConfirm: () => {
        copyProfile(source)
        onAsk(null)
      },
    })
  }

  if (layer?.type === 'derive') {
    return (
      <NutrientProfileSearch onPick={pickProfile} onClose={() => onLayerChange(null)} onError={onError} />
    )
  }

  if (layer?.type === 'portion') {
    const portion = portions.find((other) => other.key === layer.key) ?? null
    const key = portion?.key ?? null
    return (
      <PortionEditor
        portion={portion}
        unit={unit}
        isNameTaken={(portionName) => isPortionNameTaken(portions, portionName, key)}
        onSave={({ name: portionName, amount }) => {
          const savedKey = key ?? `new-${newPortionCount.current++}`
          setPortions((current) => savePortion(current, { key: savedKey, name: portionName, amount }))
          onLayerChange(null)
        }}
        onDelete={() => {
          setPortions((current) => removePortion(current, key))
          onLayerChange(null)
        }}
        onClose={() => onLayerChange(null)}
      />
    )
  }

  return (
    <section>
      <TopBar title={isNew ? 'Lebensmittel hinzufügen' : 'Lebensmittel bearbeiten'} closeLabel="Schließen" onClose={onClose} />
      <form onSubmit={submit}>
        <fieldset className="plain">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              autoFocus={focusName}
              autoComplete="off"
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>EAN-Code (optional)</span>
            <span className="inline-btn-field">
              <input
                ref={eanRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={EAN_MAX_LENGTH}
                placeholder="Nummer unter dem Strichcode"
                value={ean}
                onChange={(event) => setEan(event.target.value.replace(/\D/g, '').slice(0, EAN_MAX_LENGTH))}
              />
              {canScan && (
                <button
                  type="button"
                  className="scan-btn"
                  title="EAN scannen"
                  aria-label="EAN scannen"
                  onClick={() => setIsScanningEan(true)}
                >
                  <BarcodeIcon />
                </button>
              )}
            </span>
            {!isEanValid && (
              <span className="hint warning">Kein gültiger EAN-Code: 8, 12, 13 oder 14 Ziffern, die letzte ist eine Prüfziffer.</span>
            )}
          </label>
          {isScanningEan && (
            <BarcodeScanner
              onDetected={(code) => {
                setIsScanningEan(false)
                setEan(code)
                // after the scanner is gone: on to the next field, the kcal
                setTimeout(() => focusNextField(eanRef.current), 0)
              }}
              onClose={() => setIsScanningEan(false)}
            />
          )}
          {/* calories and unit share the row half and half */}
          <div className="unit-row">
            <NumberField label={`Kcal pro 100 ${symbol}`} value={kcal} onChange={setKcal} />
            <div className="field">
              <span>Einheit</span>
              <SelectBox
                label="Einheit"
                className="wide"
                value={unit}
                options={FOOD_UNIT_OPTIONS}
                onChange={setUnit}
              />
            </div>
          </div>
          <NumberField label={`Protein pro 100 ${symbol}`} value={protein} onChange={setProtein} />
          <NumberField label={`Kohlenhydrate pro 100 ${symbol}`} value={carbs} onChange={setCarbs} />
          <NumberField label={`Fett pro 100 ${symbol}`} value={fat} onChange={setFat} />
          <Collapsible title="Weitere Nährwerte" initiallyOpen={nutrientsOpen}>
            <button type="button" className="btn add-more derive-profile" onClick={openProfileSearch}>
              <PlusIcon size={18} />
              Nährstoffprofil ableiten
            </button>
            {derivedFrom !== null && (
              <p className="hint nutrient-note">Nährwerte von „{derivedFrom}“ übernommen.</p>
            )}
            <p className="hint nutrient-note">Alle optional, pro 100 {symbol}.</p>
            <NutrientFields texts={nutrientTextsByKey} onChange={setNutrientTextsByKey} />
          </Collapsible>
          <VisibilitySwitch published={published} onChange={setPublished} />
          {becomesPrivate && (
            <p className="hint switch-hint">
              Verwendet schon jemand anderes dieses Lebensmittel, bleibt es für alle öffentlich und
              gehört dann niemandem mehr. Du bekommst eine private Kopie. Deine öffentlichen Rezepte
              damit werden sonst ebenfalls privat.
            </p>
          )}
        </fieldset>

        <div className="section-head">
          <h2>Portionen</h2>
        </div>
        {/* Without portions there is just "Portion hinzufügen" below. */}
        {portions.length > 0 && (
          <div className="rows">
            {portions.map((portion) => (
              <PortionRow
                key={portion.key}
                portion={portion}
                unit={unit}
                onEdit={() => openPortion(portion.key)}
                onFavorite={() => setPortions((current) => setFavoritePortion(current, portion.key))}
              />
            ))}
          </div>
        )}
        <button type="button" className="btn add-more" onClick={() => openPortion(null)}>
          <PlusIcon size={18} />
          Portion hinzufügen
        </button>

        {/* Here and not in the closed "Weitere Nährwerte": carbs or fat above may cause it. */}
        {partProblems.map((problem) => (
          <p key={problem} className="hint warning part-problem">
            {problem}
          </p>
        ))}

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
      </form>
    </section>
  )
}

// The search behind "Nährstoffprofil ableiten": only confirmed public foods, as their values come
// from an official source. The filter row shows this, greyed out, and cannot be changed; only the
// text can be searched. Tapping a food picks it (onPick, with the whole food: the list has no
// nutrients, see fetchCatalog).
const PROFILE_SEARCH = { ...NEW_SEARCH, scope: SCOPE_PUBLIC, confirmedOnly: true, kind: KIND_FOODS }

function NutrientProfileSearch({ onPick, onClose, onError }) {
  const [query, setQuery] = useState('')
  const search = { ...PROFILE_SEARCH, query }
  // The backend also lists an unconfirmed food found by its EAN; its profile is not to be copied.
  const catalog = useCatalog(KIND_FOODS, search, 0, onError)
  const { entries, loadedQuery } = catalog
  const foods = entries.filter((food) => food.confirmed)
  const isPicking = useRef(false)

  async function pick(food) {
    if (isPicking.current) return
    isPicking.current = true
    try {
      onPick(await fetchFood(food.id))
    } catch (error) {
      onError(error.message)
    } finally {
      isPicking.current = false
    }
  }

  return (
    <section>
      <CatalogHeader
        search={search}
        onSearchChange={(changed) => setQuery(changed.query)}
        results={{ query: loadedQuery, count: foods.length }}
        kindLocked
        filtersLocked
        closeLabel="Abbrechen"
        onClose={onClose}
      />
      {foods.length === 0 ? (
        <CatalogEmpty catalog={catalog} search={search} notFound="Kein bestätigtes Lebensmittel gefunden." />
      ) : (
        <div className="rows">
          {foods.map((food) => (
            <DatabaseRow
              key={food.id}
              entry={food}
              sub={
                <>
                  <KcalPer100 kcal={food.kcalPer100} unit={food.unit} />
                  <ConfirmedMark entry={food} />
                </>
              }
              onOpen={() => pick(food)}
            />
          ))}
        </div>
      )}
      <LoadMoreSentinel active={catalog.hasMore} count={entries.length} onVisible={catalog.loadMore} />
    </section>
  )
}

// One portion in the food form: name and amount; for the owner an edit button and, at the far
// right, the star. Tapping the star of the favorite changes nothing, it is the favorite already.
function PortionRow({ portion, unit, onEdit, onFavorite }) {
  return (
    <div className="row">
      <div className="row-open">
        <span className="main">
          <span className="name">{portion.name}</span>
          <span className="sub">
            {formatAmount(portion.amount, unit)}
            {/* read-only (no buttons): the star's meaning in words */}
            {!onEdit && portion.favorite && ' · Standardportion'}
          </span>
        </span>
      </div>
      {onEdit && (
        <div className="row-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={`${portion.name} bearbeiten`}
            onClick={onEdit}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className={portion.favorite ? 'icon-btn star favorite' : 'icon-btn star'}
            aria-label={`${portion.name} als Standardportion`}
            aria-pressed={portion.favorite}
            title={portion.favorite ? 'Standardportion beim Buchen' : 'Als Standardportion festlegen'}
            onClick={onFavorite}
          >
            <StarIcon filled={portion.favorite} />
          </button>
        </div>
      )}
    </div>
  )
}

// Name and amount of one portion (portion null: a new one), in the unit of the food. "Übernehmen"
// puts it into the food form, which saves it with the food. Deleting is only possible here, the
// list has no room for it.
function PortionEditor({ portion, unit, isNameTaken, onSave, onDelete, onClose }) {
  const isNew = portion === null
  const [name, setName] = useState(portion?.name ?? '')
  const [amountText, setAmountText] = useState(portion ? String(portion.amount) : '')
  const amount = parseFloat(amountText)
  const nameTaken = name.trim() !== '' && isNameTaken(name)
  const isValid = name.trim() !== '' && !nameTaken && amount > 0

  function submit(event) {
    event.preventDefault()
    if (isValid) onSave({ name: name.trim(), amount })
  }

  return (
    <section>
      <TopBar
        title={isNew ? 'Portion hinzufügen' : 'Portion bearbeiten'}
        closeLabel="Zurück zum Lebensmittel"
        onClose={onClose}
      />
      <form onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            autoFocus
            autoComplete="off"
            maxLength={MAX_PORTION_NAME_LENGTH}
            placeholder="z. B. Packung"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {nameTaken && <span className="hint warning">Diesen Namen gibt es bei diesem Lebensmittel schon.</span>}
        </label>
        <label className="field">
          <span>Menge ({unitSymbol(unit)})</span>
          <input
            type="number"
            inputMode="decimal"
            enterKeyHint="done"
            min="0"
            step="any"
            value={amountText}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setAmountText(event.target.value)}
          />
        </label>
        <p className="hint">Gespeichert wird die Portion mit dem Lebensmittel.</p>
        <div className={isNew ? 'bar' : 'bar stacked'}>
          <button type="submit" className="btn primary" disabled={!isValid}>
            Übernehmen
          </button>
          {!isNew && (
            <button type="button" className="btn danger" onClick={onDelete}>
              Portion löschen
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

// Difference to the original recipe in the unit of the item: green "+1 Packung", red "−30 g",
// nothing when equal.
function Deviation({ item }) {
  const difference = quantityDifference(item.food, item, item.originalAmount)
  if (difference === null) return null
  return <span className={difference.positive ? 'delta' : 'delta minus'}>{difference.text}</span>
}

// One ingredient of a recipe or variation. Without onOpen the row is read-only; without onRemove
// there is no "×". A left-out ingredient (0) stays listed, greyed.
//
// Normally two lines that never grow: the name (one line, cut off with "…") next to the "×", and
// below it amount, portions (if booked as portions) and kcal: "240 g · 4 Stück · 346 kcal".
// showDeviation (variations, booking view): quantity and kcal below the name, followed by the
// difference to the original: "5 Stück · 432 kcal +1 Stück".
function IngredientRow({ item, showDeviation, onOpen, onRemove }) {
  const isLeftOut = item.amount === 0
  const { food } = item
  const name = (
    <span className="name">
      {food.name}
      <PrivateMark entry={food} />
    </span>
  )
  const content = showDeviation ? (
    <span className="main">
      {name}
      <span className="sub booking-sub">
        <span className="booking-part">
          {formatQuantity(food, item)} · {formatKcal(kcalOf(food, item.amount))}
        </span>{' '}
        <span className="booking-part">
          <Deviation item={item} />
        </span>
      </span>
    </span>
  ) : (
    <>
      {name}
      <span className="sub">{amountPortionsAndKcal(food, item)}</span>
    </>
  )
  const openClass = showDeviation ? 'row-open wrap' : 'row-open'
  const rowClasses = ['row']
  if (!showDeviation) rowClasses.push('two-line')
  if (isLeftOut) rowClasses.push('left-out')

  return (
    <div className={rowClasses.join(' ')}>
      {onOpen ? (
        <button type="button" className={openClass} onClick={onOpen}>
          {content}
        </button>
      ) : (
        <div className={openClass}>{content}</div>
      )}
      {onRemove && !isLeftOut && (
        <CrossButton label={`${food.name} weglassen`} onClick={onRemove} />
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
      title="In eigenen Rezepten speichern"
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

// What the amount view of an ingredient starts with: its quantity as it is, or for a left-out
// ingredient (0) the amount of the original, in the same unit (100 g if neither is there).
function editableQuantity(item) {
  if (item.amount > 0) return item
  const portion = portionById(item.food, item.portionId)
  if (portion) return portionQuantity(item.food, portion.id, item.originalAmount > 0 ? item.originalAmount / portion.amount : 1)
  return unitQuantity(item.originalAmount || DEFAULT_AMOUNT)
}

// Name, portions, visibility and the foods of a recipe of the user's own, or one of its
// variations (recipes of others only have details, see RecipeInfo). Tapping a food changes its
// amount. Switching between original and variations drops unsaved changes.
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
  const isVariation = variationId !== null
  const variations = recipe?.variations ?? []
  const servings = parseFloat(editor.servingsText)
  const weightG = editor.weightText.trim() === '' ? null : parseFloat(editor.weightText)
  const totals = totalsOf(items)
  const isValid =
    editor.name.trim() !== '' &&
    servings > 0 &&
    (weightG === null || weightG > 0) &&
    items.some((item) => item.amount > 0)

  function setQuantity(foodId, quantity) {
    onChange({
      items: items.map((item) => (item.food.id === foodId ? { ...item, ...quantity } : item)),
      layer: null,
    })
  }

  // "−" / "+" next to the portions: one less or more, never 0 or below.
  function stepServings(step) {
    const next = roundToOneDecimal((servings > 0 ? servings : 0) + step)
    if (next > 0) onChange({ servingsText: String(next) })
  }

  // In a variation, an ingredient of the original stays listed with 0 (g or portions).
  function remove(item) {
    onChange({
      items:
        isVariation && item.originalAmount > 0
          ? items.map((other) => (other === item ? { ...other, ...zeroQuantity(other.food, other) } : other))
          : items.filter((other) => other !== item),
    })
  }

  const changes = editorChanges(editor)
  const isSavedOriginal = !isNew && !isVariation

  // Enter saves only where there is just one way to save.
  function submit(event) {
    event.preventDefault()
    if (isValid && !isSavedOriginal) onSave()
  }

  if (layer?.type === 'amount') {
    const item = items.find((other) => other.food.id === layer.foodId)
    return (
      <FoodDetail
        food={item.food}
        initial={initialAmountInput(item.food, { quantity: editableQuantity(item) })}
        confirmLabel="Übernehmen"
        onConfirm={(food, quantity) => setQuantity(food.id, quantity)}
        onClose={() => onChange({ layer: null })}
      />
    )
  }

  let title = 'Rezept bearbeiten'
  if (isNew) title = 'Rezept anlegen'
  else if (isVariation) title = 'Variation bearbeiten'

  return (
    <section>
      <TopBar title={title} closeLabel="Schließen" onClose={onClose} />
      <form onSubmit={submit}>
        {variations.length > 0 && (
          <div className="field">
            {/* e.g. "Variation von Bratkartoffeln": the original's name as saved */}
            <span>{isVariation ? `Variation von ${recipe.name}` : 'Variation'}</span>
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
        <fieldset className="plain">
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
                placeholder={formatNumber(totals.amount)}
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
              `${formatNumber(totals.amount)} g · ${formatKcal(totals.kcal)}` +
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
                onOpen={() => onChange({ layer: { type: 'amount', foodId: item.food.id } })}
                onRemove={() => remove(item)}
              />
            ))}
          </div>
        )}
        <button type="button" className="btn add-more" onClick={onAddFoods}>
          <PlusIcon size={18} />
          Lebensmittel hinzufügen
        </button>

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

// ----- Details (food database and shopping list search) -----

// One value of the details, its name above it. wide: over the whole width of the card.
// A heading that opens and closes the content below it, closed at first.
// initiallyOpen: open when it appears, e.g. when a form comes back from a view on top of it.
function Collapsible({ title, initiallyOpen = false, children }) {
  const [open, setOpen] = useState(initiallyOpen)
  const contentId = useId()
  return (
    <div className="collapsible">
      <button
        type="button"
        className="collapsible-head"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div id={contentId} className="collapsible-body">
          {children}
        </div>
      )}
    </div>
  )
}

// A field for each optional nutrient, grouped as in nutrients.js, two per row. texts / onChange:
// what is typed, e.g. { VITAMIN_C: "12,5" }.
function NutrientFields({ texts, onChange }) {
  return NUTRIENT_GROUPS.map((group) => (
    <div key={group.title} className="nutrient-group">
      <h3>{group.title}</h3>
      <div className="nutrient-fields">
        {group.nutrients.map((nutrient) => (
          <UnitNumberField
            key={nutrient.key}
            label={nutrient.label}
            unit={nutrient.unit}
            maxDigits={NUTRIENT_MAX_DIGITS}
            decimals={NUTRIENT_DECIMALS}
            value={texts[nutrient.key] ?? ''}
            onChange={(text) => onChange({ ...texts, [nutrient.key]: text })}
          />
        ))}
      </div>
    </div>
  ))
}

function Info({ label, wide = false, children }) {
  return (
    <div className={wide ? 'info wide' : 'info'}>
      <span className="info-label">{label}</span>
      <span className="info-value">{children}</span>
    </div>
  )
}

const visibilityLabel = (published) => (published ? 'Öffentlich' : 'Privat')

// What a food is, as text: name, kcal and nutrients per 100 g / ml, unit, visibility, portions.
// The optional nutrients only as far as they are stated, in a closed "Weitere Nährwerte".
// Nothing to change here; owners edit with the pencil in the list (FoodForm).
function FoodInfo({ food, onClose }) {
  const per100 = `pro 100 ${unitSymbol(food.unit)}`
  const statedGroups = statedNutrientGroups(food.nutrients)
  return (
    <section>
      <TopBar title="Lebensmittel" closeLabel="Schließen" onClose={onClose} />
      <div className="info-card">
        <Info label="Name" wide>
          {food.name}
        </Info>
        {food.eanCode && (
          <Info label="EAN-Code" wide>
            {food.eanCode}
          </Info>
        )}
        <Info label={`Kcal ${per100}`}>{formatNumber(food.kcalPer100)}</Info>
        <Info label="Einheit">{FOOD_UNIT_OPTIONS.find((option) => option.value === food.unit)?.label}</Info>
        <Info label="Sichtbarkeit" wide>
          {visibilityLabel(food.published)}
        </Info>
        <MacroInfo label={`Nährwerte ${per100}`} grams={macrosOf(food, 100)} />
      </div>
      {statedGroups.length > 0 && (
        <Collapsible title="Weitere Nährwerte">
          <p className="hint nutrient-note">Pro 100 {unitSymbol(food.unit)}.</p>
          <div className="info-card">
            {statedGroups.map((group) => (
              <Fragment key={group.title}>
                <h3 className="info-group">{group.title}</h3>
                {group.nutrients.map(({ key, label, unit }) => (
                  <Info key={key} label={label}>
                    {formatNutrient(food.nutrients[key], unit)}
                  </Info>
                ))}
              </Fragment>
            ))}
          </div>
        </Collapsible>
      )}

      <div className="section-head">
        <h2>Portionen</h2>
      </div>
      {food.portions.length === 0 ? (
        <p className="empty">Keine Portionen.</p>
      ) : (
        <div className="rows">
          {food.portions.map((portion) => (
            <PortionRow key={portion.id} portion={portion} unit={food.unit} />
          ))}
        </div>
      )}
    </section>
  )
}

// What a recipe is, as text: name, portions, kcal per portion, visibility and the ingredients.
// The owner can look at the variations (select at the top, like in the editor); editing goes
// through the pencil in the list (RecipeEditor). A recipe of somebody else can be copied: "In
// eigenen Rezepten speichern" (onCopy, see CopyRecipeDialog). copying: that dialog is open
// (onCopying(true / false)), kept outside so the back button closes it.
function RecipeInfo({ recipe, variationId, copying, onSelectVariation, onCopying, onCopy, onClose }) {
  const variation = variationOf(recipe, variationId)
  const isVariation = variation !== null
  const variations = recipe.owned ? (recipe.variations ?? []) : []
  const items = itemsOf(recipe, variation)
  const totals = totalsOf(items)
  const servings = servingsOf(recipe, variation)

  return (
    <section>
      <TopBar title={isVariation ? 'Variation' : 'Rezept'} closeLabel="Schließen" onClose={onClose} />
      {variations.length > 0 && (
        <div className="field">
          <span>{isVariation ? `Variation von ${recipe.name}` : 'Variation'}</span>
          <SelectBox
            label="Original oder Variation"
            className="wide"
            value={String(variationId ?? '')}
            options={[
              { value: '', label: 'Original' },
              ...variations.map((other) => ({ value: String(other.id), label: other.name })),
            ]}
            onChange={(value) => onSelectVariation(value === '' ? null : Number(value))}
          />
        </div>
      )}
      <div className="info-card">
        <Info label={isVariation ? 'Name der Variation' : 'Name'} wide>
          {isVariation ? variation.name : recipe.name}
        </Info>
        <Info label="Portionen gesamt">{formatNumber(servings)}</Info>
        <Info label="Kcal pro Portion">{formatNumber(Math.round(totals.kcal / servings))}</Info>
        {isVariation ? (
          <Info label="Gesamtgewicht">{formatNumber(variation.weightG ?? totals.amount)} g</Info>
        ) : (
          <Info label="Sichtbarkeit">{visibilityLabel(recipe.published)}</Info>
        )}
        <MacroInfo label="Nährwerte pro Portion" grams={scaleMacros(mealTotals(items), 1 / servings)} />
      </div>

      <div className="section-head">
        <h2>Zutaten</h2>
        <span className="section-meta">
          {items.length > 0 && `${formatNumber(totals.amount)} g · ${formatKcal(totals.kcal)}`}
        </span>
      </div>
      <div className="rows">
        {items.map((item) => (
          <IngredientRow key={item.food.id} item={item} showDeviation={isVariation} />
        ))}
      </div>

      {!recipe.owned && (
        <div className="bar">
          <button type="button" className="btn primary" onClick={() => onCopying(true)}>
            In eigenen Rezepten speichern
          </button>
        </div>
      )}
      {copying && (
        <CopyRecipeDialog
          recipeName={recipe.name}
          isAdjusted={false}
          onCopy={onCopy}
          onClose={() => onCopying(false)}
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
// others have no variations; they can be copied ("In eigenen Rezepten speichern") and then booked
// and varied as the user's own.
function RecipeBooking({ booking, onChange, onAddFoods, onConfirm, onSaveVariation, onCopy, onClose }) {
  const { recipe, unit, quantityText, servingsText, weightText, items, variationId, layer } = booking
  const isVariation = variationId !== null
  const totals = totalsOf(items)
  const weightG = weightText === null ? totals.amount : parseFloat(weightText)
  const servings = parseFloat(servingsText)
  const quantity = parseFloat(quantityText)
  const isValid = totals.amount > 0 && servings > 0 && weightG > 0 && quantity > 0
  const share = isValid ? shareOf({ unit, quantity, servings, weightG }) : 0
  const adjusted = isAdjusted(booking)
  // carbs, protein and fat of the whole recipe as it is booked (items of the variation, if any)
  const macroTotals = mealTotals(items)

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
  function setQuantity(foodId, quantity) {
    onChange({
      items: items.map((item) => (item.food.id === foodId ? { ...item, ...quantity } : item)),
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
      items.filter((item) => item.amount > 0),
      share,
    )
    onConfirm(booked, recipe.name, { recipeId: recipe.id, variationId })
  }

  if (layer?.type === 'amount') {
    const item = items.find((other) => other.food.id === layer.foodId)
    return (
      <FoodDetail
        food={item.food}
        initial={initialAmountInput(item.food, { quantity: editableQuantity(item) })}
        confirmLabel="Übernehmen"
        onConfirm={(food, quantity) => setQuantity(food.id, quantity)}
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
          value={weightText ?? String(roundToOneDecimal(totals.amount))}
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
        <BookResult
          kcal={isValid ? totals.kcal * share : null}
          grams={isValid ? scaleMacros(macroTotals, share) : null}
        />

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
              onRemove={() => setQuantity(item.food.id, zeroQuantity(item.food, item))}
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
              In eigenen Rezepten speichern
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

// ----- Shopping list -----

// The shopping list. Swiping an entry sideways checks it off (crossed out, moved to the end) or
// back; pressing an unchecked entry for a moment lifts it, then it can be dragged up or down to a
// new place; tapping it opens its quantity; "×" removes it (after asking). items: as the server
// sends them, already in order (unchecked first). null while loading.
// "Zurücksetzen" and "Hinzufügen" (onAdd: the search with carts) share the bottom bar.
function ShoppingListPage({ items, onToggle, onEdit, onMoveTo, onRemove, onReset, onAdd, onClose }) {
  // The entry being dragged: { id, from, dy, height }, from its place among the unchecked entries,
  // dy how far it is dragged, height of one entry (all are equally high).
  const [drag, setDrag] = useState(null)
  const uncheckedCount = (items ?? []).filter((item) => !item.checked).length
  const target = drag
    ? Math.max(0, Math.min(uncheckedCount - 1, drag.from + Math.round(drag.dy / drag.height)))
    : null

  // The dragged entry follows the finger; the ones it passes make room.
  function shiftOf(item, index) {
    if (!drag || item.checked) return 0
    if (item.id === drag.id) return drag.dy
    if (index > drag.from && index <= target) return -drag.height
    if (index < drag.from && index >= target) return drag.height
    return 0
  }

  function endDrag(item, apply) {
    if (apply && target !== drag.from) onMoveTo(item, target)
    setDrag(null)
  }

  return (
    <section>
      <TopBar title="Einkaufsliste" closeLabel="Schließen" onClose={onClose} />
      {items !== null && items.length === 0 && <p className="empty">Die Einkaufsliste ist leer.</p>}
      {items !== null && items.length > 0 && (
        <div className="rows shopping-rows">
          {items.map((item, index) => (
            <ShoppingRow
              key={item.id}
              item={item}
              shift={shiftOf(item, index)}
              isDragged={drag?.id === item.id}
              onToggle={onToggle}
              onEdit={onEdit}
              onDragStart={(height) => setDrag({ id: item.id, from: index, dy: 0, height })}
              onDragMove={(dy) => setDrag((current) => current && { ...current, dy })}
              onDragEnd={(apply) => endDrag(item, apply)}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      <div className="bar halves">
        <button type="button" className="btn danger" disabled={!items?.length} onClick={onReset}>
          Zurücksetzen
        </button>
        <button type="button" className="btn primary" onClick={onAdd}>
          Hinzufügen
        </button>
      </div>
    </section>
  )
}

// How far a finger has to move sideways over a shopping list entry to check it off (or back).
const SWIPE_DISTANCE = 72
// How long a finger has to rest on an unchecked entry before it can be dragged to another place.
const LONG_PRESS_MS = 400
// Moving less than this is still resting (fingers are never completely still).
const MOVE_TOLERANCE = 8

// The gestures on a shopping list or checklist entry, with pointer events (finger and mouse alike):
// - sideways: the entry follows the finger (offsetX); moved at least SWIPE_DISTANCE when the
//   finger lifts, onSwipe is called;
// - resting LONG_PRESS_MS first (canDrag only): the entry is lifted and dragged up or down,
//   reported by onDragStart(height), onDragMove(dy) and onDragEnd(apply), apply false if the
//   system took the gesture away;
// - anything else is the page's: vertical moves scroll (CSS touch-action: pan-y). While dragging,
//   scrolling is blocked with a touchmove listener that is not passive (React's are).
// wasGesture(): whether the click the browser may send afterwards belongs to a swipe or drag (and
// is to be ignored); it answers only once.
// rowRef: the entry's element.
function useRowGestures(rowRef, { canDrag, onSwipe, onDragStart, onDragMove, onDragEnd }) {
  const gesture = useRef(null) // { x, y, mode: null | 'swipe' | 'drag' | 'other', timer }
  const handledGesture = useRef(false)
  const [offsetX, setOffsetX] = useState(0)
  const [isLifted, setIsLifted] = useState(false)

  useEffect(() => {
    const row = rowRef.current
    const blockScrolling = (event) => {
      if (gesture.current?.mode === 'drag') event.preventDefault()
    }
    row.addEventListener('touchmove', blockScrolling, { passive: false })
    return () => row.removeEventListener('touchmove', blockScrolling)
  }, [rowRef])

  function finish(event, cancelled) {
    const current = gesture.current
    gesture.current = null
    if (!current) return
    clearTimeout(current.timer)
    setOffsetX(0)
    if (current.mode === 'swipe') {
      handledGesture.current = true
      if (!cancelled && Math.abs(event.clientX - current.x) >= SWIPE_DISTANCE) onSwipe()
    } else if (current.mode === 'drag') {
      handledGesture.current = true
      setIsLifted(false)
      onDragEnd(!cancelled)
    }
  }

  return {
    offsetX,
    isLifted,
    wasGesture() {
      const was = handledGesture.current
      handledGesture.current = false
      return was
    },
    handlers: {
      onPointerDown(event) {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        handledGesture.current = false
        const { pointerId } = event
        const current = { x: event.clientX, y: event.clientY, mode: null, timer: null }
        if (canDrag) {
          current.timer = setTimeout(() => {
            if (gesture.current !== current || current.mode !== null) return
            current.mode = 'drag'
            rowRef.current.setPointerCapture?.(pointerId)
            navigator.vibrate?.(15)
            setIsLifted(true)
            onDragStart(rowRef.current.offsetHeight)
          }, LONG_PRESS_MS)
        }
        gesture.current = current
      },
      onPointerMove(event) {
        const current = gesture.current
        if (!current) return
        const dx = event.clientX - current.x
        const dy = event.clientY - current.y
        if (current.mode === null && Math.max(Math.abs(dx), Math.abs(dy)) > MOVE_TOLERANCE) {
          clearTimeout(current.timer)
          current.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'other'
        }
        if (current.mode === 'swipe') {
          setOffsetX(Math.max(-1.5 * SWIPE_DISTANCE, Math.min(1.5 * SWIPE_DISTANCE, dx)))
        } else if (current.mode === 'drag') {
          onDragMove(dy)
        }
      },
      onPointerUp: (event) => finish(event, false),
      onPointerCancel: (event) => finish(event, true),
      // a long press would otherwise open the context menu or select text
      onContextMenu: (event) => event.preventDefault(),
    },
  }
}

// One entry in two lines that never grow: the name (one line, cut off with "…"), and below it
// the quantity (see shoppingItemDetails); the "×" right of both lines.
// shift: how far the entry is moved up or down by a drag (its own, or one passing it).
function ShoppingRow({ item, shift, isDragged, onToggle, onEdit, onDragStart, onDragMove, onDragEnd, onRemove }) {
  const name = shoppingItemName(item)
  const rowRef = useRef(null)
  const gestures = useRowGestures(rowRef, {
    canDrag: !item.checked,
    onSwipe: () => onToggle(item),
    onDragStart,
    onDragMove,
    onDragEnd,
  })

  const classes = ['row', 'two-line', 'shopping-row']
  if (item.checked) classes.push('checked')
  if (gestures.isLifted) classes.push('lifted')
  let style
  if (gestures.offsetX) style = { transform: `translateX(${gestures.offsetX}px)`, transition: 'none' }
  else if (isDragged) style = { transform: `translateY(${shift}px)`, transition: 'none' }
  else if (shift) style = { transform: `translateY(${shift}px)` }

  // The click after a swipe or drag is not a tap.
  function open() {
    if (!gestures.wasGesture()) onEdit(item)
  }

  return (
    <div ref={rowRef} className={classes.join(' ')} style={style} {...gestures.handlers}>
      <button type="button" className="row-open" onClick={open}>
        <span className="name">{name}</span>
        <span className="sub">{shoppingItemDetails(item)}</span>
      </button>
      <CrossButton label={`${name} entfernen`} onClick={() => onRemove(item)} />
    </div>
  )
}

// A shopping list entry is a food or a user item (see ShoppingListItemResponse in the backend).
const shoppingItemName = (item) => (item.userItem ? item.userItem.name : item.food.name)

// The second line: "Anzahl: 3" for a user item; for a food the amount, followed by the portions
// if it was put on the list as portions ("360 g · 6 Stück").
function shoppingItemDetails(item) {
  if (item.userItem) return `Anzahl: ${item.count}`
  const { food } = item
  const quantity = quantityFromItem(food, item)
  const portions = quantity.portionId !== null ? ` · ${formatQuantity(food, quantity)}` : ''
  return `${formatAmount(item.amount, food.unit)}${portions}`
}

// Puts a recipe on the shopping list: the foods it takes for the chosen number of portions (the
// recipe's own number preselected) in the chosen variation (the original preselected; only the
// owner has variations). onConfirm(items, { recipeId, variationId }).
// ----- Checklist -----

// Today's tasks: the open ones first, then those ticked off (struck through). Swiping an entry
// ticks it off or on (onToggle). entries: null while loading.
function ChecklistPage({ entries, onToggle, onManage, onClose }) {
  return (
    <section>
      <TopBar title="Checkliste" closeLabel="Schließen" onClose={onClose} />
      {entries !== null && entries.length === 0 && <p className="empty">Keine Aufgaben geplant.</p>}
      {entries !== null && entries.length > 0 && (
        <div className="rows shopping-rows">
          {entries.map((entry) => (
            <ChecklistRow key={entry.task.id} entry={entry} onToggle={onToggle} />
          ))}
        </div>
      )}
      <div className="bar">
        <button type="button" className="btn primary" onClick={onManage}>
          Aufgaben verwalten
        </button>
      </div>
    </section>
  )
}

// Two lines of fixed height: the name (cut off with "…") and the kcal it books, "0 kcal" for a
// task without foods. Only swiping does something.
function ChecklistRow({ entry, onToggle }) {
  const { task } = entry
  const rowRef = useRef(null)
  const gestures = useRowGestures(rowRef, { canDrag: false, onSwipe: () => onToggle(entry) })

  const classes = ['row', 'two-line', 'shopping-row', 'checklist-row']
  if (entry.done) classes.push('checked')
  const style = gestures.offsetX
    ? { transform: `translateX(${gestures.offsetX}px)`, transition: 'none' }
    : undefined

  return (
    <div ref={rowRef} className={classes.join(' ')} style={style} {...gestures.handlers}>
      <div className="row-open">
        <span className="name">{task.name}</span>
        <span className="sub">{formatKcal(task.kcal)}</span>
      </div>
    </div>
  )
}

// All tasks, in the order they were created, each with its days ("Täglich" or "Mo, Mi, Fr").
// Tapping one opens it (onOpen), "Aufgabe planen" a new one (onNew). tasks: null while loading.
function TasksPage({ tasks, onOpen, onNew, onClose }) {
  return (
    <section>
      <TopBar title="Aufgaben verwalten" closeLabel="Schließen" onClose={onClose} />
      {tasks !== null && tasks.length === 0 && <p className="empty">Keine Aufgaben.</p>}
      {tasks !== null && tasks.length > 0 && (
        <div className="rows">
          {tasks.map((task) => (
            <div key={task.id} className="row two-line">
              <button type="button" className="row-open" onClick={() => onOpen(task)}>
                <span className="name">{task.name}</span>
                <span className="sub">{formatWeekdays(task.weekdays)}</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="bar">
        <button type="button" className="btn primary" onClick={onNew}>
          Aufgabe planen
        </button>
      </div>
    </section>
  )
}

// Name, the weekdays it is due on (seven buttons, each on its own) and the foods it books.
// editor: see taskEditorFor; it lives in MealTracker, so the food search and the amount view can
// open on top and the back button closes them. onChange(changes) merges into it.
function TaskForm({ editor, onChange, onAddFoods, onOpenEntry, onSave, onDelete, onClose }) {
  const isNew = editor.taskId === null
  const daysLabelId = useId()

  function submit(event) {
    event.preventDefault()
    if (canSaveTask(editor)) onSave()
  }

  return (
    <section>
      <TopBar title={isNew ? 'Aufgabe erstellen' : 'Aufgabe bearbeiten'} closeLabel="Schließen" onClose={onClose} />
      <form onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            autoComplete="off"
            maxLength={100}
            value={editor.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <div className="field">
          <span id={daysLabelId}>Wochentage</span>
          <div className="weekdays" role="group" aria-labelledby={daysLabelId}>
            {WEEKDAYS.map(({ key, short }) => {
              const selected = editor.weekdays.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={selected ? 'weekday selected' : 'weekday'}
                  aria-pressed={selected}
                  onClick={() => onChange({ weekdays: toggleWeekday(editor.weekdays, key) })}
                >
                  {short}
                </button>
              )
            })}
          </div>
          {editor.weekdays.length === 0 && <span className="hint warning">Mindestens ein Tag.</span>}
        </div>

        <div className="section-head normal-case">
          <h2>Zu buchende Lebensmittel</h2>
        </div>
        {editor.entries.length > 0 && (
          <div className="rows">
            {editor.entries.map((entry) => (
              <EntryRow
                key={entry.food.id}
                entry={entry}
                showDelta={false}
                onOpen={onOpenEntry}
                onRemove={(foodId) =>
                  onChange({ entries: editor.entries.filter((other) => other.food.id !== foodId) })
                }
              />
            ))}
          </div>
        )}
        <button type="button" className="btn add-more" onClick={onAddFoods}>
          <PlusIcon size={18} />
          Lebensmittel hinzufügen
        </button>

        <div className="bar">
          {!isNew && (
            <button type="button" className="btn danger-outline" onClick={onDelete}>
              Löschen
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!canSaveTask(editor)}>
            Speichern
          </button>
        </div>
      </form>
    </section>
  )
}

function ShoppingRecipeAdd({ recipe, onConfirm, onClose }) {
  const servingsId = useId()
  const [variationId, setVariationId] = useState(null)
  const variation = variationOf(recipe, variationId)
  const [servingsText, setServingsText] = useState(() => String(servingsOf(recipe, null)))
  const servings = parseFloat(servingsText)
  const share = servings > 0 ? servings / servingsOf(recipe, variation) : 0
  const items =
    share > 0
      ? scaleItems(
          itemsOf(recipe, variation).filter((item) => item.amount > 0),
          share,
        ).filter((item) => item.amount > 0)
      : []
  const variations = recipe.variations ?? []

  function selectVariation(value) {
    const id = value === '' ? null : Number(value)
    setVariationId(id)
    setServingsText(String(servingsOf(recipe, variationOf(recipe, id))))
  }

  // "−" / "+": one portion less or more, never 0 or below.
  function stepServings(step) {
    const next = roundToOneDecimal((servings > 0 ? servings : 0) + step)
    if (next > 0) setServingsText(String(next))
  }

  function submit(event) {
    event.preventDefault()
    if (items.length > 0) onConfirm(items, { recipeId: recipe.id, variationId })
  }

  return (
    <section>
      <TopBar title={recipe.name} closeLabel="Schließen" onClose={onClose} centered />
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor={servingsId}>Portionen</label>
          <div className="stepper">
            <input
              id={servingsId}
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              min="0"
              step="any"
              value={servingsText}
              onFocus={(event) => event.target.select()}
              onChange={(event) => setServingsText(event.target.value)}
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
        {recipe.owned && variations.length > 0 && (
          <div className="field">
            <span>Variation</span>
            <SelectBox
              label="Original oder Variation"
              className="wide"
              value={String(variationId ?? '')}
              options={[
                { value: '', label: 'Original' },
                ...variations.map((other) => ({ value: String(other.id), label: other.name })),
              ]}
              onChange={selectVariation}
            />
          </div>
        )}

        <div className="section-head">
          <h2>Kommt auf die Einkaufsliste</h2>
        </div>
        {items.length === 0 ? (
          <p className="empty">Bitte gib die Portionen an.</p>
        ) : (
          <div className="rows">
            {items.map((item) => (
              <IngredientRow key={item.food.id} item={item} showDeviation={false} />
            ))}
          </div>
        )}

        <div className="bar">
          <button type="submit" className="btn primary" disabled={items.length === 0}>
            Zur Einkaufsliste hinzufügen
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

// A number with its unit, e.g. "2.000 kcal", "40 %" or "80,5 kg". While focused it shows only the
// number, selected so typing replaces it. Only digits can be typed, at most maxDigits, and with
// decimals > 0 a decimal comma with that many digits after it. A text field, as a number field
// cannot show the unit. value / onChange: the number as typed, e.g. "80,5".
// placeholder: shown while the field is empty, e.g. the unit.
function UnitNumberField({ label, unit, maxDigits, decimals = 0, placeholder, value, onChange }) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef(null)

  // Selected once the unit is gone from the field, i.e. after rendering.
  useEffect(() => {
    if (isFocused) inputRef.current.select()
  }, [isFocused])

  return (
    <label className="field">
      <span>{label}</span>
      <input
        ref={inputRef}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        enterKeyHint="done"
        autoComplete="off"
        placeholder={placeholder}
        value={isFocused || value === '' ? value : `${formatTyped(value, decimals)} ${unit}`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => onChange(sanitizeNumberInput(event.target.value, maxDigits, decimals))}
      />
    </label>
  )
}

// "10000" -> "10.000", "80,5" -> "80,5" (a trailing comma is dropped)
function formatTyped(text, decimals) {
  const value = Number(text.replace(',', '.'))
  return Number.isNaN(value) ? text : value.toLocaleString(LOCALE, { maximumFractionDigits: decimals })
}

// A whole number from min to max typed into a field, or NaN.
function wholeNumberIn(text, min, max) {
  const value = Number(text)
  return text.trim() !== '' && Number.isInteger(value) && value >= min && value <= max ? value : NaN
}

// The settings of the user, saved together with one "Speichern": calorie target, step goal, how the
// calories split into carbs, protein and fat (whole percent, together 100), and the body data the
// calories of steps and the daily nutrient targets are computed from. All of them must be filled in. Below: color theme and the
// connection to Health Connect (Android app only), which is kept on the phone, not on the server.
// activity: see useActivity. The daily nutrient targets follow from the saved profile on their own
// (see dailyTargets.js and NutrientOverview); there is nothing to set for them here.
function ProfilePage({ user, activity, onUserChange, onLogout, onClose, onError }) {
  const [targetText, setTargetText] = useState(String(user.calorieTarget))
  const [stepGoalText, setStepGoalText] = useState(String(user.stepGoal))
  // { carbsPercent, proteinPercent, fatPercent } as typed
  const [percentTexts, setPercentTexts] = useState(() =>
    Object.fromEntries(MACROS.map(({ percentField }) => [percentField, String(user[percentField])])),
  )
  const [weightText, setWeightText] = useState(toFieldText(user.weightKg))
  const [heightText, setHeightText] = useState(toFieldText(user.heightCm))
  const [sex, setSex] = useState(user.sex)
  const [birthDateTexts, setBirthDateTexts] = useState(() => birthDateParts(user.birthDate))
  const runAction = useActionRunner(onError)
  const themeLabelId = useId()
  const shareLabelId = useId()
  const userItemVisibilityLabelId = useId()

  const settings = {
    calorieTarget: wholeNumberIn(targetText, 1, MAX_CALORIE_TARGET),
    stepGoal: wholeNumberIn(stepGoalText, 1, STEP_GOAL_MAX),
    ...Object.fromEntries(
      MACROS.map(({ percentField }) => [percentField, wholeNumberIn(percentTexts[percentField], 0, 100)]),
    ),
    weightKg: numberIn(weightText, WEIGHT_MIN, WEIGHT_MAX),
    heightCm: wholeNumberIn(heightText, HEIGHT_MIN, HEIGHT_MAX),
  }
  const birthDate = birthDateFromParts(birthDateTexts, localDate(new Date()))
  const isBirthDateTyped =
    birthDateTexts.day !== '' && birthDateTexts.month !== '' && birthDateTexts.year.length === 4
  const percentSum = MACROS.reduce((sum, { percentField }) => sum + settings[percentField], 0)
  const isValid =
    Object.values(settings).every((value) => !Number.isNaN(value)) &&
    percentSum === 100 &&
    sex !== null &&
    birthDate !== null
  const isChanged =
    sex !== user.sex ||
    birthDate !== (user.birthDate ?? null) ||
    Object.keys(settings).some((field) => settings[field] !== user[field])
  const lacksBodyData = user.weightKg == null || user.heightCm == null || user.sex == null || user.birthDate == null

  function save(event) {
    event.preventDefault()
    if (!isValid || !isChanged) return
    runAction(async () => {
      // The color theme is not part of it, see changeColorTheme.
      const updated = await request(API.me, {
        method: 'PUT',
        body: JSON.stringify({ ...settings, sex, birthDate }),
      })
      onUserChange(updated)
      onError(null)
    })
  }

  // Shown at once and saved on its own, independent of "Speichern" (which is for the fields above
  // it). Should saving fail, the theme before comes back.
  function changeColorTheme(colorTheme) {
    if (colorTheme === user.colorTheme) return
    const before = user
    onUserChange({ ...user, colorTheme })
    runAction(async () => {
      try {
        onUserChange(
          await request(`${API.me}/color-theme`, { method: 'PUT', body: JSON.stringify({ colorTheme }) }),
        )
        onError(null)
      } catch (error) {
        onUserChange(before)
        throw error
      }
    })
  }

  // Like the color theme: shown at once and saved on its own; the old value comes back on failure.
  function changeUserItemVisibility(userItemVisibility) {
    if (userItemVisibility === user.userItemVisibility) return
    const before = user
    onUserChange({ ...user, userItemVisibility })
    runAction(async () => {
      try {
        onUserChange(
          await request(`${API.me}/user-item-visibility`, {
            method: 'PUT',
            body: JSON.stringify({ userItemVisibility }),
          }),
        )
        onError(null)
      } catch (error) {
        onUserChange(before)
        throw error
      }
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
        <UnitNumberField
          label="Kalorienziel"
          unit="kcal"
          maxDigits={String(MAX_CALORIE_TARGET).length}
          value={targetText}
          onChange={setTargetText}
        />
        <UnitNumberField
          label="Schrittziel"
          unit="Schritte"
          maxDigits={String(STEP_GOAL_MAX).length}
          value={stepGoalText}
          onChange={setStepGoalText}
        />
        <div className="section-head">
          <h2>Nährwertziele</h2>
        </div>
        <div className="macro-fields">
          {MACROS.map(({ key, label, percentField }) => (
            <UnitNumberField
              key={key}
              label={label}
              unit="%"
              maxDigits={3}
              value={percentTexts[percentField]}
              onChange={(text) => setPercentTexts((current) => ({ ...current, [percentField]: text }))}
            />
          ))}
        </div>
        {!Number.isNaN(percentSum) && percentSum !== 100 && (
          <p className="hint warning macro-sum">Zusammen müssen es 100 % sein.</p>
        )}
        <BodyDataFields
          weightText={weightText}
          heightText={heightText}
          birthDateTexts={birthDateTexts}
          sex={sex}
          onWeightChange={setWeightText}
          onHeightChange={setHeightText}
          onBirthDateChange={setBirthDateTexts}
          onSexChange={setSex}
        />
        {isBirthDateTyped && birthDate === null && (
          <p className="hint warning body-hint">Kein gültiges Geburtsdatum.</p>
        )}
        {lacksBodyData && <p className="hint warning body-hint">Nötig für die Schritt-kcal und den Tagesbedarf.</p>}
        <button type="submit" className="btn primary wide" disabled={!isValid || !isChanged}>
          Speichern
        </button>
      </form>

      <div className="field theme-field">
        <span id={themeLabelId}>Farbschema</span>
        <div className="segmented" role="radiogroup" aria-labelledby={themeLabelId}>
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={user.colorTheme === theme.value}
              className={user.colorTheme === theme.value ? 'selected' : undefined}
              onClick={() => changeColorTheme(theme.value)}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <HealthConnectSetting activity={activity} onError={onError} />

      {/* Who sees the user's items (shopping list); never public. */}
      <div className="field theme-field">
        <span id={userItemVisibilityLabelId}>Sichtbarkeit von Benutzeritems</span>
        <div className="segmented" role="radiogroup" aria-labelledby={userItemVisibilityLabelId}>
          {USER_ITEM_VISIBILITIES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={user.userItemVisibility === option.value}
              className={user.userItemVisibility === option.value ? 'selected' : undefined}
              onClick={() => changeUserItemVisibility(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="hint">Freunde sehen deine Benutzeritems, sobald es Freunde gibt.</span>
      </div>

      {/* Shown but not usable yet: sharing comes with friends. */}
      <div className="field theme-field">
        <span id={shareLabelId}>Einkaufsliste mit Freunden teilen</span>
        <div className="segmented" role="radiogroup" aria-labelledby={shareLabelId} aria-disabled="true">
          {SHARE_OPTIONS.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={user.shareShoppingList === option.value}
              className={user.shareShoppingList === option.value ? 'selected' : undefined}
              disabled
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="hint">Kommt mit Freunden.</span>
      </div>

      <div className="bar">
        <button type="button" className="btn danger wide" onClick={onLogout}>
          Abmelden
        </button>
      </div>
    </section>
  )
}

const MISSING_TARGETS_HINT =
  'Trage im Profil dein Geburtsdatum ein und speichere, dann wird dein Tagesbedarf berechnet.'

// "Männer", "Frauen", "divers": for whom the reference values in the daily overview are.
const TARGET_SEX_LABELS = {
  MALE: 'Männer',
  FEMALE: 'Frauen',
  DIVERSE: 'divers (jeweils der höhere Wert von Männern und Frauen)',
}

// Weight and height side by side, birth date and sex below. Shared by the profile and the
// registration. birthDateTexts: { day, month, year } as typed, see BirthDateFields.
function BodyDataFields({
  weightText,
  heightText,
  birthDateTexts,
  sex,
  onWeightChange,
  onHeightChange,
  onBirthDateChange,
  onSexChange,
}) {
  return (
    <>
      <div className="body-fields">
        <UnitNumberField
          label="Gewicht"
          unit="kg"
          maxDigits={3}
          decimals={1}
          value={weightText}
          onChange={onWeightChange}
        />
        <UnitNumberField label="Größe" unit="cm" maxDigits={3} value={heightText} onChange={onHeightChange} />
      </div>
      <BirthDateFields texts={birthDateTexts} onChange={onBirthDateChange} />
      <SegmentedChoice label="Geschlecht" options={SEX_OPTIONS} value={sex} onChange={onSexChange} />
    </>
  )
}

const MONTH_OPTIONS = [
  { value: '', label: 'Monat', disabled: true },
  ...MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name })),
]

// The birth date as day (two digits), month (a select box) and year (four digits) side by side.
// Day and year open the number pad and select their text when tapped, so typing replaces it.
// texts / onChange: { day, month, year }, month "1" to "12" or "" (see bodyData.js).
function BirthDateFields({ texts, onChange }) {
  const labelId = useId()
  const change = (part, text) => onChange({ ...texts, [part]: text })
  // Selected after the tap has placed the cursor, which would otherwise undo the selection.
  const selectAll = (event) => {
    const input = event.currentTarget
    setTimeout(() => input.select(), 0)
  }
  return (
    <div className="field">
      <span id={labelId}>Geburtsdatum</span>
      <div className="birth-date" role="group" aria-labelledby={labelId}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday-day"
          aria-label="Tag"
          placeholder="TT"
          value={texts.day}
          onFocus={selectAll}
          onChange={(event) => change('day', sanitizeNumberInput(event.target.value, 2))}
        />
        <SelectBox
          label="Monat"
          className="fill"
          value={texts.month}
          options={MONTH_OPTIONS}
          onChange={(month) => change('month', month)}
        />
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          aria-label="Jahr"
          placeholder="JJJJ"
          value={texts.year}
          onFocus={selectAll}
          onChange={(event) => change('year', sanitizeNumberInput(event.target.value, 4))}
        />
      </div>
    </div>
  )
}

// Connecting Health Connect, which brings in the steps and workouts of the watch. Android only.
// Connected means: read access granted and switched on here; "Trennen" only stops reading, the
// permission itself can be withdrawn in Health Connect.
function HealthConnectSetting({ activity, onError }) {
  const [availability, setAvailability] = useState(null) // see healthConnect.availability
  const [isDenied, setIsDenied] = useState(false)
  const runAction = useActionRunner(onError)

  useEffect(() => {
    let isCurrent = true
    healthConnect
      .availability()
      .then((result) => isCurrent && setAvailability(result))
      .catch(() => isCurrent && setAvailability('notInstalled'))
    return () => {
      isCurrent = false
    }
  }, [])

  function connect() {
    runAction(async () => {
      setIsDenied(!(await activity.connect()))
    })
  }

  let content
  if (availability === 'unsupported') {
    content = <span className="hint">Nur in der Android-App verfügbar.</span>
  } else if (availability === 'notInstalled') {
    content = (
      <>
        <span className="hint">Health Connect ist nicht installiert.</span>
        <button type="button" className="btn" onClick={healthConnect.openStorePage}>
          Health Connect installieren
        </button>
      </>
    )
  } else if (activity.status === 'disconnected') {
    content = (
      <>
        <span className="hint">
          {isDenied ? 'Zugriff nicht erlaubt.' : 'Schritte und Workouts deiner Uhr übernehmen.'}
        </span>
        <button type="button" className="btn" onClick={connect}>
          Verbinden
        </button>
      </>
    )
  } else if (availability === 'available') {
    content = (
      <div className="health-connected">
        <span>Verbunden</span>
        <button type="button" className="btn" onClick={() => runAction(activity.disconnect)}>
          Trennen
        </button>
      </div>
    )
  }

  return (
    <div className="field health-field">
      <span>Health Connect</span>
      {content}
    </div>
  )
}

// What is missing or out of range in the body data of a registration, or null.
function bodyDataProblem({ weightKg, heightCm, birthDate, sex }) {
  if (Number.isNaN(weightKg)) return `Bitte gib dein Gewicht an (${WEIGHT_MIN}–${WEIGHT_MAX} kg).`
  if (Number.isNaN(heightCm)) return `Bitte gib deine Größe an (${HEIGHT_MIN}–${HEIGHT_MAX} cm).`
  if (birthDate === null) return 'Bitte gib dein Geburtsdatum an (Tag, Monat, vierstelliges Jahr).'
  if (sex === null) return 'Bitte wähle dein Geschlecht.'
  return null
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

// "Anmelden" logs in. "Registrieren" opens the registration view: the same fields plus "repeat
// password" and the body data (weight, height, birth date, sex), with "Registrieren" as its only button and
// "×" (or the back button) back to the login. Enter in a field triggers the highlighted button.
// The server field is pre-filled with the server used last; another address only replaces it
// once a login there succeeded.
function LoginPage({ onLoggedIn }) {
  const [server, setServer] = useState(getServerUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  // Required when registering: the app needs them to turn steps into calories and to compute the
  // daily nutrient targets.
  const [weightText, setWeightText] = useState('')
  const [heightText, setHeightText] = useState('')
  const [birthDateTexts, setBirthDateTexts] = useState(() => birthDateParts(null))
  const [sex, setSex] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState(null)
  const runAction = useActionRunner(setError)

  const hasCredentials = email.trim() !== '' && password !== ''

  // body: what is sent besides email and password (the body data when registering).
  function authenticate(path, body = {}) {
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
          body: JSON.stringify({ email: email.trim(), password, ...body }),
        })
      } catch (error) {
        throw new Error(authErrorMessage(error, path), { cause: error })
      }
      await onLoggedIn(serverUrl, response.token, response.user)
    })
  }

  function logIn() {
    if (!hasCredentials) {
      setError('Bitte gib E-Mail-Adresse und Passwort ein.')
      return
    }
    authenticate(API.login)
  }

  // What is typed stays when switching between login and registration.
  function showRegistration(show) {
    setIsRegistering(show)
    setError(null)
  }

  useBackNavigation(isRegistering, () => showRegistration(false))

  function register() {
    const bodyData = {
      weightKg: numberIn(weightText, WEIGHT_MIN, WEIGHT_MAX),
      heightCm: wholeNumberIn(heightText, HEIGHT_MIN, HEIGHT_MAX),
      birthDate: birthDateFromParts(birthDateTexts, localDate(new Date())),
      sex,
    }
    const problem =
      (email.trim() === '' && 'Bitte gib eine E-Mail-Adresse ein.') ||
      passwordProblem(password, passwordRepeat) ||
      bodyDataProblem(bodyData)
    if (problem) {
      setError(problem)
      return
    }
    authenticate(API.register, bodyData)
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
    <main className={isRegistering ? 'app login registering' : 'app login'}>
      {isRegistering ? (
        <TopBar title="Registrieren" closeLabel="Zurück zur Anmeldung" onClose={() => showRegistration(false)} />
      ) : (
        <h1 className="login-title">Mealtracker</h1>
      )}
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
        {isRegistering && (
          <BodyDataFields
            weightText={weightText}
            heightText={heightText}
            birthDateTexts={birthDateTexts}
            sex={sex}
            onWeightChange={setWeightText}
            onHeightChange={setHeightText}
            onBirthDateChange={setBirthDateTexts}
            onSexChange={setSex}
          />
        )}
        <div className="login-actions">
          {isRegistering ? (
            <button type="button" className="btn primary" onClick={register}>
              Registrieren
            </button>
          ) : (
            <>
              <button type="button" className="btn primary" onClick={logIn}>
                Anmelden
              </button>
              <button type="button" className="btn" onClick={() => showRegistration(true)}>
                Registrieren
              </button>
            </>
          )}
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

// Today's local date, e.g. "2026-11-11". Changes at midnight, and when the app comes back to the
// foreground on another day: timers do not run while the device sleeps or the app is paused.
function useToday() {
  const [today, setToday] = useState(() => localDate(new Date()))

  useEffect(() => {
    const update = () => setToday(localDate(new Date())) // same string: no new render
    // setTimeout never fires early; the extra second only keeps clear of the exact midnight
    const timer = setTimeout(update, msUntilMidnight(new Date()) + 1000)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') update()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    const resume = IS_NATIVE ? CapacitorApp.addListener('resume', update) : null
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      resume?.then((handle) => handle.remove())
    }
  }, [today])

  return today
}

// Today's steps and workouts from Health Connect (see healthConnect.js), read when the app starts,
// when it comes back to the foreground, on a new day and on refresh().
// status: 'unsupported' (browser), 'disconnected', 'loading', 'ok' or 'failed' (reading did not
// work; data is then what was read last today, if anything). data: see healthConnect.readDay.
function useActivity(today) {
  const [state, setState] = useState(() => ({
    status: healthConnect.isSupported() ? 'loading' : 'unsupported',
    data: null,
  }))

  const load = useCallback(async () => {
    if (!healthConnect.isSupported()) return { status: 'unsupported', data: null }
    if (!(await healthConnect.isConnected())) return { status: 'disconnected', data: null }
    try {
      return { status: 'ok', data: await healthConnect.readDay(today) }
    } catch {
      return { status: 'failed', data: await healthConnect.lastRead(today) }
    }
  }, [today])

  // State is only set once reading is done; a late answer for another day is ignored.
  useEffect(() => {
    let isCurrent = true
    const update = () => load().then((loaded) => isCurrent && setState(loaded))
    update()
    const resume = IS_NATIVE ? CapacitorApp.addListener('resume', update) : null
    return () => {
      isCurrent = false
      resume?.then((handle) => handle.remove())
    }
  }, [load])

  const refresh = useCallback(() => load().then(setState), [load])

  // true if access was granted; reads right away then.
  async function connect() {
    const granted = await healthConnect.connect()
    if (granted) await refresh()
    return granted
  }

  async function disconnect() {
    await healthConnect.disconnect()
    setState({ status: 'disconnected', data: null })
  }

  return { ...state, refresh, connect, disconnect }
}

// "×" of the food search, by what it adds to (see recipeSearch in MealTracker).
const SEARCH_CLOSE_LABELS = { editor: 'Zurück zum Rezept', booking: 'Zurück zur Buchung', task: 'Zurück zur Aufgabe' }

// The app after login. Keyed by the user id in App, so nothing carries over to another account.
function MealTracker({ user, onUserChange, onLogout }) {
  // 'list' | 'edit' | 'search' | 'preview' | 'foods' | 'shopping' | 'profile' | 'nutrients' | 'checklist'
  const [view, setView] = useState('list')
  const [meals, setMeals] = useState([])
  const [draft, setDraft] = useState(NEW_DRAFT)
  // Amount view of a food: null or { food, mode: 'add' | 'set' | 'recipe-add' | 'task-set', initial },
  // initial see initialAmountInput. 'task-set' changes an amount in the task form.
  const [detail, setDetail] = useState(null)
  const [recipeBooking, setRecipeBooking] = useState(null) // booking view of a recipe, see bookingFor
  const [foodForm, setFoodForm] = useState(null) // food shown in the food database form
  const [foodFormLayer, setFoodFormLayer] = useState(null) // portion view on top of it, see FoodForm
  const [recipeEditor, setRecipeEditor] = useState(null) // recipe editor, see NEW_EDITOR
  // Details of a food or recipe from the database or the shopping list search:
  // { kind, entry, variationId, copying }, see FoodInfo and RecipeInfo.
  const [catalogDetail, setCatalogDetail] = useState(null)
  // Food search on top of the recipe editor, the booking view or the task form: null or { target,
  // entries, previewing }, target 'editor' | 'booking' | 'task'; entries are the foods about to be
  // added.
  const [recipeSearch, setRecipeSearch] = useState(null)
  const [catalogVersion, setCatalogVersion] = useState(0) // reloads the food database list
  const [shoppingList, setShoppingList] = useState(null) // items of the shopping list, null until loaded
  // Putting a database entry on the shopping list: null, { food }, { recipe } or { userItem }.
  const [shoppingAdd, setShoppingAdd] = useState(null)
  const [userItemEdit, setUserItemEdit] = useState(null) // user item being renamed or deleted
  const [shoppingSearch, setShoppingSearch] = useState(false) // the search to add to the list is open
  // shopping list entry whose quantity (food) or count (user item) is changed
  const [shoppingEdit, setShoppingEdit] = useState(null)
  // { kind, id } of the database entry just put on the shopping list: its cart shows ✓ for a moment.
  const [addedToList, setAddedToList] = useState(null)
  const [checklist, setChecklist] = useState(null) // today's checklist entries, null until loaded
  // Something left to do turns its button in the main view orange: a task of today not done yet,
  // an entry on the shopping list not ticked off. Empty or all done: the normal colour.
  const hasOpenTasks = checklist?.some((entry) => !entry.done) ?? false
  const hasOpenShopping = shoppingList?.some((item) => !item.checked) ?? false
  const [tasksOpen, setTasksOpen] = useState(false) // "Aufgaben verwalten" is open
  const [tasks, setTasks] = useState(null) // all tasks, null while loading
  const [taskEditor, setTaskEditor] = useState(null) // task form, see taskEditorFor
  const [confirm, setConfirm] = useState(null) // props of the open ConfirmDialog
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const runAction = useActionRunner(setError)

  const isEditing = draft.mealId !== null
  const editedMeal = isEditing ? meals.find((meal) => meal.id === draft.mealId) : undefined

  // The list only shows the meals booked today, so it starts empty every day at midnight. Older
  // meals stay in the database.
  const today = useToday()
  const mealsUrl = `${API.meals}?date=${today}`
  const checklistUrl = `${API.checklist}?date=${today}`
  const activity = useActivity(today)

  // The checklist comes along: deleting a meal may open a task again, and the main view shows
  // whether all of today's tasks are done.
  const loadMeals = useCallback(async () => {
    const [loadedMeals, loadedChecklist] = await Promise.all([request(mealsUrl), request(checklistUrl)])
    setMeals(loadedMeals)
    setChecklist(loadedChecklist)
    setError(null)
  }, [mealsUrl, checklistUrl])

  // First load, and again on a new day. State is only set once the requests are done (not
  // synchronously in the effect); a late answer after unmounting or for another day is ignored.
  useEffect(() => {
    let isCurrent = true
    Promise.all([request(mealsUrl), request(checklistUrl)])
      .then(([loadedMeals, loadedChecklist]) => {
        if (!isCurrent) return
        setMeals(loadedMeals)
        setChecklist(loadedChecklist)
        setError(null)
      })
      .catch((error) => {
        if (isCurrent) setError(error.message)
      })
    return () => {
      isCurrent = false
    }
  }, [mealsUrl, checklistUrl])

  // The shopping list is loaded at start too, for the colour of the cart in the main view.
  // Afterwards every change answers with the whole list (see changeShoppingList).
  useEffect(() => {
    let isCurrent = true
    request(API.shoppingList)
      .then((items) => {
        if (isCurrent) setShoppingList(items)
      })
      .catch((error) => {
        if (isCurrent) setError(error.message)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  // Also after booking: "Zuletzt" in the searches changes with the meals.
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

  // quantity: portions or an amount in g / ml, see quantities.js
  function addToDraft(food, quantity) {
    setDraft((current) => ({ ...current, entries: addAmount(current.entries, food, quantity) }))
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
      reloadCatalog()
      await loadMeals()
    })
  }

  async function saveEditedEntries(entries) {
    const { mealId } = draft
    await createOrUpdate(API.meals, mealId, mealRequest(entries))
    reloadCatalog()
    // The saved amounts are the new baseline. Skip this if another meal was opened meanwhile.
    setDraft((current) =>
      current.mealId === mealId
        ? {
            mealId,
            entries: entries.map((entry) => ({ ...entry, baseAmount: entry.amount })),
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

  function saveEntryAmount(food, quantity) {
    runAction(async () => {
      await saveEditedEntries(
        draft.entries.map((entry) => (entry.food.id === food.id ? { ...entry, ...quantity } : entry)),
      )
      setDetail(null)
      await loadMeals()
    })
  }

  // From the search: the default portion preselected, or (asUnit, the scale button) g / ml.
  function openFoodDetail(food, { asUnit = false } = {}) {
    setDetail({ food, mode: 'add', initial: initialAmountInput(food, { asUnit }) })
  }

  function openRecipeFoodDetail(food, { asUnit = false } = {}) {
    setDetail({ food, mode: 'recipe-add', initial: initialAmountInput(food, { asUnit }) })
  }

  // An amount already in the meal is shown as it was booked: as portions or in g / ml.
  function openEntryDetail(entry) {
    setDetail({
      food: entry.food,
      mode: 'set',
      initial: initialAmountInput(entry.food, { quantity: entry }),
    })
  }

  function addFromDetail(food, quantity) {
    if (detail.mode === 'recipe-add') addToRecipeSearch(food, quantity)
    else addToDraft(food, quantity)
    setDetail(null)
  }

  function askDeleteMeal(meal) {
    setConfirm({
      title: 'Mahlzeit löschen?',
      text: `„${meal.title}“ (${Math.round(meal.kcal)} kcal) wird endgültig gelöscht.`,
      confirmLabel: 'Löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(`${API.meals}/${meal.id}`, { method: 'DELETE' })
          reloadCatalog()
          await loadMeals()
        }),
    })
  }

  // ----- food database: details -----

  // The search lists foods without their nutrients (see fetchCatalog): the details show the whole food.
  function openCatalogDetail(kind, entry) {
    setNotice(null)
    if (kind === KIND_RECIPES) {
      setCatalogDetail({ kind, entry, variationId: null, copying: false })
      return
    }
    runAction(async () => {
      const food = await fetchFood(entry.id)
      setCatalogDetail({ kind, entry: food, variationId: null, copying: false })
    })
  }

  function updateCatalogDetail(changes) {
    setCatalogDetail((current) => ({ ...current, ...changes }))
  }

  // A recipe of somebody else becomes the user's own private copy; the details then show it.
  function copyDetailRecipe({ name }) {
    const source = catalogDetail.entry
    runAction(async () => {
      const copy = await request(API.recipes, {
        method: 'POST',
        body: JSON.stringify(
          recipeRequest({
            name,
            servingsText: String(source.servings),
            published: false,
            items: itemsOf(source, null),
          }),
        ),
      })
      setCatalogDetail({ kind: KIND_RECIPES, entry: copy, variationId: null, copying: false })
      setNotice(`„${copy.name}“ ist jetzt dein eigenes Rezept.`)
      reloadCatalog()
      setError(null)
    })
  }

  // The pencil in the database list (own entries only) and "+" for a new one. The form needs the
  // whole food, the list has it without nutrients (see fetchCatalog).
  function openEditor(kind, entry) {
    if (kind === KIND_RECIPES) openRecipe(entry)
    else if (entry) runAction(async () => openFood(await fetchFood(entry.id)))
    else openFood(NEW_FOOD)
  }

  // ----- food database: foods -----

  function openFood(food) {
    setNotice(null)
    setFoodFormLayer(null)
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

  function addToRecipeSearch(food, quantity) {
    setRecipeSearch((current) => ({ ...current, entries: addAmount(current.entries, food, quantity) }))
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
    if (target === 'task') {
      setTaskEditor((current) => ({
        ...current,
        entries: added.reduce((entries, entry) => addAmount(entries, entry.food, entry), current.entries),
      }))
    } else if (target === 'booking') {
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
      .map((item) => ({ food: item.food, amount: 0 }))
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

  // ----- shopping list -----

  useEffect(() => {
    if (!addedToList) return
    const timer = setTimeout(() => setAddedToList(null), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [addedToList])

  // Every change answers with the whole list in the order to show.
  function changeShoppingList(path, options) {
    runAction(async () => {
      setShoppingList(await request(`${API.shoppingList}${path}`, options))
      setError(null)
    })
  }

  function toggleShoppingItem(item) {
    changeShoppingList(`/items/${item.id}/checked`, {
      method: 'PUT',
      body: JSON.stringify({ checked: !item.checked }),
    })
  }

  // Replaces the quantity of an entry (portions or g / ml), from the amount view.
  function saveShoppingQuantity(food, quantity) {
    const { id } = shoppingEdit
    runAction(async () => {
      setShoppingList(
        await request(`${API.shoppingList}/items/${id}/quantity`, {
          method: 'PUT',
          body: JSON.stringify(quantityFields(quantity)),
        }),
      )
      setShoppingEdit(null)
      setError(null)
    })
  }

  // Moves an unchecked entry to place `to` among the unchecked ones. Shown right away; the
  // server's answer then has the same order. If the server refuses, the old order comes back.
  function moveShoppingItem(item, to) {
    const before = shoppingList
    const unchecked = before.filter((other) => !other.checked && other.id !== item.id)
    unchecked.splice(to, 0, item)
    setShoppingList([...unchecked, ...before.filter((other) => other.checked)])
    runAction(async () => {
      try {
        setShoppingList(
          await request(`${API.shoppingList}/items/${item.id}/move?to=${to}`, { method: 'POST' }),
        )
        setError(null)
      } catch (error) {
        setShoppingList(before)
        throw error
      }
    })
  }

  // Replaces the count of a user item entry, from the count view.
  function saveShoppingCount(count) {
    const { id } = shoppingEdit
    runAction(async () => {
      setShoppingList(
        await request(`${API.shoppingList}/items/${id}/count`, {
          method: 'PUT',
          body: JSON.stringify({ count }),
        }),
      )
      setShoppingEdit(null)
      setError(null)
    })
  }

  function askRemoveShoppingItem(item) {
    setConfirm({
      title: 'Eintrag entfernen?',
      text: `„${shoppingItemName(item)}“ wird von der Einkaufsliste entfernt.`,
      confirmLabel: 'Entfernen',
      onConfirm: () => {
        setConfirm(null)
        changeShoppingList(`/items/${item.id}`, { method: 'DELETE' })
      },
    })
  }

  function askResetShoppingList() {
    setConfirm({
      title: 'Einkaufsliste zurücksetzen?',
      text: 'Alle Einträge werden gelöscht.',
      confirmLabel: 'Zurücksetzen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(API.shoppingList, { method: 'DELETE' })
          setShoppingList([])
          setError(null)
        }),
    })
  }

  // items: foods with quantities; added: { kind, id } of the database entry they come from, whose
  // cart then shows ✓; use: the recipe ({ recipeId, variationId }), which counts as booked last in
  // that variation, like when booking a meal.
  function addToShoppingList(items, added, use = null) {
    runAction(async () => {
      setShoppingList(
        await request(`${API.shoppingList}/items`, {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((item) => ({ foodId: item.food.id, ...quantityFields(item) })),
            recipes: use ? [use] : [],
          }),
        }),
      )
      setShoppingAdd(null)
      setAddedToList(added)
      if (use) reloadCatalog()
      setError(null)
    })
  }

  // A user item goes on the list with its count; one that is there already gets it added.
  function addUserItemToShoppingList(userItem, count) {
    runAction(async () => {
      setShoppingList(
        await request(`${API.shoppingList}/user-items`, {
          method: 'POST',
          body: JSON.stringify({ userItemId: userItem.id, count }),
        }),
      )
      setShoppingAdd(null)
      setAddedToList({ kind: KIND_USER_ITEMS, id: userItem.id })
      setError(null)
    })
  }

  // ----- user items -----

  // A name the user has already (in any case) is refused by the server with 409.
  async function sendUserItem(url, method, name) {
    try {
      return await request(url, { method, body: JSON.stringify({ name }) })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new Error(`Ein Item „${name}“ gibt es schon.`, { cause: error })
      }
      throw error
    }
  }

  // "+" in the shopping list search: the item named as typed. The search keeps its text, so the
  // new item is the one shown, ready for its cart.
  function createUserItem(name) {
    runAction(async () => {
      await sendUserItem(API.userItems, 'POST', name)
      reloadCatalog()
      setError(null)
    })
  }

  function saveUserItem(name) {
    const { id } = userItemEdit
    runAction(async () => {
      await sendUserItem(`${API.userItems}/${id}`, 'PUT', name)
      setUserItemEdit(null)
      reloadCatalog()
      // the list shows the new name too
      setShoppingList(await request(API.shoppingList))
      setError(null)
    })
  }

  function askDeleteUserItem() {
    const { id, name } = userItemEdit
    const onList = shoppingList?.some((item) => item.userItem?.id === id) ?? false
    setConfirm({
      title: 'Item löschen?',
      text: onList
        ? `„${name}“ wird gelöscht und von der Einkaufsliste entfernt.`
        : `„${name}“ wird gelöscht.`,
      confirmLabel: 'Löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(`${API.userItems}/${id}`, { method: 'DELETE' })
          setUserItemEdit(null)
          reloadCatalog()
          setShoppingList(await request(API.shoppingList))
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

  function openShoppingList() {
    setError(null)
    setView('shopping')
    runAction(async () => setShoppingList(await request(API.shoppingList)))
  }

  function closeShoppingList() {
    setError(null)
    setShoppingSearch(false)
    setView('list')
  }

  function openNutrients() {
    setError(null)
    setView('nutrients')
  }

  function closeNutrients() {
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

  // ----- checklist and tasks -----

  function openChecklist() {
    setError(null)
    setView('checklist')
    runAction(async () => setChecklist(await request(checklistUrl)))
  }

  function closeChecklist() {
    setError(null)
    setTasksOpen(false)
    setView('list')
  }

  // Swiped: an open task is ticked off and books its foods; a done one is opened again right
  // away, which deletes the meal it booked.
  function toggleTask(entry) {
    runAction(async () => {
      const url = `${API.checklist}/${entry.task.id}/done?date=${today}`
      setChecklist(await request(url, { method: entry.done ? 'DELETE' : 'PUT' }))
      await loadMeals()
    })
  }

  function openTasks() {
    setError(null)
    setTasks(null)
    setTasksOpen(true)
    runAction(async () => setTasks(await request(API.tasks)))
  }

  function updateTaskEditor(changes) {
    setTaskEditor((current) => ({ ...current, ...changes }))
  }

  function openTaskEntryDetail(entry) {
    setDetail({ food: entry.food, mode: 'task-set', initial: initialAmountInput(entry.food, { quantity: entry }) })
  }

  function saveTaskEntryAmount(food, quantity) {
    setTaskEditor((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.food.id === food.id ? { ...entry, ...quantity } : entry)),
    }))
    setDetail(null)
  }

  // Back to "Aufgaben verwalten"; the checklist may have changed with it.
  function saveTask() {
    runAction(async () => {
      await createOrUpdate(API.tasks, taskEditor.taskId, taskRequest(taskEditor))
      setTaskEditor(null)
      const [allTasks, todays] = await Promise.all([request(API.tasks), request(checklistUrl)])
      setTasks(allTasks)
      setChecklist(todays)
    })
  }

  function askDeleteTask() {
    const { taskId, name } = taskEditor
    setConfirm({
      title: 'Aufgabe löschen?',
      text: `„${name}“ wird gelöscht. Schon gebuchte Mahlzeiten bleiben.`,
      confirmLabel: 'Löschen',
      onConfirm: () =>
        runAction(async () => {
          setConfirm(null)
          await request(`${API.tasks}/${taskId}`, { method: 'DELETE' })
          setTaskEditor(null)
          const [allTasks, todays] = await Promise.all([request(API.tasks), request(checklistUrl)])
          setTasks(allTasks)
          setChecklist(todays)
          await loadMeals()
        }),
    })
  }

  // What the amount view's button does, by its mode.
  const detailActions = {
    add: addFromDetail,
    'recipe-add': addFromDetail,
    set: saveEntryAmount,
    'task-set': saveTaskEntryAmount,
  }

  // One handler for every "×" and for the system back button: close the topmost layer.
  function goBack() {
    setNotice(null)
    if (closeInnerView()) return
    if (confirm) setConfirm(null)
    else if (detail) setDetail(null)
    else if (recipeSearch?.previewing) setRecipeSearch({ ...recipeSearch, previewing: false })
    else if (recipeSearch) setRecipeSearch(null)
    else if (recipeBooking?.layer) updateBooking({ layer: null })
    else if (recipeBooking) setRecipeBooking(null)
    else if (recipeEditor?.layer) updateEditor({ layer: null })
    else if (recipeEditor) setRecipeEditor(null)
    else if (catalogDetail?.copying) updateCatalogDetail({ copying: false })
    else if (catalogDetail) setCatalogDetail(null)
    else if (shoppingAdd) setShoppingAdd(null)
    else if (userItemEdit) setUserItemEdit(null)
    else if (shoppingEdit) setShoppingEdit(null)
    else if (foodFormLayer) setFoodFormLayer(null)
    else if (foodForm) setFoodForm(null)
    else if (taskEditor) setTaskEditor(null)
    else if (view === 'preview') setView('search')
    else if (view === 'search' || view === 'edit') discardDraft()
    else if (view === 'foods') closeFoods()
    else if (view === 'shopping' && shoppingSearch) setShoppingSearch(false)
    else if (view === 'shopping') closeShoppingList()
    else if (view === 'nutrients') closeNutrients()
    else if (view === 'checklist' && tasksOpen) setTasksOpen(false)
    else if (view === 'checklist') closeChecklist()
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
          user={user}
          meals={meals}
          activity={activity}
          onAdd={startNewMeal}
          onEdit={editMeal}
          onDelete={askDeleteMeal}
          onOpenChecklist={openChecklist}
          hasOpenShopping={hasOpenShopping}
          hasOpenTasks={hasOpenTasks}
          onOpenFoods={openFoods}
          onOpenShoppingList={openShoppingList}
          onOpenProfile={openProfile}
          onOpenNutrients={openNutrients}
        />
      )}

      {view === 'nutrients' && (
        <NutrientOverview user={user} meals={meals} activity={activity} today={today} onClose={goBack} />
      )}

      {view === 'checklist' && !tasksOpen && (
        <ChecklistPage entries={checklist} onToggle={toggleTask} onManage={openTasks} onClose={goBack} />
      )}
      {view === 'checklist' && tasksOpen && !taskEditor && (
        <TasksPage
          tasks={tasks}
          onOpen={(task) => setTaskEditor(taskEditorFor(task))}
          onNew={() => setTaskEditor(taskEditorFor(null))}
          onClose={goBack}
        />
      )}
      {view === 'checklist' && taskEditor && !recipeSearch && !detail && (
        <TaskForm
          editor={taskEditor}
          onChange={updateTaskEditor}
          onAddFoods={() => openRecipeSearch('task')}
          onOpenEntry={openTaskEntryDetail}
          onSave={saveTask}
          onDelete={askDeleteTask}
          onClose={goBack}
        />
      )}

      {view === 'shopping' && shoppingEdit?.userItem && (
        <UserItemCount
          name={shoppingEdit.userItem.name}
          initialCount={shoppingEdit.count}
          confirmLabel="Übernehmen"
          onConfirm={saveShoppingCount}
          onClose={goBack}
        />
      )}
      {view === 'shopping' && shoppingEdit?.food && (
        <FoodDetail
          food={shoppingEdit.food}
          initial={initialAmountInput(shoppingEdit.food, {
            quantity: quantityFromItem(shoppingEdit.food, shoppingEdit),
          })}
          confirmLabel="Übernehmen"
          onConfirm={saveShoppingQuantity}
          onClose={goBack}
        />
      )}

      {view === 'shopping' && !shoppingEdit && !shoppingSearch && (
        <ShoppingListPage
          items={shoppingList}
          onToggle={toggleShoppingItem}
          onEdit={setShoppingEdit}
          onMoveTo={moveShoppingItem}
          onRemove={askRemoveShoppingItem}
          onReset={askResetShoppingList}
          onAdd={() => {
            setError(null)
            setShoppingSearch(true)
          }}
          onClose={goBack}
        />
      )}

      {/* Adding to the shopping list: the database with carts instead of pencils. */}
      {view === 'shopping' && shoppingSearch && (
        <>
          <FoodDatabase
            hidden={catalogDetail !== null || shoppingAdd !== null || userItemEdit !== null}
            version={catalogVersion}
            mode="shop"
            addedToList={addedToList}
            closeLabel="Zurück zur Einkaufsliste"
            onOpen={openCatalogDetail}
            onAddToList={(kind, entry) => {
              setNotice(null)
              setShoppingAdd(
                kind === KIND_RECIPES
                  ? { recipe: entry }
                  : kind === KIND_USER_ITEMS
                    ? { userItem: entry }
                    : { food: entry },
              )
            }}
            onNewUserItem={createUserItem}
            onEditUserItem={(item) => {
              setNotice(null)
              setError(null)
              setUserItemEdit(item)
            }}
            onClose={goBack}
            onError={setError}
          />
          {userItemEdit && (
            <UserItemForm
              key={userItemEdit.id}
              item={userItemEdit}
              onSave={saveUserItem}
              onDelete={askDeleteUserItem}
              onClose={goBack}
            />
          )}
          {shoppingAdd?.userItem && (
            <UserItemCount
              key={shoppingAdd.userItem.id}
              name={shoppingAdd.userItem.name}
              confirmLabel="Zur Einkaufsliste hinzufügen"
              onConfirm={(count) => addUserItemToShoppingList(shoppingAdd.userItem, count)}
              onClose={goBack}
            />
          )}
          {shoppingAdd?.food && (
            <FoodDetail
              food={shoppingAdd.food}
              initial={initialAmountInput(shoppingAdd.food)}
              confirmLabel="Zur Einkaufsliste hinzufügen"
              onConfirm={(food, quantity) =>
                addToShoppingList([{ food, ...quantity }], { kind: KIND_FOODS, id: food.id })
              }
              onClose={goBack}
            />
          )}
          {shoppingAdd?.recipe && (
            <ShoppingRecipeAdd
              key={shoppingAdd.recipe.id}
              recipe={shoppingAdd.recipe}
              onConfirm={(items, use) =>
                addToShoppingList(items, { kind: KIND_RECIPES, id: use.recipeId }, use)
              }
              onClose={goBack}
            />
          )}
        </>
      )}

      {view === 'profile' && (
        <ProfilePage
          user={user}
          activity={activity}
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
          bookedAt={editedMeal?.bookedAt}
          fromTask={editedMeal?.taskId != null}
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
            hidden={foodForm !== null || recipeEditor !== null || catalogDetail !== null}
            version={catalogVersion}
            mode="manage"
            onOpen={openCatalogDetail}
            onEdit={openEditor}
            onNew={(kind) => openEditor(kind, null)}
            onClose={goBack}
            onError={setError}
          />
          {foodForm && (
            <FoodForm
              key={foodForm.id ?? 'new'}
              food={foodForm}
              layer={foodFormLayer}
              onLayerChange={setFoodFormLayer}
              onSave={saveFood}
              onDelete={askDeleteFood}
              onAsk={setConfirm}
              onClose={goBack}
              onError={setError}
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

      {/* Details from the database or the shopping list search, over the list (kept mounted). */}
      {(view === 'foods' || (view === 'shopping' && shoppingSearch)) && catalogDetail?.kind === KIND_FOODS && (
        <FoodInfo food={catalogDetail.entry} onClose={goBack} />
      )}
      {(view === 'foods' || (view === 'shopping' && shoppingSearch)) && catalogDetail?.kind === KIND_RECIPES && (
        <RecipeInfo
          recipe={catalogDetail.entry}
          variationId={catalogDetail.variationId}
          copying={catalogDetail.copying}
          onSelectVariation={(variationId) => updateCatalogDetail({ variationId })}
          onCopying={(copying) => updateCatalogDetail({ copying })}
          onCopy={copyDetailRecipe}
          onClose={goBack}
        />
      )}

      {/* Adds foods to the recipe editor, the booking view or the task form. Recipes cannot
          contain recipes, and tasks book foods only, so this search only offers foods. */}
      {recipeSearch && (
        <FoodSearch
          visible={!recipeSearch.previewing && !detail}
          version={catalogVersion}
          kindLocked
          draftCount={recipeSearch.entries.length}
          submitLabel="Hinzufügen"
          closeLabel={SEARCH_CLOSE_LABELS[recipeSearch.target]}
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
          initial={detail.initial}
          confirmLabel={detail.mode === 'set' || detail.mode === 'task-set' ? 'Übernehmen' : 'Hinzufügen'}
          onConfirm={detailActions[detail.mode]}
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
    clearCatalogCache()
    setAuth(LOGGED_OUT)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logOutLocally)
  }, [logOutLocally])

  // The account's color theme once it is known; before that the one remembered on the device.
  const colorTheme = auth.user?.colorTheme ?? null
  useEffect(() => {
    applyColorTheme(colorTheme ?? storedColorTheme())
  }, [colorTheme])

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
    clearCatalogCache()
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
