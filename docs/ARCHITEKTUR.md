# Architektur

```
index.html, play/, manual/, compendium/   Seiten der Website (Vite Multi-Page, siehe WEBSITE.md); das Spiel ist play/
src/
  main.js     Einstieg des Spiels (play/index.html); pwa.js registriert den Service-Worker
  paths.js    siteRoot()/siteUrl(): Pfade zur Website-Wurzel (models/, audio/, sw.js) relativ zur Seite
  site/       Startseite, Handbuch, Kompendium (Vue, gemeinsames Layout; Kompendium erzeugt aus sim/data)
  sim/        Spiellogik: reines JS, kein DOM, kein Three.js, deterministisch
    data/     Balancing-Werte (Gebäude, Rohstoffe, Einheiten, Techs)
    systems/  Ablauf pro Takt (Bauen, Abbau, Zahltag, Gebäude-Forschung, Markt, Wetter, Brand/Reparatur, …)
    reasons.js Ablehnungsgründe der neuen Systeme in einer Tabelle (für i18n-Umstellung)
    missions/ Missionslaufzeit, Tutorial, Kampagne (siehe docs/MISSIONEN.md), scenarios/ (Lernabenteuer)
    scripting/ Python-Skripte in der Simulation: ScriptHost, Spiel-API, Szenario-Format (docs/SKRIPTE.md)
    editor/   Werkzeuge des Welteneditors auf einer Vorschau-Simulation
    world.js  Welten: Zufallskarte, flache Grundkarte, gespeicherte Editor-Karte
  script/     Python-Teilmenge: Lexer, Parser, Compiler, Bytecode-VM (kein DOM, keine Sim)
  i18n/       Wörterbücher de.js/en.js, t(key, params), tr({ de, en }), reaktive Sprache
  ai/         Computergegner – erzeugt nur Befehle
  save/       Spielstände: Speicherformat (Umschlag, Prüfung, Migration), Plätze, Kompression, Import/Export
  render/     Three.js-Darstellung, liest den Zustand der Simulation
  game/       Engine (Spielschleife, Auswahl, Bauvorschau) und Eingabe (Maus, Tastatur, Touch);
              buildingUi.js liefert die Gebäude-Daten selection.techs/market/weather/repair
  game/       Engine (Spielschleife, Auswahl, Bauvorschau) und Eingabe (Maus, Tastatur, Touch)
  audio/      Ton: synthetisierte Effekte, generative Musik, Umgebung, Dateien per Manifest (docs/AUDIO.md)
  i18n/       Wörterbücher DE/EN, t(), Namen aus Spieldaten, Ablehnungsgründe
  dev/        Entwicklermodus (nur lesen, nachgeladen): Drahtgitter, A*-Aufnahme, Raster-Overlays, Statistik
  ui/         Vue 3 (Options API): Menüs, Leisten, Panels; ui/hud/ Befehlsleiste, ui/icons/ Symbole,
              ui/mission/ für Kampagne und Tutorial, ui/saves/ Spielstandliste und Bestätigungsdialog,
              ui/script/ Code-Panel und Debugger, ui/editor/ Welteneditor (mit game/EditorView.js)
tests/        Vitest (Simulation, KI, Website)
e2e/          Playwright (Desktop und Handy-Viewport); Adresse des Spiels zentral in e2e/paths.js
docs/         Spielregeln und Architektur
```

## Leitregeln

1. **Befehle sind der einzige Eingang.** Spieler, KI und später Netzwerk-Mitspieler schicken
   Befehle wie `{ type: 'placeBuilding', player, building, x, y }`. Die Simulation prüft sie
   und wendet sie im nächsten Takt an.
2. **Determinismus.** Gleicher Seed + gleiche Befehle = gleicher Zustand, auf jedem Browser.
   - fester Takt (100 ms), nur Ganzzahlen in der Logik (Positionen in 1/1000 Kachel),
   - eigener Zufallsgenerator (`sim/rng.js`), kein `Math.random`, kein `Date.now`,
   - keine `Math.sin/cos/atan2` in der Logik (Lookup-Tabellen in `sim/fixed.js`),
   - feste Iterationsreihenfolge (Entities nach ID).
   - `sim/hash.js` bildet pro Takt einen Zustands-Hash; Golden-Tests sichern das ab.
   - Befehle können aus dem Netz kommen: IDs aus Datentabellen nur mit `hasKey()` (sim.js) nachschlagen,
     Koordinaten als Ganzzahlen prüfen. `tests/sim/fuzz.test.js` schickt zufällige und unsinnige Befehle.
3. **Grafik austauschbar.** Die Simulation kennt nur Typen (`residence`, Stufe 2). Welches Modell
   gezeigt wird, steht in einer Zuordnung im Renderer.
4. **Simulation getrennt vom Rendering.** Sie läuft mit festem Takt; der Renderer interpoliert
   zwischen den Takten. Zurzeit im Haupt-Thread (die Rechenlast ist klein); der Umzug in einen
   Web Worker ist vorbereitet, weil die Engine nur über Befehle und Lesezugriffe mit ihr spricht.
5. **Vue fasst keine Three-Objekte an.** Die Engine ist eine eigene Klasse; Vue bekommt nur
   einen kleinen reaktiven Ausschnitt (Rohstoffe, Auswahl), wenige Male pro Sekunde.
6. **Wegsuche:** `findPath` prüft zuerst über `map.regionAt()` (zusammenhängende begehbare Gebiete), ob ein
   Ziel überhaupt erreichbar ist. Die Gebiete werden lazy je `map.version` und Frost neu berechnet;
   `occupy`/`release` erhöhen `map.version`. Wer `map.flags` direkt ändert (Missionsaufbau), muss danach
   `map.version++` setzen.
   `map.landRegionAt()` liefert dieselben Gebiete ohne Eis (für Planungen der KI, die den Winter überdauern).
7. **Sicht** (`sim/systems/vision.js`, Werte `sim/data/vision.js`): je Team `explored`/`visible` (Uint8Array
   je Kachel) und `ghosts` (zuletzt gesehene feindliche Gebäude/Ruinen). Alle `VISION.updateTicks` Takte wird
   `visible` aus allen Sichtquellen neu gestempelt (Kreise als zwischengespeicherte Zeilenbreiten, `fill()`).
   Abfragen: `canSee(sim, spieler, entity)`, `isVisible`, `isExplored`, `knownBuildings`; Missionen:
   `revealArea`. `sim.vision.version` zählt Neuberechnungen (Darstellung/Minikarte cachen darauf). Nebel aus
   (`new Sim({ fog: false })`, Mission `fog: false`): alle Abfragen liefern „sichtbar“. Die Simulation selbst
   (Kampf, Wegsuche) kennt keinen Nebel; Spieler und KI wirken nur über ihre Befehle – die Oberfläche
   (Engine) und `AiPlayer` filtern, was sie wahrnehmen. Gespeichert werden Bitfelder (Base64) und Momentaufnahmen.
8. **Bewegung** (`sim/systems/movement.js`): Jeder Teilschritt geht höchstens in eine Nachbarkachel, diagonal
   nur ohne Eckenschneiden (`canStep`, gleiche Regel wie A*); `moveAlong` verwirft unzulässige Pfade.
   `unstickAll()` setzt zu Beginn jedes Takts Figuren auf gesperrten Kacheln auf die nächste freie Kachel.
9. **Brücken** (`sim/systems/bridges.js`, Daten `sim/data/bridges.js`, Übersicht [ADDON.md](ADDON.md)): Die
   Kartenerzeugung legt Brückenstellen über Flüsse (`sim.bridgeSites`), ihre Brückenköpfe sind `RESERVED`. Eine
   fertige Brücke setzt das Kartenbit `BRIDGE` (begehbar trotz Wasser, Gebiete und Wegsuche übernehmen das
   automatisch) und wird nicht eingeebnet; stürzt sie ein, ertrinkt, wer darauf steht. Brunnen und Denkmal sind
   gewöhnliche Ziergebäude (`motivationEffect`).
10. **Gelände** (`sim/systems/terrain.js`): `createBuilding` ebnet die Grundfläche in `map.heights` ein
   (`levelSite`, gerundeter Mittelwert, 1 Kachel Übergangsrand, Flags bleiben), zählt `map.heightVersion` hoch und
   meldet `terrainChanged` (Rechteck). `padPreview()` liefert der Bauvorschau Zielhöhe und Abweichung, ohne etwas
   zu ändern. Höhen stehen im Spielstand und im Zustands-Hash. Regeln: [Spielregeln §6a](SPIELREGELN.md#6a-bauen-am-hang).

## Darstellung (src/render)

| Datei | Aufgabe |
|---|---|
| `Renderer.js` | liest den Zustand, ordnet Entities Darstellungen zu, Ereignisse (Schüsse, Zerstörung, Bau fertig) |
| `grid.js` | Kachelraster (`Renderer.setGrid`): Linien folgen dem Boden, jede fünfte kräftig; `overviewDist` für die Übersicht kleiner Karten |
| `lod.js` | Detailstufen nach Abstand/Sichtfeld bzw. Bildschirmhöhe mit Hysterese, Chunk-Raster mit Sichtprüfung für Instanzen |
| `characters.js` | Figuren aus `manifest.json`, gebackene Animationen, GPU-Skinning, instanziert |
| `effects.js` | Partikel (Staub, Rauch, Feuer, Spuren), Lebensbalken und Auswahlmarkierungen |
| `terrain.js`, `water.js`, `environment.js`, `nature.js` | Gelände, Wasser, Himmel/Licht, Bäume und Deko |
| `textures.js` | Bodentexturen: gemalte Bilddateien (vor dem Start geladen, [BODEN.md](BODEN.md)), sonst im Code gemalt |
| `terrain.js` `updateArea()` | übernimmt geänderte Sim-Höhen: Ecken, Catmull-Rom-Raster, Normalen, Texturgewichte im Bereich; `setPad/clearPad` legen die Rand-Ecken lebender Gebäude exakt auf ihre Ebene. `Renderer.reshapeGround()` setzt Bäume, Deko, Stümpfe, Haufen und Markierungen nach; `terrainChanged` im Nebel wird erst bei Sicht übernommen |
| `fog.js` | Nebel des Krieges: Datentextur (1 Texel je Kachel, R sichtbar, G erkundet, weichgezeichnet und überblendet), Shader-Zusatz `patchFog()` für alle Weltmaterialien |
| `models.js`, `assets.js` | prozedurale Modelle und das Laden der GLB-Modelle |
| `devHook` | Haken des Entwicklermodus (`src/dev/`, [ENTWICKLERMODUS.md](ENTWICKLERMODUS.md)): vor/nach dem Zeichnen, sonst `null` |

Pro Bild: Kamera → Sichtprüfung (Frustum) → Entities abgleichen → Detailstufen wählen → Instanzdaten
schreiben → zeichnen. Die Simulation bleibt unberührt. Siehe [MODELLE.md](MODELLE.md).

Nebel des Krieges in der Darstellung: Der Renderer zeichnet aus Sicht von `opts.player`. Feindliche Figuren,
Fallen, Geschosse, Treffer und Explosionen nur in sichtbaren Kacheln; feindliche Gebäude außerhalb der Sicht
aus der Momentaufnahme (`ghostEntity`, ohne Rauch/Feuer/Staub, nicht wählbar, `pickGhost` für Angriffsbewegungen).
`patchFog(material)` hängt sich an ein bestehendes `onBeforeCompile` an (Programmschlüssel `…|kfow1`), Instanzen
im Unerkundeten verwirft der Vertex-Shader. Neue Weltobjekte mit `patchFogTree(obj)` versehen. Die Uniforms
(`fowUniforms`) sind modulweit, damit gemeinsam zwischengespeicherte Materialien keinen alten Renderer festhalten.
Kosten: ein Texturzugriff und zwei Rauschwerte je Pixel; die Textur (≤ 160×160) wird nur hochgeladen, solange
sie überblendet.

Grafikstufe im laufenden Spiel: `setQuality()` meldet `kronland-quality`, die Engine ruft
`Renderer.applyQuality()` (Pixeldichte, Schatten, Deko-Dichte, Detailstufen sofort; Kantenglättung, Texturen,
Gelände-/Wasser-/Baumdetail erst beim nächsten Start). Kamerasprünge, bei denen das Ziel sichtbar bleiben soll,
gehen über `Engine.focusPoint()` (auf Handys über dem Kontextpanel, `CameraRig.lookAtScreen`).

Kamera und Nahzoom (`CameraRig`): Abstand `MIN_DIST` (3) bis `MAX_DIST` (75) Kacheln. Unter `TILT_START` (18)
wird der Blick weich flacher bis `NEAR_PITCH` (≈ 17°) wie in Siedler 5, der Blickpunkt hebt sich leicht über
den Boden, die nahe Schnittebene rückt von 0,3 auf 0,08; die eingestellte Neigung bleibt erhalten und kehrt
beim Herauszoomen zurück. Die Höhe des Zielpunkts ist das räumlich geglättete Gelände (Radius 2,5–10 Kacheln,
mit dem Abstand wachsend) – ohne zeitliche Verzögerung, also ohne Nachwippen. Bodenfreiheit: Kamera und ein
Ring um sie bleiben über dem Gelände (nah 0,45, weit 1,5) und über Gebäuden (`Renderer.buildingTopAt`:
Grundriss mit Haushöhe, weicher Rand, damit die Kamera stetig steigt statt hineinzufahren); Hügel zwischen
Kamera und Ziel heben sie an.
Weil die Kamera der Geländehöhe folgt, gleicht `holdUnder()` beim Ziehen und Drehen den Rest begrenzt aus
(nur solange er kleiner wird, nie weiter als der Schritt selbst). Strahlen nahe am Horizont sind auf eine
Reichweite begrenzt (`rayPlane`), nichts schießt ins Unendliche. Detailstufen: bis `NEAR_FULL_DETAIL` (14 Kacheln echter
Abstand, `lod.js`) gilt für Gebäude auf jeder Grafikstufe Stufe 0, dahinter stetiger Übergang; Figuren und Bäume
wählen nach ihrer Bildschirmhöhe und sind ganz nah ohnehin groß genug für Stufe 0. Der Schattenausschnitt wird
nah dran kleiner und nach vorn verschoben (`Environment.follow`), damit Schatten scharf bleiben.

Spielende/neues Spiel/Laden: `Engine.stop()` ruft `Renderer.dispose()`. Jedes Spiel bekommt einen neuen
Canvas und WebGL-Kontext; `dispose()` gibt Szene, modulweite Zwischenspeicher (Modelle, Materialien,
Texturen) und den Kontext frei. Neue modulweite three.js-Ressourcen dort mit aufnehmen, sonst hält ihr
`dispose`-Zuhörer den alten Renderer samt Spielzustand im Speicher (siehe docs/QA-BERICHT.md).

## Sprache und Oberfläche

- **Die Simulation kennt keine Texte.** Ablehnungen sind Codes mit Parametern
  (`sim.reject(cmd, 'err.techFirst', { tech: 'education' })`, Ereignis `{ type: 'rejected', reason, params }`),
  `check…()`-Funktionen liefern `null`, einen Code oder `{ code, params }`. Parameter sind IDs.
- `src/i18n/index.js`: `t(key, params)`, `tr({ de, en })`, `reasonText(reason)`, Namen aus Spieldaten
  (`buildingName(typ, stufe)`, `techName`, `unitName` …). Wörterbücher `de.js`/`en.js` mit flachen
  Schlüsseln (`building.residence.1`, `err.popLimit`, `toast.buildingDone`); ein Test prüft gleiche
  Schlüssel, keine leeren Werte, gleiche Platzhalter und dass jeder `err.*`-Code im Code übersetzt ist.
  Fehlt ein Schlüssel für neue Daten, erscheint der deutsche Name aus der Datendatei.
- Sprache: reaktiv (`i18n.lang`), gespeichert in `localStorage['kronland-lang']`; in Komponenten
  `$t`, `$tr`, `$reason`, `$name.building(…)` (globales Plugin `src/ui/plugin.js`).
- Meldungen: `engine.toast(key, params, { icon, tone, pos })`; mit `pos` springt ein Klick dorthin.
- Nebel des Krieges in der Engine: `canSee(e)`, `tileVisible`, `tileExplored`, `fogLifted()` (Nebel aus, Spielende,
  ausgeschieden); `selectable()` liefert für Unsichtbares `null`; `minimapFog()` liefert die Nebel-Ebene der Minikarte.
- Einstellungen: `src/ui/settings.js` (`get`, `set`, `onChange`, Fenster-Ereignis `kronland-settings`;
  Lautstärken `master`/`music`/`effects`, `uiScale`, `edgeScroll`, `hints`, Sprache, Grafikstufe).
- Erweiterungen im Gebäudepanel: `registerBuildingSection((engine, building) => ({ id, title, actions }))`
  aus `src/game/Engine.js`; Aktionen schicken ihren `cmd` als normalen Befehl. Neue Gebäude im Baumenü:
  `BUILD_MENU` + `BUILD_CATEGORY` (Gruppen `home`, `raw`, `refine`, `military`, `admin`, alle gleichzeitig sichtbar).
- Gestaltung: Tokens in `src/ui/style.css` (Holz, Pergament, Messing/Gold, Abstände in rem, skaliert
  über `--ui-scale`), Symbole in `src/ui/icons/` (`<Icon name="gold" />`; bunte aus dem KI-Atlas
  `public/icons/symbols.webp`, SVG als Rückfall, siehe [SYMBOLE.md](SYMBOLE.md)), Tooltips
  über `v-tip="{ title, text, notes, cost, reason, key }"` (`src/ui/tooltip.js`). Touch: Langdruck
  (`LONG_PRESS_MS`) öffnet den Tooltip und verwirft den folgenden Klick; er bleibt bis zum nächsten Tippen.
  Jedes Bedienelement mit Symbol braucht deshalb einen `v-tip` mit Titel und Erklärung (DE/EN).
- Beschriftungen: Regel „ständig sichtbar = Symbol mit Tooltip, nur bei Auswahl sichtbar = immer beschriftet“
  (Baumenü-Kacheln, Befehlskacheln `.act` in `style.css`). Die Einstellung `labels` (Standard: an bei
  `pointer: coarse`) setzt `.show-labels` auf `.game` und blendet zusätzlich Namen unter dem Schnellzugriff ein.
- Spieloberfläche (HUD): `TopBar.vue` (drei freistehende Schilder mit Abstand zum Rand – nichts dockt am Bildrand an: Rohstoffe, Wappen mit Zahltag-Medaillon,
  Münzknöpfe; Raster mit gleich breiten Seitenspalten, damit das Wappen genau mittig sitzt – passt das nicht,
  misst `TopBar.measure()` und setzt `.tight`: das Wappen bekommt eine eigene, mittige zweite Reihe), `hud/CommandBar.vue` als Raster `Karte | Tafel | Porträt` (`minmax(max-content, 1fr) auto
  minmax(max-content, 1fr)` – die Tafel bekommt den Rest und bricht um, nichts überlappt), `hud/SelectionCard.vue`
  (Porträt im Messingrahmen, gemalte Porträts unter `public/portraits/`), `hud/BuildMenu.vue` (Gruppen ohne Reiter,
  schmal als wischbare Reihe mit Sprungmarken). Breitenstufen setzt `App.vue` als Klassen auf `.game`
  (Breite geteilt durch Oberflächengröße): `narrow` < 1500 px (Porträt ohne Schild, Kennzahlen in der Tafel,
  drei Kachelreihen), `mid` < 1100 px (kleinere Karte, Baumenü als Reihe), `compact` < 760 px oder Höhe < 560 px
  (Handy: Tafel als Schublade, Karte als Knopf). Reine Hilfen (Minikarten-Geometrie, Gruppen, Trennstellen)
  in `hud/hudLayout.js`. Schnellzugriff-Daten aus der Engine: `ui.idleSerfs`, `ui.heroes` (`quickInfo()`),
  `ui.groups`, `ui.group`, Aktionen `selectHero(id)`, `selectAllArmy()`, `assignGroup(n)`, `selectGroup(n)`.
- Steuergruppen: `src/game/groups.js` (`ControlGroups`) – reiner Oberflächenzustand des Spielers, kein
  Sim-Zustand und nicht im State-Hash; die Zahltasten verarbeitet `Input.keydown` über `e.code`
  (unabhängig vom Tastaturlayout). Strg+Zahl wechselt in Chrome die Tabs, darum merkt Umschalt+Zahl.
- Bildschirmfotos zur Gestaltungsprüfung: `python3 scripts/ui-screens.py http://localhost:4211`
  (Ergebnis in `review/`, nicht im Repository). Bilder für Startseite/Handbuch: `scripts/site-screens.py`.
- Dateien aus `public/` (Modelle, Ton) nie mit festen Pfaden laden, sondern über `siteUrl()` aus `src/paths.js` –
  das Spiel liegt unter `play/`, die Dateien in der Wurzel.
- Spielsysteme im HUD (`src/ui/hud/systems/`): Gebäude-Technologien, Marktplatz, Wetterturm/-kraftwerk,
  Reparatur/Brand. Daten liefert `src/game/buildingUi.js` (nur IDs, Zahlen und `err.*`-Codes, z. B.
  `selection.techs`, `selection.market`, `selection.weather`, `selection.repair`); Hauptleute mit
  Erfahrungssternen stehen in `selection.leaders` (Rang als Index → `rank.<n>`).

## Spielstände (src/save)

Drei Schichten, jede einzeln getestet (`tests/save/`):

| Datei | Aufgabe |
|---|---|
| `sim/serialize.js` | `saveGame(sim, extra)` → reiner JSON-Zustand der Simulation, `loadGame(state)` → `Sim`. Karte als Base64 (Int32/Uint8), Nebel als Bitfelder, KI-Zustand und Kamera in `extra`. |
| `save/format.js` | Umschlag mit Kennzeichen und Versionen, Metadaten, Prüfung (`parseSaveText`), Migration, Dateiname. Fehler als `SaveError` mit i18n-Code `saves.err.*`. |
| `save/store.js`, `backends.js`, `codec.js` | Mehrere Plätze: `index` (Liste mit Vorschaubild) + `slot:<id>` (komprimierter Umschlag). Schreibvorgänge in einer Warteschlange; Platz und Liste werden gemeinsam geschrieben (`backend.atomic`). |

**Ablage.** IndexedDB (Datenbank `kronland`, Objektspeicher `saves`) – großes Kontingent und asynchron,
blockiert das Spiel beim Schreiben nicht. Ohne IndexedDB: `localStorage` (Präfix `kronland-saves:`), sonst nur
Arbeitsspeicher mit Hinweis „exportiere als Datei“. Gespeichert wird immer gzip-komprimiert (`CompressionStream`)
und Base64-kodiert (Präfix `gz:`, ohne gzip `js:`): ein früher Spielstand schrumpft von ~160 kB auf ~25 kB.
Speicher voll (`QuotaExceededError`) und gesperrter Speicher (privates Fenster) werden zu `saves.err.quota`
bzw. `saves.err.storage`; ein gescheiterter Schreibvorgang lässt vorhandene Stände unverändert.
Platz und Liste ändern sich immer zusammen: bei IndexedDB in *einer* Transaktion (die Liste wird darin gelesen
und neu geschrieben – zwei offene Tabs überschreiben sich so keine Einträge), bei localStorage/Arbeitsspeicher
der Reihe nach mit Rücknahme bei Fehlern. Geht die IndexedDB-Verbindung verloren (Safari im Hintergrund,
`versionchange` aus einem anderen Tab), wird sie einmal neu geöffnet. Die Liste zeigt die Belegung laut
`navigator.storage.estimate()`; nach dem ersten Speichern wird `navigator.storage.persist()` erbeten, damit der
Browser die Stände bei Platzmangel nicht räumt.
Der frühere Einzelspielstand (`localStorage['kronland-save-1']`) wird beim ersten Öffnen übernommen, ebenso
Stände aus einer Sitzung, in der IndexedDB nicht ging (`adoptFrom`, bei gleicher ID gewinnt der neuere).
Die Frist für `indexedDB.open()` (~8 s) zählt in 250-ms-Schritten: Ist der Hauptthread beim Spielstart lange
belegt, wird eine längst eingetroffene Antwort nicht als „hängt“ gewertet (sonst landete man fälschlich im
localStorage).

**Vorschaubild.** `ui/saves/thumb.js` zeichnet die Minikarte (Gelände, Nebel, Gebäude) auf 96×96 px
(WebP, sonst PNG, wenige kB) – kein Bildschirmfoto der 3D-Szene, das bräuchte `preserveDrawingBuffer`. Mit Nebel
zeigt es nur den erkundeten Bereich (quadratischer Ausschnitt, `ui/saves/crop.js`).
Importierte Dateien bekommen ihr Bild aus dem probeweise geladenen Zustand (`thumbFromState`, Sicht von Spieler 0).

**Autosave.** Platz `auto` (fest), alle 5 Spielminuten (3000 Takte), beim Verlassen ins Hauptmenü und wenn
die Seite verborgen wird (`visibilitychange`/`pagehide`). Einstellung `autosave` (an/aus) im Einstellungsmenü.
Beendete Partien werden nicht mehr gesichert. „Weiterspielen“ im Startmenü lädt den neuesten Platz.
Zustand und Vorschaubild werden synchron kopiert, das Schreiben läuft danach über die Warteschlange; derselbe
Takt wird nicht doppelt gesichert (`visibilitychange` + `pagehide`).

**Was (nicht) im Spielstand steht.** Alles, was die Simulation braucht – auch die durch Einebnung beim Bauen
am Hang geänderten Geländehöhen (`map.heights`, stehen ohnehin im Zustands-Hash). Nicht gespeichert werden
Zwischenspeicher (`heightVersion`, Gebietsnummern) und alles aus dem Entwicklermodus (Schalter in
`localStorage['kronland-dev']`, Werkzeuge lesen nur). Der Roundtrip-Test prüft gleichen Hash nach weiteren
Takten für Freies Spiel und Mission mit Nebel, Markthandel und eingeebnetem Gelände (`tests/save/roundtrip.test.js`).

**Dateiformat (Export/Import).** Dateiname `kronland-<name>-<YYYY-MM-DD>.json`, standardmäßig eingerückt
(lesbar – im Unterricht lässt sich der Spielzustand ansehen), wahlweise kompakt. Ausschnitt:

```json
{
  "format": "kronland-save",
  "formatVersion": 1,
  "gameVersion": "1.0.0",
  "meta": {
    "name": "Mission 2 – 42:10",
    "savedAt": "2026-10-04T12:00:00.000Z",
    "tick": 25300, "mode": "mission", "mission": "c2", "seed": 7, "players": 3, "fog": true
  },
  "state": {
    "version": 1, "seed": 7, "tick": 25300, "nextId": 4711, "rng": [1130501896, -297207299, 816914994, 2217],
    "map": { "width": 96, "height": 96, "frozen": false, "heights": "AAAAAP…", "flags": "AQEB…", "owner": "AAAA…" },
    "players": [ { "id": 0, "stock": { "gold": 1300, "clay": 1800, "wood": 2200, "stone": 1200, "iron": 600, "sulfur": 0 },
                   "taxLevel": 2, "techs": ["construction"], "faith": 0, "team": 0, "defeated": false } ],
    "entities": [ { "id": 140, "kind": "building", "type": "headquarters", "owner": 0, "x": 14, "y": 14, "w": 5, "h": 5,
                    "level": 0, "done": true, "hp": 2500, "workers": [], "trade": null, "burning": false } ],
    "market": { "prices": { "gold": 1000, "clay": 800, "wood": 800, "stone": 900, "iron": 1200, "sulfur": 1200 } },
    "mission": { "id": "c2", "objectives": [], "flags": {}, "messages": [] },
    "vision": { "enabled": true, "teams": [ { "team": 0, "explored": "…", "visible": "…", "ghosts": [] } ] },
    "extra": { "ais": [], "camera": { "x": 41.5, "z": 33, "yaw": 0.6, "dist": 30 } }
  }
}
```

`meta` dient Liste und Dateiname und wird beim Einlesen aus `state` nachgezogen; maßgeblich ist `state`.
Positionen bewegter Figuren (`px`, `py`) stehen in Tausendstel Kacheln (Festkomma, siehe Leitregel 2).

**Prüfung beim Import** (`readSaveFile` → `parseSaveText(text, { deep: true })`): kein JSON → `notJson`;
fremdes Objekt → `wrongFormat`; `formatVersion` größer als bekannt → `newer` (nennt Spiel- und Formatversion);
fehlende/falsche Felder → `broken` (mit Feldname); unbekannte Mission → `unknownMission`; Datei > 32 MB →
`tooLarge`. Die tiefe Prüfung lädt den Zustand probeweise (`loadGame`) und findet so auch kaputtes Base64.

**Migration.** `MIGRATIONS[v]` hebt ein Dokument von Formatversion `v` auf `v + 1`; `migrate()` wendet die
Schritte nacheinander an und prüft jede Zielversion. Version 0 ist der frühere Zustand ohne Umschlag.
Neue Formatversion: `FORMAT_VERSION` erhöhen, `MIGRATIONS[alt]` ergänzen, Test in `tests/save/format.test.js`.
Ändert sich nur der Simulationszustand (`state.version`), gehört die Umstellung ebenfalls in eine Migration.

**Oberfläche.** `ui/saves/SaveBrowser.vue` (Modus `save` im Spielmenü, `load` im Spielmenü und Startmenü →
„Spielstände“): Liste mit Vorschaubild, Datum, Spielzeit, Modus; Speichern unter neuem Namen (Vorschlag
„Mission 2 – 0:42:10“ / „Freies Spiel Seed 42 – 12:30“), Überschreiben, Umbenennen, Löschen, Export, Import per
Dateiauswahl (auf Touch-Geräten ohne Typfilter, weil Android/iOS `.json` sonst oft ausgrauen) und Ziehen &
Ablegen (fensterweit, damit eine danebengeworfene Datei nicht das Spiel verlässt). Rückfragen über `ConfirmDialog.vue` (kein `window.confirm`).

## Multiplayer (später)

Lockstep: Alle Clients rechnen dieselbe Simulation, ausgetauscht werden nur Befehle pro Takt.
Ein kleiner WebSocket-Relay genügt. Desyncs erkennt der Zustands-Hash.

## JavaScript mit Typ-Hinweisen

Es ist normales JavaScript. Typen stehen als JSDoc-Kommentare; `jsconfig.json` aktiviert die
Prüfung im Editor, ohne Build-Schritt.

## Steuerung

| | Desktop | Touch |
|---|---|---|
| Auswählen | Linksklick, Rahmen ziehen, Shift fügt hinzu | Tippen |
| Befehl (laufen, bauen, abbauen) | Rechtsklick | Tippen mit Auswahl |
| Kamera verschieben | mittlere Taste ziehen (greift den Boden), WASD/Pfeile, Bildschirmrand | 1 Finger ziehen (greift den Boden) |
| Kamera drehen | Q/E, Einfg/Entf, rechte Taste seitlich ziehen | 2 Finger umeinander drehen (ab 25 px Drehweg) |
| Kamera neigen | R/F, Pos1/Ende, rechte Taste hoch/runter, Umschalt+Mausrad | 2 Finger parallel hoch/runter |
| Zoomen (bis ganz nah, Blick dann flacher) | Mausrad zum Mauszeiger, Bild↑/↓ zur Bildmitte | 2 Finger spreizen, zur Fingermitte |
| Bauen | Baumenü, Klick setzt, Rechtsklick bricht ab | Baumenü, Tippen, „Hier bauen“ |
| Untätige Leibeigene | Taste . | Knopf „Untätige“ |
| Pause | Leertaste | Knopf |
| Baumenü-Gruppe | Mausrad (schmales Fenster) | Sprungmarken |
| Heldenfähigkeit | X, C | Knopf |
| Steuergruppe merken | Umschalt+1–9 (Strg+1–9, wo der Browser es durchlässt) | Knopf „Als Gruppe merken“ |
| Steuergruppe abrufen | 1–9, zweimal: Kamera hin | Gruppenschild über der Karte |
| Zur Burg | H | Knopf „Burg“ |
| Held finden | Porträt über der Karte | Porträt |
| Alle Truppen | Knopf „Truppen“ | Knopf „Truppen“ |
| Minikarte | Klick/Ziehen | Tippen (Knopf „Karte“ blendet ein) |
| Menü | Esc | Knopf |
| Symbol erklären | Maus darüber halten | lang drücken (löst nichts aus) |

Die Kamera folgt der Hand direkt wie ein Kartenprogramm (Vorbild three.js `MapControls`, Gesten wie
MapLibre), ohne Nachgleiten oder Nachwippen: Die Kameralage ist eine reine Funktion von Ziel, Drehung,
Neigung und Abstand (`CameraRig.pose()`). Ziehen greift den Boden, der Punkt unter Maus bzw. Finger wandert
mit. Mausrad und Zwei-Finger-Zoom fahren entlang des Strahls durch Zeiger bzw. Fingermitte
(wie `OrbitControls.zoomToCursor`). Zwei Finger legen die Geste einmal fest: Neigen nur, wenn beide Finger
parallel senkrecht gleiten; sonst Zoomen und Verschieben, Drehen erst ab 25 px Drehweg (wie MapLibre), damit
ein Zoom nicht nebenbei dreht. Randscrollen läuft sanft an und endet, sobald die Maus das Fenster verlässt
(auch nach oben in die Browserleiste).
