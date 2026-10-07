# Tests und CI

Vitest prüft Simulation und Render-Logik (`tests/`), Playwright das Spiel im Browser (`e2e/`, Desktop und Handy
„Pixel 7“, Software-WebGL über SwiftShader). Befehle und Regeln fürs gezielte Testen: [CLAUDE.md](../CLAUDE.md).

## Aufbau der CI (`.github/workflows/ci.yml`)

| Job | Wann | Inhalt |
|-----|------|--------|
| `unit` | jeder Push auf einen PR, „Run workflow“ | `npm test`, `npm run build` |
| `build` | PR kein Entwurf (mehr), „Run workflow“ | `npm run build` einmal für alle Shards, `dist/` als Artefakt (parallel zu `unit`) |
| `e2e light 1/12 … 12/12` | ebenso, nach `build` | alle leichten Specs, auf 12 Shards verteilt |
| `e2e heavy 1/3 … 3/3` | ebenso | die schweren Specs (siehe unten) in eigenen Shards |
| `e2e-report` | nach allen E2E-Jobs, auch bei Fehlern | führt die Blob-Berichte zu einem HTML-Bericht zusammen (Artefakt `playwright-report`) |

- Die E2E-Jobs bauen nicht selbst: sie laden `dist/` aus dem `build`-Job (`E2E_PREBUILT=1` → nur `vite preview`).
- Die Shards laufen im Container `mcr.microsoft.com/playwright:v<Version>-noble`: Browser und Systembibliotheken sind
  dort schon installiert (per `apt` dauerte das bis zu 10 min). **Beim Update von `@playwright/test` den Tag in
  `ci.yml` mitziehen.**
- Je Runner **ein** Worker (`workers: 1` bei `CI`): zwei SwiftShader-Browser auf einer Maschine bremsen sich
  gegenseitig bis in Zeitüberschreitungen. Parallelität kommt aus den Shards; `fullyParallel` verteilt einzelne Tests
  (nicht ganze Dateien) auf die Shards.
- `fail-fast: false`: ein roter Shard bricht die anderen nicht ab. Bei Fehlern lädt jeder Shard `test-results/`
  (Screenshots, Fehlerkontext, Trace) als `test-results-<shard>` hoch.
- Ein neuer Push bricht den laufenden Lauf desselben PRs ab.

## Gruppen und Projekte (`playwright.config.js`)

- **Schwer** (`HEAVY`): `cavalry`, `circle`, `figures`, `showcase`, `spots`, `update`, `winter` – hohe Grafikstufe, die
  Schaukasten-Karte oder ein zweiter Build (`update`: Deploy-Simulation), Minuten je Test. `E2E_GROUP=heavy` wählt nur sie, `E2E_GROUP=light` alle anderen, ohne Variable
  läuft alles.
- **Nur Desktop** (`DESKTOP_ONLY`, dieselben sieben Specs): sie prüfen Darstellung oder Simulation ohne Handy-Bezug
  (kein Touch, kein Hochformat-Layout). Alles mit Touch, Hochformat oder Handy-Panels läuft in beiden Projekten.
  `E2E_ALL_PROJECTS=1` nimmt sie für Belegbilder auch ins Handy-Projekt.
- Belegbilder-Specs (`circle`, `spots`, `showcase`) prüfen den Zustand, nicht die Pixel: sie laufen auf der Stufe
  `E2E_SHOT_QUALITY` (Standard `low`); schöne Bilder mit `E2E_SHOT_QUALITY=high`.

## Lokal

```bash
E2E_PORT=4310 npx playwright test e2e/hud.spec.js:223 --project=desktop --workers=1
E2E_GROUP=heavy E2E_PORT=4310 npx playwright test --workers=1     # nur die schweren Specs
```

## Schnelle, stabile E2E-Tests schreiben

- Spielzeit läuft in Echtzeit (auch bei langsamen Bildern, `src/game/loop.js`): Computergegner bauen, Figuren laufen,
  das erste Autosave kommt nach 30 Spielsekunden. Zählungen auf den eigenen Spieler beschränken
  (`e.owner === window.__kronland.player`), für Klick- oder Bildvergleiche das Spiel anhalten (`paused = true`),
  Autosave abschalten, wenn Spielstand-Listen gezählt werden.
- Kein `quality=high`, wenn nicht Modelle oder Effekte dieser Stufe geprüft werden; kleines Fenster
  (`page.setViewportSize`), wenn nur der Bildmittelpunkt oder der Zustand zählt.
- Bildschirmpunkte (Klick, Auswahlrahmen) gelten nur, solange die Kamera steht: vorher die Maus auf die Karte setzen
  (`page.mouse.move(Mitte)`). Playwrights Maus startet bei (0, 0) im Randscroll-Streifen; ein vom Browser
  erzeugtes `pointermove` dort schiebt die Kamera nach links oben (`e2e/multiselect.spec.js`).
- Auf Zustände warten (`waitForFunction`, `expect.poll`), nicht auf feste Zeiten; Befehle, die erst im nächsten Tick
  wirken (Debugger-Schritte), einzeln abwarten.
