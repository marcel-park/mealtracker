# REST-API

[English](../api.md) | [Deutsch](api.md)

Die API verwendet JSON und hat kein zusätzliches Präfix außer `/api`. Schreiboperationen werden mit Bean Validation geprüft. Fehlerantworten werden zentral durch `GlobalExceptionHandler` erzeugt.

## Lebensmittel

Basisroute: `/api/foods`

| Methode | Route | Verhalten |
| --- | --- | --- |
| `GET` | `/api/foods` | Alle Lebensmittel auflisten; optional mit `?query=...` suchen |
| `GET` | `/api/foods/{id}` | Einzelnes Lebensmittel abrufen |
| `POST` | `/api/foods` | Lebensmittel anlegen; antwortet mit `201 Created` |
| `PUT` | `/api/foods/{id}` | Lebensmittel ersetzen |
| `DELETE` | `/api/foods/{id}` | Lebensmittel löschen; antwortet mit `204 No Content` |

Beispiel für `POST` oder `PUT`:

```json
{
  "name": "Apfel",
  "kcalPer100g": 52,
  "protein": 0.3,
  "carbs": 14,
  "fat": 0.2
}
```

Nährwerte sind nicht negativ; der Name darf höchstens 100 Zeichen lang und nicht leer sein.

## Mahlzeiten

Basisroute: `/api/meals`

| Methode | Route | Verhalten |
| --- | --- | --- |
| `GET` | `/api/meals` | Mahlzeiten auflisten |
| `POST` | `/api/meals` | Mahlzeit anlegen; antwortet mit `201 Created` |
| `PUT` | `/api/meals/{id}` | Mahlzeit ersetzen |
| `DELETE` | `/api/meals/{id}` | Mahlzeit löschen; antwortet mit `204 No Content` |
| `DELETE` | `/api/meals` | Alle Mahlzeiten löschen; antwortet mit `204 No Content` |

Beispiel für `POST` oder `PUT`:

```json
{
  "title": "Frühstück",
  "items": [
    { "foodId": 1, "amountG": 150 },
    { "foodId": 2, "amountG": 40 }
  ]
}
```

Der Titel muss angegeben sein, die Liste der Einträge darf nicht leer sein und jede Menge muss positiv sein. Mahlzeitenantworten enthalten unter anderem `id`, `title`, `bookedAt`, `kcal` und `items`.