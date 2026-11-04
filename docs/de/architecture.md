# Architektur

[English](../architecture.md) | [Deutsch](architecture.md)

## Überblick

Mealtracker besteht aus einer React-Anwendung, einer Spring-Boot-REST-API und MariaDB. Das Frontend kommuniziert über JSON-Endpunkte unter `/api`; im Vite-Entwicklungsmodus wird dieser Pfad an das Backend weitergeleitet. Capacitor kapselt dasselbe Frontend für Android.

## Backend

Der Java-Code liegt unter `src/main/java/io/github/marcel_park/mealtracker` und folgt einer Schichtung:

- `controller`: HTTP-Routen für Lebensmittel und Mahlzeiten
- `dto`: Request- und Response-Datensätze sowie Eingabevalidierung
- `service`: Anwendungslogik und Umrechnung der Mahlzeitenwerte
- `repository`: Datenzugriff mit Spring Data JPA
- `model`: JPA-Entitäten
- `exception`: einheitliche Fehlerantworten und Behandlung nicht gefundener Ressourcen
- `config`: Infrastrukturkonfiguration, unter anderem CORS

Spring Boot startet die Anwendung über `MealtrackerApplication`. Hibernate validiert das Datenbankschema; Flyway verwaltet dessen Versionen.

## Frontend

Der UI-Einstieg ist `frontend/src/main.jsx`; die Anwendungsoberfläche und die API-Aufrufe befinden sich in `frontend/src/App.jsx`. Die Basisadresse der API wird über `VITE_API_BASE_URL` festgelegt. Ist sie leer, verwendet das Frontend dieselbe Origin.

## Hauptabläufe

- Lebensmittel werden über `/api/foods` gesucht und gepflegt.
- Mahlzeiten enthalten Lebensmittel und Mengen in Gramm. Das Backend ermittelt Kalorien aus den Nährwerten und speichert Buchungszeitpunkt sowie Einträge.
- Die Datenbankbeziehungen und Löschregeln sind in den Flyway-Migrationen definiert.