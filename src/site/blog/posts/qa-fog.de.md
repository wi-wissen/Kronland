---
title: QA-Runden, Balance und Nebel des Krieges
date: 2026-10-04T09:51:07+02:00
teaser: Eine unabhängige QA-Sitzung findet 26 Befunde, ein Bot gewinnt die Kampagne auf vier Karten, und der Nebel des Krieges kommt – mit fairer KI.
milestone: true
---

## Was entstand {#what}

In der Nacht zum 4. Oktober prüft eine eigene QA-Sitzung das Spiel unabhängig vom Entwicklungsteam: Spielen im
Browser auf Desktop und Handy (hoch und quer, Deutsch und Englisch), Fuzz- und Dauertests, Durchsicht der
Risikobereiche. Parallel spielt ein Missions-Bot jede Kampagnenmission, bis er alle auf vier Karten im Zeitlimit
gewinnt. Am Morgen folgt der Nebel des Krieges: Sicht je Team, erkundete Gebiete, zuletzt gesehene Gebäude und eine
KI, die nur kennt, was sie gesehen hat.

## Wie {#how}

- Fuzz-Tests mit Seed schicken lange Befehlsfolgen samt Unsinn (Prototyp-Schlüssel, fremde IDs, NaN) durch die
  Simulation und prüfen alle 250 Takte Invarianten; Speichern und Laden in der Mitte muss denselben Endzustand ergeben.
- `scripts/campaign-matrix.js` spielt alle Missionen auf mehreren Karten; die Ergebnisse stehen als Tabelle in `docs/MISSIONEN.md`.
- Jeder Befund steht mit Schwere, Nachstellweg und Behebung in `docs/QA-BERICHT.md`.

## Was nicht klappte {#problems}

- **Speicherleck:** Jeder Spielstart ließ den alten Renderer samt WebGL-Kontext im Speicher (50 → 96 MB nach fünf
  Starts). Lösung: `Renderer.dispose()` gibt alles frei – danach 50 → 52 MB.
- **Ruckler über eine Sekunde:** vergebliche Wegsuchen zu unerreichbaren Zielen. Gebietsnummern brechen sie sofort ab;
  der 60-Minuten-Dauerlauf mit vier KI-Gegnern dauerte danach 34 s statt rund 10 min.
- **Absturz durch einen Befehl** wie `building: 'toString'` – für Mehrspieler fatal. Tabellen werden nur noch mit eigenen Schlüsseln nachgeschlagen.
- **Truppen schnitten Wasserecken** und blieben stecken; jeder Teilschritt geht jetzt höchstens in eine Nachbarkachel, diagonal nur, wenn beide Nachbarn begehbar sind.

## Zum Nachmachen {#tips}

- Lass eine Sitzung prüfen, die den Code nicht geschrieben hat – mit dem ausdrücklichen Auftrag, Fehler zu finden.
- Ein Bot, der die Kampagne gewinnen muss, ist ein Balance-Test, der nie müde wird.
- Fairness der KI ist eine Regel der Simulation, nicht der KI: Sie bekommt nur, was ihr Team sieht.
