# Mealtracker auf dem iPhone

iOS-Apps lassen sich nur auf macOS mit Xcode bauen, unter Linux geht das nicht. Darum baut
GitHub Actions die App auf einem macOS-Rechner (`.github/workflows/ios.yml`). Unter Linux wird die
fertige `.ipa` nur noch signiert und per USB auf das iPhone gebracht.

```
Linux (Code)  ──push──▶  GitHub Actions, macOS + Xcode  ──.ipa──▶  Linux: Impactor  ──USB──▶  iPhone
```

## Was du brauchst

| Was | Wofür | Kosten |
|---|---|---|
| GitHub-Repository mit Actions | baut die App auf macOS | öffentliches Repo: frei; privat: macOS-Minuten zählen zehnfach (Free-Plan: 2.000 min ≈ 200 macOS-min/Monat, ein Build dauert etwa 5–10 min) |
| Apple-ID | signiert die App für dein iPhone | kostenlos (Einschränkungen siehe unten) |
| [Impactor](https://github.com/khcrysalis/impactor) | signiert und installiert die `.ipa` unter Linux | kostenlos, Open Source |
| `usbmuxd` | USB-Verbindung zum iPhone | Arch-Paket |
| USB-Kabel | | |

Android Studio, Xcode, CocoaPods oder ein Mac sind dafür nicht nötig.

## Einmalig einrichten

### 1. Abhängigkeiten installieren und iOS-Projekt synchronisieren

Das Xcode-Projekt (`frontend/ios/`) ist schon angelegt. In `package.json` ist nur
`@capacitor/ios` neu dazugekommen, deshalb:

```bash
cd frontend
npm install                 # aktualisiert package-lock.json, die muss mit committet werden
npm run build
npx cap sync ios            # schreibt die Plugins in ios/App/CapApp-SPM/Package.swift
```

`cap sync ios` warnt unter Linux eventuell, dass `xcodebuild` fehlt. Das kannst du ignorieren.
Danach `frontend/ios/`, `package.json` und `package-lock.json` committen. Ohne die aktualisierte
`package-lock.json` bricht `npm ci` im Workflow ab.

### 2. Backend neu deployen

Die iOS-App ruft den Server von der Herkunft `capacitor://localhost` aus auf, die Android-App von
`http://localhost`. `CorsConfig` erlaubt jetzt beide. Solange der laufende Server noch die alte
Version ist, scheitert in der iOS-App jede Anfrage („Die Anfrage ist fehlgeschlagen“).

### 3. Linux vorbereiten (Arch)

```bash
sudo pacman -S usbmuxd libimobiledevice
flatpak install flathub dev.khcrysalis.PlumeImpactor
```

`ideviceinfo` zeigt bei angestecktem und entsperrtem iPhone die Gerätedaten an. Auf dem iPhone
musst du dafür einmal „Diesem Computer vertrauen“ bestätigen.

### 4. iPhone vorbereiten

- **Entwicklermodus:** Einstellungen → Datenschutz & Sicherheit → Entwicklermodus → an.
  Das iPhone startet danach neu. Der Menüpunkt erscheint manchmal erst, nachdem einmal eine
  App installiert wurde. Dann installieren, einschalten und nochmal installieren.

## Bauen

1. Pushen, dann auf GitHub: **Actions → iOS build → Run workflow** (Branch auswählen).
2. Nach dem Lauf unten bei **Artifacts** `Mealtracker-ios` herunterladen und entpacken. Darin
   liegt `Mealtracker-unsigned.ipa`.

Optional legst du unter Settings → Secrets and variables → Actions → **Variables** die Variable
`VITE_API_BASE_URL` an (wie in `.env.example`). Dann ist die Serveradresse auf der Login-Seite
schon vorausgefüllt.

## Aufs iPhone bringen

1. iPhone per USB anstecken und entsperren, **danach** Impactor starten. Unter Linux erkennt
   Impactor das Gerät sonst manchmal nicht, weil `usbmuxd` ohne Gerät beendet wird.
2. In Impactor mit deiner Apple-ID anmelden. Eine eigene Apple-ID nur zum Entwickeln geht auch.
3. `Mealtracker-unsigned.ipa` importieren → **Install**.
4. Auf dem iPhone: Einstellungen → Allgemein → VPN & Geräteverwaltung → deine Apple-ID →
   **Vertrauen**.
5. App starten, Serveradresse eingeben (z. B. `http://192.168.0.10:8080`) und die Frage nach dem
   **lokalen Netzwerk** mit „Erlauben“ beantworten. Wenn du sie ablehnst, erreicht die App den
   Server im WLAN nicht mehr: Einstellungen → Mealtracker → Lokales Netzwerk.

Login-Token und Serveradresse liegen in den App-Daten (Capacitor Preferences). Wenn du dieselbe
App neu installierst, bleiben sie erhalten. Erst beim Löschen der App sind sie weg.

## Grenzen der kostenlosen Apple-ID

- Die Signatur ist **7 Tage** gültig, danach startet die App nicht mehr. Dann mit Impactor neu
  installieren. Die Daten bleiben dabei erhalten.
- Höchstens 3 selbst signierte Apps gleichzeitig und wenige neue App-IDs pro Woche.
- HealthKit (Apple Health) lässt sich damit nicht sinnvoll nutzen.

Mit dem **Apple Developer Program** (99 €/Jahr) fallen diese Grenzen weg: Die Signatur gilt ein
Jahr, und die Installation geht über **TestFlight** ohne Kabel. Dafür würde der Workflow um
Signieren und den Upload zu App Store Connect erweitert (Zertifikat und API-Key als
GitHub-Secrets).

## Was auf iOS (noch) nicht geht

- **Barcode-Scanner:** Der Scanner nutzt den `BarcodeDetector` des Browsers. Den gibt es in
  Safari bzw. WKWebView nicht, deshalb blendet die App den Scan-Knopf auf dem iPhone aus
  (`canScanEan`). Für iOS bräuchte es ein natives Scanner-Plugin, z. B.
  `@capacitor-mlkit/barcode-scanning`. Den Kamera-Berechtigungstext gibt es in der `Info.plist`
  schon.
- **Schritte/Workouts:** `healthConnect.js` liest nur Health Connect (Android). Im Profil steht auf
  dem iPhone „Nur in der Android-App verfügbar“. `@capgo/capacitor-health` kann auch HealthKit
  lesen. Dafür bräuchte es die HealthKit-Capability in Xcode, also praktisch den bezahlten
  Account.

## Alternative: mit einem Mac

Falls du doch an einen Mac kommst (eigener Mac mini, geliehen oder gemietet in der Cloud): Xcode 26
installieren, `npx cap open ios`, unter Signing & Capabilities deine Apple-ID als Team wählen,
iPhone anstecken und auf ▶ drücken. GitHub Actions und Impactor brauchst du dann nicht.

## Was für iOS im Projekt geändert wurde

- `frontend/ios/`: Xcode-Projekt aus der Capacitor-8-Vorlage (Swift Package Manager, iOS 15+),
  Bundle-ID `io.github.marcelpark.mealtracker`, App-Icon aus `frontend/assets/`
- `frontend/ios/App/App/Info.plist`: HTTP zu beliebigen Servern (wie `cleartext` auf Android), Text
  für den Zugriff aufs lokale Netzwerk, Kamera- und Health-Texte
- `frontend/capacitor.config.json`: `ios.contentInset: "always"`. Der Inhalt bleibt damit wie auf
  Android zwischen Statusleiste und Home-Balken, ohne dass das CSS geändert werden muss.
- `CorsConfig` + Test: Herkunft `capacitor://localhost`
- `.github/workflows/ios.yml`: Build auf macOS, unsigniertes `.ipa` als Artifact
