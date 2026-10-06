# Meilensteine

Die Entstehung von Kronland in Abschnitten (Zeiten Europe/Berlin). Jeder Meilenstein entspricht genau einem Commit
auf `main`. Maschinenlesbar: [milestones.json](milestones.json); auf der Website hat jeder Meilenstein einen
Blog-Artikel (`blog/<id>/`, Text in `src/site/blog/posts/<id>.de.md` und `.en.md`) mit Links zum Code des
Meilensteins und zum Projekt in diesem Stand.

Pflege: In `milestones.json` `id`, Titel, Zusammenfassungen, Zeiten und `commit` (volle SHA auf `main`) eintragen,
dann `node scripts/milestones.mjs` (prüft die Reihenfolge, berechnet geänderte Zeilen und Testfälle aus dem Commit
und schreibt diese Datei neu). `tests/site/blog.test.js` prüft Reihenfolge, Artikel und – sobald `commit`
gesetzt ist – die Zuordnung zu `main`.

Stand: 16 Meilensteine, 3.10.2026 11:51 bis 6.10.2026 21:56.

| # | Meilenstein | Beginn | Ende | Commit |
|---|---|---|---|---|
| 1 | Simulationskern | 3.10.2026 11:51 | 3.10.2026 11:51 | [`6799be7`](https://github.com/wi-wissen/Kronland/commit/6799be7b230e6d356b8e039d716872cd01ee2f69) |
| 2 | 3D-Darstellung und Steuerung | 3.10.2026 12:07 | 3.10.2026 12:08 | [`8ff6071`](https://github.com/wi-wissen/Kronland/commit/8ff6071e6d27872fba905f5b3db2bdf4480eac8b) |
| 3 | Wirtschaft | 3.10.2026 12:17 | 3.10.2026 12:17 | [`f87cb35`](https://github.com/wi-wissen/Kronland/commit/f87cb359cec2b1b97559372ddf62b016f55d52d4) |
| 4 | Militär und Computergegner | 3.10.2026 12:31 | 3.10.2026 12:35 | [`b7550a4`](https://github.com/wi-wissen/Kronland/commit/b7550a420d0cb368dc1965adb398bbb7c472f7f5) |
| 5 | Startmenü, Speichern, PWA und CC0-Modelle | 3.10.2026 12:45 | 3.10.2026 12:48 | [`bcbd7f7`](https://github.com/wi-wissen/Kronland/commit/bcbd7f776f8e6810abe49981ebc64889dd05e21f) |
| 6 | Gelände und Grafik | 3.10.2026 17:12 | 3.10.2026 19:45 | [`9401359`](https://github.com/wi-wissen/Kronland/commit/9401359e4b3a2b65d29f0b79d9b86f461ef0c45b) |
| 7 | Parallele Zweige: Missionen, Spielsysteme, Ton, HUD | 3.10.2026 19:46 | 4.10.2026 02:45 | [`e9a3b10`](https://github.com/wi-wissen/Kronland/commit/e9a3b10bb5a070ace3900327fe069400d1edf606) |
| 8 | QA-Runden, Balance und Nebel des Krieges | 4.10.2026 04:02 | 4.10.2026 09:51 | [`d7a3bab`](https://github.com/wi-wissen/Kronland/commit/d7a3babdeaad0217e48ebc6bdcf3ba8e1f35f67a) |
| 9 | Die erste Welle: Entwicklermodus, Hang, Spielstände, Website | 4.10.2026 13:30 | 4.10.2026 16:31 | [`854f6f9`](https://github.com/wi-wissen/Kronland/commit/854f6f90ab564d29ff025dd627ebf2b5f318198d) |
| 10 | Figuren-Pipeline und Programmier-Abenteuer | 4.10.2026 17:03 | 4.10.2026 20:41 | [`ec10bb2`](https://github.com/wi-wissen/Kronland/commit/ec10bb2cf0127f0e1c7effbf5a9c237cd9f284f1) |
| 11 | Kampagne „Krone aus Eis“ und gemalte Welt | 4.10.2026 22:03 | 4.10.2026 23:17 | [`af9a72e`](https://github.com/wi-wissen/Kronland/commit/af9a72e68c918d0cc68fddb94ad872e004f52cdc) |
| 12 | Stimmen, Musik und Einführungsmission | 5.10.2026 08:26 | 5.10.2026 15:03 | [`10dfe98`](https://github.com/wi-wissen/Kronland/commit/10dfe984ab5688b884234ba16547a6c7c5a2e627) |
| 13 | Eigene Grafik statt KayKit | 5.10.2026 22:41 | 5.10.2026 22:54 | [`3bad1ca`](https://github.com/wi-wissen/Kronland/commit/3bad1caf44ae286ba43397242791861be6cdaa11) |
| 14 | Laden, Caching und Figuren-Feinschliff | 6.10.2026 00:19 | 6.10.2026 09:11 | [`e7077d1`](https://github.com/wi-wissen/Kronland/commit/e7077d168d59e312c5d2c2659d15be70834a4b87) |
| 15 | Feinschliff: Gewimmel, Nahkampf, Reittier | 6.10.2026 18:50 | 6.10.2026 19:12 | [`1161901`](https://github.com/wi-wissen/Kronland/commit/116190143aa5bdc9b5d4f7d0e1d98335362c692c) |
| 16 | Feinschliff II: Meldungen, Kreisplätze, Ton, Blog | 6.10.2026 20:31 | 6.10.2026 21:56 | [`0020d92`](https://github.com/wi-wissen/Kronland/commit/0020d9261f02433477a0861e8a856d585b1a440f) |

## 1. Simulationskern

3.10.2026 11:51 (Arbeit ab 3.10.2026 11:51) · 25 Dateien, +3155 / −0 Zeilen · Commit [`6799be7`](https://github.com/wi-wissen/Kronland/commit/6799be7b230e6d356b8e039d716872cd01ee2f69)

Testfälle im Quelltext: Vitest 33 (+33), Playwright 0 (+0) · Blog: `blog/simulation-core/`

Der erste Commit legt Karte, Leibeigene, Bauen, Rohstoffabbau und Zahltag als deterministische Simulation an: nur Ganzzahlen, eigener Zufallsgenerator mit Seed, fester 100-ms-Takt, Zustands-Hash. Spielregeln (SPIELREGELN.md) und Architektur sind von Anfang an aufgeschrieben, Vitest prüft Wirtschaft, Kartengenerator und Determinismus.

## 2. 3D-Darstellung und Steuerung

3.10.2026 12:07–12:08 (Arbeit ab 3.10.2026 12:07) · 20 Dateien, +1759 / −8 Zeilen · Commit [`8ff6071`](https://github.com/wi-wissen/Kronland/commit/8ff6071e6d27872fba905f5b3db2bdf4480eac8b)

Testfälle im Quelltext: Vitest 33 (+0), Playwright 3 (+3) · Blog: `blog/rendering/`

Three.js zeigt die Simulation, die Steuerung funktioniert mit Maus und Touch, dazu eine erste Oberfläche und die ersten Playwright-Tests. Der Build bekommt relative Pfade, damit das Spiel in jedem Unterordner läuft.

## 3. Wirtschaft

3.10.2026 12:17 (Arbeit ab 3.10.2026 12:17) · 19 Dateien, +1116 / −62 Zeilen · Commit [`f87cb35`](https://github.com/wi-wissen/Kronland/commit/f87cb359cec2b1b97559372ddf62b016f55d52d4)

Testfälle im Quelltext: Vitest 53 (+20), Playwright 4 (+1) · Blog: `blog/economy/`

Arbeiter, Minen und Veredelung, Motivation, Steuern, Forschung und der Ausbau von Gebäuden – die Wirtschaftsschleife nach dem Vorbild von Siedler 5 steht in einem Schritt.

## 4. Militär und Computergegner

3.10.2026 12:31–12:35 (Arbeit ab 3.10.2026 12:31) · 23 Dateien, +2211 / −31 Zeilen · Commit [`b7550a4`](https://github.com/wi-wissen/Kronland/commit/b7550a420d0cb368dc1965adb398bbb7c472f7f5)

Testfälle im Quelltext: Vitest 77 (+24), Playwright 5 (+1) · Blog: `blog/military-ai/`

Kampf, Türme, Helden, Miliz, Wetter sowie Sieg und Niederlage, danach ein Computergegner, der aufbaut, forscht, ein Heer aufstellt, angreift und sich verteidigt.

## 5. Startmenü, Speichern, PWA und CC0-Modelle

3.10.2026 12:45–12:48 (Arbeit ab 3.10.2026 12:45) · 116 Dateien, +9402 / −992 Zeilen · Commit [`bcbd7f7`](https://github.com/wi-wissen/Kronland/commit/bcbd7f776f8e6810abe49981ebc64889dd05e21f)

Testfälle im Quelltext: Vitest 79 (+2), Playwright 6 (+1) · Blog: `blog/first-package/`

Mit den freien KayKit-Modellen (CC0), Startmenü, Speichern und Laden, Offline-Fähigkeit als PWA und einer CI-Pipeline ist das Spiel zum ersten Mal von Anfang bis Ende spielbar. Die Modellendung wird konfigurierbar, für Hosts ohne .glb.

## 6. Gelände und Grafik

3.10.2026 17:12–19:45 (Arbeit ab 3.10.2026 17:12) · 31 Dateien, +2839 / −217 Zeilen · Commit [`9401359`](https://github.com/wi-wissen/Kronland/commit/9401359e4b3a2b65d29f0b79d9b86f461ef0c45b)

Testfälle im Quelltext: Vitest 84 (+5), Playwright 6 (+0) · Blog: `blog/terrain-graphics/`

Der Kartengenerator bekommt Gebirge, Flüsse mit Furten, Klippen und drei Kartengrößen. Grafikstufen, texturiertes Gelände, Wasser-Shader, Himmel, Bäume und Deko machen aus dem Prototyp eine Landschaft – mit einer eigenen Runde für schwache Geräte.

## 7. Parallele Zweige: Missionen, Spielsysteme, Ton, HUD

3.10.2026 19:46 – 4.10.2026 02:45 (Arbeit ab 3.10.2026 18:05) · 297 Dateien, +18168 / −955 Zeilen · Commit [`e9a3b10`](https://github.com/wi-wissen/Kronland/commit/e9a3b10bb5a070ace3900327fe069400d1edf606)

Testfälle im Quelltext: Vitest 226 (+142), Playwright 25 (+19) · Blog: `blog/parallel-branches/`

Zum ersten Mal arbeiten mehrere Zweige gleichzeitig: Missionssystem mit Tutorial und Kampagne, Gebäude-Technologien, Marktplatz, Wetter und Erfahrung, Detailstufen und GPU-Instanzen, prozeduraler Ton und ein neues zweisprachiges HUD. In der Nacht zum 4. Oktober werden sie zusammengeführt.

## 8. QA-Runden, Balance und Nebel des Krieges

4.10.2026 04:02–09:51 (Arbeit ab 4.10.2026 04:02) · 63 Dateien, +4625 / −178 Zeilen · Commit [`d7a3bab`](https://github.com/wi-wissen/Kronland/commit/d7a3babdeaad0217e48ebc6bdcf3ba8e1f35f67a)

Testfälle im Quelltext: Vitest 283 (+57), Playwright 31 (+6) · Blog: `blog/qa-fog/`

Eine unabhängige QA-Sitzung spielt im Browser, schreibt Fuzz- und Dauertests und findet 26 Befunde, darunter ein Speicherleck je Spielstart und Ruckler über eine Sekunde durch vergebliche Wegsuchen – alle behoben (QA-BERICHT.md). Ein Missions-Bot stimmt die Kampagne ab, danach kommt der Nebel des Krieges mit fairer KI.

## 9. Die erste Welle: Entwicklermodus, Hang, Spielstände, Website

4.10.2026 13:30–16:31 (Arbeit ab 4.10.2026 10:29) · 196 Dateien, +16602 / −486 Zeilen · Commit [`854f6f9`](https://github.com/wi-wissen/Kronland/commit/854f6f90ab564d29ff025dd627ebf2b5f318198d)

Testfälle im Quelltext: Vitest 445 (+162), Playwright 64 (+33) · Blog: `blog/first-wave/`

CLAUDE.md hält die Regeln für alle Sitzungen fest; danach laufen viele Aufgaben in eigenen Sitzungen parallel: Entwicklermodus mit A*-Ansicht, Bauen am Hang, Nahzoom, Handy-Tooltips, Spielstände mit Autosave, Erweiterungsinhalte, Symbol-Atlas aus der Bild-KI, neue Kamera und die Website mit Startseite, Handbuch und Wiki.

## 10. Figuren-Pipeline und Programmier-Abenteuer

4.10.2026 17:03–20:41 (Arbeit ab 4.10.2026 15:07) · 181 Dateien, +17537 / −1130 Zeilen · Commit [`ec10bb2`](https://github.com/wi-wissen/Kronland/commit/ec10bb2cf0127f0e1c7effbf5a9c237cd9f284f1)

Testfälle im Quelltext: Vitest 543 (+98), Playwright 76 (+12) · Blog: `blog/characters-coding/`

Die Figuren-Pipeline erzeugt aus Konzeptbögen mit Meshy die ersten eigenen Figuren (Leibeigener und Leibeigene, zuletzt mit Meshy 7.1 und PBR). Parallel entstehen eine Python-Teilmenge mit eigener Bytecode-VM, Lernabenteuer mit Debugger und der Welteneditor. Dazu HUD-Feinschliff, Balance nach Vorbild und die Website mit englischen Adressen und Kompendium.

## 11. Kampagne „Krone aus Eis“ und gemalte Welt

4.10.2026 22:03–23:17 (Arbeit ab 4.10.2026 19:03) · 178 Dateien, +4986 / −3949 Zeilen · Commit [`af9a72e`](https://github.com/wi-wissen/Kronland/commit/af9a72e68c918d0cc68fddb94ad872e004f52cdc)

Testfälle im Quelltext: Vitest 567 (+24), Playwright 83 (+7) · Blog: `blog/campaign/`

Sechs Missionen mit neuen Helden, mehreren Helden je Spieler, Diplomatie, Tributen und Gesprächsfiguren; die Erweiterung wird auf Brücken, Brunnen und Denkmal ausgedünnt. Bodentexturen und App-Symbole kommen aus der Bild-KI, Bäume bekommen Detailstufen nach Bildschirmhöhe.

## 12. Stimmen, Musik und Einführungsmission

5.10.2026 08:26–15:03 (Arbeit ab 4.10.2026 23:06) · 515 Dateien, +3858 / −367 Zeilen · Commit [`10dfe98`](https://github.com/wi-wissen/Kronland/commit/10dfe984ab5688b884234ba16547a6c7c5a2e627)

Testfälle im Quelltext: Vitest 599 (+32), Playwright 95 (+12) · Blog: `blog/voices-music/`

368 Sprachaufnahmen (Dialoge und Sprüche, DE/EN) entstehen mit Seed Audio und automatischer Hörprüfung, zwölf Musikstücke mit Lyria 3, Arbeitsgeräusche aus CC0-Quellen (Kenney, Freesound). Viele kleine Verbesserungen schärfen Dialoge, Minikarte, Helden und Winter; Mission 1 wird zur geführten Einführung.

## 13. Eigene Grafik statt KayKit

5.10.2026 22:41–22:54 (Arbeit ab 4.10.2026 19:51) · 726 Dateien, +6122 / −914 Zeilen · Commit [`3bad1ca`](https://github.com/wi-wissen/Kronland/commit/3bad1caf44ae286ba43397242791861be6cdaa11)

Testfälle im Quelltext: Vitest 661 (+62), Playwright 105 (+10) · Blog: `blog/own-art/`

Der größte Zweig (über einen Tag Arbeit): Alle Gebäude in drei Ausbaustufen, 24 Berufe, Soldaten, Helden, Bäume und Kanone entstehen als eigene Modelle – Konzept mit Bildmodellen, 3D mit Meshy, Nachbearbeitung mit eigenen Skripten. Das Meshy-Guthaben ist zwischendurch leer, Bewegungsdateien schrumpfen von 1 470 MB auf 16 MB.

## 14. Laden, Caching und Figuren-Feinschliff

6.10.2026 00:19–09:11 (Arbeit ab 5.10.2026 23:23) · 257 Dateien, +4393 / −359 Zeilen · Commit [`e7077d1`](https://github.com/wi-wissen/Kronland/commit/e7077d168d59e312c5d2c2659d15be70834a4b87)

Testfälle im Quelltext: Vitest 717 (+56), Playwright 112 (+7) · Blog: `blog/loading-performance/`

Alle Spieldateien bekommen einen Inhalts-Hash und werden nur bei Bedarf geladen; das Nahmodell der Figuren kommt erst beim Heranzoomen (freies Spiel 35 → 19 MB). Dazu Angriffswarnung und Diplomatie, gleich große Figuren mit Beinen im Lauftempo und feste Arbeitsplätze.

## 15. Feinschliff: Gewimmel, Nahkampf, Reittier

6.10.2026 18:50–19:12 (Arbeit ab 6.10.2026 15:48) · 210 Dateien, +3466 / −248 Zeilen · Commit [`1161901`](https://github.com/wi-wissen/Kronland/commit/116190143aa5bdc9b5d4f7d0e1d98335362c692c)

Testfälle im Quelltext: Vitest 769 (+52), Playwright 118 (+6) · Blog: `blog/polish/`

Die Belastungsprobe „Gewimmel“ mit rund 2 500 Figuren deckt Hänger auf; die Spielschleife wird robust, der Autosave billig. Nahkämpfer umzingeln ihr Ziel, Gebäude zeigen in der Ferne keine Farbstreifen mehr, Nelia wird neu gestaltet und das Meshy-Pferd trägt seine Reiter mit selbst geschriebenen Gangarten.

## 16. Feinschliff II: Meldungen, Kreisplätze, Ton, Blog

6.10.2026 20:31–21:56 (Arbeit ab 6.10.2026 19:53) · 144 Dateien, +5830 / −421 Zeilen · Commit [`0020d92`](https://github.com/wi-wissen/Kronland/commit/0020d9261f02433477a0861e8a856d585b1a440f)

Testfälle im Quelltext: Vitest 832 (+63), Playwright 132 (+14) · Blog: `blog/polish-2/`

Neun Aufgaben in einer Abendrunde: Meldungen bekommen Kategorien mit Vorrang, Bündelung und Dauerwarnungen bei Angriff und Brand; Rastende, Wartende und Holzfäller stehen auf Kreisplätzen um ihr Ziel. Weibliche Figuren heißen und sprechen weiblich, Warnrufe erklingen auch für Soldaten, die Kampfmusik endet nach dem Kampf, der Schaukasten klingelt nicht mehr dauernd. Klicks ins Leere wählen keine Figur außerhalb des Bildes, Karten lassen sich per Link teilen, und dieser Blog erzählt die Entstehung je Meilenstein.
