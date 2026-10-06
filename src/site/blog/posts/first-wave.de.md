---
title: Die erste Welle: Entwicklermodus, Hang, Spielstände, Website
date: 2026-10-04T16:31:12+02:00
teaser: Eine CLAUDE.md für alle Sitzungen, dann ein Dutzend Aufgaben parallel: Entwicklermodus, Bauen am Hang, Spielstände, Website und mehr.
milestone: true
---

## Was entstand {#what}

Am 4. Oktober zwischen 10:29 und 11:15 Uhr beginnen fünf Aufgaben gleichzeitig, weitere folgen bis zum Nachmittag.
Um 13:30 Uhr kommt `CLAUDE.md` ins Repository, danach landen die Ergebnisse nacheinander auf `main`:

- **Entwicklermodus:** Drahtgitter und Detailstufen, A\*-Wegsuche Schritt für Schritt, Raster-Ansichten, Statistik – auch für den Informatikunterricht.
- **Bauen am Hang:** Die Simulation ebnet den Bauplatz ein, die Bauvorschau zeigt es gelb.
- **Spielstände:** mehrere Plätze in IndexedDB (sonst localStorage), Autosave, Export und Import als JSON mit Formatversion und Migration.
- **Erweiterungsinhalte**, Langdruck-Tooltips am Handy, Nahzoom, Gruppen auffächern, Symbol-Atlas aus der Bild-KI, Kamera wie ein Kartenprogramm.
- **Website:** Das Spiel zieht nach `play/`, dazu Startseite, zweisprachiges Handbuch und ein Wiki aus den Spieldaten.

## Wie {#how}

- Jede Aufgabe eine eigene Sitzung mit eigenem Zweig; vor der Übernahme kommt der aktuelle Stand von `main` hinein.
- `CLAUDE.md` hält fest, was jede Sitzung wissen muss: Stack, deterministische Simulation, Zweisprachigkeit, Handy, Lizenzen, Tests vor der Übernahme.
- Pfade zur Website-Wurzel laufen zentral über `src/paths.js` – die Grundlage dafür, dass Spiel, Handbuch und später der Blog in Unterordnern liegen können.

## Was nicht klappte {#problems}

- **Spielstände** brauchten sechs Nachbesserungen: Die IndexedDB-Frist schlug bei belegtem Hauptfaden zu, Änderungen
  über mehrere Tabs mussten atomar werden, Ziehen und Ablegen öffnete versehentlich die Datei im Browser.
- **Symbol-Atlas:** Gemini lieferte einen schönen Bogen, aber im falschen Raster (14 × 7) mit erfundenen und doppelten
  Symbolen und dem Wort „TAX“ trotz Verbot – nicht automatisch zuzuordnen. Das GPT-Bildmodell hielt das Raster ein.
- **E2E unter Software-Grafik:** Speichern/Laden, Beschriftungen und Gruppen brauchten längere Zeitlimits.

## Zum Nachmachen {#tips}

- Schreib die gemeinsamen Regeln auf, bevor du parallelisierst – sonst erklärt jede Sitzung sie sich neu.
- Kleine Aufgaben mit klarem Ergebnis eignen sich am besten für parallele Agenten.
- Plane Mehrseiten-Pfade (`siteUrl()`) früh, wenn neben dem Spiel eine Website entstehen soll.
