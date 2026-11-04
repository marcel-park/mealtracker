# Datenmodell und Migrationen

[English](../data-model.md) | [Deutsch](data-model.md)

Das Datenbankschema wird mit Flyway unter `src/main/resources/db/migration` fortgeschrieben. Hibernate ist auf `ddl-auto=validate` konfiguriert und erwartet, dass das Schema durch die Migrationen bereits angelegt wurde.

## Entitäten

- `Food`: Name sowie Kalorien, Protein, Kohlenhydrate und Fett pro 100 g.
- `Meal`: Titel und Buchungszeitpunkt.
- `MealItem`: verknüpft eine Mahlzeit mit einem Lebensmittel und speichert die Menge in Gramm. Ein Lebensmittel kommt pro Mahlzeit höchstens einmal vor.

## Beziehungen und Integrität

`meal_item` hat einen zusammengesetzten Primärschlüssel aus `meal_id` und `food_id`. Wird eine Mahlzeit gelöscht, werden ihre Einträge kaskadierend entfernt. Lebensmittel, die bereits in einer Mahlzeit verwendet werden, können wegen `ON DELETE RESTRICT` nicht gelöscht werden. Die Menge muss größer als null sein.

## Migrationen

- `V1__create_food.sql`: legt die Lebensmitteltabelle an.
- `V2__create_meal_tables.sql`: legt Mahlzeiten und ihre Lebensmitteleinträge samt Fremdschlüsseln an.