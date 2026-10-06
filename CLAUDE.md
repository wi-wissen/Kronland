# Kronland – Hinweise für Claude

Aufbau-Strategiespiel im Browser nach dem Gameplay-Vorbild „Die Siedler – Das Erbe der Könige“ (Siedler 5).
Desktop und Handy, Einzelspieler gegen Computergegner, Multiplayer (Lockstep) vorbereitet, aber nicht gebaut.

## Stack
- Reines JavaScript mit JSDoc – **kein TypeScript**.
- Vite, Vue 3 **Options API** (keine Composition API), Three.js, Vitest, Playwright.
- Einstieg: README.md, docs/ARCHITEKTUR.md (Aufbau, Steuerung), docs/SPIELREGELN.md (Mechaniken), docs/MODELLE.md + docs/STIL.md (Figuren).

## Befehle
```bash
npm run dev                 # Entwicklungsserver
npm test                    # Vitest (Simulation, Render-Logik)
npm run build               # Produktionsbuild
E2E_PORT=4310 npx playwright test e2e/<spec>.js   # E2E, Desktop + Handy (Pixel 7)
node scripts/ai-match.js 1 60 hard easy           # KI gegen KI
node scripts/campaign-matrix.js                   # alle Missionen auf mehreren Seeds
node scripts/asset-gen/model.mjs all <id>         # Figur per Meshy (siehe docs/MODELLE.md, docs/STIL.md)
node scripts/asset-gen/music.mjs gen|rate|process  # Musik per Lyria 3 (siehe docs/AUDIO.md#musik-lyria-3)
node scripts/asset-gen/sfx-cc0.mjs                # CC0-Effekte (Kenney, Freesound) schneiden (docs/AUDIO.md)
node scripts/load-report.mjs [szenario]           # geladene Datenmengen messen (nach npm run build, docs/PERFORMANCE.md)
node scripts/assets-src.mjs status|fetch|pack      # Rohdateien in assets-src/ (nur lokal, nicht in Git, docs/ROHDATEIEN.md)
```
In der Cloud-Umgebung nimmt Node-`fetch` den Proxy (und damit die injizierten API-Schlüssel für OpenRouter/Meshy) nur mit `NODE_USE_ENV_PROXY=1`; `curl` geht direkt.
E2E läuft headless über SwiftShader (Software-WebGL) und ist langsam (passt die Playwright-Version nicht zum vorinstallierten Browser: `PW_CHROMIUM=/opt/pw-browsers/chromium`): großzügige Timeouts, nur betroffene Specs laufen lassen, eigenen Port wählen, wenn mehrere Sitzungen parallel testen.

## Feste Regeln
- **Simulation (`src/sim`) ist deterministisch**: nur Ganzzahlen (Milli-Kacheln, `isqrt`), seeded RNG (`src/sim/rng.js`), kein `Math.random`, kein `Date`, fester 100-ms-Tick. Einzige Eingabe sind Befehle. Darstellung und UI lesen den Zustand nur, sie ändern ihn nie direkt. Neuer Sim-Zustand gehört in `src/sim/serialize.js` und in den State-Hash.
- Balance-Werte in `src/sim/data/` (BALANCE, Gebäude, Einheiten …), nicht im Code verstreut – das Wiki liest sie von dort.
- **Alle Texte zweisprachig** über `src/i18n` (de.js, en.js, `t()`); Ablehnungsgründe der Sim sind Codes `err.*`.
- **Handy mitdenken**: Touch, kein Hover, kleine Bildschirme.
- Spieldateien in `public/` immer über `siteUrl()`/`assetUrl()` (`src/paths.js`) adressieren – nur so greift der Inhalts-Hash im Build. Rohdateien der Asset-Pipeline liegen in `assets-src/` **außerhalb von Git** (`.gitignore`), nur lokal beim Maintainer; nichts in Spiel, Tests oder Build darf davon abhängen, Pipeline-Skripte brechen ohne den Ordner mit Hinweis ab (docs/ROHDATEIEN.md).
- **Nur freie (CC0) oder selbst generierte Assets** (eigene Bildgenerierung, Meshy), Herkunft in CREDITS.md; keine gekauften Asset-Pakete. Keine Namen, Texte oder Grafiken aus Siedler – Mechaniken nachbauen ja, Benennung eigen.
- **Sprache:** Code, Bezeichner, Kommentare, Dateinamen, Commit-Nachrichten sowie Titel und Beschreibung von Pull Requests auf **Englisch**. Markdown-Doku (README, docs/, CLAUDE.md) und Spielertexte (Werte in `src/i18n/de.js`, Anzeigenamen in `src/sim/data/`, Handbuch, Blog) bleiben **Deutsch** (Spielertexte zusätzlich englisch in `en.js`). Kompakt schreiben. Neue Funktionen in README/docs nachtragen.
- Neue Logik bekommt Vitest-Tests, sichtbare Funktionen eine Playwright-Spec. Vor dem PR: `npm test` grün, `npm run build` ok, betroffene E2E-Specs grün.

## Arbeitsweise
- Eigener Branch je Aufgabe, Pull Request gegen `main`. Vor dem PR `main` hineinmergen.
- PRs werden per **Squash** in `main` übernommen: ein Commit je PR, der englische PR-Titel ist die Commit-Nachricht.
- Fehlende Punkte selbst erkennen und mit umsetzen; nicht unfertig aufhören.
- Ergebnisse mit Screenshots (Desktop 1440×900 und Handy) belegen.
