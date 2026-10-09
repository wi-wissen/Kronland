# Spielregeln (Spezifikation)

Kronland bildet das Gameplay von *Die Siedler – Das Erbe der Könige* (Grundspiel, ohne Addons) nach.
Mechanik wird übernommen, Namen von Helden, Texte und Grafiken sind eigene.

Mechaniken und Größenordnungen stammen aus der Recherche (dedk.de-Wiki, Handbuch, Original-Entity-XMLs).
Zahlen werden nicht 1:1 übernommen: Truppen- und Wirtschaftswerte sind eigene, mit Messskripten so abgestimmt,
dass die Verhältnisse dem Vorbild ähneln (§4 Veredler, §8 Truppen). Werte mit **(A)** sind eigene Annahmen;
sie sind Balancing-Stellschrauben und stehen gebündelt in `src/sim/data/`.

## 1. Grundprinzip

- Keine Wege, keine Träger, kein Territorium. Gebaut wird frei auf freiem Gelände; mäßige Hänge werden
  beim Bauen eingeebnet (§6a). Trampelpfade und Fußspuren sind nur Optik (§14).
- Rohstoffe werden beim Abbau sofort dem Spieler gutgeschrieben.
- Ausnahmen beim Bauen: Dorfzentren nur auf **Siedlungsplätzen**, Minen nur auf **Schächten**.
- Spielzeit läuft in festen Takten (10 Takte pro Sekunde).

## 2. Rohstoffe

| Rohstoff | Rohgewinnung | Veredler |
|---|---|---|
| Taler | Steuern am Zahltag | Bank |
| Holz | Leibeigene fällen Bäume | Sägemühle |
| Lehm | Leibeigene an Haufen, Lehmgrube | Ziegelhütte |
| Stein | Leibeigene an Haufen, Steingrube | Steinmetzhütte |
| Eisen | Leibeigene an Haufen, Eisengrube | Schmiede |
| Schwefel | Leibeigene an Haufen, Schwefelgrube | Alchimistenhütte |

- Jeder Rohstoff hat ein Konto *roh* und *veredelt*. Beides ist verbaubar; bezahlt wird zuerst aus
  veredelt, dann aus roh.
- Veredler holen Rohware selbst (5 pro Gang) aus Burg, Lager oder Mine und wandeln sie um.
- Bergleute arbeiten 4× so schnell wie Leibeigene. Leibeigene hacken Holz etwa doppelt so schnell
  wie andere Rohstoffe.
- Startrohstoffe (Normal): 500 Taler, 2400 Lehm, 1750 Holz, 700 Stein, 50 Eisen, 50 Schwefel.
- Bäume wachsen nicht nach. Der Kartengenerator garantiert jedem Start mindestens 70 Bäume im Umkreis
  von 25 Kacheln und rund 150 im Umkreis von 40 Kacheln **(A)**. Sonst war auf waldarmen Karten das Holz
  um Minute 20 aufgebraucht, bevor eine Kaserne stand.

## 3. Leibeigene

- Kosten 50 Taler, gekauft in der Burg, belegen 1 Bevölkerungsplatz.
- 200 LP, Angriff 5, Rüstung 0. Kein Haus, kein Hof, keine Steuern, keine Motivation.
- Aufgaben (vom Spieler befohlen): bauen (höchstens so viele wie das Gebäude Bauplätze hat, 1/4/6/8, und so viele
  Plätze frei sind), reparieren, Holz fällen,
  Haufen abbauen. Nach getaner Arbeit suchen sie im Umkreis gleichartige Arbeit **(A)**
  (auch nach einer Reparatur: nächstes beschädigtes eigenes Gebäude).
- Abbau verteilt sich: höchstens 1 Leibeigener je Baum und 4 je Rohstoffhaufen **(A)**. Schickt man
  mehrere zu einem Baum, gehen die übrigen zu freien Bäumen in der Nähe (Umkreis 12 Kacheln, nur
  erreichbare). Ist dort nichts mehr frei, teilen sie sich einen Baum; ist gar nichts mehr da, bleiben sie
  untätig und es erscheint die Meldung „Kein Holz mehr in der Nähe“.
- **Feste Plätze – nie zwei auf einem Fleck** **(A)**: Wer baut oder repariert, belegt eine eigene freie
  Kachel direkt an der Grundfläche (die nächste zu ihm, im selben Gebiet) und steht in deren Mitte – so schlägt
  er an die Wand. Wer Holz fällt oder einen Haufen abbaut, steht auf einem eigenen **Punkt im Kreis** um
  Baum bzw. Haufen (Baum: 8 Plätze, Halbmesser 0,9 Kacheln; Haufen: 8 Plätze, 0,95 Kacheln), mit Blick zum
  Ziel. Plätze auf gesperrten Kacheln (Nachbarbaum, Wasser, Gebäude) oder in einem anderen Gebiet fallen weg;
  belegt ist ein Platz, wenn eine andere ruhende Figur näher als 0,6 Kacheln steht (auch Leibeigene an
  Nachbarbäumen, Bauleute, wartende Arbeiter). Ist alles belegt, ist das Ziel voll: Eine Baustelle nimmt dann
  keinen weiteren Leibeigenen an (Meldung „An der Baustelle ist kein Platz mehr frei“, `err.siteFull`), beim
  Abbau weichen die übrigen auf den nächsten Baum/Haufen mit freiem Platz aus. Die Obergrenze der Bauplätze je
  Gebäude bleibt; frei werdende Plätze (Abzug, Tod, Abbruch, Miliz) werden sofort wieder vergeben.
  Gewählt wird im innersten Ring der Platz, der der Figur am nächsten liegt (also in der Richtung, aus der sie
  kommt, sonst der nächste freie daneben). Die Figur läuft bis in die Kachel des Platzes und dann geradeaus
  auf den genauen Punkt. Umsetzung: `src/sim/systems/spots.js`, Werte in `SPOTS` (`src/sim/data/spots.js`);
  der Platz steht an der Figur (`spot` = Kachel, `slot` = Kreisplatz; gespeichert und im Zustands-Hash), die
  belegten Plätze werden daraus abgeleitet. KI und Missions-Bots schicken nur so viele Leibeigene, wie Plätze
  frei sind (`siteRoom`). Im Kampf und bei Laufbefehlen gilt das nicht (dort fächern Formationen bzw.
  Zielkacheln auf).
- Laufbefehle fächern auf: Jede Figur bekommt eine eigene Zielkachel um den Klickpunkt (Leibeigene
  1 Kachel Abstand, Truppen und Helden 3 Kacheln, damit die Soldaten dahinter Platz haben). Bei einem Klick
  des Spielers (Befehlsfeld `avoid`) bleiben Kacheln frei, auf denen schon eine andere Figur steht oder auf die
  ein Leibeigener gerade läuft (`takenTiles`, bei Trupps zählen nur Hauptleute und Helden): Wer auf eine besetzte
  Kachel geschickt wird, bleibt auf der Nachbarkachel stehen. Skripte und KI laufen weiter genau aufs Ziel.
- Beim Platzieren eines Gebäudes mit ausgewählten Leibeigenen fangen diese sofort an zu bauen.
- Über jeder Baustelle (auch beim Ausbau) zeigt ein blauer Balken den Baufortschritt. Ausbauten nehmen keine
  Leibeigenen an (`err.upgradeNoSerfs`), siehe §6.
- Angreifen wie Holzhacken (Vorbild): Leibeigene wählen, dann Gegner statt Baum anklicken (Rechtsklick bzw.
  Tippen) – sie greifen mit bloßen Fäusten an (Angriff 5, Arbeitsauftrag `fight`), bis er fällt; Gebäude nicht.
  Wer kämpft, flieht nicht.
- „Zu den Waffen“ in der Burg: alle Leibeigenen werden Miliz (Angriff 9, Rüstung 1), rückverwandelbar
  („Entwarnung“ in der Burg oder „An die Arbeit“ bei gewählter Miliz).
- Angegriffen wehren sich Leibeigene nicht von selbst (wie im Vorbild): Sie **fliehen** 6 s lang (`fleeTicks`) zur
  Burg – oder vom Angreifer weg (`fleeTiles` = 8 Kacheln), wenn der näher an der Burg steht – und arbeiten danach
  an ihrer Aufgabe weiter. Miliz flieht nicht.

## 4. Arbeiter, Motivation, Steuern

- Arbeiter erscheinen automatisch am Dorfzentrum, wenn ein Arbeitsplatz frei ist und das
  Bevölkerungslimit es zulässt. Nicht steuerbar.
- Zyklus: arbeiten → Ausdauer sinkt → essen (Bauernhof) → schlafen (Wohnhaus) → weiter.
  Ohne Platz: Lagerfeuer, deutlich langsamer. Haus + Hof machen ca. 7× schneller.
- **Lagerfeuer entstehen nur bei Bedarf**: Braucht ein Arbeiter ohne Bett oder Essplatz Rast, nimmt er das
  nächste eigene Lagerfeuer bis 12 Kacheln um seinen Arbeitsplatz. Gibt es keins, wird auf einer freien Kachel
  3–10 Kacheln um den Arbeitsplatz eins entzündet (mit einer Kachel Luft zu Gebäuden, Bäumen, Wasser und
  reservierten Plätzen, im selben Gebiet). Alle 5 s prüft die Simulation, ob es noch gebraucht wird; haben alle
  Arbeiter in der Nähe Bett und Essplatz und rastet niemand mehr dort, geht es aus. Überbautes Feuer erlischt.
  So zeigen Lagerfeuer (auch als orange Punkte auf der Minikarte), wo Wohnhäuser oder Bauernhöfe fehlen;
  beim ersten Feuer kommt eine Meldung (höchstens einmal je Minute). Findet sich kein Platz, rasten sie wie
  früher an Dorfzentrum oder Burg. Burg und Dorfzentrum haben kein festes Lagerfeuer mehr.
- **Plätze am Lagerfeuer** **(A)**: Rastende sitzen im Kreis um das Feuer (8 Plätze, Halbmesser 1,1 Kacheln,
  je einer in jeder der 8 Nachbarkacheln) und schauen hinein. Ist der Kreis voll, nimmt der Nächste ein anderes
  Feuer in Reichweite mit freiem Platz oder entzündet ein weiteres (mind. 3 Kacheln vom nächsten Feuer, die
  Kreise überschneiden sich nicht).
- **Warten vor dem Gebäude** **(A)**: Arbeiter, die draußen vor ihrem Arbeitsplatz warten (Ausbau, keine
  Rohware) – oder ohne Feuerplatz an Dorfzentrum bzw. Burg rasten –, stehen auf einem Kreis um das Gebäude
  (Halbmesser halbe Diagonale der Grundfläche + 0,4 Kacheln, zweiter Ring 0,9 Kacheln weiter außen und um
  einen halben Platz versetzt, Plätze mindestens 1 Kachel auseinander) und schauen zum Gebäude. Die Gruppe
  sammelt sich auf der Seite, von der sie kommt. Nur wenn wirklich alles belegt ist, stellen sie sich wie
  früher irgendwo dazu.
- Wohnhaus 6/9/12 Betten, Bauernhof 8/10/12 Essplätze (Stufe 1/2/3).
- Umsetzung (Werte in `src/sim/data/professions.js`): Ausdauer max. 2000 (neue Arbeiter 600),
  ein Arbeitsgang kostet 100. Essen +200, Schlafen +400 – jeweils × Motivationswirkung; Lagerfeuer
  fest +25. Motivationswirkung (linear dazwischen): 25 % → 10 %, 50 % → 45 %, 100 % → 100 %, 300 % → 300 %.
- **Abgleich mit der Veredleranalyse des Vorbilds** (dedk.de, Produktion je Veredler und Minute bei
  Motivation 30…300 % und Haus/Hof/beides/nichts). Nachmessen: `node scripts/refiner-analysis.js`.
  Gleiche Tendenzen, eigene Zahlen:
  - Motivation steigert die Leistung auch über 100 % gleichmäßig (Vorbild 300 %: ca. +35 %, hier ca. +30 %);
    unter 100 % sackt sie stark ab (30 %: Vorbild und hier rund ein Drittel von 100 %).
  - Haus bringt mehr als Hof: bei 100 % leistet „nur Haus“ ca. 70 %, „nur Hof“ ca. 50 % von Haus + Hof.
  - Ohne beides sind Veredler fast nur Steuerzahler (ca. 15 % Leistung), egal wie motiviert.
  - Steinmetze sind am ergiebigsten, Sägewerker am wenigsten; der Schatzmeister liegt knapp darüber
    (Vorbild: Schatzmeister mit Haus + Hof bringt etwa so viel wie seine Steuern noch einmal).
  - Lauftempo-Forschung bringt Veredlern wenig, Ausbau ändert die Leistung je Arbeiter nicht (nur mehr Plätze).
  - Messwerte Steinmetz, Stein/min (Haus + Hof / nur Haus / nur Hof / nichts):
    300 %: 28 / 23 / 18 / 3 · 100 %: 22 / 15 / 11 / 3 · 30 %: 8 / 6 / 4 / 3.
- Veredler holen 5 Rohware pro Gang; je Arbeitsgang wird 1 Rohware zu 2 veredelter Ware **(A)**.
- Überstunden: 1,5× schneller, −1 % Motivation je Arbeitsgang **(A)**.
- Segnung: 1000 Glaube, +25 % Motivation für die Berufsgruppe **(A)**.
- Maximale Motivation: 150 % + Ziergebäude (Uhr, Windrad je +4 %), höchstens 300 % **(A)**.
- Abriss erstattet die Hälfte der Baukosten **(A)**; die Arbeiter verlassen die Siedlung.
- Motivation: Start 100 %, Maximum 300 %.
  - < 70 %: Warnung. Durchschnitt < 30 %: keine neuen Siedler. Einzelner < 25 %: wandert ab.
  - Sinkt durch hohe Steuern, Überstunden. Steigt durch niedrige Steuern, Segnungen, Ziergebäude.
- **Zahltag alle 120 s.** 5 Steuerstufen: keine, niedrig, normal, hoch, sehr hoch.
  „Sehr hoch“ bringt das Doppelte von „normal“. Steuersatz erst nach Forschung „Bildung“ wählbar.
  - Taler je Arbeiter bei „normal“: 5 **(A)**. Faktoren 0 / 0,5 / 1 / 1,5 / 2 **(A)**.
  - Motivation je Zahltag: +8 % / +4 % / 0 / −6 % / −12 % **(A)**.
- Sold: je Hauptmann am Zahltag 10 Taler **(A)**.

## 5. Bevölkerung

- Limit nur durch Dorfzentren: 75 / 100 / 125 Plätze (Stufe 1/2/3).
- Alle Einheiten außer Helden zählen. Kavallerie 2 Plätze, Kanone 5.

## 6. Gebäude

Siehe `src/sim/data/buildings.js` (Kosten, Bauzeit, Bauplätze, Größe, Stufen, Freischaltung).

**Bauzeit und Bauplätze** (Quelle: Original-XML `config/entities/PB_*.xml`, Spiel-Engine laut
S5BinkHook `CConstructionSite::GetProgressPerTick`: Fortschritt je Leibeigenem und Takt = 1 / (BuildFactor ·
Time · 10), BuildFactor 1):
- `buildTime` von Stufe 1 gilt für **einen** Leibeigenen; jeder weitere zählt voll mit, n Leibeigene brauchen
  `buildTime / n` (je Leibeigenem und Takt 1 Punkt, Arbeit = `buildTime · 10` Punkte).
- Höchstens so viele wie das Gebäude **Bauplätze** hat (`builders`, Anzahl `BuilderSlot` im Original): Zierbauten 1,
  meist 4; Dorfzentrum, Hochschule, Sägemühle, Kaserne, Schießplatz, Kanonengießerei 6; Burg, Bank, Kapelle,
  Reiterei 8. Gleiche Grenze bei der Reparatur.
- **Ausbau ohne Leibeigene**: Ein Ausbau läuft von selbst, 1 Punkt je Takt, und dauert genau die angegebene Zeit
  (`buildTime` der Stufe 2+, im Original `Upgrade/Time` der unteren Stufe; `src/sim/systems/upgrades.js`). Beleg:
  Die Ausbau-Baustelle `ZB_UpgradeSite*` ist im Original ein reines `EGL::CGLEEntity` ohne Bauplätze (die
  Neubau-Baustelle dagegen `GGL::CConstructionSite`), der Leibeigene kennt nur `ApproachConstructionSiteTaskList`,
  und der Fortschritt steht als `UpgradeProgress` am Gebäude (Anzeige wie Forschung und Handel). Während des
  Ausbaus ruht das Gebäude (Original: `IsBuildingClosed`); LP steigen mit dem Fortschritt auf den neuen Höchstwert.
  Laufende Reparaturen enden beim Start des Ausbaus.

| Gebäude | Bau (1 Leibeigener) | Ausbau → 2 / → 3 | Bauplätze |
|---|---|---|---|
| Burg (nicht baubar) | – | 90 / 120 s | 8 |
| Dorfzentrum | 110 s | 40 / 40 s | 6 |
| Wohnhaus, Bauernhof | 80 s | 40 / 50 s | 4 |
| Hochschule | 90 s | 50 s | 6 |
| Lehm-, Stein-, Eisenmine | 80 s | 40 / 50 s | 4 |
| Schwefelmine | 110 s | 40 / 50 s | 4 |
| Ziegelhütte, Schmiede | 110 s | 40 s | 4 |
| Sägemühle | 110 s | 40 s | 6 |
| Steinmetz, Alchimist | 80 s | 40 s | 4 |
| Bank | 130 s | 40 s | 8 |
| Kapelle | 140 s | 60 / 90 s | 8 |
| Lager (Original: Markt) | 80 s | 40 s | 4 |
| Kaserne, Schießplatz | 90 s | 40 s | 6 |
| Reiterei | 120 s | 40 s | 8 |
| Kanonengießerei | 110 s | 40 s | 6 |
| Wachturm | 80 s | 15 / 15 s | 4 |
| Wetterturm, Wetterkraftwerk | 40 s | – | 4 |
| Brücke | 80 s | – | 4 |
| Windrad (≈ Zierbau 12), Denkmal (≈ Zierbau 07) | 20 s / 30 s | – | 1 |
| Uhr, Brunnen | 20 s **(A)** | – | 1 |

Vorher galt die Bauzeit bei 4 Leibeigenen (ein Leibeigener brauchte das Vierfache); mit gleich vielen
Leibeigenen baut Kronland jetzt 3- bis 4-mal so schnell wie zuvor, also wie das Original.

## 6a. Bauen am Hang

**Regel in Kronland**
- Bebaubar ist eine Fläche, wenn der Höhenunterschied ihrer Kacheln höchstens `BALANCE.maxSlope` =
  **400 cm** beträgt **(A)** und sie frei von Wasser, Klippen, Belegung und reservierten Plätzen ist.
  Sonst Ablehnung `err.tooSteep` („Gelände zu steil“), Vorschau rot.
- Beim Setzen der Baustelle ebnet die Simulation die Grundfläche auf den **gerundeten Mittelwert** ihrer
  Kachelhöhen ein (Ganzzahl, cm) **(A)**. Übergangsrand: eine Kachel rundum, Kanten-Nachbarn rücken halb,
  Eck-Nachbarn ein Viertel zur Ebene **(A)**. Wasser, Klippen, belegte Kacheln (Gebäude, Bäume, Haufen)
  und reservierte Plätze (Siedlungsplätze, Schächte) im Rand bleiben unverändert – Fundamente der Nachbarn
  werden nie verschoben. Gilt für alle Gebäude gleich, auch für vorgegebene (Burg, Missionsgebäude);
  Siedlungsplätze und Schächte prüfen keine Steigung (die Kartenerzeugung legt sie eben bzw. höchstens
  `maxSlope` steil an), eingeebnet werden auch sie. Ausnahme **Brücken** (Erweiterung, §13): keine Einebnung;
  ihre Brückenköpfe sind reserviert und bleiben daher auch beim Bauen daneben unverändert.
- Die Ebene **bleibt nach Abriss und Zerstörung** bestehen **(A)** (Ruinen liegen auf ihr, neu bauen ändert nichts).
- Klippen- und Wasser-Flags ändern sich durch die Einebnung nie; Begehbarkeit und Wegsuche bleiben gleich.
- Die Höhen sind Teil des Spielstands und des Zustands-Hashes. Ereignis `terrainChanged` (Rechteck in Kacheln)
  meldet die Darstellung; im Nebel übernimmt sie es erst, wenn der Bereich sichtbar ist.
- Vorschau: grün = eben (keine Kachel weicht mehr als 40 cm ab), gelb = wird eingeebnet (der Geist steht auf
  der künftigen Ebene), rot = nicht möglich.

**Recherche (Stand 10/2026)**
- Belegt: Beim Platzieren zeigt das Spiel den Umriss; rot heißt „hier kann nicht gebaut werden“
  ([Handbuch, Abschnitt 2.5](https://cdn.akamai.steamstatic.com/steam/apps/965300/manuals/Settlers_5_Heritage_of_Kings_Manual_english.pdf)).
- Belegt: Das Gelände ist ein Höhenraster mit Knoten im Abstand von 100 Welteinheiten, per Skript änderbar
  (`Logic.SetTerrainNodeHeight(x, y, h)`); Blockierung (unbegehbar/unbebaubar) wird aus der Höhe abgeleitet
  und muss nach Höhenänderungen neu berechnet werden (`Logic.UpdateBlocking`, `CUtil.UpdateBlockingWholeMapWithHeight`)
  – Skripte im [EMS-Projekt](https://github.com/MadShadow-/EMS) (`EMS/tools/rmg/rmg.lua`).
- Belegt: Im Editor sind rot markierte Stellen „unzugänglich und unbebaubar“; für Bauflächen wird das
  Plateau-Werkzeug empfohlen, steile Übergänge soll man glätten
  ([dedk.de-Wiki: Terrainhöhen](https://dedk.de/wiki/doku.php?id=scripting:tutorials:level1:terrain_heights)).
- **Nicht belegt** (keine Quelle gefunden; Foren siedler-maps.de/siedler-games.de waren nicht abrufbar):
  genaue Steigungsgrenze, wie die Zielhöhe bestimmt wird, ob es Übergangsbereiche gibt, ob der Boden nach
  Abriss eben bleibt, Sonderregeln je Gebäudeart. Die Werte oben sind Annahmen, die das Spielgefühl
  treffen sollen: an mäßigen Hängen bauen, an Steilhängen und Klippen nicht.
- Begründung 400 cm: 1 Kachel ≈ 3,6 m (Darstellung: 360 cm Höhe je Kachelbreite); Klippe ab 230 cm je Kachel.
  400 cm über eine Fläche erlauben kleinen Gebäuden (2×2, 3×3) Hänge bis knapp unter Klippensteilheit,
  großen (4×4) nur mäßige Hänge – mehr Erdarbeit, wie man es erwartet. Kartenstatistik (Seeds 1/7/42,
  ohne Wasser/Klippen): bebaubar sind ca. 100 % der 2×2-, 90 % der 3×3- und 72 % der 4×4-Flächen
  (vorher mit 300 cm: 98/77/56 %). Die Ebene liegt höchstens etwa 2 m über/unter dem alten Boden.

## 7. Forschung

Hochschule/Universität, 4 Linien × 4 Stufen (siehe `src/sim/data/technologies.js`),
dazu Techs in Burg, Dorfzentrum, Veredlern und Militärgebäuden (`src/sim/data/buildingTechs.js`).

### 7.1 Gebäude-Technologien

Geforscht wird im jeweiligen Gebäude (Befehl `research` mit Gebäude und Tech-ID, Kosten sofort).
Werkstätten forschen nur, solange dort Arbeiter arbeiten: je arbeitendem Arbeiter 1 Punkt pro
Takt (Überstunden ×2); voll besetzt dauert eine Forschung genau die angegebene Zeit. Burg,
Dorfzentrum und Militärgebäude haben keine Arbeiter und forschen mit fester Rate (genau die
angegebene Zeit). Je Gebäude eine Forschung zur Zeit; Ausbau während der Forschung gesperrt.
Gebäude-Technologien zählen nicht für die Universitäts-Regel „4 Technologien“.

Wirkungen (Rüstung/Angriff +2 je Stufe: siedlercommunity.de; Kosten der Militärgebäude-Techs
200/200: siedlercommunity.de; alles andere **(A)**):

| Gebäude | Technologie | Stufe | Kosten | Zeit | Wirkung |
|---|---|---|---|---|---|
| Schmiede | Kettenlederrüstung | 1 | 150 T, 150 E | 30 s | Schwert, schwere Reiter: Rüstung +2 |
| Schmiede | Weiches Leder | 1 | 150 T, 150 E | 30 s | Speer, Bogen, leichte Reiter: Rüstung +2 |
| Schmiede | Kettenhemd | 2 | 250 T, 250 E | 45 s | wie Kettenlederrüstung, +2 |
| Schmiede | Wattiertes Leder | 2 | 250 T, 250 E | 45 s | wie Weiches Leder, +2 |
| Schmiede | Meisterschmied | 2 | 300 T, 300 E | 45 s | Schwert, schwere Reiter: Angriff +2 **(A)** |
| Schmiede | Plattenharnisch | 2 + Festung | 400 T, 400 E | 60 s | +2 Rüstung (dritte Stufe) |
| Schmiede | Verstärktes Leder | 2 + Festung | 400 T, 400 E | 60 s | +2 Rüstung (dritte Stufe) |
| Schmiede | Eisengießen | 2 + Festung | 400 T, 400 E | 60 s | Schwert, schwere Reiter: Angriff +2 **(A)** |
| Sägemühle | Holz härten | 1 | 150 T, 250 H | 30 s | Speer: Angriff +2 |
| Sägemühle | Drechseln | 1 | 250 T, 350 H | 45 s | Speer: Angriff +2, Reichweite +0,3 Kacheln |
| Sägemühle | Befiederung | 2 | 200 T, 300 H | 45 s | Bogen, ber. Schützen: Angriff +2 |
| Sägemühle | Bodkinpfeile | 2 | 300 T, 300 E | 60 s | Bogen, ber. Schützen: Angriff +2 |
| Alchimist | Schießpulver | 1 | 200 T, 300 Sw | 40 s | Kanonen: Angriff +2, Reichweite +1 |
| Alchimist | Glühende Geschosse | 2 | 300 T, 400 Sw | 60 s | Kanonen: Angriff +4 |
| Alchimist | Wettervorhersage | 1 | 150 T, 150 Sw | 30 s | schaltet Wetterturm frei |
| Alchimist | Meteorologie | 2 | 300 T, 300 Sw, 200 E | 60 s | schaltet Wetterkraftwerk frei |
| Steinmetz | Maurerhandwerk | 1 | 200 T, 300 St | 40 s | eigene Gebäude: Rüstung +2, LP +20 % |
| Burg | Fährtenlesen | 1 | 200 T, 200 H | 30 s | Truppen: Sichtweite +2 Kacheln |
| Burg | Stadtwache | Festung | 300 T, 200 E | 40 s | Miliz: Angriff +4, Rüstung +2 |
| Dorfzentrum | Webrahmen | 1 | 150 T, 150 H | 30 s | Leibeigene, Arbeiter: Rüstung +2 |
| Dorfzentrum | Hochwertige Schuhe | Gemeindezentrum | 200 T, 200 L | 40 s | Leibeigene, Arbeiter: Tempo +20 % |
| Kaserne | Marschieren | 1 | 200 T, 200 E | 30 s | Schwert, Speer: Tempo +20 % |
| Schießplatz | Meisterschütze | 1 | 200 T, 200 H | 30 s | Bogen: Reichweite +1, Angriff +1 |
| Reiterei | Hufbeschlag | 1 | 200 T, 200 E | 30 s | Reiterei: Tempo +20 % |
| Kanonengießerei | Verbessertes Fahrgestell | 1 | 200 H, 200 E | 30 s | Kanonen: Tempo +25 % |

Abweichung vom Original: Die Veredler haben hier nur zwei Stufen. Die dritte Stufe der Schmiede-
Technologien (Original: Feinschmiede) liegt daher auf Stufe 2 und braucht zusätzlich die Festung.
Ketten mit Vorgänger: Kettenleder → Kettenhemd → Plattenharnisch, Weiches → Wattiertes →
Verstärktes Leder, Meisterschmied → Eisengießen, Holz härten → Drechseln, Befiederung →
Bodkinpfeile, Schießpulver → Glühende Geschosse, Wettervorhersage → Meteorologie.
Maurerhandwerk hebt die LP bestehender Gebäude anteilig mit an.

## 7a. Marktplatz

- Lager Stufe 2 = Marktplatz (2 Händler). Getauscht wird in 50er-Schritten, höchstens 500 je
  Handel **(A)**, ein Handel je Marktplatz zur Zeit.
- Preise gelten für alle Spieler. Grundwerte in Talern je Einheit **(A)**: Lehm 0,8, Holz 0,8,
  Stein 0,9, Eisen 1,2, Schwefel 1,2. Taler sind die feste Währung.
- Nach jedem abgeschlossenen Handel steigt der Preis der gekauften Ware um 4 % des Grundwerts je
  50 Einheiten, der Preis der bezahlten Ware fällt ebenso (Grenzen 25 % … 400 %) **(A)**. Jeder
  50er-Schritt wird schon innerhalb des Handels zum veränderten Preis abgerechnet, darum lohnt
  Hin-und-zurück-Handeln nie (Quelle: Handbuch – wer viel verkauft, drückt den Preis für alle).
- Alle 30 s kehrt jeder Preis um 1 % des Grundwerts zum Grundwert zurück **(A)**.
- Bezahlt wird sofort, die Ware kommt nach der Handelszeit: 200 Arbeitspunkte je 50 Einheiten;
  jeder Händler am Marktplatz bringt 1 Punkt je Takt, Überstunden ×2 → mit 2 Händlern 10 s je 50
  **(A)**. Ohne Händler kein Handel.

## 8. Militär

### 8.1 Erfahrung

Hauptleute sammeln Erfahrung: jeder Treffer der Truppe (Hauptmann oder Soldat) zählt 1 Punkt.
Sterne bei 15 / 40 / 80 / 140 / 220 Punkten **(A)**. Wirkungen gelten für die ganze Truppe und
sind kumulativ (Stufentexte aus dem Handbuch, Zahlen **(A)**):

| Sterne | Rang | Wirkung |
|---|---|---|
| 1 | Gefreiter | 10 % Chance auf kritischen Treffer (doppelter Schaden) |
| 2 | Feldwebel | Fernkämpfer: Reichweite +1; Fernkämpfer und Reiter: Sicht +2 |
| 3 | Hauptmann | Regeneration: alle 2 s +2 LP für Hauptmann und Soldaten |
| 4 | Kommandant | Angriff +2 |
| 5 | General | Fernkämpfer: Angriff +2; Nahkämpfer: Rüstung +1 |

- Hauptmann + Soldaten (4 bei Stufe 1–2, 8 bei Stufe 3–4, Kavallerie 3).
  Hauptmann ist unverwundbar, solange ein Soldat bei ihm ist (höchstens 12 Kacheln entfernt und
  auf derselben Seite von Wasser/Felsen); abgeschnittene Soldaten schützen ihn nicht. Nachrekrutieren
  am Gebäude. Soldaten, die weit von ihrem Hauptmann entfernt sind, laufen zu ihm zurück; ist er
  unerreichbar, bis zur nächsten erreichbaren Stelle bei ihm.
- Schaden = Angriff × Faktor(Angriffstyp, Rüstungstyp) − Rüstung (+ kleiner Zufall).
  Tabelle in `src/sim/data/combat.js` (Aufbau wie im Vorbild, Faktoren eigene).
- **Truppenwerte** (`src/sim/data/units.js`): Rollen, Stufen und Truppenstärken wie im Vorbild, Zahlen
  eigene (Angriff, Rüstung, LP, Kosten, Aufwertungskosten, Türme, LP der Burg und Militärgebäude).
  Abgestimmt mit `node scripts/troop-duels.js` (27 Duelle volle Einheit gegen volle Einheit):
  Mit den Originalwerten und mit unseren gewinnt in jedem Duell dieselbe Seite, die Restkraft des Siegers
  weicht meist um weniger als 10 Prozentpunkte ab. Eigene Akzente: höhere Stufen haben etwas mehr LP,
  Stufe 1 ist etwas billiger. Gleiche Rangfolge: Schwert schlägt Speer und Bogen, Speer schlägt Reiter,
  Bogen schlägt schwere Reiter auf Abstand, schwere Reiter schlagen Schwerter; Kanonen verlieren gegen
  Truppen im Nahkampf.
- Türme: Wachturm → Ballistaturm → Kanonenturm.
- Helden: 550–700 LP, werden bewusstlos statt zu sterben, stehen nach 10 s ohne Feinde
  mit halben LP wieder auf. Eigene Figuren der Kampagne „Krone aus Eis“, Fähigkeiten nach dem Vorbild der
  Helden des Originals (Werte in `src/sim/data/units.js`, Abklingzeit in Klammern):
  - **Nelia**, Leibeigenentochter: *Weitblick* (deckt 30 s einen Kreis mit Radius 18 um sie auf und erkundet ihn
    dauerhaft, 90 s), *Mut machen* (Angriff eigener Hauptleute und Helden im Umkreis 6 ×2 für 60 s, 120 s)
  - **Orrin**, Händler: *Bestechen* (die nächste feindliche Truppe im Umkreis 5 wechselt die Seite, kostet
    200 Taler + 50 je Soldat; ohne Ziel oder Taler keine Abklingzeit, 180 s) **(A)**, *Wundsalbe* (170 LP für
    eigene Einheiten im Umkreis 6, 120 s)
  - **Taran**, Hauptmann: *Schildstoß* (80 Schaden an allen Feinden im Umkreis 3, 120 s), *Einschüchtern*
    (feindliche Hauptleute und Miliz im Umkreis 5 fliehen 8 Kacheln weit und greifen 15 s nicht an; ihre Soldaten
    folgen, Helden bleiben unbeeindruckt, 150 s) **(A)**
  - **Malvor**, Statthalter (Gegenspieler, im freien Spiel wählbar): *Feldgeschütz* (Geschütz mit 4 Schuss,
    Reichweite 6, 180 s), *Fußangeln* (Falle, 36 Schaden im Umkreis 2,5, 180 s)
  - Ein Spieler kann mehrere Helden haben (Missionen: `heroes: ['nelia', 'orrin']`).
- Diplomatie (Missionen): zwischen zwei Spielern *feindlich*, *neutral* oder *verbündet*. Standard aus den Teams;
  Neutrale greifen einander nicht an, teilen aber keine Sicht. Dörfer sind Spielerplätze ohne Burg und anfangs
  neutral (wie im Vorbild).
- Fremde Auswahl: Die Tafel nennt die Diplomatie mit farbigem Punkt (rot Feind, gold neutral, grün verbündet;
  Räuber heißen Räuber, Dörfer mit Namen). Fremde, nicht verbündete Gebäude zeigen nur Name, Stufe und
  Lebenspunkte – Arbeiter, Betten, Essplätze und Stimmung bleiben verborgen.
- Rekrutieren: volle Einheit oder nur Hauptmann; Soldaten nachkaufen am Militärgebäude.
- Aufwerten einer Truppengattung (Stufe 2: passender Veredler, Stufe 3: ausgebautes
  Militärgebäude, Stufe 4: zusätzlich Festung) wertet auch bestehende Truppen auf.
- Befehle: Laufen, Angreifen (Ziel oder Angriffsbewegung), Halten, Verteidigen (Standard:
  Feinde in 9 Kacheln Umkreis angreifen, höchstens 14 Kacheln vom Ankerpunkt weg) **(A)**.
  - Laufen: ignoriert Feinde.
  - Angreifen eines Gebäudes (Ziel oder Angriffsbewegung): Kommen kämpfende Feinde (Truppen, Helden,
    Miliz, Selbstschuss-Kanone) in Sichtweite (9 Kacheln), greifen Hauptmann und Soldaten zuerst sie an
    und kehren danach zum Gebäude zurück. Leibeigene und Arbeiter lenken nicht ab **(A)**.
  - Halten: nur Feinde in eigener Reichweite, keine Verfolgung.
  - Unerreichbares Ziel (z. B. auf einer Insel): Fernkämpfer (Reichweite ab 3 Kacheln) laufen zu einer
    erreichbaren Kachel, von der aus das Ziel in Reichweite liegt, und schießen vom Ufer aus; Nahkämpfer
    geben das Ziel auf.
  - Ziel auf einem Gebäude oder im Wasser: die Truppe läuft zur nächsten begehbaren Kachel.
- Umzingeln im Nahkampf **(A)**: Nahkämpfer (Reichweite bis 2 Kacheln: Schwert, Speer, schwere Reiter, Helden,
  Miliz) nehmen in den letzten 3 Kacheln vor einer feindlichen Figur einen eigenen Platz im Ring um sie ein –
  innen 8 Plätze (0,8 Kacheln), außen 12 (1,15 Kacheln), beide in Schlagweite. Bevorzugt der Platz in der
  Richtung, aus der der Angreifer kommt; ist er vergeben, der nächste freie daneben. Sind die nahen Plätze voll,
  geht er wie bisher bis in Schlagweite. Im Schlagabstand rückt er mit halbem Tempo geradeaus auf seinen Platz
  nach (ohne Wegsuche), während er weiter zuschlägt. Belegung je Takt neu (Zähler je Ziel, keine Paarvergleiche),
  Werte in `COMBAT.surround` (`src/sim/data/combat.js`). Fernkämpfer und Gebäudeziele unverändert.
  Folge: Weil Angreifer nicht mehr auf einem Punkt stehen, bündeln Bogenschützen ihr Feuer seltener zufällig;
  Bogen gegen Ritter (Stufe 3 gegen 1) gewinnt in 7 von 8 Duellen statt 8 von 8, alle anderen Paarungen gleich.
- Bewegung: Figuren betreten nie Wasser (außer Eis im Winter), Felsen oder Gebäude und schneiden
  keine Ecken (diagonal nur, wenn beide Nachbarkacheln frei sind). Wer auf einer gesperrten Kachel
  steht (z. B. unter einem neuen Gebäude), geht sofort zur nächsten freien Kachel.
- Regen: Fernkampf −30 % **(A)**. Winter: −25 % Tempo **(A)**. Werte in `WEATHER_EFFECTS` (`src/sim/data/weather.js`).
- Miliz: „Zu den Waffen!“ in der Burg bewaffnet alle Leibeigenen.

## 9. Wetter

Sommer / Regen / Winter im kartenabhängigen Zyklus. Regen: weniger Sicht (−2 Kacheln), Fernkampf
schlechter. Winter: Wasser friert und wird begehbar, Einheiten langsamer, Sicht −1 Kachel (siehe §12).

- **Wetterturm** (Wettervorhersage; 100 T, 100 H, 250 St, 2×2) **(A)**: zeigt die nächsten drei
  Wetterlagen mit Countdown. Auch das Wetterkraftwerk zeigt die Vorhersage.
- **Wetterkraftwerk** (Meteorologie; 300 T, 300 St, 200 E, 4×3, 3 Wettertechniker) **(A)**:
  Wettertechniker erzeugen 10 Wetterenergie je Arbeitsgang, Speicher 1000. Ein Wetterwechsel
  kostet 1000 Energie, hält 3 min und sperrt den Spieler für 3 min; danach läuft der Kartenzyklus
  mit dem nächsten Eintrag weiter **(A)**.

## 9a. Gebäudeschäden

- Ein fertiges Gebäude unter 50 % LP brennt und verliert 2 LP/s, bis es repariert ist oder
  zerfällt **(A)**.
- Reparieren: Leibeigene auf ein beschädigtes eigenes Gebäude schicken (Befehl `assignWork`,
  höchstens 4). Je Leibeigenem 1 LP pro Takt, kostenlos **(A)**. Unter 50 % erlischt der Brand.
- Zerstörte Gebäude hinterlassen 60 s eine Ruine, die den Platz blockiert **(A)**; danach ist
  der Platz wieder frei. Ereignisse: `buildingBurning`, `buildingExtinguished`, `repaired`,
  `buildingDestroyed` (mit `ruin`), `ruinCleared`.

## 9b. Nicht umgesetzt (bewusst)

- Wirtshaus, Dieb, Kundschafter, verborgene Lagerstätten, Büchsenschützen (Erweiterung; wieder entfernt, siehe
  [ADDON.md](ADDON.md)).
- Diplomatie und Tribute gibt es nur in Missionen (Skript-Aktionen `diplomacy`, `tribute`), nicht im freien Spiel.

## 10. Sieg

Standard: alle gegnerischen Burgen zerstören. Optional Waffenstillstand (0/15/30 min).

Wer seine Burg verliert, scheidet aus: Seine Figuren verschwinden, seine übrigen Gebäude kämpfen
nicht mehr (Türme schweigen), forschen und handeln nicht mehr und zerfallen innerhalb von 60 s zu
Ruinen (wie im Original). Sein Computergegner gibt keine Befehle mehr.

## 11. Computergegner

Das Original hatte keine Aufbau-KI. Kronland bekommt eine eigene: Strategie-Ebene
(Utility-Bewertung), Bauplan mit Prioritäten, Armee-Zustandsmaschine
(Verteidigen → Angreifen → Rückzug → Erholen), Schwierigkeit über Reaktionszeit,
Armeegröße und Aggressivität. Die KI nutzt exakt dieselben Befehle wie der Spieler; sie läuft im Takt der
Simulation, ihre Befehle werden im selben Takt geprüft wie die des Spielers (docs/ARCHITEKTUR.md, Multiplayer).
Wirft ihr Code dreimal in Folge einen Fehler, schaltet sie sich ab und der Spieler bekommt eine Meldung.

Zusätzlich: Gebäude-Technologien (nur bei doppelten Kosten im Lager, ab 25 Arbeitern und
Kaserne), Reparatur beschädigter Gebäude (brennende zuerst), Marktplatz bei Engpässen (knappster
Rohstoff gegen größten Überschuss, nur zu vertretbarem Kurs; bei Engpass werden Handelswesen,
Lager und Ausbau zum Marktplatz vorgezogen), ein Wetterturm im späten Bauplan. Leibeigene
weichen auf weiter entfernte Bäume aus, wenn um die Burg nichts mehr wächst.

Erreichbarkeit: Die KI plant nur Ziele, die von ihrer Burg aus zu Fuß erreichbar sind (Gebiete der
Wegsuche, Eis zählt nicht): Bauplätze (auch nach dem Bau – ein Schacht darf seinen eigenen Zugang
nicht zubauen), Bäume und Rohstoffhaufen, Reparaturen, Verteidigung nur gegen Feinde diesseits von
Wasser und Felsen, Sammel- und Angriffspunkte auf begehbaren Kacheln vor der feindlichen Burg.
Unerreichbar gewordene Baustellen und Gebäude reißt sie ab und baut neu; abgeschnittene
Leibeigene bekommen keine Aufträge.

Nebel des Krieges: Die KI sieht nur, was ihr Team sieht (§12). Feindliche Truppen nimmt sie nur in
Sicht wahr, feindliche Gebäude als zuletzt gesehenen Stand. Bekannt sind – wie im Gefecht des
Originals – die Startpositionen: Dorthin zieht ihr Heer per Angriffsbewegung, erkundet unterwegs und
greift gezielt nur an, was es gerade sieht. Einziger Vorteil der Stufe **Schwer**: Wachen melden
feindliche Truppen im Umkreis von 22 Kacheln um die eigene Burg auch im Nebel **(A)**.

## 12. Sicht und Nebel des Krieges

Wie im Original kennt jede Kachel drei Zustände (je Team; Verbündete teilen Sicht und Erkundung):

| Zustand | Darstellung | Inhalt |
|---|---|---|
| unerkundet | schwarz, wolkiger Rand | nichts – weder Gelände noch Gebäude |
| erkundet | abgedunkelt, entsättigt | Landschaft, Bäume, Rohstoffe; feindliche Gebäude als **zuletzt gesehener Stand** (blass, ohne Rauch und Feuer); keine feindlichen Figuren |
| sichtbar | normal | alles |

- **Sichtquellen**: eigene Leibeigene, Arbeiter (nur draußen), Hauptleute und Soldaten, Helden, Miliz,
  Selbstschuss-Kanonen, Gebäude (fertig und Baustellen). Erkundet bleibt erkundet.
- **Sichtweiten** in Kacheln **(A)** (Werte in `src/sim/data/vision.js`; Gebäude: ab der Mitte, plus halbe Kantenlänge):

| Quelle | Sicht |
|---|---|
| Leibeigener | 7 |
| Arbeiter (draußen) | 5 |
| Miliz | 11 |
| Held | 13 |
| Truppen (Hauptmann und Soldaten) | Kampfsicht 9 + Gattung: Schwert/Speer/Kanone +2, Bogen +3, schwere Reiter +3, leichte Reiter +4 |
| Selbstschuss-Kanone | 9 |
| Burg / Festung | 16 / 18 (+2 halbe Kante) |
| Dorfzentrum Stufe 1–3 | 10 / 11 / 12 |
| Wachturm / Ballistaturm / Kanonenturm | 14 / 16 / 18 |
| Wetterturm | 22 |
| Kaserne, Schießplatz, Reiterei, Kanonengießerei | 8 |
| übrige Gebäude | 6 |
| Baustelle | 4 |

- **Fährtenlesen** (Burg) +2 und **Feldwebel** (2 Sterne, Fernkämpfer und Reiter) +2 erhöhen die Kampfsicht
  und damit auch die Sicht der Truppen.
- **Wetter**: Regen −2, Winter −1 Kachel für alle Quellen (mindestens 3). Truppen sehen auch im Regen noch
  mindestens so weit, wie sie Feinde selbst angreifen (Zuschlag ≥ Wetterabzug) – keine Truppe greift ins Dunkle.
- **Start**: Um jede Burg sind 20 Kacheln erkundet (Tutorial: 34). Missionen decken mit der Aktion
  `reveal` (mit `area`) Gebiete auf: dauerhaft erkundet, 30 s sichtbar.
- **Spieler**: Feindliche Figuren und Gebäude außerhalb der Sicht sind weder wähl- noch angreifbar;
  ein Rechtsklick auf ein zuletzt gesehenes Gebäude gibt eine Angriffsbewegung dorthin. Bauen nur auf
  erkundetem Gebiet. Klänge aus dem Nebel sind stumm (eigene Gebäude und Truppen sind immer sichtbar).
  Meldungen über eigene Verluste und Angriffe kommen immer.
- **Minikarte**: unerkundet schwarz, erkundet dunkel, sichtbar hell; feindliche Figuren nur in Sicht,
  feindliche Gebäude als zuletzt gesehener Stand; Schächte nur auf erkundetem Gebiet.
- **Abschalten**: freies Spiel „Nebel des Krieges an/aus“ im Startmenü bzw. `?fog=off`. Kampagne:
  an; Tutorial: an, aber großzügig erkundet. Nach Spielende oder Ausscheiden zeigt die Karte alles.
- Berechnung: alle 5 Takte (0,5 s), ganzzahlig und deterministisch; Spielstände enthalten Erkundung,
  Sicht (Bitfelder) und die zuletzt gesehenen Gebäude.

## 13. Brücken und Zierden

Aus den Erweiterungen des Originals übernommen (Recherche und Auswahl: [ADDON.md](ADDON.md)); fest im Spiel, auch in
Kampagne und Skript-Missionen. Werte: `src/sim/data/bridges.js`, `buildings.js`, `buildingTechs.js` (alle (A)).

| Inhalt | Voraussetzung | Kosten | Wirkung |
|---|---|---|---|
| **Brücke** | Mathematik (Steinmetzhütte) | 300 Holz, 250 Stein | nur an Brückenstellen (Kartengenerator, je Flussabschnitt zwischen Furten die kürzeste 2 Kacheln breite Querung, 2–9 lang). Brücken werden nicht eingeebnet; Brückenköpfe (Ufer an beiden Enden) und Landkacheln der Stelle sind von Anfang an frei und reserviert (dort baut niemand, die Einebnung lässt sie unverändert). Fertig: begehbar für alle; zerstört/abgerissen: wieder Wasser, wer darauf steht, ertrinkt (Helden zurück zur Burg), keine Ruine. Niemand greift Brücken von selbst an |
| **Brunnen** / **Denkmal** | Konstruktion / Buchdruck | 150 T + 150 S / 400 T + 300 S | Zierde: max. Motivation +3 / +6 (und einmalig die aktuelle) |

- **Meldungen**: Brücke fertig, Brücke eingestürzt.
- **Computergegner**: baut nach Kaserne und drei Hauptleuten eine Brücke Richtung Gegner (falls es eine Brückenstelle
  gibt) sowie Brunnen und Denkmal, sobald er sie sich leisten kann.

## 14. Spuren und Gegenstände

Nur Optik und Information für Skripte – keine Wirkung auf Tempo, Wegsuche oder Balance. Code: `src/sim/systems/ground.js`,
Werte: `BALANCE.ground` (alle (A)).

- **Spuren:** Verlässt eine Figur (Held, Leibeigener, Arbeiter draußen, Hauptmann, Soldat) eine Kachel zu einer
  Nachbarkachel, wird die Spur dort um 1 stärker (höchstens 48, ein Byte je Kachel). Sprünge (Teleport, Rückkehr zur
  Burg) hinterlassen nichts. Ein umlaufender „Besen“ nimmt jeder Kachel alle 30 s eine Stufe; seine Position folgt aus
  dem Takt, es gibt keine Liste. Als Spur zählt eine Kachel ab Stärke 8 (Trampelpfad), im Winter ab 1 (Fußabdrücke im
  Schnee). Tauwetter löscht Spuren auf dem Eis. Ein Level stellt das mit `world.tracks` ein (`threshold`, `fade` in
  Sekunden je Stufe, 0 = verweht nie, `who`: `all`, `none`, `heroes`).
- **Gegenstände:** Taler und Blumen liegen auf Kacheln (höchstens einer je Kachel, nur auf begehbarem Boden, im
  Winter auch auf dem Eis). Helden und Leibeigene heben auf, worauf sie stehen (Befehl `item`, 0,5 s): ein Taler bringt
  1 Gold, eine Blume wird gepflückt. Ablegen geht nur mit Talern (kostet 1 Gold). Ein Baum, Haufen oder Gebäude auf der
  Kachel nimmt den Gegenstand weg, ebenso Tauwetter auf dem Eis und eine einstürzende Brücke. Gegenstände setzen nur
  Missionen und der Weltaufbau.
- **Darstellung:** Spuren zeigt das Gelände als Trampelpfad (Sommer, Regen) bzw. getretenen Schnee mit Fußabdrücken
  (Winter), nur soweit der Spieler sie sieht oder zuletzt gesehen hat. Taler und Christrosen liegen sichtbar auf
  ihren Kacheln, sobald die Kachel erkundet ist. Im Welteneditor setzt man beides mit „Gegenstand“ und „Spur“.
- **Kursmissionen ohne Burg** beginnen mit leerem Lager (außer `players[].stock` setzt einen Vorrat) – `stock("gold")` zählt
  genau die gesammelten Taler.
