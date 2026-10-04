# QA-Bericht

Stand: 4. Oktober 2026, Zweig `feat/qa`; Nachtrag (zweite Runde, Befunde 19–26: alle offenen Punkte
A–E und die bekannten Grenzen aus `MISSIONEN.md` behoben) auf `main`. Geprüft wurde unabhängig vom Entwicklungsteam: Spielen im
Browser (headless Chromium mit Software-GL, Desktop 1280×800, Handy hoch 390×844 und quer 844×390, Deutsch
und Englisch), Fuzz- und Dauertests der Simulation, Durchsicht der Risikobereiche im Code.

Bildschirmfotos liegen in `review/` (nicht im Repository). Belege zu einzelnen Befunden: `review/befund-*.png`.

## Befunde

Schwere: **Hoch** = Absturz, Datenverlust oder deutlich spürbar für jeden Spieler; **Mittel** = Spielregel
falsch oder Bedienung blockiert in einer Konstellation; **Niedrig** = Schönheitsfehler, Randfall, Härtung.

### Behoben

| # | Schwere | Befund | Nachstellen (vorher) | Behebung |
|---|---|---|---|---|
| 1 | Hoch | **Speicherleck bei jedem Spielstart.** Neues Spiel, Laden oder Zurück ins Menü ließ den alten Renderer mit WebGL-Kontext, die komplette Simulation und die HUD-Knoten im Speicher. Je Spiel ca. +10 MB JS-Heap und ~630 GL-Puffer, 31 Texturen, 21 Shader-Programme. | 5× Spiel starten → Menü → neues Spiel: Heap 50 → 96 MB, GL-Puffer 635 → 3160. Retainer-Pfad (Heap-Snapshot): Modell-/Material-Zwischenspeicher bzw. three.js-DFG-Tabelle → `dispose`-Zuhörer des alten Renderers → Kontext → Canvas → abgehängte HUD-Knoten → Vue-Props → Engine. | `Renderer.dispose()` (Szene, Zwischenspeicher aller Module, DFG-Tabelle, Umgebungskarte, Gelände, Wasser, WebGL-Renderer freigeben), aufgerufen in `Engine.stop()`. Danach: Heap 50 → 52 MB nach 5 Spielen bzw. 4× Laden, alte Engines werden eingesammelt (per `WeakRef` geprüft). Kein `forceContextLoss()`: beim Laden aus dem Spiel heraus benutzt der nächste Renderer denselben Canvas. Das Debug-Overlay (`?debug=1`) bleibt nicht mehr im Menü stehen. |
| 2 | Hoch | **Ruckler bis über 1 s pro Takt** bei Computergegnern. Fehlgeschlagene A*-Suchen laufen über bis zu 20 000 Knoten (~25 ms); die KI schickt Leibeigene und Truppen wiederholt zu unerreichbaren Zielen. | `node` 4 KI, Größe 160, 60 min: langsamster Takt 1,6 s, Gesamtlaufzeit ~10 min (unter Last). | `TileMap.regionAt()` (zusammenhängende Gebiete, lazy je `map.version`/Frost) – `findPath` bricht bei unerreichbaren Zielen sofort ab. Ergebnis der Suche identisch (Test). Jetzt 34 s für 60 min, langsamster Takt ~120 ms. |
| 3 | Mittel | **Türme ausgeschiedener Spieler schießen weiter und sind unangreifbar.** `isEnemy` prüfte nur das Ziel auf „ausgeschieden“, nicht den Angreifer. Außerdem zogen weiter Arbeiter in die Dorfzentren der Ausgeschiedenen; Gebäudelisten verwiesen auf gelöschte Arbeiter. | 3 Spieler, Spieler 1 verliert die Burg, sein Wachturm (Stufe 2) beschießt weiter Truppen in Reichweite. | `isEnemy` symmetrisch, kein Zuzug für Ausgeschiedene, Listen der übrigen Gebäude werden geleert. Test `qa.test.js`. |
| 4 | Mittel | **Absturz der Simulation durch Befehle mit Prototyp-Schlüsseln** (`building: 'toString'`, `tech: 'constructor'`, …): `TypeError` im Takt. Für den geplanten Mehrspielerbetrieb ein Absturz aller Clients durch einen Befehl. | Fuzz-Test, Takt 1259: `placeBuilding` mit `building: 'toString'`. | `hasKey()` bzw. `Object.hasOwn` bei allen Tabellen-Nachschlagen aus Befehlen (Gebäude, Techs, Gebäude-Techs, Segnungen, Linien, Wetter, Fähigkeiten). |
| 5 | Mittel | **Heldenfähigkeit mit beliebigem Zielpunkt**: Bombe/Falle/Selbstschuss-Kanone ließen sich über `x/y` überall auf (und außerhalb) der Karte setzen. Die Oberfläche schickt keinen Zielpunkt, ein Netz-Mitspieler könnte es. | `{ type: 'ability', ability: 'bomb', x: -40, y: … }` → Bombe außerhalb der Karte. | Zielpunkt nur auf der Karte und höchstens 6 Kacheln vom Helden (`ABILITY_RANGE`), sonst `err.notWalkable`. |
| 6 | Mittel | **Kopfleiste bei Oberflächengröße 130 %**: Pause, Tempo und Menüknopf aus dem Bild geschoben (Desktop 1280×800, Handy quer), im Hochformat Schwefel abgeschnitten und Zahltag unter den Knöpfen. Auf dem Handy war das Spielmenü damit nicht mehr erreichbar. | Einstellungen → Oberflächengröße 130 %. Beleg: `review/befund-kopfleiste-130prozent-vorher.png`. | Kopfleiste bricht bei Platzmangel um, Steuerknöpfe bleiben rechts; im flachen Querformat werden die Anzeigen beschnitten statt der Knöpfe. Geprüft auf allen drei Geräten (DE/EN). |
| 7 | Mittel | **Spielmenü im Handy-Querformat nicht scrollbar**: „Steuerung“ halb, „Hauptmenü“ ganz außerhalb des Bilds. | 844×390, Menü öffnen. Beleg: `review/befund-spielmenue-quer-vorher.png`, nachher `…-nachher.png`. | Hauptansicht des Spielmenüs scrollt wie die anderen Ansichten. |
| 8 | Mittel | **Tauwetter blockiert Baustellen**: Leibeigene, die auf dem Eis ertrinken, blieben in der Bauarbeiterliste; mit vier Toten nimmt die Baustelle niemanden mehr an. | Winter, Leibeigene einer Baustelle aufs Eis, Wetter wechselt. | Ertrinkende Leibeigene werden wie Gefallene von der Baustelle gelöst. Test. |
| 9 | Niedrig | Miliz ließ sich als Bauarbeiter eintragen (Bauen mit ausgewählter Miliz, „Untätige“ wählte Miliz mit aus) und belegte Plätze, ohne zu arbeiten. | „Zu den Waffen“, dann Wohnhaus mit allen Leibeigenen setzen. | Simulation nimmt Miliz nicht als Arbeitskraft; „Untätige“ und Ausbau-Helfer ohne Miliz. Test. |
| 10 | Niedrig | Klick in eine Gruppe wählte immer die vorderste Figur, nicht die unter dem Zeiger – der Held zwischen seinen Soldaten war kaum anwählbar (Tutorialschritt „Heldenkraft“). | Tutorial bis „Heldenkraft“, auf Bertram klicken → Schwertkämpfer gewählt. | Figur mit kleinstem Bildschirmabstand zum Zeiger gewinnt, bei Gleichstand die vordere. |
| 11 | Niedrig | Kamera: bei flachem Blick und weitem Zoom verdeckten Berge den Zielpunkt (≈ 6 % geprüfter Kamerastellungen). | 400 Ziele × 4 Drehungen × 4 Zoom/Neigungen je Karte, Sichtlinie gegen Gelände. | Kamera hebt sich, bis die Sichtlinie frei ist (0 von 19 200 Stellungen verdeckt). Beleg: `review/befund-kamera-berg-nachher.png`. |
| 12 | Niedrig | PWA: Figuren-Manifest (`models/characters/manifest.json`) wurde nicht zwischengespeichert → offline nur Platzhalterfiguren neben echten Gebäuden. Modell-Cache auf 200 Einträge begrenzt, ein Spiel mit 4 Spielern lädt 205 Dateien → ständiges Verdrängen. | Offline-Start nach einem Online-Spiel. | Laufzeit-Cache für `models/*.json`, Modell-Cache 400 Einträge. Offline-Start geprüft: echte Figuren und Gebäude, keine Fehler. |
| 13 | Niedrig | `saveGame`/`loadGame` teilten Objekte mit der laufenden Simulation (Rohstoffe, Truppenstufen, Markt, Befehle). Zweimal aus demselben Objekt geladen → gekoppelte Spiele. Im Spiel nicht sichtbar, weil `App.vue` über JSON speichert. | `loadGame(data)` zweimal, in einem Gold ändern. | Tiefe Kopien in beiden Richtungen. Test. |
| 14 | Niedrig | Laufbefehle mit Kommazahlen/außerhalb der Karte wurden angenommen (Ziel-Index als Bruch). | Fuzz. | `move`/`order` prüfen ganzzahlige Koordinaten auf der Karte. |
| 15 | Niedrig | Zustands-Hash ohne Wetter, Frost, Truppenstufen und Ausscheiden – ein Desync (z. B. durch das Wetterkraftwerk) wäre erst spät aufgefallen. | Code-Durchsicht. | Felder in `Sim.hash()` aufgenommen. |
| 16 | Niedrig | Figuren-Instanzpuffer: beim Vergrößern blieb der alte `instanceMatrix`-Puffer auf der GPU. | Code-Durchsicht. | `InstancedMesh.dispose()`. |
| 17 | Niedrig | Ton: Glocken-Obertöne (Münzklang) über der Nyquist-Frequenz → Konsolenwarnung „value 22152 outside nominal range“. | Markt-Handel bei 44,1 kHz. | Obertöne oberhalb 95 % der Nyquist-Frequenz entfallen (unhörbar). |
| 18 | Niedrig | Räuber-Spieler (Missionen) ohne Felder `weatherEnergy`/`weatherReadyAt`. | Fuzz-Invariante. | Felder beim Anlegen gesetzt. |

### Behoben in der zweiten Runde (vorher offen bzw. bekannte Grenzen)

| # | Schwere | Befund | Nachstellen (vorher) | Behebung |
|---|---|---|---|---|
| 19 | Mittel | **Truppen schneiden Wasserecken und bleiben im Wasser stecken** (vorher „bekannte Grenze“ in `MISSIONEN.md`, Mission 5 Karte 7). Ursachen: `stepToward` (Formation, Verfolgung auf kurze Distanz) prüfte nur die Zielkachel des Schritts, nicht den Kachelwechsel – diagonal zwischen zwei Wasserkacheln hindurch; außerdem lief es einen veralteten Pfad als Gerade ab. `moveAlong` lief zu Pfadpunkten, die nicht (mehr) Nachbarkacheln waren. | Hauptmann mit Soldaten an einer diagonalen Seenkette hin und her schicken: Soldat steht im Wasser (Test `movement.test.js`, schlägt mit dem alten Stand fehl). | `canStep()` (`src/sim/systems/movement.js`): jeder Teilschritt höchstens in eine Nachbarkachel, diagonal nur, wenn beide angrenzenden Kacheln begehbar sind (wie A*). `moveAlong` verwirft Pfade mit unzulässigem nächsten Schritt (Aufrufer suchen neu), `stepToward` geht Umwege bis zum Ende und verwirft fremde Pfade. |
| 20 | Mittel | **Festsitzende Figuren**: Wer auf einer gesperrten Kachel stand (neues Gebäude über Truppen/Helden/Arbeitern – `ejectUnits` kannte nur Leibeigene –, Ruine, Missionsaufbau), kam nie mehr weg. Soldaten weit vom Hauptmann suchten einen Weg zu ihm; war er unerreichbar, standen sie still. | Gebäude über einem Hauptmann setzen; Flags unter Figuren sperren. | `unstickAll()` zu Beginn jedes Takts: Figur auf gesperrter Kachel → nächste begehbare Kachel. `ejectUnits` schiebt alle Figurenarten. Soldaten ohne Weg zum Hauptmann laufen zur nächsten erreichbaren Stelle bei ihm (gleiches Gebiet). Die DETACHED-Regel bleibt als Absicherung und zählt jetzt auch Soldaten jenseits von Wasser/Felsen als abgeschnitten (sonst hätte ein Soldat am anderen Ufer den Hauptmann wieder unverwundbar gemacht). |
| 21 | Mittel | **Gebäudeangreifer wehren sich nicht** (vorher „bekannte Grenze“): Mit Angriff/Angriffsbewegung auf ein Gebäude schlugen Hauptmann und Soldaten weiter auf das Gebäude ein, während feindliche Truppen sie niedermachten; nur der Test-Bot lenkte um (`micro()`). | Schwertkämpfer auf ein Wohnhaus, Bogenschützen daneben (Test `qa2.test.js`). | Hauptleute, Helden, Miliz und Soldaten mit Gebäudeziel sehen alle 5 Takte (je Figur versetzt, deterministisch) nach kämpfenden Feinden in Sichtweite und greifen zuerst diese an; danach zurück zum Gebäude (der Befehl bleibt). Leibeigene und Arbeiter lenken nicht ab. Halten/Verteidigen unverändert (geprüft, Tests). Neues Ziel verwirft den alten Weg. |
| 22 | Mittel | **KI schickt Leibeigene und Truppen zu unerreichbaren Zielen** (vorher A). Hauptursache: Schächte in Felsnischen, deren einziger Zugang durch das Gebäude selbst zugebaut wird – Bauarbeiter und Arbeiter sitzen danach fest und suchen alle 2 s vergeblich Wege. Dazu Angriffspunkte in der feindlichen Burg (Truppen blieben stehen) und Sammelpunkte im Wasser. | 4 KI (schwer), Größe 160, je 20 min: bis 1724 vergebliche Wegsuchen je 150 s (Seeds 1/7/23: 4829/831/2598 gesamt). | `AiPlayer`: Erreichbarkeit über `map.landRegionAt()` (Gebiete ohne Eis) für Bauplätze (`reachableAfterBuild`: Flutfüllung von der Burg mit gesperrter Baufläche), Bäume/Haufen, Reparaturen, Feinde nahe der Burg, Angriffsziele (`enemyHome`), Sammel- und Auffüllpunkte (`reachPoint`). Neu planen: unerreichbare Baustellen und Gebäude abreißen, abgeschnittene Leibeigene nicht verplanen. `findPlacement(…, accept)`. Simulation: Lauf-/Angriffsbefehle auf Gebäude/Wasser gehen zur nächsten begehbaren Kachel. Jetzt **0** Fehlversuche in denselben Partien. |
| 23 | Niedrig | `Engine.stepOnce` (und `scripts/ai-match.js`, Missions-Bot) riefen `ai.update()` für Ausgeschiedene (vorher B). | – | Ausgeschiedene Spieler werden übersprungen (zusätzlich zur Prüfung in `AiPlayer.update`). |
| 24 | Niedrig | Gebäude Ausgeschiedener blieben als unangreifbare Hüllen stehen, Forschung lief weiter (vorher C). | Burg von Spieler 2 zerstören. | Wie im Original: Gebäude zerfallen in 60 s (`DAMAGE.decayTicks`) zu Ruinen, Forschung und Handel enden beim Ausscheiden. Spielregel in `SPIELREGELN.md` §10. |
| 25 | Niedrig | Tutorial/Kamerasprünge im Hochformat legten das Ziel unter das offene Panel (vorher D). | Handy hoch, Burg-Panel offen, Sprung zur Hochschule. | `Engine.focusPoint()` + `CameraRig.lookAtScreen()`: auf Handys/Hochformat liegt das Ziel in der Mitte des freien Bereichs zwischen Kopfleiste (`--top-total`) und Panel (`--bottom-h`); ändert sich die Panelhöhe gleich danach (Auswahl öffnet es), wird 1,5 s nachgeführt. Gilt für Missionssprünge, „Burg“, „Untätige“ und Meldungen. |
| 26 | Niedrig | Grafikstufe im laufenden Spiel wirkte erst beim nächsten Start (vorher E). | Spielmenü → Einstellungen → Grafik. | `Renderer.applyQuality()` über das Ereignis `kronland-quality`: Pixeldichte, Schatten an/aus und Schattenkartengröße (Shader werden neu übersetzt), Deko-Dichte (neu aufgebaut), Detailstufen von Bäumen, Deko, Gebäuden und Figuren, Blob-Schatten sofort. Nur Kantenglättung (WebGL-Kontext), Texturgröße sowie Gelände-, Wasser- und Baumdetail brauchen einen Neustart – der Hinweis im Panel nennt nur noch diese. |

### Offen

| # | Schwere | Befund | Empfehlung |
|---|---|---|---|
| F | Hinweis | Missionsskripte, die `map.flags` direkt ändern, müssen danach `map.version++` setzen (in `setupApi.js` erledigt, in `ARCHITEKTUR.md` dokumentiert). Figuren auf neu gesperrten Kacheln befreit jetzt `unstickAll`. | – |

Bewusst so (Spielregel, kein Fehler): Gebäude haben hohe Rüstung, Nahkämpfer machen fast nur Mindestschaden
(siehe `MISSIONEN.md`).

## Gespielt (Browser)

Alle Sitzungen ohne JavaScript-Fehler, ohne unbehandelte Promise-Ablehnungen und – nach Befund 17 – ohne
Konsolenwarnungen.

- **Freies Spiel vom Startmenü** (Desktop DE): Gegner, Stärke, Held wählen, Leibeigene kaufen, Wohnhaus und
  Hof über das Baumenü setzen (Bauvorschau = tatsächlicher Bauplatz), Holz per Rechtsklick.
- **Systeme über die Oberfläche** (Desktop EN): Hochschule/„Bildung“, Steuern, Burg ausbauen, Marktplatz
  (Vorschau, Handel, Lieferung), Kaserne/Rekrutieren, Angriff per Rechtsklick, Heldenfähigkeit,
  Wetterkraftwerk (Winter herbeiführen), Brand und Reparatur, Speichern/Laden über das Spielmenü (Hash vor
  und nach dem Laden gleich), Einstellungen im Spiel (Grafik, Oberflächengröße, Sprache) – keine deutschen
  Reste oder Rohschlüssel im englischen Modus. Alle `$t('…')`-Schlüssel der Oberfläche existieren in DE und EN.
- **Tutorial komplett über die Oberfläche**: Desktop EN und Handy hoch DE, alle 18 Schritte bis
  „Tutorial beendet“ (≈ 6 min Spielzeit).
- **Kampagne Mission 1** über Startmenü → Kampagne → Briefing → Start (Handy quer EN): Dialog, Ziele,
  Spielmenü, Einstellungen. Startmenü und Kampagne sind im Querformat höher als der Bildschirm, aber scrollbar.
- **Touch**: Ein-Finger-Ziehen verschiebt die Kamera, Zwei-Finger-Spreizen zoomt (hoch und quer).
- **Ergebnisbildschirme** (Sieg, Niederlage, Missionsergebnis) auf allen Geräten erreichbar.
- **Neustart-Schleife**: 5× Spiel → Menü → Spiel; 4× Laden aus dem Spiel heraus; Darstellung danach korrekt
  (auch Grafikstufe hoch).
- **Offline (PWA)**: nach einem Online-Spiel Netz trennen, neues Spiel → startet mit echten Modellen.

## Neue Tests

- `tests/sim/fuzz.test.js` + `tests/sim/fuzzHelpers.js`
  - Befehlsgenerator mit Seed (alle Befehlsarten, plausible Ziele) plus ~4 % unsinnige Befehle
    (Prototyp-Schlüssel, fremde IDs, Koordinaten außerhalb, NaN/negative Mengen, unbekannte Befehlstypen);
    Befehle laufen wie im Netz durch JSON.
  - Invarianten alle 250 Takte: keine Ausnahmen, Bestände ganzzahlig und ≥ 0, Preise > 0, Positionen
    ganzzahlig und auf der Karte, Pfade gültig, keine toten Einheiten, Verweise Arbeiter↔Arbeitsplatz/Haus/Hof,
    Bauarbeiterlisten (vorhanden, eindeutig, höchstens 4, arbeiten wirklich dort), Hauptmann↔Soldaten,
    nichts gehört Ausgeschiedenen; Bevölkerung wächst nie über das Limit.
  - Freies Spiel: Seeds 1/7/23/99, Größen 96/128/160, 2–4 Spieler, 4000–6000 Takte.
  - Alle Missionen (Tutorial, c1–c5): Fuzz, Speichern/Laden in der Mitte, Endzustand vollständig gleich.
  - Determinismus: protokollierte Befehle ⇒ identische Hash-Folge; Speichern/Laden nach 2500 Takten ⇒
    kompletter Zustand nach 5000 Takten gleich; geladene Stände teilen keine Objekte.
  - KI-Dauerlauf: 4 Computergegner, Größe 160, 60 min Spielzeit, Invarianten alle 5 min, Laufzeitgrenze.
- `tests/sim/qa.test.js`: Regressionstests zu den Befunden 3, 4, 5, 8, 9, 13 und zur Gleichwertigkeit der
  Wegsuche mit Gebietsnummern (auch nach Bauen/Abreißen und bei Frost).

Zweite Runde:

- `tests/sim/movement.test.js`: Eckenschnitt (`canStep`, `moveAlong`), Truppen an einer diagonalen Seenkette
  und bei Verfolgung, Befreien festsitzender Figuren, Gebäude über Truppen/Helden, Soldat jenseits des
  Wassers (läuft ans Ufer, Hauptmann bleibt angreifbar), KI-Wirtschaft 6 min ohne Figuren auf Wasser.
- `tests/sim/qa2.test.js`: Gebäudeangreifer (Angriff und Angriffsbewegung) wehren sich und kehren zurück,
  Leibeigene lenken nicht ab, Halten/Verteidigen; Zerfall bei Ausscheiden, KI Ausgeschiedener still;
  KI meidet Inseln, reißt unerreichbare Baustelle ab, 4 KI × 15 min mit < 40 Fehlversuchen.
- `tests/render/camera.test.js`: `lookAtScreen` (Hochformat, Drehungen, Kartenrand), Schatten und
  Figuren-Detailstufen beim Wechsel der Grafikstufe.
- `e2e/ui.spec.js`: Grafikstufe im laufenden Spiel, Kamerasprung zur Burg im Hochformat, Meldungssprung
  (Ort im freien Bildbereich).

`npx vitest run`: 24 Dateien, 325 Tests, ~4 min. `npx playwright test`: 54 Tests (Desktop + Handy).

## Leistung und Speicher

| Messung | Vorher | Nachher |
|---|---|---|
| KI-Dauerlauf 4 Spieler, Größe 160, 60 min (Node) | ~588 s, langsamster Takt 1,6 s (Rechner parallel ausgelastet) | 34 s, langsamster Takt ~120 ms |
| 20 min davon, unbelastet: Rechenzeit Simulation | 20,3 s | 6,9 s |
| 5 Spielstarts hintereinander: JS-Heap nach GC | 50 → 96 MB | 50 → 52 MB |
| 5 Spielstarts: lebende GL-Puffer / Programme | 3160 / 105 | 0 / 0 nach jedem Spielende |
| 4× Laden aus dem Spiel heraus: JS-Heap | – | 51 → 52 MB |
| 30 min Spielzeit im Browser, 4 Spieler (schwer) | – | Heap 50–53 MB stabil, GL-Puffer 866 konstant, ~76 Zeichenaufrufe (niedrig, Software-GL) |

Profil des Dauerlaufs nach der Behebung: Simulation ~87 %, davon `nearestEnemy` und `buildGrid` (Kampf),
`findPath` und das Neuberechnen der Gebiete (1,7 s je 60 min) die größten Posten; KI ~13 %.
Hängende Einheiten (gleiche Position trotz Auftrag ≥ 60 s) in einer 40-min-Partie mit 3 schweren
Computergegnern: keine.

## Durchgesehene Bereiche ohne Befund

- `serialize.js`: alle Zustandsfelder werden gespeichert (Ruinen, Brand, Markt, Erfahrung, Wetter samt
  Energie und Sperrzeit, Missionszustand, Forschung, Handel); Missionen mit KI laufen nach dem Laden
  identisch weiter (alle sechs geprüft).
- Markt: Kosten-/Preisrechnung ganzzahlig, Hin-und-zurück lohnt nicht, Grenzen halten (Fuzz).
- Gebäude-Technologien, Erfahrung, Schaden/Ruinen, Arbeiter-Zyklus: Invarianten im Fuzz halten.
- Engine/Eingabe: alle Fenster-Zuhörer werden beim Spielende abgemeldet; AudioEngine ist ein Einzelobjekt
  mit einmal angemeldeten Zuhörern.
- i18n: Schlüsselgleichheit, Platzhalter und Ablehnungsgründe (bestehender Test) plus Abgleich aller
  `$t`-Schlüssel der Oberfläche.
