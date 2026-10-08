# Kronland

Aufbau-Strategiespiel im Browser nach dem Vorbild von *Die Siedler – Das Erbe der Könige*.
Desktop und Handy, Einzelspieler gegen Computergegner, Multiplayer vorbereitet.
Arbeitstitel; Name, Grafiken und Texte sind eigene.

## Starten

```bash
npm install
npm run dev     # Entwicklungsserver: Startseite /, Spiel /play/, Handbuch /manual/, Kompendium /compendium/, Programmier-Referenz /scripting/, Blog /blog/
npm test        # Simulationstests (Vitest)
npm run test:e2e  # Oberflächentests Desktop + Handy (Playwright); anderer Port: E2E_PORT=4204 npm run test:e2e
npm run build   # Produktionsbuild nach dist/ (statische Website, alle Pfade relativ)
```

## Website

| Adresse | Inhalt |
|---|---|
| `./` | Startseite: Titelbild (Spielszene als Video-Loop), Funktionen, Galerie, „Für die Schule“ (Entwicklermodus), Danksagung |
| `play/` | das Spiel (URL-Parameter wie unten, z. B. `play/?seed=42`; PWA mit Start `play/`) |
| `manual/` | Handbuch DE/EN mit Inhaltsverzeichnis, Suche, Druckansicht (Markdown in `src/site/manual/`) |
| `compendium/` | Kompendium: alle Werte und Formeln mit Seitenleiste, Suche, Deep-Links – alle Tabellen aus `src/sim/data/` erzeugt, neue Inhalte erscheinen automatisch |
| `scripting/` | Programmier-Referenz: Kronland-Python (Ablauf, Sprache, Fehler) und jeder Befehl mit Parametern, Rückgabe, typischen Fehlern und Beispiel; Python-Beispiele zeigen ihre echte Ausgabe, Tests prüfen jedes Beispiel |
| `blog/` | Blog: wie Kronland entstanden ist, im Rückblick – ein Artikel je Meilenstein (DE/EN, Markdown in `src/site/blog/posts/`), Meilensteine (je ein Commit auf `main`) in [docs/MEILENSTEINE.md](docs/MEILENSTEINE.md) |

Online unter **https://kronland.wi7.net/** – jeder Push auf `main` wird per GitHub Pages veröffentlicht, Links
zeigen beim Teilen eine Vorschau (Open Graph).

Aufbau, Erweitern von Handbuch und Kompendium, Pfade, PWA, Linkvorschau und Veröffentlichung: [docs/WEBSITE.md](docs/WEBSITE.md). Laden und Caching (Inhalts-Hash, Datenmengen): [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Simulationskern: Karte, Leibeigene, Bauen, Abbau, Zahltag, Determinismus | fertig |
| 2 | 3D-Darstellung und Steuerung (Desktop + Touch) | fertig |
| 3 | Arbeiter, Veredelung, Motivation, Steuern, Forschung | fertig |
| 4 | Militär, Kampf, Türme, Helden, Wetter, Siegbedingung | fertig |
| 5 | Computergegner (Leicht, Normal, Schwer) | fertig |
| 6 | CC0-Modelle (KayKit), Startmenü, Speichern/Laden, PWA, CI | fertig |
| 7 | Missionssystem, Tutorial, Kampagne mit 6 Missionen | fertig |
| 8 | Gebäude-Technologien, Marktplatz, Wetterturm/-kraftwerk, Erfahrung, Brand/Reparatur/Ruinen | fertig |
| 9 | Nebel des Krieges (unerkundet/erkundet/sichtbar, zuletzt gesehene Gebäude, faire KI) | fertig |
| 10 | Erweiterungsinhalte: Brücken, Brunnen, Denkmal (Wirtshaus, Dieb, Kundschafter, Büchsenschützen wieder entfernt) | fertig |
| 11 | Website: Startseite, Spiel unter `play/`, Handbuch, Kompendium aus den Spieldaten | fertig |
| 12 | Python-Skripte (eigene VM), Lernabenteuer mit Debugger, Skript-Missionen, Welteneditor | fertig |
| 13 | Kampagne „Krone aus Eis“: Helden Nelia, Orrin, Taran, Malvor, mehrere Helden je Spieler, Diplomatie, Dörfer, Gesprächsfiguren, Tribute | fertig |

## Spielen

- **Tutorial**: Der Händler Orrin führt Nelia in 18 Schritten durch Leibeigene, Bauen, Arbeiter, Forschung und Kampf.
- **Kampagne** „Krone aus Eis“: sechs Karten in drei Akten (Winter, Krieg, Wissen). Die Leibeigenentochter Nelia
  sammelt mit dem Händler Orrin die fünf Zacken der zerbrochenen Krone – im Wettlauf mit Malvor, der damit König
  werden will –, zerstört sein Wetterwerk, gewinnt Hauptmann Taran und stürmt das Inselschloss über den gefrorenen
  See. Kaufen oder Kämpfen (Tribute), Dörfer (Diplomatie), Gesprächsfiguren. Jede Mission schaltet wenige neue
  Gebäude und Forschungen frei (der Rest steht ausgegraut im Menü), Figuren stellen Neues vor, ein Zeiger zeigt auf
  den Knopf; der Gegner legt erst nach einem Meilenstein des Spielers los. Story und Mechanik: [Kampagne](docs/KAMPAGNE.md). Fortschritt und Bestzeiten
  speichert der Browser. Direktstart: `play/?mission=c1` … `play/?mission=c6`, `play/?mission=tutorial`.
- **Programmier-Abenteuer**: Nelia mit Python steuern – fünf Lernabenteuer (Schleifen, Bedingungen, Funktionen,
  Listen) und die erste Kursmission „Im Schneetreiben“ (drei Etappen, Zettel der Magd, Vorhersage), Code-Panel neben dem Spiel (ziehbare Trennlinie, einklappbar; am Handy als Blatt mit „Spiel ansehen“)
  mit Einzelschritt, Haltepunkten und Variablenansicht, Knopf „Referenz“ zur Website, Befehlserklärung beim Überfahren (Strg+Klick öffnet die
  Referenz, am Handy langes Drücken), Fehlermeldungen mit Vorschlag, bernsteinfarbene Hinweise (Programm läuft weiter),
  Taler und Christrosen zum Aufheben, Trampelpfade und Fußabdrücke im Schnee, am Handy folgt die Kamera der gesteuerten Figur,
  `print()` in die Konsole, `notify()` als Meldung im Spiel, Programm als `.py` speichern und öffnen. **Ausführen startet
  die Etappe neu** (Schnappschuss je Unterziel), der aktive Auftrag steht oben im Panel, Figuren stecken **Zettel** mit
  Code zu („Zurück zu meinem Code“), Ereignisse (`@every`, `@on_enter` …) auch im eigenen Programm mit Haltepunkten,
  Zeilen verschieben mit Alt+↑/↓ bzw. ⇡ ⇣ in der Tastenleiste.
  Dazu die Skript-Mission „Der Überfall“, der **Welteneditor** (Gelände, Wald, Gegenstände, Spuren, Orte, Missionen programmieren,
  Welt aus Code erzeugen, Bilder, Töne und 3D-Modelle beilegen, als `.zip` speichern, testspielen). Ein Level ist
  ein Ordner (`scenario.json`, `.py`-Dateien, `assets/`) und reist als `.zip` – auch per Link von einem statischen
  Host (`play/?level=https://…/level.zip`). Missionen in Python: Ziele mit Fortschritt, Gesprächsfiguren (`npc()`,
  `@on_talk`), `@on_event`, Texte zweisprachig direkt im Code.
  Direktstart: `play/?mission=adv1` … `adv5`, `play/?mission=r1-4`, `play/?mission=m1`. Alles dazu: [Skripte](docs/SKRIPTE.md).
- **Sonderkarten** (Startmenü → „Sonderkarten“): fertige Einzelkarten ohne Sieg und Niederlage, ohne Nebel.
  - **Schaukasten** (`play/?mission=showcase`): jedes Gebäude in jeder Ausbaustufe, Baustellen, Ruinen, Brücke,
    Rohstoffe, Arbeiter jedes Berufs, alle Truppen, die vier Helden, Räuber und ein Lagerfeuer – zum Prüfen der Modelle.
  - **Gewimmel** (`play/?mission=bustle`): Belastungsprobe mit vier ausgebauten Städten (~180 Gebäude), über
    tausend Figuren und zwei Schlachten mit ständigem Nachschub – zum Prüfen der Darstellung unter Last.
  Details: [Missionen](docs/MISSIONEN.md#sonderkarten).
- **Freies Spiel**: Im Startmenü Gegnerzahl (1–3), Stärke, Held (Nelia, Orrin, Taran oder Malvor), Nebel des Krieges an/aus und Karte wählen.
- Direktstart per Adresse: `play/?seed=42&ai=hard&players=3&hero=orrin` (ohne Nebel: `&fog=off`)
- **Links teilen**: Beim Spielstart steht der Start-Link der Karte in der Adresszeile; im Spielmenü (Pause) zeigen
  „Karte: 62921“ und „Link kopieren“ (Handy: „Link teilen“) ihn an. Der Link startet die Karte **von vorn** mit
  denselben Einstellungen (bzw. `?mission=<id>`), nicht den aktuellen Spielstand; geladene Spielstände haben keinen
  Link. Parameter: [Architektur](docs/ARCHITEKTUR.md#url-parameter).
- **Brücken und Zierden** nach Vorbild der Siedler-5-Erweiterungen, fest im Spiel: Brücken an Brückenstellen über
  Flüsse (Mathematik), Brunnen und Denkmal für mehr Motivation. Die KI baut sie auch. Details:
  [Erweiterung](docs/ADDON.md), [Spielregeln §13](docs/SPIELREGELN.md#13-brücken-und-zierden).
- **Nebel des Krieges** wie im Original: Unerkundetes ist schwarz, Erkundetes abgedunkelt mit dem zuletzt
  gesehenen Stand feindlicher Gebäude, Feinde sieht man nur in Sichtweite. Die KI schummelt nicht.
  Sichtweiten und Regeln: [Spielregeln §12](docs/SPIELREGELN.md#12-sicht-und-nebel-des-krieges).
- Grafikstufe: automatisch (Handy/ohne Grafikkarte niedrig, Desktop hoch), erzwingbar per `?quality=low|medium|high`
  (wird gemerkt; im Code: `setQuality()` aus `src/render/quality.js`). Objekte werden je nach Abstand/Zoom
  vereinfacht (Detailstufen; Figuren und Bäume nach ihrer Größe auf dem Bildschirm, kleine Deko schrumpft in der
  Ferne in den Boden und wird dann gar nicht mehr gezeichnet), Figuren sind instanziert und GPU-animiert. Figuren haben zwei Darstellungen:
  ein detailliertes Nahmodell beim Heranzoomen und ein flach gefärbtes, gut lesbares Spielmodell, umgeschaltet
  nach ihrer Bildschirmhöhe mit kurzer Überblendung – Details in [Modelle](docs/MODELLE.md). Der Boden ist gemalt
  (sechs nahtlose Texturen aus der Bild-KI, [Bodentexturen](docs/BODEN.md)), mit Rückfall auf im Code gemalte Texturen;
  Bäume und Büsche sind eigene Modelle (Eiche, Buche, Birke, Fichte, Kiefer, Busch), die im Winter gegen kahle bzw.
  verschneite Fassungen getauscht werden; Felsen, Stümpfe, Rohstoffhaufen und Schächte tragen gemalte Fels- und
  Rindenstruktur (triplanar, ohne mehr Polygone).
- **Nahkampf im Kreis**: Schwertkämpfer, Speerträger und Ritter umzingeln ihr Ziel auf eigenen Plätzen statt
  auf einem Punkt zu stehen; Figuren am selben Fleck werden leicht versetzt gezeichnet
  ([Spielregeln §8](docs/SPIELREGELN.md#8-militär), [Architektur](docs/ARCHITEKTUR.md#darstellung-srcrender)).
- **Ruhende Figuren im Kreis**: Rastende sitzen rund ums Lagerfeuer, wartende Arbeiter stehen im Bogen vor ihrem
  Gebäude, Holzfäller rund um den Stamm – jeder auf einem eigenen Punkt, mit Blick zum Ziel
  ([Spielregeln §3](docs/SPIELREGELN.md#3-leibeigene), [§4](docs/SPIELREGELN.md#4-arbeiter-motivation-steuern)).
- Kamera wie ein Kartenprogramm: Ziehen (mittlere Maustaste, ein Finger) greift den Boden, Mausrad und
  Zwei-Finger-Zoom zoomen zum Zeiger bzw. zur Fingermitte, nichts gleitet oder wippt nach.
- **Bewegte Gebäude**: Mühlenflügel, Windrad, Wasserrad und Wetterhahn drehen sich ([Modelle](docs/MODELLE.md#bewegliche-teile-flügel-räder-wetterhahn)).
- Nahzoom bis dicht an Figuren und Gebäude; ganz nah wird der Blick flacher, Figuren und Gebäude bleiben in
  voller Detailstufe ([Architektur](docs/ARCHITEKTUR.md#steuerung)).
- **Doppelklick bzw. Doppeltippen** auf eine eigene Figur wählt alle eigenen Figuren derselben Art im Bild
  (Leibeigene, Miliz, Trupps eines Einheitentyps, Helden); Umschalt/Strg+Doppelklick fügt hinzu. Bewusste
  Abweichung vom Vorbild, wie in gängigen Echtzeitstrategiespielen.
- **Entwicklermodus** (auch für den Informatik-Unterricht): Drahtgitter und Detailstufen, A*-Wegsuche Schritt für Schritt,
  Raster-Overlays, Figurenzustände, „Statistik für Nerds“. Einschalten: Einstellungen, `?dev=1` (oder `?debug=1`),
  F3 bzw. Strg+Umschalt+D – siehe [Entwicklermodus](docs/ENTWICKLERMODUS.md).
- Karten werden aus dem Seed erzeugt: Hügel, Täler, Gebirge mit Gipfeln, Flüsse mit Furten, Seen, Küsten.
  Steilhänge und Gipfel (Klippen) sind unpassierbar und nicht bebaubar. Größen 96/128/160 (`generateMap(seed, { size })`).
- **Bauzeiten wie im Original**: Die Bauzeit gilt für einen Leibeigenen, n Leibeigene brauchen ein n-tel davon
  (Wohnhaus 80 s allein, 20 s zu viert); je nach Gebäude bauen 1, 4, 6 oder 8 mit. Ausbauten laufen von selbst
  ohne Leibeigene. Werte aus den Original-XMLs: [Spielregeln §6](docs/SPIELREGELN.md#6-gebäude).
- **Bauen am Hang**: Mäßige Hänge (bis 4 m Höhenunterschied unter dem Gebäude) werden beim Setzen der Baustelle
  dauerhaft eingeebnet; die Bauvorschau zeigt grün (eben), gelb (wird eingeebnet) oder rot (zu steil).
  Regeln und Recherche: [Spielregeln §6a](docs/SPIELREGELN.md#6a-bauen-am-hang).
- **Spielstände**: beliebig viele im Browser (IndexedDB, komprimiert) mit Vorschaubild, Datum, Spielzeit und Modus;
  speichern, überschreiben, umbenennen, löschen über Menü → „Spiel speichern“ bzw. „Gespeichertes Spiel laden“
  und im Startmenü unter „Spielstände“. „Weiterspielen“ lädt den neuesten Stand. **Autosave** 30 Spielsekunden nach dem Start, danach alle
  2 Spielminuten und beim Verlassen (abschaltbar unter Einstellungen). **Fehlerdialog**: hält ein Fehler das Spiel
  an, bietet ein Dialog „Letzten Spielstand laden“ oder „Seite neu laden“; danach weist das Startmenü auf
  „Weiterspielen“ hin ([Architektur](docs/ARCHITEKTUR.md#spielschleife-und-fehler)). **Export/Import** als lesbare JSON-Datei
  (`kronland-<name>-<datum>.json`, wahlweise kompakt) – per Dateiauswahl (auch Handy) oder Ziehen & Ablegen.
  Gespeichert wird der vollständige Simulationszustand (inkl. eingeebnetem Gelände), nicht der Entwicklermodus.
  Format, Prüfung und Migration: [Architektur → Spielstände](docs/ARCHITEKTUR.md#spielstände-srcsave).
- **Ton**: eigene Musik (Lyria 3: fünf Aufbaustücke, eigene Wintermusik, zwei Kampfthemen, Menü, Sieg/Niederlage) mit Pausen zwischen den Friedensstücken, echte Arbeitsgeräusche (Kenney, CC0), räumliche Effekte, vertonte Dialoge – [docs/AUDIO.md](docs/AUDIO.md).
- Spielerfarbe wählbar (Blau, Rot, Grün, Ocker) unter Einstellungen; wer sonst diese Farbe hätte, bekommt die bisherige des Spielers (gilt ab dem nächsten Spielstart, auch in Missionen).
- Sprache Deutsch/Englisch, Grafikstufe, Lautstärken, Pausen zwischen Musikstücken, Häufigkeit der Sprüche der Figuren, Oberflächengröße, Randscrollen, Beschriftungen, „Dialoge vorlesen“ und „Kamera bei Dialogen“ (fährt nah an die sprechende Figur) im Menü „Einstellungen“ (Startmenü und Spielmenü).
- **Spieloberfläche** aus freistehenden Schildern mit Abstand zum Bildrand, jedes nur so breit wie sein Inhalt – die Mitte gehört
  der Karte: oben Rohstoffe, Wappen genau in der Bildschirmmitte mit Zahltag-Medaillon (Sekunden erst kurz vorher, ein Lichtimpuls am
  Zahltag) und Münzknöpfe für Pause (hält auch alle Animationen sowie Musik, Umgebung und Spielgeräusche an, Welt in Graustufen, Schild „Pausiert“ unten mittig, bei offener Auswahl klein unter der Kopfleiste), Tempo (Ausklappmenü 1× · 2× · 4×), Ton (stumm, Musik, Effekte, Gesamt) und Menü; unten links die Kartentafel: eckige Minikarte (Rechtsklick bzw. Tippen mit Auswahl schickt die Figuren dorthin), links daneben der Schnellzugriff
  als eckige Knöpfe ohne Namen (Burg, Untätige mit Zahl, Alle Leibeigenen, Truppen), darüber die Heldenporträts übereinander (Klick wählt den Helden und holt ihn ins Bild; bewusstlos: grau mit Restzeit bis zum Aufwachen) und die
  **Steuergruppen** (Umschalt+1–9 merkt die Auswahl, 1–9 ruft sie ab, zweimal holt sie ins Bild; am Handy über
  „Als Gruppe merken“),
  Befehlstafel nur bei Auswahl und Porträt der Auswahl (Titel und Porträt passend zur gezeichneten Figur: „1 Leibeigene“,
  „Schmiedin“ …, siehe docs/MODELLE.md#varianten-und-geschlecht). Das Baumenü zeigt alle Gruppen nebeneinander, wo das nicht passt (mittlere Fenster, Handy) als Reiter.
  Leibeigene: Aktionsleiste (Bauen [B], Zu den Waffen, Gruppe) oder Baumenü mit „‹ Zurück“ – die letzte Ansicht
  bleibt gemerkt; Gebäude-Infos (Kosten, Bauzeit, Arbeiter, fehlende Forschung) als Infoleiste über der Tafel
  (Maus darüber, Handy lang drücken); Esc geht schrittweise zurück.
  Nichts überlappt: bei weniger Breite brechen Leisten um, Karte und Kacheln werden kleiner, am Handy wird die
  Tafel zur Schublade. Große Rohstoffmengen erscheinen ab 10 000 gekürzt („50k“, genauer Wert im Tooltip); reicht der
  Platz trotzdem nicht, wird die Rohstoffleiste zweizeilig, das Wappen bleibt in der Zeile. Am Handy: unten rechts nur
  ein Kartenknopf, der Minikarte und Schnellzugriff als kleine Tafel aufklappt; Helden als Reihe darüber; die Ziele
  als kleiner Knopf oben links, der sie bildschirmfüllend zeigt („Ziel zeigen“ springt hin und schließt die Ansicht).
- **Angriffswarnung**: Sturmglocke, Hilferuf der Getroffenen (vertont) und roter Puls an der Stelle auf der Minikarte
  (am Handy pulsiert der Kartenknopf), auch bei Fernangriffen; fremde Figuren und Gebäude nennen ihre Diplomatie (Feind,
  neutral, verbündet). Angegriffene Leibeigene fliehen; gewählte Leibeigene greifen einen angeklickten Gegner an (wie beim Holzhacken).
- **Meldungen mit Kategorien**: Angriff, Brand und bewusstloser Held stehen als Dauerwarnung, solange der Anlass anhält;
  gleiche Meldungen werden gebündelt („12 Beförderungen“), jede Kategorie behält einen Platz; Sprung per Klick, × schließt
  ([Architektur](docs/ARCHITEKTUR.md#sprache-und-oberfläche)).
- **Lagerfeuer zeigen Wohnungsnot**: Arbeiter ohne Bett oder Essplatz entzünden nahe ihrer Werkstatt ein Lagerfeuer
  (auch auf der Minikarte), das wieder ausgeht, sobald dort alle untergebracht sind ([Spielregeln §4](docs/SPIELREGELN.md#4-arbeiter-motivation-steuern)).
- Jedes Symbol ist erklärt: Maus darüber (Desktop) oder **lang drücken** (Handy) zeigt Name, Kosten und Erklärung,
  ohne die Aktion auszulösen. Was nur bei einer Auswahl erscheint (Baumenü, Befehle von Gebäuden und Truppen),
  ist immer beschriftet; „Beschriftungen anzeigen“ (am Handy standardmäßig an) setzt zusätzlich Namen unter
  den Schnellzugriff und an die Forschungslinien.
- Auf dem Handy als App installierbar (PWA, startet `play/`); der Spielcode ist danach offline verfügbar.
- Steuerung: siehe [Architektur](docs/ARCHITEKTUR.md#steuerung) oder Menü → „Steuerung anzeigen“.

## KI gegen KI

```bash
node scripts/ai-match.js 1 60 hard easy   # Seed, Minuten, Stärke Spieler 1 und 2
node scripts/stress-run.js bustle 20       # Dauerlauf ohne Grafik: Takt-Zeiten, Figuren, Spielstand je Minute (--build=5: Spieler baut)
```

Veredler-Leistung je Motivation und Haus/Hof nachmessen (Abgleich mit dem Vorbild, siehe [Spielregeln §4](docs/SPIELREGELN.md#4-arbeiter-motivation-steuern)):

```bash
node scripts/refiner-analysis.js 10 300 200 100 50 30   # Minuten, Motivationsstufen
```

Truppen gegeneinander antreten lassen (Abstimmung der Truppenwerte, siehe [Spielregeln §8](docs/SPIELREGELN.md#8-militär)):

```bash
node scripts/troop-duels.js 6   # Anzahl Seeds je Duell
```

## Modelle neu erzeugen

Die verwendeten Modelle liegen fertig in `public/models/`. Von KayKit kommen nur noch Baugerüst, Bauphasen,
Trümmer, Felsen und Felsgipfel; zum Neuerzeugen das Paket `KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`
von GitHub holen und dann:

```bash
scripts/build-assets.sh <Pfad Hexagon-Paket>
```

Das Skript optimiert die Modelle und erzeugt die Detailstufen `*.lod1.glb`, `*.lod2.glb` (`scripts/build-lods.mjs`).
Bäume und Büsche sind eigene Meshy-Modelle (`public/models/buildings/tree_*.glb`, `bush*.glb`, mit Winterfassung,
siehe [docs/MODELLE.md](docs/MODELLE.md#bäume-und-büsche)).
Zuordnung Gebäudetyp → Modell: `src/render/assets.js`; Figuren: `public/models/characters/manifest.json`.
Eigene Figuren erzeugen (Konzeptbild → Meshy → Nachbearbeitung, `scripts/asset-gen/`) und einbauen:
[docs/MODELLE.md](docs/MODELLE.md), Stilregeln und Prompts: [docs/STIL.md](docs/STIL.md).
Leibeigene erscheinen zufällig, aber stabil als Leibeigener oder Leibeigene (Teamfarbe an Mütze/Haarband und Schal),
mit Axt, Hammer und Spitzhacke je nach Tätigkeit.
Reiter sitzen auf einem eigenen Pferdemodell (Rig von Hand in Meshy, Bewegungen Stehen/Schritt/Galopp/Sterben selbst
geschrieben: `node scripts/asset-gen/horse.mjs`, siehe [docs/MODELLE.md](docs/MODELLE.md#pferd-reittier)); die Hufe laufen im
Tempo der Einheit, der Reiter hebt und senkt sich mit dem Rücken des Pferds.
Ohne Modelle zeigt das Spiel prozedurale Platzhalter.

Die bunten Symbole (Rohstoffe, Gebäude, Einheiten …) stammen aus einem Sprite-Atlas, den ein Bildmodell
(OpenRouter, `openai/gpt-5.4-image-2`) im Stil der Figuren gemalt hat. Neu erzeugen mit
`scripts/icons/` – Ablauf in [docs/SYMBOLE.md](docs/SYMBOLE.md).

## Mitarbeiten

- **Sprache:** Quelltext, Bezeichner, Kommentare im Code, Dateinamen, Commit-Nachrichten und Pull Requests auf
  Englisch; Markdown-Doku (README, `docs/`) und Spielertexte auf Deutsch (Spielertexte zusätzlich englisch).
- Ein Branch je Aufgabe, Pull Request gegen `main` (Squash); vorher `npm test`, `npm run build` und die betroffenen
  E2E-Specs. Weitere feste Regeln (Determinismus der Simulation, Assets, i18n): [CLAUDE.md](CLAUDE.md).

## Dokumentation

- [Spielregeln](docs/SPIELREGELN.md)
- [Erweiterungsinhalte: Recherche, Auswahl, Technik](docs/ADDON.md)
- [Architektur](docs/ARCHITEKTUR.md)
- [Missionen schreiben](docs/MISSIONEN.md)
- [Modelle, Figuren, Detailstufen](docs/MODELLE.md)
- [Erkenntnisse aus der Asset-Erzeugung (Bildmodelle, Meshy, Werkzeuge)](docs/ASSET-ERKENNTNISSE.md)
- [Figurenstil und Prompts (Pipeline)](docs/STIL.md)
- [Symbole aus dem Bildmodell (Atlas, Prompts, Neuerzeugung)](docs/SYMBOLE.md)
- [Boden- und Naturtexturen aus der Bild-KI (Erzeugen, Nahtlos, Farbabgleich)](docs/BODEN.md)
- [Stilreferenz für Figuren und Symbole](docs/STILREFERENZ.md)
- [Ton: Effekte, Musik, Stimmen, eigene Audiodateien](docs/AUDIO.md)
- [Entwicklermodus: was man zeigen kann, Unterrichtsideen](docs/ENTWICKLERMODUS.md)
- [QA-Bericht: Befunde, Fuzz-/Dauertests, Leistung](docs/QA-BERICHT.md)
- [Website: Seiten, Handbuch und Kompendium erweitern](docs/WEBSITE.md)
- [Laden, Caching und Datenmengen (Inhalts-Hash, Service-Worker, Ladebericht)](docs/PERFORMANCE.md)
- [Rohdateien der Asset-Pipeline außerhalb von Git](docs/ROHDATEIEN.md)
- [Lizenzen und Danksagung](CREDITS.md)
