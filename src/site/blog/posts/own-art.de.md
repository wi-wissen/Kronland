---
title: Eigene Grafik statt KayKit
date: 2026-10-05T22:54:41+02:00
teaser: Der größte Zweig: Gebäude in drei Stufen, 24 Berufe, Soldaten, Helden, Bäume – alles eigene Modelle aus Bild-KI und Meshy, bis das Guthaben leer war.
milestone: true
---

## Was entstand {#what}

Die Arbeit lief vom Abend des 4. bis zum Abend des 5. Oktober und berührte über 2 000 Dateien. Danach hat Kronland
eigene Grafik: alle Gebäude in ihren Ausbaustufen, 24 Berufe (je Mann und Frau), Soldaten, Reiter, Helden, Räuber,
Bäume mit Winterfassung, Brücke, Ruinen, Lagerfeuer, Porträts und eine Kanone. Vom KayKit-Paket bleiben nur Baugerüst,
Bauphasen, Trümmer und Felsen. Dazu eine kleine Korrektur an der Kopfleiste.

## Wie {#how}

- **Konzept:** Gebäude aus den Symbolen des Spiels plus einer Hausvorlage, die der Nutzer in ChatGPT erzeugt hatte.
  Nach einem Vergleich von GPT-Bildmodell, Gemini und Seedream wurde Seedream 5.0 Flash (0,02 $ je Bild) der Standard für Gebäude.
- **Alle Ausbaustufen in einem Bild** (Idee des Nutzers) – gleiche Bauweise, gleicher Maßstab; einheitliche Terrakotta-Dächer;
  je Stufe ein Geschoss mehr und wertigeres Material. Später zusätzlich eine Rückansicht, damit Meshy die Rückseite nicht erfindet.
- **3D:** Meshy 7.1 aus einer oder zwei Ansichten, Nachbearbeitung mit eigenen Skripten, Spielfotos je Zoomstufe (`ingame.mjs`).
- Die Kanone entstand in einer eigenen Sitzung und kam danach dazu.

## Was nicht klappte {#problems}

- **Werkzeuge in der Hand sahen „miserabel“ aus** (Urteil des Nutzers): Generierte Bewegungen kennen kein Werkzeug. Mit
  der Waffe im Konzept verschmolz Meshy das Schwert mit dem Bein; in der A-Pose ließ es Gehaltenes ganz weg. Lösung für
  Soldaten: Waffe fest im Modell, vom Körper weg, Haltung des Konzepts behalten, Klinge per Skript starr an den Handknochen.
- **Das Meshy-Guthaben war leer:** Der erste Durchlauf schaffte 36 Gebäudestufen, 12 Figuren und das Pferd, der Rest
  brach ab. Seitdem steht jeder Schritt in einer Auftragsdatei und wird fortgesetzt statt neu bezahlt.
- **Bewegungsdateien:** Meshy liefert zu jedem Clip das ganze Modell mit Textur – 1 470 MB, verlustfrei auf 16 MB gekürzt.
- **Bildmodelle:** Deutsche Gebäudenamen erschienen als Schrift im Bild, Zahlen wie „1,5 × Breite“ wurden ignoriert,
  Gruben wurden zu ausgeschnittenen Erdwürfeln („flach wie ein Teppich“ half). Der Händler mit Waage brach im Rig zweimal den Kopf weg – er trägt jetzt keine Waage.

## Zum Nachmachen {#tips}

- Stil kommt aus Referenzbildern, nicht aus Worten – und gib nie eigene Zwischenergebnisse als Stilvorlage weiter, Fehler vererben sich.
- Erzeuge zusammengehörige Dinge in einem Bild (alle Stufen eines Gebäudes).
- Protokolliere Prompt, Modell, Kosten und Auftragsnummer je Datei (bei uns unter `assets-src/`) und führe ein Budget-Buch.
