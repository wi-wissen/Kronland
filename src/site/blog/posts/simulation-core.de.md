---
title: Simulationskern
date: 2026-10-03T11:51:52+02:00
teaser: Bevor irgendetwas zu sehen war, stand die Simulation: Ganzzahlen, Zufall mit Seed, fester Takt und ein Hash über den ganzen Zustand.
milestone: true
---

## Was entstand {#what}

Der allererste Commit enthält kein Bild und keinen Knopf, sondern den Kern des Spiels: eine Kachelkarte mit
Kartengenerator, A\*-Wegsuche, Leibeigene, die bauen und Rohstoffe abbauen, und den Zahltag. Dazu kommen die
Spielregeln (`docs/SPIELREGELN.md`) und die Architektur (`docs/ARCHITEKTUR.md`) – aufgeschrieben, bevor es etwas zu
spielen gab.

## Wie {#how}

- Die Simulation in `src/sim` rechnet nur mit Ganzzahlen (Positionen in Milli-Kacheln), würfelt mit einem eigenen
  Zufallsgenerator mit Seed (`rng.js`) und läuft in einem festen 100-ms-Takt. Einzige Eingabe sind Befehle.
- `hash.js` bildet einen Hash über den Zustand. Gleiche Befehle ergeben auf jedem Rechner dieselbe Hash-Folge – die
  Grundlage für Tests, Spielstände, Bots und einen späteren Mehrspielermodus im Gleichschritt.
- Vitest prüft von Anfang an Grundregeln, Wirtschaft, Kartengenerator und Determinismus.
- Die Zahlenwerte folgen der Community-Dokumentation des Vorbilds „Die Siedler – Das Erbe der Könige“; Namen und
  Texte sind eigene.

## Was nicht klappte {#problems}

In diesem Schritt gab es keinen Fehlschlag. Der Wert der strengen Regeln zeigte sich erst später:
Als eine QA-Sitzung am nächsten Morgen Fuzz-Tests schrieb, konnten Befehlsfolgen protokolliert und bitgenau
wiederholt werden, und Speichern und Laden mitten im Spiel musste denselben Endzustand ergeben – das geht nur mit einer
deterministischen Simulation.

## Zum Nachmachen {#tips}

- Fang mit Regeln und Simulation an, nicht mit Grafik. Eine Simulation ohne Darstellung lässt sich in Millisekunden testen.
- Verbiete `Math.random`, `Date` und Gleitkomma-Logik in der Simulation von Anfang an – nachträglich ist das mühsam.
- Schreib Regeln und Architektur als Markdown ins Repository: Jede neue Agenten-Sitzung liest sie mit.
