# REST API

[English](api.md) | [Deutsch](de/api.md)

The API uses JSON and has no prefix beyond `/api`. Write operations are validated with Bean Validation. `GlobalExceptionHandler` creates error responses centrally.

## Foods

Base route: `/api/foods`

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/foods` | List foods; optionally search with `?query=...` |
| `GET` | `/api/foods/{id}` | Get one food |
| `POST` | `/api/foods` | Create a food; returns `201 Created` |
| `PUT` | `/api/foods/{id}` | Replace a food |
| `DELETE` | `/api/foods/{id}` | Delete a food; returns `204 No Content` |

Example for `POST` or `PUT`:

```json
{
  "name": "Apple",
  "kcalPer100g": 52,
  "protein": 0.3,
  "carbs": 14,
  "fat": 0.2
}
```

Nutrition values cannot be negative. The name is required and limited to 100 characters.

## Meals

Base route: `/api/meals`

| Method | Route | Behavior |
| --- | --- | --- |
| `GET` | `/api/meals` | List meals |
| `POST` | `/api/meals` | Create a meal; returns `201 Created` |
| `PUT` | `/api/meals/{id}` | Replace a meal |
| `DELETE` | `/api/meals/{id}` | Delete a meal; returns `204 No Content` |
| `DELETE` | `/api/meals` | Delete all meals; returns `204 No Content` |

Example for `POST` or `PUT`:

```json
{
  "title": "Breakfast",
  "items": [
    { "foodId": 1, "amountG": 150 },
    { "foodId": 2, "amountG": 40 }
  ]
}
```

The title is required, the items list cannot be empty, and each amount must be positive. Meal responses include fields such as `id`, `title`, `bookedAt`, `kcal`, and `items`.