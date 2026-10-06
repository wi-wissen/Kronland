---
title: 3D-Darstellung und Steuerung
date: 2026-10-03T12:08:15+02:00
teaser: Three.js zeigt die Welt, Maus und Touch steuern sie, und Playwright prüft sie vom ersten Tag an auf Desktop und Handy.
milestone: true
---

## Was entstand {#what}

Sechzehn Minuten nach dem Simulationskern kommt die Darstellung: Three.js zeichnet Gelände, Gebäude und Figuren, die
Steuerung funktioniert mit Maus und mit Touch, dazu eine erste Oberfläche. Eine Minute später folgt eine einzeilige
Änderung: Der Build bekommt einen relativen Basispfad.

## Wie {#how}

- Darstellung und Oberfläche lesen den Zustand der Simulation nur; sie ändern ihn nie direkt, sondern schicken Befehle.
- Die ersten drei Playwright-Tests laufen in zwei Profilen: Desktop und Handy (Pixel 7).
- `base: './'` in der Vite-Konfiguration: Alle Pfade sind relativ, das Spiel läuft in jedem Unterordner eines Servers.

## Was nicht klappte {#problems}

Absolute Pfade hätten das Spiel an die Wurzel eines Servers gebunden – deshalb der schnelle Nachtrag. Später zeigte
sich die Kehrseite der E2E-Tests: Ohne Grafikkarte laufen sie über Software-WebGL (SwiftShader) und sind langsam.
Immer wieder mussten Zeitlimits angehoben werden; die Regel in `CLAUDE.md` lautet seitdem: großzügige Timeouts, nur
betroffene Specs laufen lassen, eigener Port je Sitzung.

## Zum Nachmachen {#tips}

- Trenne Simulation und Darstellung streng. Dann kann die Grafik später komplett getauscht werden, ohne die Regeln anzufassen.
- Richte Playwright mit einem Handy-Profil ein, bevor die Oberfläche groß wird – Touch nachzurüsten ist teurer.
- Relative Pfade von Anfang an, wenn das Spiel auf beliebigem Webspace laufen soll.
