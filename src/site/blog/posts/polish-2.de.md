---
title: Feinschliff II: Meldungen, Kreisplätze, Ton, Blog
date: 2026-10-06T21:56:46+02:00
teaser: Neun Aufgaben am Abend des 6. Oktober: Meldungen mit Vorrang und Dauerwarnungen, Kreisplätze um Feuer, Gebäude und Bäume, weibliche Figuren, Warnrufe und Kampfmusik – und dieser Blog.
milestone: true
---

## Was entstand {#what}

Am Abend des 6. Oktober laufen neun Zweige parallel und werden nacheinander in `main` zusammengeführt:

- **Kopfleiste**: Glaube steht immer da, bei 0 ausgegraut statt als Lücke.
- **Schaukasten**: Das Dauer-Klingeln beim Einzug vieler Arbeiter ist weg.
- **Auswahl**: Ein Klick ins Leere wählt keine Figur mehr, die außerhalb des Bildes steht.
- **Links**: Karten lassen sich per Link teilen; das Spielmenü zeigt die Karte und „Link kopieren“, das
  Startmenü „Weiterspielen“.
- **Weibliche Figuren** heißen „Bäuerin“ oder „Schwertkämpferin“, zeigen ihr eigenes Porträt und rufen mit der
  Frauenstimme.
- **Meldungen** haben Kategorien mit Vorrang, gleiche Meldungen werden gebündelt („×n“), Angriff, Brand und
  bewusstloser Held bleiben als Dauerwarnung stehen.
- **Warnruf und Kampfmusik**: Auch getroffene Soldaten rufen, und die Kampfmusik endet kurz nach dem letzten
  eigenen Treffer.
- **Kreisplätze**: Rastende, Wartende und Holzfäller stehen auf festen Punkten eines Kreises um ihr Ziel statt
  in Kachelmitten.
- **Blog**: ein Artikel je Meilenstein, mit Kennzahlen und Link zum Quellcode des jeweiligen Stands.

## Wie {#how}

- **Eine Quelle je Frage:** Das Geschlecht einer Figur steht nur im Figuren-Manifest (`"sex": "m"|"f"`). Darstellung,
  Auswahlkarte und Ton lesen es über dieselben reinen Funktionen (`figureSex`), die Simulation bleibt unverändert.
- **Kreisplätze deterministisch:** Richtungen kommen aus einer festen Ganzzahl-Tabelle im 5°-Raster (`src/sim/dirs.js`).
  Der Platz steht in `e.slot`, geht in den State-Hash ein, und alte Spielstände werden beim Laden umgerechnet.
- **Meldungen als Modell:** `src/game/notices.js` entscheidet Vorrang, Grenzen je Kategorie und Bündelung. Die
  Dauerwarnungen baut die Engine bei jedem Takt neu aus dem Spielzustand, statt sie als Ereignis zu speichern.
- **Klicks geprüft:** `pickFigure` ist eine reine Funktion mit Tests. Wählbar ist nur, was in diesem Bild gezeichnet
  wurde und dessen Trefferpunkt im Bild liegt.
- **Zusammenführen der Reihe nach:** Jeder Zweig bekommt zuerst den aktuellen Stand von `main`. Konflikte werden so
  gelöst, dass das Verhalten beider Seiten erhalten bleibt, dann laufen `npm test`, der Build und die betroffenen
  E2E-Specs.

## Was nicht klappte {#problems}

- **Klingeln:** Im Schaukasten zogen gut ein Arbeiter je Sekunde ein, und jeder Einzug spielte den Harfenklang. Die
  Abklingzeit von 0,4 s half nicht; erst Ruhezeiten je Ereignisart (8 s für Einzug) im `NotifyGate` beendeten es.
- **Phantom-Auswahl:** Figuren knapp hinter der Kamera bekamen riesige Bildkoordinaten und damit einen riesigen
  Fangradius. Auf „Gewimmel“ wählten über 80 % der Klicks auf leeres Gras eine Figur außerhalb des Bildes.
- **Stumme Truppen:** Meist wird ein Soldat getroffen, nicht der Hauptmann. Soldaten hatten aber keine Sprechrolle,
  und die Miliz bekam Sätze ohne Aufnahme. Beim Zusammenführen mit den weiblichen Figuren musste die Miliz zudem
  wieder mit der Leibeigenen-Stimme ihres Geschlechts rufen.
- **Zu lange Kampfmusik:** Sie hing an einer langsam abklingenden „Hitze“ und lief nach großen Kämpfen noch eine halbe
  Minute nach. Auch fremde Kämpfe im Bild lösten sie aus.
- **Langsame Tests:** Unter Software-Grafik schafften E2E-Tests zu wenige Takte; der Lagerfeuer-Test spult jetzt mit
  `stepOnce` vor. Zeitüberschreitungen unter Last wurden einzeln wiederholt, bevor sie als Fehler galten.

## Zum Nachmachen {#tips}

- Drossle Klänge aus Massenereignissen je Ereignisart, nicht je Einzelfall.
- Lege Eigenschaften wie das Geschlecht an genau einer Stelle fest und lies sie überall über dieselbe Funktion.
- Baue Dauerzustände wie „wird angegriffen“ jedes Mal neu aus dem Zustand auf, statt sie als Meldung mitzuschleppen.
- Führe parallele Zweige einzeln nacheinander zusammen und teste nach jedem Schritt; so bleibt klar, welcher
  Zusammenschluss etwas kaputt gemacht hat.
