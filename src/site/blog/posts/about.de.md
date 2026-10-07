---
title: Worum es geht – ein Spiel, gebaut von KI-Agenten
date: 2026-10-06
teaser: Kronland entstand in vier Tagen mit Claude Code, Bild- und 3D-Modellen. Dieser Blog erzählt im Rückblick, Meilenstein für Meilenstein, wie ein Spiel funktioniert und entsteht – geschrieben für alle, die Informatik im Unterricht hatten und jetzt hinter die Kulissen schauen wollen.
pinned: true
---

## Die Idee {#start}

Kronland ist ein Aufbau-Strategiespiel im Browser – und ein Versuch: Wie weit kommt man, wenn KI-Agenten fast den
ganzen Code, die Grafik, die Musik und die Stimmen schreiben, und ein Mensch die Richtung vorgibt, Ergebnisse
abnimmt und den Geschmack entscheidet? Dieser Blog erzählt die Entstehung **im Rückblick** – aufgeschrieben, als das
Spiel stand – für alle, die so etwas selbst ausprobieren wollen: was wir benutzt haben, wie ein Arbeitsschritt
ablief, was schiefging und wie es gelöst wurde.

Das spielerische Vorbild ist offen benannt: **„Die Siedler – Das Erbe der Könige“** (Blue Byte, 2004). Mechaniken
wie Leibeigene, Zahltag, Motivation, Hauptleute mit Truppen, Helden und Wetter sind daran angelehnt, die Zahlen
stammen aus der Community-Dokumentation (dedk.de-Wiki) und sind in den Spielregeln belegt. Namen, Texte, Helden,
Grafiken und Klänge sind eigene – nichts davon ist aus dem Original übernommen.

Die Arbeit begann am **{{start}}**, der bisher letzte Meilenstein war am **{{end}}** abgeschlossen: {{days}}
Kalendertage, {{milestones}} Meilensteine. Alle Zeiten in diesem Blog sind mitteleuropäische Sommerzeit.

## Für wen dieser Blog ist {#audience}

Geschrieben ist er vor allem für Schülerinnen und Schüler der Oberstufe – und alle anderen –, die im
Informatikunterricht Variablen, Schleifen, Arrays, Objekte und vielleicht schon Graphen oder Rekursion kennengelernt
haben und jetzt wissen wollen: **Wie funktioniert eigentlich ein echtes Spiel, und wie entsteht es?** Die Artikel
erklären die Ideen von Grund auf, mit echten Ausschnitten aus dem Code, Pseudocode, schematischen Abbildungen und
Bildschirmfotos der allerersten Spielfassungen. Fachbegriffe sind mit Wikipedia verlinkt.

Einige Fragen, auf die du hier Antworten findest:

- **Wie läuft ein Spiel ohne Bildschirm?** Warum die Spielregeln ein eigenes Programm sind, das man in der
  Kommandozeile laufen lassen und in Sekunden testen kann – [Simulationskern](blog/simulation-core/#headless).
- **Wie finden Figuren ihren Weg?** Raster oder Polygone, Breitensuche, Dijkstra und A\* mit Heuristik –
  [Simulationskern](blog/simulation-core/#pathfinding).
- **Wie entsteht eine Zufallskarte, die trotzdem fair ist?** Seeds, Rauschen, Floodfill –
  [Simulationskern](blog/simulation-core/#mapgen) und [Gelände und Grafik](blog/terrain-graphics/#noise).
- **Wie wird aus Zahlen ein 3D-Bild?** Szenengraph, Dreiecke, Kamera, Shader – [3D-Darstellung](blog/rendering/#scene).
- **Wie funktioniert ein Computergegner?** Prioritäten, Zustandsautomaten und warum er nicht schummeln kann –
  [Militär und Computergegner](blog/military-ai/#ai).
- **Wie testet man ein Spiel?** Von Vitest über Playwright bis zu Fuzz-Tests mit Unsinnsbefehlen –
  [QA-Runden](blog/qa-fog/#fuzz).

Du musst dafür nicht programmieren können wie ein Profi. Wenn du weißt, was eine Schleife und ein Objekt ist, kannst du
den Code-Ausschnitten folgen; der Text drumherum erklärt, worauf es ankommt.

## Die Zahlen {#numbers}

Stand {{end}}, gezählt im Repository:

| Was | Menge |
|---|---:|
| Kalendertage vom Beginn bis zum letzten Meilenstein | {{days}} |
| Meilensteine (je ein Artikel) | {{milestones}} |
| Programmcode in `src/` (JavaScript, Vue, CSS) | rund 49 000 Zeilen in 227 Dateien |
| Tests: Vitest (84 Dateien) und Playwright (33 Specs) | rund 17 500 Zeilen; {{vitestCount}} Vitest-Tests, jede Playwright-Spec auf Desktop und Pixel 7 |
| Werkzeugskripte (`scripts/`: Asset-Pipeline, Messungen, Bots) | rund 7 000 Zeilen |
| Dokumentation (`docs/`) | rund 4 100 Zeilen in 19 Dateien |
| 3D-Dateien (Gebäude mit Ausbaustufen, Figuren, Natur; mit Detailstufen) | 348 GLB, davon 82 Gebäude- und Naturmodelle ohne Detailstufen und 94 Figurendateien |
| Ton | 12 Musikstücke, 430 Sprachdateien (DE/EN), 24 CC0-Effekte |
| Meshy-Guthaben laut Budget-Buch | knapp 9 700 Credits (das Buch zählt abgelehnte Aufträge mit, ist also eher zu hoch) |

## So ist der Blog aufgebaut {#structure}

Im Rückblick gliedert sich die Entstehung in {{milestones}} Meilensteine, und jeder Meilenstein hat hier einen eigenen
Artikel – datiert auf den Zeitpunkt, an dem er abgeschlossen war. Jeder Artikel erzählt, was entstand, erklärt die
Technik dahinter, berichtet, was nicht klappte und wie es gelöst wurde, und endet mit Tipps zum Nachmachen. Die ersten
Artikel gehen dabei besonders auf die Grundlagen ein; wer der Reihe nach liest, baut Schritt für Schritt ein Bild davon
auf, wie die Teile zusammenspielen. Die Bildschirmfotos in den Artikeln zeigen, wie das Spiel zum jeweiligen Zeitpunkt
wirklich aussah – aufgenommen mit dem Code genau dieses Meilensteins. Der Kasten am Anfang nennt
Zeitraum, Arbeitszeit, geänderte Zeilen und neue Tests (`docs/milestones.json`, Übersicht in `docs/MEILENSTEINE.md`);
zwei Links führen zum Code des Meilensteins und zum ganzen Projekt in diesem Stand. Weitere Artikel kommen einfach
hinten dazu.

## Werkzeuge {#tools}

### Agenten

- **Claude Code** mit Claude Opus 5.5 schreibt Code, Tests und Doku. Jede Aufgabe läuft in einer eigenen Sitzung
  auf einem eigenen Zweig und wird danach in `main` übernommen.
- **Mehrere Sitzungen und Subagenten parallel.** Ab dem 4. Oktober liefen oft fünf und mehr Aufgaben gleichzeitig
  (Entwicklermodus, Bauen am Hang, Spielstände, Website, Erweiterung wurden zwischen 10:29 und 11:15 Uhr begonnen).
  Eine Sitzung kann Teilaufgaben an Subagenten abgeben, z. B. Recherche im Code oder diesen Blog.
- **CLAUDE.md** im Repository hält die festen Regeln für alle Sitzungen fest: Stack, deterministische Simulation,
  Zweisprachigkeit, Handy, Lizenzen, Tests vor der Übernahme.

### Spiel

- **Vite**, **Vue 3** (Options API) für Oberfläche und Website, **Three.js** für die 3D-Welt – reines JavaScript
  mit JSDoc, kein TypeScript.
- **Deterministische Simulation** in `src/sim`: nur Ganzzahlen (Milli-Kacheln, ganzzahlige Wurzel), Zufall mit Seed,
  fester 100-ms-Takt, Befehle als einzige Eingabe, Zustands-Hash. Darstellung und Oberfläche lesen nur. Das macht
  Tests, Spielstände, Bots und später Mehrspieler im Gleichschritt möglich.
- Eine kleine **Python-Teilmenge mit eigener Bytecode-VM** für die Programmier-Abenteuer – ebenfalls deterministisch.
- **PWA** mit Service-Worker, alle Spieldateien mit Inhalts-Hash im Namen.

### Prüfen

- **Vitest** für Simulation, KI, Darstellungslogik, Website, Werkzeuge – inklusive Fuzz-Tests mit Unsinnsbefehlen
  und Dauerläufen mit vier Computergegnern.
- **Playwright** für alles Sichtbare, immer auf Desktop und Handy (Pixel 7), headless mit Software-Grafik
  (SwiftShader). Ergebnisse werden mit Bildschirmfotos in 1440 × 900 und im Handyformat belegt.
- **Bots:** KI gegen KI (`scripts/ai-match.js`) und ein Missions-Bot, der jede Kampagnenmission auf mehreren
  Karten gewinnen muss (`scripts/campaign-matrix.js`).

### Grafik und Ton

- **Bildmodelle über OpenRouter** für Konzepte, Symbole, Porträts, Titelbild und Bodentexturen:
  `openai/gpt-5.4-image-2` (Figurenbögen, Symbol-Atlas), `google/gemini-3-pro-image` (Bearbeitungen),
  `bytedance-seed/seedream-5-0-flash` (Gebäude, Bäume, Texturen; 0,02 $ je Bild).
- **Meshy** (ab Version 7.1 mit PBR) macht aus den Konzepten 3D-Modelle, Rigs und Bewegungen. Eigene Skripte
  (`scripts/asset-gen/`) erledigen Ansichten zuschneiden, Nachbearbeitung, Detailstufen und Spielfotos.
- **Lyria 3 Pro** komponiert die Musik, **Seed Audio** spricht die Stimmen, **Gemini** hört beides vor
  (Gesang im Instrumentalstück? stimmt der gesprochene Wortlaut?).
- **CC0-Klänge** von Kenney und Freesound für Arbeits- und Kampfgeräusche; der Rest ist im Spiel synthetisiert.
- Nur freie (CC0) oder selbst erzeugte Dateien; Herkunft jeder Datei steht in der Danksagung, Prompts und
  Auftragsnummern liegen unter `assets-src/`.

## Frag eine KI nach dem Code {#ask-ai}

Der gesamte Code von Kronland ist öffentlich: [github.com/wi-wissen/Kronland](https://github.com/wi-wissen/Kronland).
Rund 49 000 Zeilen sind viel zum Lesen – aber du musst sie nicht allein lesen. Gib die Adresse des Repositorys einem
KI-Assistenten, der Code lesen kann (zum Beispiel Claude), und stell ihm deine Fragen. Ein KI-Assistent kann dir
Dateien zeigen, Abläufe Schritt für Schritt erklären und Fachbegriffe übersetzen – und du kannst so lange nachfragen,
bis es klick macht. Ein paar Fragen zum Einstieg:

- „Erkläre mir, was in `src/sim/sim.js` in einem einzigen Takt passiert – Schritt für Schritt.“
- „Wie findet ein Leibeigener in Kronland seinen Weg zu einem Baum? Zeig mir die Stellen im Code.“
- „Warum benutzt die Simulation keine Kommazahlen und kein `Math.random`? Was würde sonst schiefgehen?“
- „Wie entscheidet der Computergegner, was er als Nächstes baut?“
- „Wie wird aus der Höhenkarte in `src/sim/map.js` das 3D-Gelände, das ich im Browser sehe?“
- „Ich möchte ein neues Gebäude hinzufügen. Welche Dateien muss ich anfassen?“
- „Wie kann ich zwei Computergegner ohne Grafik gegeneinander spielen lassen, und was bedeutet die Ausgabe?“

Ein Tipp dazu: Lass dir nicht nur Antworten geben, sondern frag nach den Stellen im Code und schau sie dir selbst an.
Und wenn etwas widersprüchlich klingt, frag nach – auch eine KI liegt manchmal daneben. Genau so ist übrigens dieses
Spiel entstanden: im Gespräch zwischen einem Menschen und KI-Agenten.

## So lief ein Meilenstein ab {#process}

1. **Aufgabe beschreiben.** Der Mensch formuliert ein Ziel in ein paar Sätzen („Bauen am Hang wie im Vorbild“,
   „eigene Musik statt Synthese“).
2. **Regeln zuerst.** Neue Mechaniken landen zuerst in `docs/SPIELREGELN.md` und in den Datentabellen
   (`src/sim/data/`), dann in der Simulation – mit Vitest-Tests, bevor irgendetwas gezeichnet wird.
3. **Darstellung und Oberfläche** lesen den neuen Zustand; Texte kommen gleich zweisprachig in die Wörterbücher.
4. **Sichtbares bekommt eine Playwright-Spec** und Bildschirmfotos auf Desktop und Handy. Die Bilder gehen mit in
   die Abnahme.
5. **Assets** laufen als eigene Pipeline: Konzept → Vorschau in Spielgröße → Abnahme durch den Menschen →
   3D/Ton → Nachbearbeitung → Spielfoto. Billiges zuerst prüfen, Teures (Meshy-Credits) erst danach.
6. **Doku nachziehen** (README, `docs/`), den aktuellen Stand von `main` hereinholen, `npm test`, `npm run build`,
   betroffene E2E-Specs – dann in `main` übernehmen. Größere Zweige bekamen vorher eine Durchsicht (Review).

## Was nicht geklappt hat {#lessons}

Vieles – und genau das ist der interessanteste Teil. Werkzeuge, die in der Hand schweben, ein leeres Meshy-Guthaben,
ein Speicherleck je Spielstart, Musik mit Gesang trotz Verbot, Tests, die unter Software-Grafik zu langsam sind: Die
Lösungen stehen jeweils im Artikel des Meilensteins, in dem das Problem auftrat. Wer es ausführlich will, findet die
Protokolle im Repository: `docs/ASSET-ERKENNTNISSE.md`, `docs/QA-BERICHT.md`, `docs/PERFORMANCE.md`, `docs/AUDIO.md`.

## Tipps zum Nachmachen {#tips}

- **Erst die Regeln, dann die Grafik.** Eine deterministische Simulation mit Tests trägt alles andere: Bots,
  Spielstände, Fuzz-Tests und Fehlersuche per Zustands-Hash.
- **Eine CLAUDE.md mit festen Regeln** spart in jeder Sitzung Erklärungen – kurz halten, auf Doku verweisen.
- **Kleine, parallele Aufgaben** mit eigenem Zweig; vorher den aktuellen Stand von `main` hereinholen. Große Zweige (bei uns die
  eigene Grafik mit über 2 000 Dateien) brauchen am meisten Abstimmung.
- **Jede sichtbare Änderung mit Bildschirmfotos belegen,** Desktop und Handy – auf Bildern fallen Fehler auf, die
  kein Test bemerkt (abgeschnittene Kopfleiste bei 130 %, Menü im Querformat nicht erreichbar).
- **Geschmack bleibt beim Menschen:** Figuren, Stimmen und Musik hat der Nutzer abgenommen; KI-Prüfer (Gemini als
  „Ohr“) filtern nur offensichtliche Fehler vor.
- **Assets in Spielgröße beurteilen,** nicht in der Großansicht – eine Figur ist im Spiel nur rund 25 Pixel hoch.
- **Herkunft protokollieren:** Prompt, Modell, Kosten und Auftragsnummer zu jeder Datei. Das macht Lizenzen
  nachvollziehbar und Ergebnisse wiederholbar.
- **Erkenntnisse aufschreiben** (bei uns `docs/ASSET-ERKENNTNISSE.md`, `QA-BERICHT.md`, `PERFORMANCE.md`), damit
  die nächste Sitzung nicht dieselben Umwege geht.

## Vorbild und Rechte {#inspiration}

Kronland ist ein Hobbyprojekt und kein offizielles Produkt. Die Spielmechanik folgt „Die Siedler – Das Erbe der
Könige“ (Blue Byte, 2004); Namen, Texte, Helden, Grafiken, Musik und Stimmen sind eigene oder freie (CC0) Werke.
Wer was beigetragen hat, steht in der [Danksagung im Handbuch](manual/#licenses).
