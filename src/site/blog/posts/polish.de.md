---
title: Feinschliff: Gewimmel, Nahkampf, Reittier
date: 2026-10-06T19:12:10+02:00
teaser: Eine Belastungsprobe mit rund 2 500 Figuren deckt Hänger auf. Danach: robuste Spielschleife, Umzingeln im Nahkampf, eine neue Nelia und ein Pferd mit eigenen Gangarten.
milestone: true
---

## Was entstand {#what}

Am Nachmittag des 6. Oktober laufen sieben Aufgaben parallel und sind innerhalb von 22 Minuten auf `main`:
gemalte Menüsymbole, Doppelklick wählt alle sichtbaren Figuren derselben Art, Nahkampf im Kreis,
Gebäude ohne Farbstreifen in der weitesten Zoomstufe, Hänger im „Gewimmel“ behoben, eine neue Nelia
und das Meshy-Pferd als Reittier.

## Wie {#how}

- **Gewimmel** (`?mission=bustle`): rund 2 500 Figuren, vier Computergegner, zwei Dauerschlachten – gemessen ohne
  Grafik mit `scripts/stress-run.js`. Vorher und nachher müssen die Zustands-Hashes gleich sein.
- **Nelia** entstand diesmal durch Bearbeiten des Bogens der Leibeigenen statt neu: gleiche Statur, nur Haare, Umhang
  und Hose geändert.
- **Pferd:** Rig von Hand in der Meshy-Oberfläche (durch den Projektinhaber), Gangarten mit einem eigenen Skript
  geschrieben, Spielmodell per Remesh auf rund 2 000 Dreiecke.

## Was nicht klappte {#problems}

- **Hänger:** Die Feindsuche kostete 42 % der Rechenzeit; schnellere Suche und Gebietsrechnung senkten den Takt von
  19,9 auf rund 7 ms. Die Spielschleife hat jetzt ein Zeitbudget je Bild und verwirft Rückstand statt in eine
  Todesspirale zu laufen.
- **Autosave:** `toDataURL` auf einer GPU-Zeichenfläche wartete auf alle WebGL-Bilder und hielt das Spiel an – das
  Vorschaubild entsteht jetzt auf einer Zeichenfläche im Hauptspeicher.
- **Shader mitten im Spiel** hielten das Spiel unter Software-Grafik bis zu 70 s an; später auftauchende Modelle werden beim Aufwärmen mitgezeichnet.
- Neu erzeugt wurde Nelia klobig, obwohl die Vorlage zierlich war; Gemini malte den Umhang himbeerrot und Meshy schob
  ihn Richtung Violett – ein Nachfärbeschritt dreht beides auf die Teamfarbe zurück.

## Zum Nachmachen {#tips}

- Bau dir eine Belastungsprobe als normale Karte – dann ist sie jederzeit spielbar und messbar.
- Optimiere mit Hash-Vergleich: Gleiches Verhalten ist beweisbar, nicht nur gefühlt.
- Wenn ein Generator die Figur verfehlt, bearbeite eine gelungene Vorlage, statt neu zu würfeln.
