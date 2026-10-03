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
  Haufen abbauen. Nach getaner Arbeit suchen sie im Umkreis gleichartige Arbeit **(A)**.
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
dazu Techs in Burg, Dorfzentrum, Veredlern und Militärgebäuden.

## 8. Militär

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

## 10. Sieg

Standard: alle gegnerischen Burgen zerstören. Optional Waffenstillstand (0/15/30 min).

## 11. Computergegner

Das Original hatte keine Aufbau-KI. Kronland bekommt eine eigene: Strategie-Ebene
(Utility-Bewertung), Bauplan mit Prioritäten, Armee-Zustandsmaschine
(Verteidigen → Angreifen → Rückzug → Erholen), Schwierigkeit über Reaktionszeit,
Armeegröße und Aggressivität. Die KI nutzt exakt dieselben Befehle wie der Spieler.
