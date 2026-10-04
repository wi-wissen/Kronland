# Architektur

```
src/
  sim/        Spiellogik: reines JS, kein DOM, kein Three.js, deterministisch
    data/     Balancing-Werte (Gebäude, Rohstoffe, Einheiten, Techs)
    systems/  Ablauf pro Takt (Bauen, Abbau, Zahltag, Gebäude-Forschung, Markt, Wetter, Brand/Reparatur, …)
    reasons.js Ablehnungsgründe der neuen Systeme in einer Tabelle (für i18n-Umstellung)
    missions/ Missionslaufzeit, Tutorial, Kampagne (siehe docs/MISSIONEN.md)
  i18n/       Wörterbücher de.js/en.js, t(key, params), tr({ de, en }), reaktive Sprache
  ai/         Computergegner – erzeugt nur Befehle
  render/     Three.js-Darstellung, liest den Zustand der Simulation
  game/       Engine (Spielschleife, Auswahl, Bauvorschau) und Eingabe (Maus, Tastatur, Touch);
              buildingUi.js liefert die Gebäude-Daten selection.techs/market/weather/repair
  game/       Engine (Spielschleife, Auswahl, Bauvorschau) und Eingabe (Maus, Tastatur, Touch)
  audio/      Ton: synthetisierte Effekte, generative Musik, Umgebung, Dateien per Manifest (docs/AUDIO.md)
  i18n/       Wörterbücher DE/EN, t(), Namen aus Spieldaten, Ablehnungsgründe
  ui/         Vue 3 (Options API): Menüs, Leisten, Panels; ui/hud/ Befehlsleiste, ui/icons/ Symbole,
              ui/mission/ für Kampagne und Tutorial
tests/        Vitest (Simulation, KI)
e2e/          Playwright (Desktop und Handy-Viewport)
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

## Darstellung (src/render)

| Datei | Aufgabe |
|---|---|
| `Renderer.js` | liest den Zustand, ordnet Entities Darstellungen zu, Ereignisse (Schüsse, Zerstörung, Bau fertig) |
| `lod.js` | Detailstufen nach Abstand/Sichtfeld mit Hysterese, Chunk-Raster mit Sichtprüfung für Instanzen |
| `characters.js` | Figuren aus `manifest.json`, gebackene Animationen, GPU-Skinning, instanziert |
| `effects.js` | Partikel (Staub, Rauch, Feuer, Spuren), Lebensbalken und Auswahlmarkierungen |
| `terrain.js`, `water.js`, `environment.js`, `nature.js` | Gelände, Wasser, Himmel/Licht, Bäume und Deko |
| `fog.js` | Nebel des Krieges: Datentextur (1 Texel je Kachel, R sichtbar, G erkundet, weichgezeichnet und überblendet), Shader-Zusatz `patchFog()` für alle Weltmaterialien |
| `models.js`, `assets.js` | prozedurale Modelle und das Laden der GLB-Modelle |
| `debug.js` | Leistungsanzeige (`?debug=1`) |

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
  `BUILD_MENU` + `BUILD_CATEGORY` (Reiter `home`, `raw`, `refine`, `military`, `admin`).
- Gestaltung: Tokens in `src/ui/style.css` (Holz, Pergament, Messing/Gold, Abstände in rem, skaliert
  über `--ui-scale`), Symbole im Code gezeichnet in `src/ui/icons/` (`<Icon name="gold" />`), Tooltips
  über `v-tip="{ title, text, cost, reason, key }"`.
- Bildschirmfotos zur Gestaltungsprüfung: `python3 scripts/ui-screens.py http://localhost:4211`
  (Ergebnis in `review/`, nicht im Repository).
- Spielsysteme im HUD (`src/ui/hud/systems/`): Gebäude-Technologien, Marktplatz, Wetterturm/-kraftwerk,
  Reparatur/Brand. Daten liefert `src/game/buildingUi.js` (nur IDs, Zahlen und `err.*`-Codes, z. B.
  `selection.techs`, `selection.market`, `selection.weather`, `selection.repair`); Hauptleute mit
  Erfahrungssternen stehen in `selection.leaders` (Rang als Index → `rank.<n>`).

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
| Kamera verschieben | WASD/Pfeile, mittlere Taste ziehen, Bildschirmrand | 1 Finger ziehen |
| Kamera drehen | Q/E, Einfg/Entf, rechte Taste ziehen | 2 Finger drehen |
| Zoomen | Mausrad, Bild↑/↓ | 2 Finger spreizen |
| Bauen | Baumenü, Klick setzt, Rechtsklick bricht ab | Baumenü, Tippen, „Hier bauen“ |
| Untätige Leibeigene | Taste . | Knopf „Untätige“ |
| Pause | Leertaste | Knopf |
| Baukategorie | 1–5 | Reiter |
| Heldenfähigkeit | 1–2 | Knopf |
| Zur Burg | H | Knopf „Burg“ |
| Minikarte | Klick/Ziehen | Tippen (Knopf „Karte“ blendet ein) |
| Menü | Esc | Knopf |
