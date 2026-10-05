# Erweiterungsinhalte

Vorbild: die Erweiterungen von *Die Siedler – Das Erbe der Könige* („Nebelreich“, März 2005; „Legenden“, September 2005).
Nachgebaut werden Mechaniken; Namen, Texte, Grafiken und Werte sind eigene. Übrig sind **Brücken**, **Brunnen** und
**Denkmal** – sie gehören fest zum Spiel (freies Spiel, Kampagne, Skripte), einen Schalter gibt es nicht. Regeln und
Zahlen: [Spielregeln §13](SPIELREGELN.md#13-brücken-und-zierden).

Code: `src/sim/systems/bridges.js`, Daten `src/sim/data/bridges.js` (Brückenstellen) und Einträge in `buildings.js`
(`bridge`, `fountain`, `statue`) und `buildingTechs.js` (`mathematics`), Texte `src/i18n/extras.*.js`, Symbole
`src/ui/icons/extras.js`.

## Recherche: Was brachten die Erweiterungen?

| Inhalt im Original | Beleg | Umgesetzt? |
|---|---|---|
| Neue Einheiten **Dieb** und **Kundschafter**, angeworben in Taverne/Wirtshaus | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html) | ~~ja~~ – entfernt (zu komplex für den Spielfluss) |
| Dieb: für Gegner unsichtbar, stiehlt aus Vorratslagern, Sprengladungen (z. B. an Brücken), entschärft Sprengstoff | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/), [siedler-maps.de (Forum)](https://www.siedler-maps.de/forum/Siedler-DEdK-Script-Forum/Dieb-soll-Brcke-sprengen-16242.htm) | ~~ja~~ – entfernt |
| Kundschafter: erkundet, „Rohstoffe finden“ zeigt Lagerstätten, Fackel | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html) | ~~ja~~ – entfernt, ebenso die verborgenen Lagerstätten |
| Leichte und schwere **Scharfschützen** (Büchsen) aus der Büchsenmacherei | [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | ~~ja~~ – entfernt |
| **Brückenbau** nach Forschung (Mathematik, Architektenbüro), Leibeigene bauen an Baugerüsten | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | **ja** – Mathematik (Steinmetzhütte), Brückenstellen vom Kartengenerator |
| Neue Helden: Meisterschütze (Drake), Kampfkünstlerin mit Moral-/Unterstützungsfähigkeiten (Yuki), Nebelhexe mit Giftnebel, der schadet und verlangsamt (Kala) | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | ~~ja, zwei~~ – Falk (Schütze) und Morla (Nebelhexe) wurden mit der Kampagne „Krone aus Eis“ entfernt (siehe [Kampagne](KAMPAGNE.md)) |
| Sumpf-/Nebelgebiete als neue Klimazone, „Nebelvolk“ als Gegner | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | nein (siehe unten) |
| Söldnerlager auf der Karte (Truppen gegen Rohstoffe ohne Militärgebäude) | [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | nein |
| Nebelreich: Karteneditor, neue Einzel- und Mehrspielerkarten; Legenden: drei Mehrspieler-Helden im Einzelspiel, erweiterter Editor, Zufallskarten, vier Kampagnen | [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings) | teilweise – neue Helden auch im freien Spiel wählbar; Zufallskarten gibt es schon, Editor nein |
| Verschönerungen (Zierden) für die Motivation | Grundspiel (Uhr, Windrad schon vorhanden), siehe [Spielregeln §4](SPIELREGELN.md) | **ja** – zwei weitere: Brunnen, Denkmal |

Weitere Quellen der Suche: [spieletipps.de](https://www.spieletipps.de/artikel/73/1/), [Fandom-Wiki Nebelreich](https://die-siedler.fandom.com/de/wiki/Die_Siedler_5:Das_Erbe_der_K%C3%B6nige_-_Nebelreich_(Erster_Add-On))
(beim Abruf nicht erreichbar), [MobyGames](https://www.mobygames.com/game/35467/the-settlers-heritage-of-kings-expansion-disc/).

## Auswahl

1. **Brücken** – verändern Wege und Erreichbarkeit (Abkürzungen über Flüsse, auch für den Feind); die Wegsuche über
   Gebiete (`regionAt`) berücksichtigt sie automatisch über das Kartenbit `BRIDGE`.
2. **Brunnen, Denkmal** – reine Daten, mehr Spielraum für Motivation und Steuern.

**Entfernt** (Oktober 2026, mit der Kampagne „Krone aus Eis“): Wirtshaus, Dieb, Kundschafter, verborgene
Lagerstätten, Büchsenmacherei und Büchsenschützen. Sie machten das Spiel unübersichtlich und waren zu nah am
Vorbild abgeschrieben; die Kampagne nutzte sie nicht. Spielstände älterer Versionen lassen sich deshalb nicht mehr
laden (`saves.err.outdated`, Speicherformat 2).

**Abweichung vom Vorbild:** Brücken bauen hier Leibeigene (wie jedes Gebäude), im Original Architekten am Baugerüst.

Nicht umgesetzt: Sumpf-Klimazone und Nebelvolk, Söldnerlager (die Kampagne hat dafür Tribute „Söldner anheuern“).

## Zusammenspiel mit Bauen am Hang und Entwicklermodus

- **Brücken werden nicht eingeebnet** (`createBuilding` überspringt `levelSite` für `placement: 'bridge'`): Flussbett
  und Deck bleiben, wie sie sind.
- **Brückenköpfe** (die Uferkacheln an beiden Enden) und Landkacheln einer Brückenstelle werden beim Start
  freigeräumt (Bäume/Haufen) und **reserviert**: Niemand verbaut den Zugang, und die Einebnung lässt reservierte
  Kacheln im Übergangsrand unverändert – das Ufer und damit die Deckhöhe bleiben gleich, auch wenn daneben gebaut wird.
- **Entwicklermodus**: Das Begehbarkeitsraster zeigt Brücken (begehbar).

## Technik

- Brückenstellen kommen aus `findBridgeSites()` im Kartengenerator (deterministisch, ohne Zufall, ohne die Karte
  zu ändern) und stehen in `sim.bridgeSites` (im Spielstand und im Hash); die fertige Brücke setzt `BRIDGE` auf
  ihre Wasserkacheln, zerstört werden sie wieder Wasser, wer darauf steht, ertrinkt.
- Computergegner: baut nach Kaserne und drei Hauptleuten eine Brücke Richtung Gegner sowie Brunnen und Denkmal
  (`EXTRAS` in `src/ai/AiPlayer.js`).
- Modelle: Brunnen, Denkmal und Brücke eigene Meshy-Modelle (`fountain`, `statue`, `bridge`). Die Brücke ist ein
  ganzes Modell mit zwei Widerlagern; `bridgeAssetModel` (src/render/models.js) streckt nur den gleichförmigen
  Mittelteil auf die Länge der Brückenstelle (2–9 Kacheln), die Enden bleiben unverzerrt. Bis es geladen ist,
  steht die prozedurale Brücke.
- Tests: `tests/sim/bridges.test.js`, E2E `e2e/bridges.spec.js`.
