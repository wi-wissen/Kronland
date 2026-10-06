# Offene Punkte der 3D-Erzeugung

Stand: alle Gebäudetypen und Figuren haben eigene Modelle; KayKit liefert nur noch Baustelle, Trümmer und Natur.

## Gebäude

- Alle Gebäude aus zwei Ansichten (Vorder- und Rückansicht, `multi-image-to-3d`), Ausnahme Schießplatz 1:
  dessen Rückansicht hatte andere Maße, darum nur Vorderansicht.
- Schlanke Türme (Turm, Uhr, Windrad, Wetterturm) werden wie alle Gebäude auf ihre Grundfläche eingepasst und dürfen hoch werden (Wunsch: Türme sind hoch).
- Räuberlager trägt eine dunkle Fahne statt Magenta (neutral, bleibt so).

## Figuren

- **Händler:** mit Waage bricht das Rig in jeder Bewegung den Kopf weg (zweimal gerigged). Im Spiel jetzt die Fassung
  ohne Waage; die mit Waage liegt in `assets-src/characters/worker_trader/with-scales/`.
- **Pferd:** Meshy riggt per Schnittstelle nur Menschengestalten – vorerst prozedurales Pferd; Nutzer versucht das
  Riggen in der Meshy-Oberfläche. Für ein GLB-Reittier braucht das Spiel noch eine kleine Erweiterung.
- **Geschützmannschaft:** Angriff ist noch der Schwerthieb – eigene Lade-Bewegung fehlt.
- **Budget-Buch** (`assets-src/credits.json`) bucht abgelehnte Aufträge mit und steht zu hoch.

## Lückenschluss (offen)

- Symbole für die Fähigkeiten `ab-farsight`, `ab-bribe`, `ab-intimidate` sind noch gezeichnete SVGs (Atlas hat nur
  4 freie Felder – Bogen nach docs/SYMBOLE.md neu erzeugen).
- Herold (Dialog) ohne Porträt; Titel-/Ladebild, Kampagnenbilder fehlen; Website-Bilder (`public/site/*.webp`)
  zeigen noch den KayKit-Stand (neu aufnehmen: `scripts/site-screens.py`).
- Bäume: Prototyp mit gemalter Struktur (`?nature=off` zum Vergleich) wirkt nur dezent – Entscheidung offen:
  eigene Blatttextur oder Meshy-Bäume (~5 Arten, ~150 Credits).

## Technik

- Gebäude und Figuren werden bei Bedarf nachgeladen; Bewegungsdateien sind auf reine Bewegungsdaten gekürzt.
- **Rohdateien:** `assets-src/` (auch die Meshy-Rohmodelle `raw*.glb`, `rigged*.glb`, `remeshed.glb`) liegt nur lokal
  beim Maintainer und gehört nicht ins Repository; Sicherung siehe [ROHDATEIEN.md](ROHDATEIEN.md).
- KayKit-Gebäude in Spielerfarben entfernt (7 MB); KayKit bleibt für Baustelle, Trümmer und Natur.
