import { useCallback, useEffect, useId, useRef, useState } from 'react'
import './App.css'
import {
  API,
  clearToken,
  loadToken,
  request,
  saveToken,
  setUnauthorizedHandler,
} from './api.js'

const SEARCH_PARAM = 'query'

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
// Entries are { food, amountG, baseG }. baseG is the amount already saved in the meal,
// so amountG - baseG is what the preview shows as "+X g".
const NEW_DRAFT = { mealId: null, entries: [] }

const NEW_FOOD = { id: null }

function fetchFoods(query, signal) {
  const search = query.trim()
  const url = search ? `${API.foods}?${SEARCH_PARAM}=${encodeURIComponent(search)}` : API.foods
  return request(url, { signal })
}

// Records without an id yet are created (POST), existing ones are replaced (PUT /{id}).
function createOrUpdate(url, id, data) {
  const body = JSON.stringify(data)
  return id === null
    ? request(url, { method: 'POST', body })
    : request(`${url}/${id}`, { method: 'PUT', body })
}

function mealRequest(entries) {
  return {
    title: makeTitle(entries.map((entry) => entry.food.name)),
    items: entries.map((entry) => ({ foodId: entry.food.id, amountG: entry.amountG })),
  }
}

const roundToOneDecimal = (n) => Math.round(n * 10) / 10

const toText = (value) => String(value ?? '')

// e.g. "Apfel, Banane, Brot +2"
function makeTitle(names) {
  const shown = names.slice(0, 3).join(', ')
  const hiddenCount = names.length - 3
  const title = hiddenCount > 0 ? `${shown} +${hiddenCount}` : shown
  return title.slice(0, MAX_TITLE_LENGTH)
}

function addAmount(entries, food, amountG) {
  if (!entries.some((entry) => entry.food.id === food.id)) {
    return [...entries, { food, amountG, baseG: 0 }]
  }
  return entries.map((entry) =>
    entry.food.id === food.id
      ? { ...entry, amountG: roundToOneDecimal(entry.amountG + amountG) }
      : entry,
  )
}

// Meal items only carry the kcal of their amount, so the value per 100 g is derived from it.
function entryFromMealItem(item) {
  const kcalPer100g = item.amountG > 0 ? (item.kcal / item.amountG) * 100 : 0
  return {
    food: { id: item.foodId, name: item.foodName, kcalPer100g },
    amountG: item.amountG,
    baseG: item.amountG,
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" {...iconProps} strokeWidth={2.4}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

// Foods matching `query`, loaded once typing pauses. Returns [foods, reload].
// onError must be stable (e.g. a state setter), otherwise every render restarts the request.
function useFoods(query, onError) {
  const [foods, setFoods] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setFoods(await fetchFoods(query, controller.signal))
        onError(null)
      } catch (error) {
        if (!controller.signal.aborted) onError(error.message)
      }
    }, SEARCH_DELAY_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, reloadKey, onError])

  const reload = () => setReloadKey((key) => key + 1)
  return [foods, reload]
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

function TopBar({ title, closeLabel, onClose, centered = false }) {
  return (
    <div className={centered ? 'topbar centered' : 'topbar'}>
      <CrossButton label={closeLabel} onClick={onClose} />
      <h1>{title}</h1>
    </div>
  )
}

function SearchBar({ query, onQueryChange, closeLabel, onClose, children }) {
  return (
    <div className="search">
      <CrossButton label={closeLabel} onClick={onClose} />
      <input
        type="search"
        placeholder="Lebensmittel suchen"
        aria-label="Lebensmittel suchen"
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {children}
    </div>
  )
}

function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }) {
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
          <button type="button" className="btn danger" onClick={onConfirm}>
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

function FoodSearch({
  visible,
  draftCount,
  submitLabel,
  onOpenFood,
  onAddFood,
  onPreview,
  onSubmit,
  onClose,
  onError,
}) {
  const [query, setQuery] = useState('')
  const [foods] = useFoods(query, onError)

  return (
    <section hidden={!visible}>
      <SearchBar query={query} onQueryChange={setQuery} closeLabel="Abbrechen" onClose={onClose} />
      {foods.length === 0 ? (
        <p className="empty">Kein Lebensmittel gefunden.</p>
      ) : (
        <div className="rows">
          {foods.map((food) => (
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

function FoodSearchRow({ food, onOpen, onAdd }) {
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!justAdded) return
    const timer = setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [justAdded])

  function add() {
    onAdd(food, DEFAULT_AMOUNT_G)
    setJustAdded(true)
  }

  return (
    <div className="row">
      <button type="button" className="row-open wrap" onClick={() => onOpen(food)}>
        <span className="main">
          <span className="name">{food.name}</span>
          <span className="sub">
            <KcalPer100g kcal={food.kcalPer100g} />
          </span>
        </span>
        <span className="amount">{`${DEFAULT_AMOUNT_G} g`}</span>
      </button>
      <button type="button" className="add" aria-label={`${food.name} hinzufügen`} onClick={add}>
        {justAdded ? '✓' : '+'}
      </button>
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

function FoodDatabase({ formFood, onFormChange, onClose, onError }) {
  const [query, setQuery] = useState('')
  const [foods, reloadFoods] = useFoods(query, onError)
  const runAction = useActionRunner(onError)

  function saveFood(id, values) {
    runAction(async () => {
      await createOrUpdate(API.foods, id, values)
      onFormChange(null)
      reloadFoods()
      onError(null)
    })
  }

  return (
    <>
      {/* Only hidden while the form is open, so the search survives. */}
      <section hidden={formFood !== null}>
        <SearchBar query={query} onQueryChange={setQuery} closeLabel="Schließen" onClose={onClose}>
          <button
            type="button"
            className="add"
            title="Lebensmittel hinzufügen"
            aria-label="Lebensmittel hinzufügen"
            onClick={() => onFormChange(NEW_FOOD)}
          >
            <PlusIcon />
          </button>
        </SearchBar>
        {foods.length === 0 ? (
          <p className="empty">Kein Lebensmittel gefunden.</p>
        ) : (
          <div className="rows">
            {foods.map((food) => (
              <FoodDatabaseRow key={food.id} food={food} onOpen={onFormChange} />
            ))}
          </div>
        )}
      </section>
      {formFood !== null && (
        <FoodForm food={formFood} onSave={saveFood} onClose={onClose} />
      )}
    </>
  )
}

function FoodDatabaseRow({ food, onOpen }) {
  return (
    <div className="row">
      <button type="button" className="row-open" onClick={() => onOpen(food)}>
        <span className="main">
          <span className="name">{food.name}</span>
          <span className="sub">
            <KcalPer100g kcal={food.kcalPer100g} />
          </span>
        </span>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  )
}

function FoodForm({ food, onSave, onClose }) {
  const isNew = food.id === null
  const [name, setName] = useState(toText(food.name))
  const [kcal, setKcal] = useState(toText(food.kcalPer100g))
  const [protein, setProtein] = useState(toText(food.protein))
  const [carbs, setCarbs] = useState(toText(food.carbs))
  const [fat, setFat] = useState(toText(food.fat))

  // Field names as the backend expects them.
  const values = {
    name: name.trim(),
    kcalPer100g: parseFloat(kcal),
    protein: parseFloat(protein),
    carbs: parseFloat(carbs),
    fat: parseFloat(fat),
  }
  const numbers = [values.kcalPer100g, values.protein, values.carbs, values.fat]
  // An empty field parses to NaN, and NaN >= 0 is false.
  const isValid = values.name !== '' && numbers.every((n) => n >= 0)

  function submit(event) {
    event.preventDefault()
    if (isValid) onSave(food.id, values)
  }

  return (
    <section>
      <TopBar
        title={isNew ? 'Lebensmittel hinzufügen' : 'Lebensmittel bearbeiten'}
        closeLabel="Schließen"
        onClose={onClose}
      />
      <form onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            autoFocus
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
        <div className="bar">
          <button type="submit" className="btn primary" disabled={!isValid}>
            Speichern
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
      <p className="profile-email">{user.email}</p>

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
  409: 'Für diese E-Mail-Adresse gibt es schon ein Konto.',
}

// fetch() itself throws (without status) when the server cannot be reached at all.
function authErrorMessage(error, url) {
  if (error.status === undefined) return 'Der Server ist nicht erreichbar.'
  if (error.status === 403 && url === API.login) return 'Dieses Konto ist deaktiviert.'
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
function LoginPage({ onLoggedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState(null)
  const runAction = useActionRunner(setError)

  const hasCredentials = email.trim() !== '' && password !== ''

  function authenticate(url) {
    runAction(async () => {
      let response
      try {
        response = await request(url, {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password }),
        })
      } catch (error) {
        throw new Error(authErrorMessage(error, url))
      }
      await onLoggedIn(response.token, response.user)
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
          <span>E-Mail-Adresse</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
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
// While anything above the main view is shown, one extra history entry sits on
// top of the app's entry; pressing back removes it and runs goBack instead.
function useBackNavigation(isNested, goBack) {
  const [hasEntry, setHasEntry] = useState(false)
  const hasEntryRef = useRef(false) // hasEntry for the unmount cleanup below
  const isRemovingEntry = useRef(false) // true while our own history.back() is in flight
  const goBackRef = useRef(goBack)

  useEffect(() => {
    goBackRef.current = goBack
    hasEntryRef.current = hasEntry
  })

  // Unmounted while a nested view is open (e.g. logout from the profile): remove the extra
  // entry as well, otherwise the next back press on the login page would do nothing.
  useEffect(() => {
    return () => {
      if (hasEntryRef.current) history.back()
    }
  }, [])

  useEffect(() => {
    function onPopState() {
      setHasEntry(false)
      if (isRemovingEntry.current) isRemovingEntry.current = false
      else goBackRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
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
  const [detail, setDetail] = useState(null) // null or { food, mode: 'add' | 'set', amountG }
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)
  const [foodForm, setFoodForm] = useState(null) // food shown in the food database form
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

  function startNewMeal() {
    setDraft(NEW_DRAFT)
    setView('search')
  }

  function editMeal(meal) {
    setDraft({ mealId: meal.id, entries: meal.items.map(entryFromMealItem) })
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

  function openEntryDetail(entry) {
    setDetail({ food: entry.food, mode: 'set', amountG: entry.amountG })
  }

  function addFromDetail(food, amountG) {
    addToDraft(food, amountG)
    setDetail(null)
  }

  function deleteMeal(id) {
    runAction(async () => {
      await request(`${API.meals}/${id}`, { method: 'DELETE' })
      await loadMeals()
    })
  }

  function deleteAllMeals() {
    runAction(async () => {
      setConfirmingDeleteAll(false)
      await request(API.meals, { method: 'DELETE' })
      await loadMeals()
    })
  }

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
    if (confirmingDeleteAll) setConfirmingDeleteAll(false)
    else if (detail) setDetail(null)
    else if (foodForm) setFoodForm(null)
    else if (view === 'preview') setView('search')
    else if (view === 'search' || view === 'edit') discardDraft()
    else if (view === 'foods') closeFoods()
    else if (view === 'profile') closeProfile()
  }

  useBackNavigation(view !== 'list' || detail !== null || confirmingDeleteAll, goBack)

  return (
    <main className="app">
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {view === 'list' && (
        <MealList
          meals={meals}
          onAdd={startNewMeal}
          onEdit={editMeal}
          onDelete={deleteMeal}
          onDeleteAll={() => setConfirmingDeleteAll(true)}
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

      {/* Stays mounted (only hidden) under the preview and the detail view,
          so the search text and results survive. */}
      {(view === 'search' || view === 'preview') && (
        <FoodSearch
          visible={view === 'search' && !detail}
          draftCount={draft.entries.length}
          submitLabel={isEditing ? 'Mahlzeit speichern' : 'Mahlzeit hinzufügen'}
          onOpenFood={openFoodDetail}
          onAddFood={addToDraft}
          onPreview={() => setView('preview')}
          onSubmit={submitMeal}
          onClose={goBack}
          onError={setError}
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

      {detail && (
        <FoodDetail
          food={detail.food}
          initialAmountG={detail.amountG}
          confirmLabel={detail.mode === 'add' ? 'Hinzufügen' : 'Übernehmen'}
          onConfirm={detail.mode === 'add' ? addFromDetail : saveEntryAmount}
          onClose={goBack}
        />
      )}

      {view === 'foods' && (
        <FoodDatabase
          formFood={foodForm}
          onFormChange={setFoodForm}
          onClose={goBack}
          onError={setError}
        />
      )}

      {confirmingDeleteAll && (
        <ConfirmDialog
          title="Alle Mahlzeiten löschen?"
          text={`Alle ${meals.length} gebuchten Mahlzeiten werden endgültig gelöscht.`}
          confirmLabel="Alle löschen"
          onConfirm={deleteAllMeals}
          onClose={goBack}
        />
      )}
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
      if (!(await loadToken())) {
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

  async function logIn(token, user) {
    await saveToken(token)
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
