import { useEffect, useState } from 'react'

function App() {
  const [foods, setFoods] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/foods')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
      })
      .then(setFoods)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p>Fehler: {error}</p>

  return (
    <div>
      <h1>MealTracker</h1>
      <ul>
        {foods.map((f) => (
          <li key={f.id}>
            {f.name}: {f.kcalPer100g} kcal / 100 g
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App