# Entwicklermodus

Der Entwicklermodus macht sichtbar, was im Spiel „unter der Haube“ passiert: Dreiecksnetze und
Detailstufen, die A*-Wegsuche einer Figur, das Kachelraster der Karte, Zustände der Figuren und
Leistungswerte. Er ist für Neugierige und ausdrücklich für den Informatik-Unterricht gedacht.
Er verändert das Spiel nicht – alles wird nur gelesen.

## Einschalten

| Weg | |
|---|---|
| Menü → Einstellungen → „Entwicklermodus“ | wird gemerkt |
| Adresse `?dev=1` (auch das ältere `?debug=1`) | z. B. `?seed=42&dev=1` |
| Taste **F3** oder **Strg+Umschalt+D** | an/aus im laufenden Spiel |

Das Panel liegt am Desktop rechts, auf dem Handy als ausklappbares Blatt unten; „⌄“ klappt es zu
(Knopf „</> DEV“ öffnet es wieder), „×“ beendet den Modus. „Erklärungen zeigen“ blendet die kurzen
Erklärtexte (Deutsch/Englisch) ein oder aus. Die Optionen merkt sich der Browser.

## Was man zeigen kann

### Polygone (Reiter „Polygone“)
- **Drahtgitter** getrennt für Gelände, Gebäude, Figuren, Wasser, Bäume/Deko – wahlweise „Kanten über
  Bild“ oder „Nur Kanten“. Die Figuren bleiben dabei animiert.
- **Detailstufen einfärben**: LOD 0 grün (feinstes Netz), LOD 1 gelb, LOD 2 rot, LOD 3 violett.
  Beim Heraus-/Hineinzoomen wechseln die Farben.
- **Dreiecke im Bild** und für das **ausgewählte Objekt** (Gebäude oder Figur): Ecken und Dreiecke der
  aktuellen Stufe sowie aller Stufen als Balken (z. B. Burg 5 659 → 2 568 → 1 238 Dreiecke).
- Tabelle „Objekte je Detailstufe“ (Gebäude, Bäume, Figuren).

### Wegsuche (Reiter „Wegsuche“)
- Figur anklicken/antippen: ihr **Pfad** (weiße Linie mit Wegpunkten) aus dem Spielzustand.
- **A*-Suche**: Die Suche wird vom aktuellen Standort zum Ziel noch einmal mit derselben Funktion
  gerechnet, dabei werden alle Schritte mitgeschrieben. Türkis = offene Liste, Orange = geschlossene
  Liste, Gelb = Weg, Grün = Start, Magenta = Ziel, Rot = gerade untersuchtes Feld.
- **Abspielen** Schritt für Schritt (⏮ ◀ ▶/⏸ ▶ ⏭, Tempo 1–400 Schritte/s).
- Maus über ein Feld: **f = g + h** (g = bisherige Kosten, gerade 10/schräg 14; h = Oktil-Abstand zum
  Ziel). Am Handy „Feld untersuchen“ und dann tippen.
- **Ziel wählen**: beliebiges Übungsziel antippen – die Figur läuft nicht dorthin, nur die Suche wird gezeigt.
- **Gebiete einfärben**: zusammenhängende begehbare Flächen. Liegt das Ziel in einem anderen Gebiet,
  bricht die Wegsuche sofort ab („unerreichbar“).

### Raster (Reiter „Raster“)
Begehbarkeit (frei/belegt/Klippe/Wasser/Eis/Bauplatz), Höhenkarte mit Höhenlinien, Bebaubarkeit und
Steigung (Regel: höchstens `BALANCE.maxSlope` = 4 m Höhenunterschied unter einem Gebäude), Sicht und Nebel je Feld mit
den Sichtkreisen der eigenen Figuren und Gebäude, Territorien (nur Anzeige: nächstes Gebäude je Spieler –
die Spielregeln kennen keine Grenzen). Optional mit Kachelgrenzen. Die Overlays zeigen den wahren
Zustand, auch unter dem Nebel.

### Figuren (Reiter „Figuren“)
- Infos über der ausgewählten bzw. allen nahen Figuren: Zustand der Zustandsmaschine
  (untätig, läuft, arbeitet, trägt, kämpft, isst, schläft …), Lebenspunkte, Auftrag, Wegziel.
- **State-Hash** mit Takt und Anzahl der Objekte in der Simulation.

### Statistik für Nerds (Knopf „Statistik“)
Halbtransparent oben links: Bilder/s, Bildzeit als Live-Diagramm (Linien bei 60 und 30 Bildern/s),
Sim-Takt- und KI-Zeit, Takt, Tempo, State-Hash, Zeichenaufrufe, Dreiecke, Geometrien/Texturen/
Shader-Programme, JS-Heap (Chrome), Entitäten je Art, Figuren gezeichnet, LOD-Verteilung, Auflösung ×
Pixelverhältnis, Grafikstufe, GPU, Kamera. „Kopieren“ legt alles als Text in die Zwischenablage.

## Unterrichtsideen

1. **Dreiecke zählen (Kl. 7–10):** Burg anklicken, Drahtgitter „Gebäude“ an. Wie viele Dreiecke hat
   die Burg nah und fern? Warum lohnt sich das bei 300 Bäumen? Mit „Statistik“ die Gesamtzahl vergleichen.
2. **LOD erleben:** „Detailstufen einfärben“ an, langsam herauszoomen, beobachten, wann Grün zu Gelb wird.
   Diskussion: Woran merkt man (nicht), dass ein Modell gröber wird?
3. **A* nachspielen (Kl. 9–12):** Figur wählen, „Ziel wählen“ hinter einen Fluss oder Berg, Animation
   langsam (5 Schritte/s) abspielen. Zwischendurch anhalten: Welches Feld kommt als Nächstes dran?
   Mit f-, g-, h-Werten am Zeiger prüfen. Vergleich: Ziel auf freier Wiese vs. hinter einem Hindernis.
4. **Heuristik verstehen:** Warum ist die geschlossene Liste bei freier Sicht schmal und hinter einem
   Hindernis breit? Was würde passieren, wenn h immer 0 wäre (→ Dijkstra)?
5. **Erreichbarkeit vorab prüfen:** „Gebiete einfärben“ – warum sucht das Spiel gar nicht erst, wenn
   das Ziel auf einer Insel liegt? (Zusammenhangskomponenten, Breitensuche)
6. **Raster als Datenstruktur:** Höhenkarte und Bebaubarkeit vergleichen – aus welchen gespeicherten
   Werten folgt „zu steil“?
7. **Zustandsmaschinen:** „Infos über Figuren: Alle“, einem Arbeiter zusehen (läuft → arbeitet → isst →
   schläft). Zustandsdiagramm an die Tafel zeichnen.
8. **Determinismus:** Zwei Rechner, gleiche Adresse `?seed=42&dev=1`, gleich lange laufen lassen ohne
   einzugreifen – sind die State-Hashes gleich? Warum ist das für Mehrspieler über das Netz wichtig?

## Technik (für Entwickler)

| Datei | Aufgabe |
|---|---|
| `src/dev/state.js` | Schalter, Optionen (localStorage `kronland-dev`), Tastenkürzel – im Hauptpaket |
| `src/dev/DevTools.js` | Werkzeuge über dem Spiel; wird erst beim Einschalten nachgeladen |
| `src/dev/astar.js` | Aufnahme (`recordSearch`) und Wiedergabe (`SearchPlayback`) der A*-Suche |
| `src/dev/overlayData.js` | RGBA-Daten der Raster (rein, getestet) |
| `src/dev/wireframe.js`, `tileLayer.js` | Drahtgitter-Materialien, Kachel-Overlay auf dem Gelände |
| `src/dev/figureInfo.js`, `statsText.js` | Figurenzustand, Statistik-Zeilen |
| `src/ui/dev/DevPanel.vue`, `DevStats.vue` | Panel und Statistik (nachgeladen) |

- `findPath(map, sx, sy, goals, maxNodes, observer)`: optionaler Beobachter (`'open'|'close'|'goal'|…`).
  Ohne Beobachter nur eine Null-Prüfung; mit Beobachter zählt die Suche nicht in `pathStats`. Tests
  (`tests/dev/devmode.test.js`) prüfen gleiche Routen und unveränderten Sim-Hash bei aktiven Debug-Läufen.
- Haken: `Engine.dev` (`frame`, `afterTick`), `Renderer.devHook` (`beforeRender`/`afterRender`).
  Ausgeschaltet ist `dev`/`devHook` `null` – keine Kosten. Overlays entstehen erst beim Einschalten;
  `dispose()` (Modus aus, Spielende, Laden) entfernt Netze, Materialien, Texturen und DOM.
- Drahtgitter: Materialkopien mit `wireframe` (Shader-Zusätze wie Nebel und GPU-Skinning bleiben), nur
  während des Zeichnens eingesetzt. „Kanten über Bild“ zeichnet einen zweiten Durchgang mit leicht
  verschobener Tiefe.
- Das Diagramm nutzt einen Software-Canvas (`willReadFrequently`): Ein GPU-Canvas über dem WebGL-Bild
  bremste Software-Grafik (SwiftShader) bis zum Stillstand.
