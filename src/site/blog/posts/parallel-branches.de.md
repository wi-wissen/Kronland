---
title: Parallele Zweige: Missionen, Spielsysteme, Ton, HUD
date: 2026-10-04T02:45:55+02:00
teaser: Fünf Zweige gleichzeitig – Missionen, Spielsysteme, Grafik, Ton und ein zweisprachiges HUD – und eine Nacht, in der alles zusammenkommt.
milestone: true
---

## Was entstand {#what}

Am Abend des 3. Oktober arbeiten zum ersten Mal mehrere Zweige parallel:

- **Missionen:** Laufzeit mit Zielen, Auslösern und Aktionen, Tutorial, Kampagne mit fünf Missionen, Haken in der Simulation.
- **Spielsysteme:** Gebäude-Technologien, Marktplatz mit gemeinsamen Preisen, Wetterturm und Wetterkraftwerk, Erfahrung der Hauptleute, Brand, Reparatur und Ruinen.
- **Grafik:** Detailstufen, GPU-Instanzen für Figuren mit Animationen in einer Knochen-Textur, Partikeleffekte.
- **Ton:** 38 synthetisierte Effekte, generative Musik (Laute, Harfe, Flöte per Karplus-Strong), Umgebungsklänge, ein Manifest für spätere eigene Dateien.
- **Oberfläche:** Deutsch und Englisch, neues HUD in Holz, Pergament und Messing, Handy hoch und quer mit 44-px-Tippzielen.

## Wie {#how}

- Die Zweige schneiden das Spiel nach Schichten (Simulation, Darstellung, Ton, Oberfläche) – so berühren sie selten dieselben Dateien.
- Erweiterungspunkte statt Umbauten: Missionen hängen sich über drei dokumentierte Haken ein, Gebäudepanels über `registerBuildingSection()`, Ton über kleine Einhängepunkte in der Engine.
- Ablehnungsgründe der Simulation werden sprachunabhängige Codes (`err.notEnoughResources`); die Oberfläche übersetzt sie.

## Was nicht klappte {#problems}

Das Zusammenführen war der schwerste Teil: Der UI-Zweig wurde zuletzt gemergt und musste HUD, Zweisprachigkeit,
Spielsysteme, Grafik und Ton zusammenbringen (fertig um 02:45 Uhr). Ein Rekrutier-Test schlug unter Software-Grafik
fehl, weil der Simulationstakt unter Last später kam – er wartet seitdem länger.

## Zum Nachmachen {#tips}

- Plane parallele Arbeit entlang der Architektur-Schichten und lege vorher Schnittstellen fest.
- Merge den Zweig mit den meisten Querbezügen (bei uns die Oberfläche) zuletzt.
- Texte von Anfang an über Schlüssel und Wörterbücher – nachträgliche Zweisprachigkeit kostet einen ganzen Zweig.
