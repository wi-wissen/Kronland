# Website: Startseite, Spiel, Handbuch, Kompendium

Der Build ist eine kleine statische Website (Vite Multi-Page, `base: './'`, alle Pfade relativ – in jedem
Unterordner hostbar):

| Adresse | Datei | Inhalt | Code |
|---|---|---|---|
| `./` | `index.html` | Startseite (Titelbild, Funktionen, Galerie, „Für die Schule“, Danksagung) | `src/site/home/` |
| `play/` | `play/index.html` | das Spiel | `src/main.js`, `src/ui/` … |
| `manual/` | `manual/index.html` | Handbuch DE/EN | `src/site/manual/` |
| `compendium/` | `compendium/index.html` | Kompendium: alle Werte und Formeln, aus den Spieldaten erzeugt | `src/site/compendium/` |

**Adressen sind englisch** (wie bei Spielen üblich: `play/`, `manual/`, `compendium/`), die Seiten selbst zweisprachig.
Das Kompendium hieß früher „Wiki“; umbenannt, weil niemand mitschreibt – es ist ein Nachschlagewerk, das aus den
Spieldaten entsteht.

Eine neue Seite: HTML-Datei anlegen (Kopf wie die vorhandenen, `window.KRONLAND_ROOT` = Weg zur Wurzel) und in
`PAGES` in `vite.config.js` eintragen.

## Gemeinsamer Unterbau (`src/site/`)

- `site.js` – `mountPage(Komponente)`: Sprache, `$s()` (Website-Texte), `$t()`/`$name` (Spieltexte), `$links`, `$siteRoot`.
  Sprache wie im Spiel aus `localStorage['kronland-lang']`, sonst Browsersprache (nicht gespeichert); die
  Umschaltung in der Kopfzeile speichert und gilt damit auch fürs Spiel.
- `SiteLayout.vue` – Kopfzeile (Startseite · Spielen · Handbuch · Kompendium · DE/EN) und Fußzeile mit Danksagung.
- `strings.js` – Texte der Website (DE/EN, gleiche Schlüssel; Test in `tests/site/site.test.js`).
- `site.css` – baut auf den Tokens aus `src/ui/style.css` auf; Lesetext auf Pergament (`.prose`), Druckansicht.
- `markdown.js` – kleiner Markdown-Umsetzer (Überschriften mit `{#id}`, Listen, Tabellen, `> Hinweis`,
  Codeblöcke mit ```` ``` ````, Bilder, `**fett**`, `*kursiv*`, `` `Code` ``, `[[Taste]]` → `<kbd>`, Platzhalter `{{name}}`).
- `SiteIcon.vue`, `icons.js` – Spielsymbole wie im Spiel: bunte aus dem Atlas `public/icons/symbols.webp`
  (`docs/SYMBOLE.md`, auch in den `v-html`-Tabellen des Kompendiums), Bediensymbole als SVG-Maske; ohne die
  PNG-Umrechnung des Spiels.

## Pfade zur Wurzel (`src/paths.js`)

Modelle, Ton, Service-Worker und Website-Bilder liegen in der Wurzel. `siteUrl('models/')` liefert den Pfad
relativ zur aktuellen Seite (`play/` → `../models/`). Jede Seite setzt dafür vor ihren Skripten
`window.KRONLAND_ROOT` (`play/index.html`: `'../'`). Ein Host kann den Wert vorher selbst setzen – genau wie
`window.KRONLAND_MODEL_EXT` (z. B. `'.json'` für Hosts ohne `.glb`).

## PWA

Das Manifest liegt in der Wurzel mit `start_url`/`scope` = `play/` und wird nur in `play/index.html` verlinkt
(Plugin `kronland:page-paths` in `vite.config.js`). Den Service-Worker registriert das Spiel selbst
(`src/pwa.js`, Geltungsbereich Website-Wurzel). Ersatzseite für Navigationen ist abgeschaltet
(`navigateFallback: null`), damit `/play/` nie die Startseite bekommt; Seiten sind vorab gecacht und werden
mit `autoUpdate` beim nächsten Laden erneuert. URL-Parameter zählen beim Abgleich mit dem Vorab-Cache nicht
(`ignoreURLParametersMatching`), damit `play/?seed=42&dev=1` auch offline startet. Website-Bilder (`site/`)
werden erst bei Bedarf gecacht.

Alle Dateien aus `public/` (Modelle, Texturen, Ton, Bilder) bekommen im Build einen Inhalts-Hash im Namen und
werden nach dem ersten Laden nie wieder angefragt; eine geänderte Datei lädt als einzige neu. Ablauf, Cache-
Strategie und gemessene Datenmengen: [PERFORMANCE.md](PERFORMANCE.md).

## Handbuch erweitern

Text: `src/site/manual/de.md` und `en.md`. Jedes Kapitel beginnt mit `## Titel {#id}` – **dieselbe ID in
beiden Sprachen** (Deep-Links bleiben beim Sprachwechsel gültig; ein Test prüft das). Inhaltsverzeichnis und
Suche entstehen aus den Überschriften (`##`, `###`).

- Zahlen aus den Spieldaten nicht abschreiben, sondern als Platzhalter `{{name}}` nutzen; neue Platzhalter in
  `src/site/manual/vars.js` ergänzen (z. B. `{{paydaySec}}`, `{{taxTable}}`, `{{campaignList}}`, `{{adventureList}}`, `{{thiefCost}}`).
- Bilder: `![Beschreibung](site/datei.webp)` – die Beschreibung wird zur Bildunterschrift und zum Alt-Text.
- Große Bildschirmfotos mit kleiner Fassung (`SMALL_SHOTS` in `content.js`) bekommen automatisch `srcset` (720/1440 px).
- Sonderzeichen wörtlich: `\*` (z. B. `A\*-Suche`), `\_`, `\[`.
- Kapitel (gleiche IDs DE/EN): erste-schritte, bedienung, oberflaeche, siedlung, wirtschaft, arbeiter, forschung,
  militaer, bruecken (Brücken, Brunnen, Denkmal), wetter, nebel, hang, kampagne, freies-spiel,
  speichern, programmieren (Programmier-Abenteuer, Code-Panel, Welteneditor), entwicklermodus, tipps, faq, lizenzen.
- Verweise ins Kompendium: `[Text](compendium/#b-farm)`, auf Kapitel: `[Text](#economy)`.
- Die Danksagung kommt aus `CREDITS.md` (Platzhalter `{{credits}}`).

## Kompendium erweitern

Das Kompendium wird zur Laufzeit aus den Datenmodulen erzeugt (`src/site/compendium/generate.js`): `BUILDINGS`, `UNITS`,
`LINES`, `HEROES`, `TECHS`, `BUILDING_TECHS`, `RESOURCES`, `PROFESSIONS`, `BLESSINGS`, `BALANCE`, `WORKER`,
`MARKET`, `VISION`, `WEATHER_*` (Wirkungen in `WEATHER_EFFECTS`, von Simulation und Kompendium gelesen), `EXPERIENCE`,
`DAMAGE`, `DIFFICULTY`/`BUILD_PLAN` der KI, `MAP_SIZES`. „Bauen am Hang“ rechnet sein Beispiel mit `levelSite()`
aus `src/sim/systems/terrain.js` – Formeländerungen dort erscheinen sofort im Kompendium.
Neue Einträge in diesen Daten erscheinen **ohne Änderung** – mit Namen aus i18n (`building.<typ>.<stufe>`,
`unit.<id>` …), sonst dem deutschen Namen aus der Datendatei. Neue Zahlenfelder (z. B. ein weiteres Feld je
Gebäudestufe) bekommen eine eigene Spalte; ihren Anzeigenamen trägt man in `KEYS` in `texts.js` ein.

- Neuer Bereich: Funktion `xyzSection(lang, names, f)` in `generate.js` schreiben und in `SECTIONS` eintragen;
  Titel `sec.xyz` und Einleitung in `texts.js` (DE und EN).
- Bausteine: `{ type: 'table', id, caption, cols, rows }`, `{ type: 'facts', items }`, `{ type: 'md', text }`.
  Zellen: Text, `{ t, href, icon, cls }`, `{ cost }` (Rohstoffe mit Symbolen), `{ list }`.
- Anker: Bereich `#buildings`, Gebäude `#b-<typ>`, Gattung `#u-<linie>`, Einheit `#unit-<id>`, Held `#h-<id>`,
  Technologie `#t-<id>`, Rohstoff `#r-<id>`, Beruf `#p-<id>` – Tabellenzeilen mit Anker werden beim Anspringen markiert.
- Robust gegen neue Daten: fehlende Felder erscheinen als „–“, unbekannte Arten (z. B. eine neue Angriffsart
  `atk.fire`) mit ihrer Datenkennung, bis man ihnen in `texts.js` einen Namen gibt.
- Tests (`tests/site/compendium.test.js`) prüfen, dass jeder Datensatz einen Eintrag hat, keine Zelle leer/`NaN` ist
  und alle internen Verweise auf vorhandene Anker zeigen. Ein Test fügt probeweise Gebäude, Einheiten, Held und
Technologie wie aus einem Addon hinzu und prüft, dass sie ohne Codeänderung erscheinen.

## Bildschirmfotos

`python3 scripts/site-screens.py http://localhost:4301 [filter]` nimmt die Bilder für Startseite und Handbuch
aus dem laufenden Spiel auf (Vorschau-Server mit aktuellem Build; Desktop 1440×900, Grafikstufe hoch, plus
Handy) und legt sie als WebP unter `public/site/` ab (`<name>.webp`, Galerie zusätzlich `<name>-small.webp`,
HUD-Ausschnitte `hud-*.webp`). Mit SwiftShader dauert das einige Minuten. Filter z. B. `kampf,winter`.
Motive: `hero`, `settlement`, `hud-*`, `combat`, `hud-armee`, `winter`, `fog`, `slope` (gelbe Bauvorschau),
`developer` (A*-Suche), `programming` (Code-Panel am Haltepunkt), `phone`. Ein Test begrenzt die Dateigröße (Galerie ≤ 120 kB, groß ≤ 300 kB).
