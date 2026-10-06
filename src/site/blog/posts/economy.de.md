---
title: Wirtschaft
date: 2026-10-03T12:17:09+02:00
teaser: Arbeiter, die essen und schlafen, Werkstätten, Steuern und Forschung: die Wirtschaftsschleife des Vorbilds in einem Schritt.
milestone: true
---

## Was entstand {#what}

Aus Leibeigenen und Rohstoffen wird eine Wirtschaft: Arbeiter mit Arbeitsplatz, Wohnhaus und Bauernhof, Minen,
Veredelung in Werkstätten, Motivation, Steuern, Forschung und der Ausbau von Gebäuden in Stufen.

## Wie {#how}

- Alle Werte stehen in Datentabellen unter `src/sim/data/` (Gebäude, Berufe, Balance) und nicht verstreut im Code.
  Das zahlt sich zweimal aus: Balance-Änderungen sind eine Zeile, und das spätere Kompendium der Website erzeugt seine
  Tabellen direkt aus diesen Daten.
- Zwanzig neue Vitest-Fälle prüfen die Schleife Arbeit – Essen – Schlaf – Motivation – Zahltag.

## Was nicht klappte {#problems}

Die ersten Werte waren eine Annäherung. Einen Tag später nahm sich eine eigene Aufgabe die Balance noch
einmal vor: Eine Analyse der Veredler stimmte Motivation, Haus und Hof ab, Truppen bekamen eigene Werte mit den
Kräfteverhältnissen des Vorbilds, und jede Karte bekam eine Holzgarantie fürs Umland.

## Zum Nachmachen {#tips}

- Balance gehört in Daten, nicht in Code. Dann kann ein Agent sie gezielt ändern, ohne Logik anzufassen.
- Schreib zu jeder Regel die Quelle dazu (bei uns die Community-Dokumentation des Vorbilds) – so lässt sich später prüfen, ob etwas absichtlich so ist.
