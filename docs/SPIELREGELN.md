# Spielregeln (Spezifikation)

Kronland bildet das Gameplay von *Die Siedler – Das Erbe der Könige* (Grundspiel, ohne Addons) nach.
Mechanik wird übernommen, Namen von Helden, Texte und Grafiken sind eigene.

Werte stammen aus der Recherche (dedk.de-Wiki, Handbuch, Original-Entity-XMLs). Werte mit
**(A)** sind eigene Annahmen, weil keine Quelle gefunden wurde; sie sind Balancing-Stellschrauben
und stehen gebündelt in `src/sim/data/`.

## 1. Grundprinzip

- Keine Wege, keine Träger, kein Territorium. Gebaut wird frei auf ebenem, freiem Gelände.
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

## 3. Leibeigene

- Kosten 50 Taler, gekauft in der Burg, belegen 1 Bevölkerungsplatz.
- 200 LP, Angriff 5, Rüstung 0. Kein Haus, kein Hof, keine Steuern, keine Motivation.
- Aufgaben (vom Spieler befohlen): bauen (max. 4 je Baustelle), reparieren, Holz fällen,
  Haufen abbauen. Nach getaner Arbeit suchen sie im Umkreis gleichartige Arbeit **(A)**
  (auch nach einer Reparatur: nächstes beschädigtes eigenes Gebäude).
- Beim Platzieren eines Gebäudes mit ausgewählten Leibeigenen fangen diese sofort an zu bauen.
- „Zu den Waffen“: werden zu Miliz (Angriff 10, Rüstung 1), rückverwandelbar.

## 4. Arbeiter, Motivation, Steuern

- Arbeiter erscheinen automatisch am Dorfzentrum, wenn ein Arbeitsplatz frei ist und das
  Bevölkerungslimit es zulässt. Nicht steuerbar.
- Zyklus: arbeiten → Ausdauer sinkt → essen (Bauernhof) → schlafen (Wohnhaus) → weiter.
  Ohne Platz: Lagerfeuer, deutlich langsamer. Haus + Hof machen ca. 5× schneller.
- Wohnhaus 6/9/12 Betten, Bauernhof 8/10/12 Essplätze (Stufe 1/2/3).
- Umsetzung (Werte in `src/sim/data/professions.js`): Ausdauer max. 600, ein Arbeitsgang kostet 100.
  Essen +200, Schlafen +400, Lagerfeuer +40 – jeweils × Motivation. Ergebnis im Test:
  Steinmetz mit Haus und Hof ca. 20 Stein/min (Original gemessen: 21), am Lagerfeuer ca. 4.
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

Siehe `src/sim/data/buildings.js` (Kosten, Bauzeit, Größe, Stufen, Freischaltung).
Bauzeit gilt bei 4 Leibeigenen; mit weniger entsprechend länger **(A)**.

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
  Hauptmann ist unverwundbar, solange ein Soldat lebt. Nachrekrutieren am Gebäude.
- Schaden = Angriff × Faktor(Angriffstyp, Rüstungstyp) − Rüstung (+ kleiner Zufall).
  Tabelle in `src/sim/data/combat.js`.
- Türme: Wachturm → Ballistaturm → Kanonenturm.
- Helden: 600 LP, werden bewusstlos statt zu sterben, stehen nach 10 s ohne Feinde
  mit halben LP wieder auf. Eigene Heldenfiguren mit Fähigkeiten nach Vorbild des Originals:
  - **Bertram**, Ritter: Wirbelschlag (80 Flächenschaden), Aura der Stärke (Angriff ×2, 60 s)
  - **Hedda**, Kräuterkundige: Heilen (170 LP im Umkreis), Falle (36 Schaden)
  - **Gerold**, Sprengmeister: Bombe (50 Schaden nach 2 s), Selbstschuss-Kanone (4 Schuss)
- Rekrutieren: volle Einheit oder nur Hauptmann; Soldaten nachkaufen am Militärgebäude.
- Aufwerten einer Truppengattung (Stufe 2: passender Veredler, Stufe 3: ausgebautes
  Militärgebäude, Stufe 4: zusätzlich Festung) wertet auch bestehende Truppen auf.
- Befehle: Laufen, Angreifen (Ziel oder Angriffsbewegung), Halten, Verteidigen (Standard:
  Feinde in 9 Kacheln Umkreis angreifen, höchstens 14 Kacheln vom Ankerpunkt weg) **(A)**.
- Regen: Fernkampf −30 % **(A)**. Winter: −25 % Tempo **(A)**.
- Miliz: „Zu den Waffen!“ in der Burg bewaffnet alle Leibeigenen.

## 9. Wetter

Sommer / Regen / Winter im kartenabhängigen Zyklus. Regen: weniger Sicht, Fernkampf schlechter.
Winter: Wasser friert und wird begehbar, Einheiten langsamer.

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

- Dieb, Kundschafter und alle weiteren Addon-Inhalte.
- Tribute und Bündniswechsel: Teams (`players[].team`) bestehen, Diplomatie im Spiel nicht.

## 10. Sieg

Standard: alle gegnerischen Burgen zerstören. Optional Waffenstillstand (0/15/30 min).

## 11. Computergegner

Das Original hatte keine Aufbau-KI. Kronland bekommt eine eigene: Strategie-Ebene
(Utility-Bewertung), Bauplan mit Prioritäten, Armee-Zustandsmaschine
(Verteidigen → Angreifen → Rückzug → Erholen), Schwierigkeit über Reaktionszeit,
Armeegröße und Aggressivität. Die KI nutzt exakt dieselben Befehle wie der Spieler.

Zusätzlich: Gebäude-Technologien (nur bei doppelten Kosten im Lager, ab 25 Arbeitern und
Kaserne), Reparatur beschädigter Gebäude (brennende zuerst), Marktplatz bei Engpässen (knappster
Rohstoff gegen größten Überschuss, nur zu vertretbarem Kurs; bei Engpass werden Handelswesen,
Lager und Ausbau zum Marktplatz vorgezogen), ein Wetterturm im späten Bauplan. Leibeigene
weichen auf weiter entfernte Bäume aus, wenn um die Burg nichts mehr wächst.
