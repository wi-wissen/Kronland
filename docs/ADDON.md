# Erweiterungsinhalte

Vorbild: die Erweiterungen von *Die Siedler – Das Erbe der Könige* („Nebelreich“, März 2005; „Legenden“, September 2005).
Nachgebaut werden Mechaniken; Namen, Texte, Grafiken und Werte sind eigene. Regeln und Zahlen:
[Spielregeln §13](SPIELREGELN.md#13-erweiterungsinhalte). Im freien Spiel gehören die Inhalte fest zum Spiel – einen
Schalter gibt es nicht mehr (die Sim-Option `addon` bleibt für Missionen, Tests und `scripts/ai-match.js`). Code: `src/sim/systems/addon.js`, Daten
`src/sim/data/addon.js` (+ Einträge mit `addon: true` in `buildings.js`, `units.js`, `buildingTechs.js`),
KI `src/ai/addonAi.js`, Oberfläche `src/game/addonUi.js`, `src/ui/hud/SpecialistPanel.vue`, Texte `src/i18n/addon.*.js`.

## Recherche: Was brachten die Erweiterungen?

| Inhalt im Original | Beleg | Umgesetzt? |
|---|---|---|
| Neue Einheiten **Dieb** und **Kundschafter**, angeworben in Taverne/Wirtshaus | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html) | **ja** – Wirtshaus, Dieb, Kundschafter |
| Dieb: für Gegner unsichtbar, stiehlt aus Vorratslagern, Sprengladungen (z. B. an Brücken), entschärft Sprengstoff | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/), [siedler-maps.de (Forum)](https://www.siedler-maps.de/forum/Siedler-DEdK-Script-Forum/Dieb-soll-Brcke-sprengen-16242.htm) | **ja** – Unsichtbarkeit (Türme/Kundschafter entdecken), Stehlen, Sprengladung; Entschärfen nein |
| Kundschafter: erkundet, „Rohstoffe finden“ zeigt Lagerstätten, Fackel | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html) | **ja** – große Sicht, Fackel, Rohstoffsuche legt verborgene Lagerstätten frei |
| Leichte und schwere **Scharfschützen** (Büchsen) aus der Büchsenmacherei | [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | **ja** – Linie Büchsenschützen (2 Stufen), Büchsenmacherei |
| **Brückenbau** nach Forschung (Mathematik, Architektenbüro), Leibeigene bauen an Baugerüsten | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | **ja** – Mathematik (Steinmetzhütte), Brückenstellen vom Kartengenerator |
| Neue Helden: Meisterschütze (Drake), Kampfkünstlerin mit Moral-/Unterstützungsfähigkeiten (Yuki), Nebelhexe mit Giftnebel, der schadet und verlangsamt (Kala) | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [dlh.net](https://www.dlh.net/de/reviews/1199/die-siedler-v---nebelreich.html), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | **ja, zwei** – eigene Figuren Falk (Schütze) und Morla (Nebelhexe), keine Originalnamen |
| Sumpf-/Nebelgebiete als neue Klimazone, „Nebelvolk“ als Gegner | [PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/), [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | nein (siehe unten) |
| Söldnerlager auf der Karte (Truppen gegen Rohstoffe ohne Militärgebäude) | [Retro Replay](https://retro-replay.com/db/windows/the-settlers-heritage-of-kings-expansion-disc/) | nein |
| Nebelreich: Karteneditor, neue Einzel- und Mehrspielerkarten; Legenden: drei Mehrspieler-Helden im Einzelspiel, erweiterter Editor, Zufallskarten, vier Kampagnen | [Wikipedia](https://en.wikipedia.org/wiki/The_Settlers:_Heritage_of_Kings) | teilweise – neue Helden auch im freien Spiel wählbar; Zufallskarten gibt es schon, Editor nein |
| Verschönerungen (Zierden) für die Motivation | Grundspiel (Uhr, Windrad schon vorhanden), siehe [Spielregeln §4](SPIELREGELN.md) | **ja** – zwei weitere: Brunnen, Denkmal |

Weitere Quellen der Suche: [spieletipps.de](https://www.spieletipps.de/artikel/73/1/), [Fandom-Wiki Nebelreich](https://die-siedler.fandom.com/de/wiki/Die_Siedler_5:Das_Erbe_der_K%C3%B6nige_-_Nebelreich_(Erster_Add-On))
(beim Abruf nicht erreichbar), [MobyGames](https://www.mobygames.com/game/35467/the-settlers-heritage-of-kings-expansion-disc/).

## Auswahl und Begründung

1. **Dieb** – neue Spielweise (Wirtschaftskrieg statt Schlacht), nutzt den vorhandenen Nebel des Krieges und
   gibt Türmen eine zweite Aufgabe (Diebe entdecken). Gegenspiel: Türme, Kundschafter, Truppen.
2. **Kundschafter + verborgene Lagerstätten** – macht Erkundung lohnend (Fackel, Sicht) und gibt der Kartenmitte
   Wert; die Lagerstätten sind nur mit Erweiterung da und ändern die Grundkarte nicht.
3. **Brücken** – verändern Wege und Erreichbarkeit (Abkürzungen, Sprengziele); die Wegsuche über Gebiete
   (`regionAt`) berücksichtigt sie automatisch über das Kartenbit `BRIDGE`.
4. **Büchsenschützen** – nutzt den schon vorgesehenen Angriffstyp „Schuss“ und gibt Schwefel einen weiteren Zweck.
5. **Zwei Helden** – Falk (Fernkampf, Stärkung der Schützen) und Morla (Flächenschaden, Verlangsamung,
   Unsichtbarkeit) bringen neue taktische Mittel; Morlas Schleier nutzt dieselbe Unsichtbarkeit wie der Dieb.
6. **Brunnen, Denkmal** – billig umzusetzen (reine Daten), mehr Spielraum für Motivation und Steuern.

**Bewusste Abweichungen vom Vorbild**
- Der Dieb im Original „tarnt sich als Leibeigener“ ([PC Games](https://www.pcgames.de/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-Spiel-21510/Tests/Die-Siedler-Das-Erbe-der-Koenige-Nebelreich-365700/)).
  Hier ist er unsichtbar, bis ein Turm oder Kundschafter ihn entdeckt: Eine Tarnung, die nur die Darstellung täuscht,
  ließe sich im Lockstep nicht fair prüfen (die KI liest den Zustand) – Unsichtbarkeit ist eine klare Sim-Regel.
- „Rohstoffe finden“ zeigt im Original die Richtung von Minen. Hier legt es verborgene Lagerstätten frei; das passt
  zur festen Karte ohne versteckte Schächte und macht den Fund sofort nutzbar.
- Brücken bauen hier Leibeigene (wie jedes Gebäude), im Original Architekten am Baugerüst.

Nicht umgesetzt: Sumpf-Klimazone und Nebelvolk (eigene Grafiken/Gelände und eine neue Gegnerpartei – zu groß
für diesen Schritt, wäre ein eigenes Kampagnenkapitel), Söldnerlager (überschneidet sich mit dem Räuberlager der
Missionen), Entschärfen von Sprengladungen, Kampfkünstlerin mit Feuerwerk (Motivation ist über Zierden abgedeckt).

## Zusammenspiel mit Bauen am Hang und Entwicklermodus

- **Brücken werden nicht eingeebnet** (`createBuilding` überspringt `levelSite` für `placement: 'bridge'`): Flussbett
  und Deck bleiben, wie sie sind.
- **Brückenköpfe** (die Uferkacheln an beiden Enden) und Landkacheln einer Brückenstelle werden beim Start
  freigeräumt (Bäume/Haufen) und **reserviert**: Niemand verbaut den Zugang, und die Einebnung lässt reservierte
  Kacheln im Übergangsrand unverändert – das Ufer und damit die Deckhöhe bleiben gleich, auch wenn daneben gebaut wird.
- **Entwicklermodus**: Figureninfos kennen Spezialisten (Auftrag `thief:steal`, Ziel, Beute), das
  Begehbarkeitsraster zeigt Brücken (begehbar), die Statistik zählt die neuen Entities. Unsichtbare feindliche
  Diebe bleiben auch im Entwicklermodus verborgen, solange der Nebel nicht aufgehoben ist.

## Review (zweite Runde)

- **Entdeckung je Team**: `e.seenBy` (Bitmaske der Teams, deren Türme/Kundschafter einen Dieb bzw. verschleierte
  Truppen entdecken). Nur diese Teams sehen und bekämpfen sie; ein Turm von B verrät einen Dieb von A nicht an C
  (`src/sim/systems/hidden.js`, genutzt von `canSee`, `nearestEnemy`, Darstellung und KI).
- **Unsichtbar auch ohne Nebel** (vorher sah man Diebe bei „Nebel aus“).
- **Stehlen**: höchstens einmal je Abklingzeit, Bestände nie negativ, Beute geht mit dem Dieb verloren; derselbe
  Auftrag noch einmal setzt den Fortschritt nicht mehr zurück (vorher brach Dauerklicken das Stehlen ab).
- **Speicher**: Meldungsliste entdeckter Diebe und KI-Aufträge gefallener Diebe wachsen nicht mehr.
- Tests: `tests/sim/addon.test.js`, `tests/sim/addonReview.test.js`, E2E `e2e/addon.spec.js`.

## Technik

- Schalter: `new Sim({ addon: true })` (Standard aus, damit Kampagne, Tutorial und alte Tests unverändert
  bleiben); freies Spiel über das Startmenü (Standard an), Missionen per `addon: true` in der Missionsdatei.
- Neue Entities: `specialist` (Dieb/Kundschafter), `charge` (Sprengladung), `torch` (Fackel), `cloud`
  (Giftnebel), `deposit` (verborgene Lagerstätte). Unsichtbarkeit ist das Feld `hidden` (jeden Takt neu,
  `updateHidden`); `canSee` und `targetable` behandeln es für alle Gegner, auch für die KI.
- Brückenstellen kommen aus `findBridgeSites()` im Kartengenerator (deterministisch, ohne Zufall, ohne die Karte
  zu ändern) und stehen in `sim.bridgeSites`; die fertige Brücke setzt `BRIDGE` auf ihre Wasserkacheln.
- Hash und Spielstand enthalten alle neuen Zustände (`hashAddon`, `addon`/`bridgeSites` im Spielstand).
- KI-Partie mit Erweiterung: `node scripts/ai-match.js 1 60 hard easy --addon` (zählt Diebstähle, Funde, Fackeln …).
- Modelle: Wirtshaus/Büchsenmacherei/Brunnen aus dem KayKit-Paket (`tavern`, `blacksmith`, `well`), Brücke,
  Denkmal, Ladung, Fackel und Giftnebel prozedural; Figuren über das Manifest (`specialist.thief` =
  Rogue_Hooded mit Messern, `specialist.scout`, `soldier.rifle`, `hero.falk` = Rogue mit Armbrust,
  `hero.morla` = Mage mit Zauberstab und Buch). Symbole: `src/ui/icons/addon.js`.
