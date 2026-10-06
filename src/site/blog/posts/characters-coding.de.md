---
title: Figuren-Pipeline und Programmier-Abenteuer
date: 2026-10-04T20:41:03+02:00
teaser: Die ersten eigenen Figuren aus Konzeptbogen und Meshy – und parallel eine Python-Teilmenge mit eigener VM, Lernabenteuern und Welteneditor.
milestone: true
---

## Was entstand {#what}

- **Figuren-Pipeline:** Aus einem Konzeptbogen mit vier Ansichten macht Meshy ein 3D-Modell mit Rig und
  Bewegungen; eigene Skripte bereiten es auf. Die ersten Figuren sind Leibeigener und Leibeigene, mit Nahmodell und
  Spielmodell, umgeschaltet nach Bildschirmhöhe.
- **Programmieren:** eine Python-Teilmenge mit eigener Bytecode-VM, Szenarien mit Python-Skripten, Lernabenteuer
  mit Einzelschritt, Haltepunkten und Variablenansicht, die Skript-Mission „Der Überfall“ und ein Welteneditor.
- Dazu Spieloberfläche und HUD-Feinschliff, Balance nach Vorbild und die Website mit englischen
  Adressen und dem **Kompendium** – so heißt das Wiki seitdem, weil niemand mitschreibt.

## Wie {#how}

- Teamfarbe als reines Magenta im Konzept; der Shader färbt es beim Zeichnen in die Spielerfarbe um.
- Vergleich statt Vermutung: Testfiguren mit Meshy 7.1 und PBR gegen das ältere Modell, Fernmodell als Remesh des
  Nahmodells (F1) gegen ein eigenes vereinfachtes Konzept (F2).
- Die Python-VM läuft in der deterministischen Simulation – Skripte überstehen auch Speichern und Laden.

## Was nicht klappte {#problems}

- Das ältere Meshy-Modell zeigte sichtbare Polygone; Meshy 7.1 mit PBR liefert glatte Gesichter und eine Normal-Map.
- Ein eigenes Fernkonzept brachte in Spielgröße nichts. Das Spielmodell ist jetzt das per Remesh auf rund 2 000
  Dreiecke reduzierte Nahmodell (5 Credits).
- Flache Eckfarben und Sättigen machten aus Oliv „Malkastengrün“ – am Ende wurden Meshys Farben einfach übernommen.
- Kein Randlicht: Es wirkte als helle Kanten.
- Wörterbücher mit Tupel-Schlüsseln in der Skript-VM überstanden das Laden nicht – ein eigener Fix.

## Zum Nachmachen {#tips}

- Beurteile Figuren in Spielgröße (bei uns rund 25 Pixel), nicht in der Großansicht.
- Billiges zuerst: Konzept und Vorschau prüfen, bevor Meshy-Credits fließen; ein Budget-Buch zählt mit.
- Eine eigene kleine Skriptsprache ist machbar, wenn sie deterministisch in die Simulation eingebettet wird.
