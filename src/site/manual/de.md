## Erste Schritte {#getting-started}

Kronland ist ein Aufbau-Strategiespiel: Du gründest eine Siedlung, versorgst deine Arbeiter, erforschst
neue Techniken und verteidigst deine Burg gegen Computergegner. Das Spiel läuft im Browser – auf dem
Rechner mit Maus und Tastatur, auf Tablet und Handy mit Touch.

1. Öffne [Spielen](play/). Beim ersten Start lädt das Spiel die 3D-Modelle; das dauert je nach Verbindung ein paar Sekunden.
2. Wähle im **Startmenü** das **Tutorial**, wenn du neu bist. Der Händler Orrin führt dich Schritt für Schritt durch die Grundlagen.
3. Danach wartet die **Kampagne** „Krone aus Eis“ oder ein **Freies Spiel** gegen Computergegner auf einer zufälligen Karte.

Zu Beginn hast du eine **Burg**, {{startSerfs}} **Leibeigene**, einen Helden und einen kleinen Vorrat:

| Taler | Lehm | Holz | Stein | Eisen | Schwefel |
|---:|---:|---:|---:|---:|---:|
| {{startGold}} | {{startClay}} | {{startWood}} | {{startStone}} | {{startIron}} | {{startSulfur}} |

> **Das Wichtigste in einem Satz:** Leibeigene bauen und sammeln Rohstoffe, Arbeiter kommen von selbst in
> deine Werkstätten – sorge mit Wohnhäusern und Bauernhöfen dafür, dass sie ausgeruht und satt sind.

![Eine Siedlung mit Burg, Wohnhäusern, Höfen und Werkstätten](site/settlement.webp)

## Bedienung {#controls}

### Maus und Tastatur

| Aktion | Desktop |
|---|---|
| Auswählen | Linksklick, Rahmen ziehen; [[Shift]] fügt hinzu |
| Alle sichtbaren derselben Art | Doppelklick auf eine eigene Figur ([[Shift]] / [[Strg]] fügt hinzu); alle Helden zählen als eine Art |
| Befehl (laufen, bauen, abbauen, angreifen) | Rechtsklick |
| Angriffsbewegung | [[Strg]] + Rechtsklick oder Knopf „Angreifen“ |
| Kamera verschieben | [[W]] [[A]] [[S]] [[D]] oder Pfeiltasten, mittlere Maustaste ziehen, Bildschirmrand |
| Kamera drehen | [[Q]] / [[E]], [[Einfg]] / [[Entf]], rechte Maustaste ziehen |
| Zoomen | Mausrad, [[Bild↑]] / [[Bild↓]] |
| Bauen | Baumenü, Klick setzt das Gebäude, Rechtsklick bricht ab |
| Heldenfähigkeit | [[X]] / [[C]] (Held ausgewählt) |
| Steuergruppe merken | [[Shift]] + [[1]] … [[9]] |
| Steuergruppe wählen | [[1]] … [[9]], zweimal: Kamera hin |
| Untätige Leibeigene | [[.]] |
| Zur Burg | [[H]] |
| Pause | [[Leertaste]] |
| Menü, Auswahl aufheben | [[Esc]] |

### Touch (Tablet und Handy)

| Aktion | Touch |
|---|---|
| Auswählen | Tippen |
| Alle sichtbaren derselben Art | Eigene Figur doppelt antippen |
| Befehl | Mit Auswahl auf Boden, Baum, Baustelle oder Feind tippen |
| Kamera verschieben | Mit einem Finger ziehen |
| Kamera drehen | Mit zwei Fingern drehen |
| Zoomen | Mit zwei Fingern spreizen |
| Bauen | „Bauen …“, Gebäude wählen, Platz antippen, „Hier bauen“ |
| Untätige Leibeigene, Burg, Pause | Knöpfe am unteren bzw. oberen Rand |
| Minikarte | Knopf „Karte“ blendet sie ein, Tippen springt dorthin |

Im Spiel zeigt **Menü → Steuerung** dieselbe Übersicht. Die **Größe der Oberfläche** und das
**Verschieben am Bildschirmrand** stellst du unter **Einstellungen** ein.

## Die Oberfläche {#interface}

### Obere Leiste

![Rohstoffe: verfügbar (groß) und noch unverarbeitete Rohware (klein)](site/hud-resources.webp)

![Bevölkerung, Motivation, Wetter und Zahltag](site/hud-status.webp)

- **Rohstoffe:** Taler, Lehm, Holz, Stein, Eisen und Schwefel – die Zahl ist, was du ausgeben kannst. Fährst du
  darüber, siehst du, wie viel davon noch unverarbeitete Rohware ist (siehe [Wirtschaft](#economy)). Fehlt
  etwas für das Gebäude unter dem Mauszeiger im Baumenü, wird der Rohstoff rot.
- **Bevölkerung:** belegte und verfügbare Plätze. Mehr Plätze bringen Dorfzentren.
- **Motivation:** Durchschnitt deiner Arbeiter. Fährst du darüber, zeigt ein Hinweis Höchstwert und Grenzen.
- **Zahltag:** das runde Medaillon in der Mitte füllt sich bis zur nächsten Steuereinnahme. Die Sekunden erscheinen
  erst kurz vorher; am Zahltag selbst leuchtet es einmal auf. Der Hinweis nennt erwartete Steuern und Sold.
- **Wetter:** der Ring zeigt, wie viel der Jahreszeit vorbei ist; die genaue Zeit steht im Hinweis.
- **Pause, Geschwindigkeit und Ton:** der Tempo-Knopf klappt die Stufen 1×, 2× und 4× aus; der Ton-Knopf schaltet
  stumm und stellt Musik, Effekte und Gesamtlautstärke ein; ganz rechts das **Menü**.

### Befehlsleiste, Minikarte und Kontextpanel

![Befehlsleiste mit Schnellzugriff, Minikarte und Baumenü](site/hud-commandbar.webp)

- **Schnellzugriff** als eckige Knöpfe links neben der Minikarte (Namen im Tooltip): *Burg* springt zur Burg, *Untätige* wählt Leibeigene ohne Arbeit
  (die Zahl daran sagt, wie viele es sind), *Alle* wählt alle Leibeigenen, *Truppen* alle Soldaten und Helden.
- **Helden und Steuergruppen** über der Karte: Die Heldenporträts stehen übereinander; ein Klick wählt den Helden
  und holt ihn ins Bild. Ist ein Held bewusstlos, wird sein Porträt grau, ein Ring füllt sich bis zum Aufwachen
  und darunter steht die Restzeit – solange Feinde in der Nähe sind, steht dort „bewusstlos“. Mit Umschalt+1 bis 9 merkst du dir eine Auswahl als Gruppe; die Zahltaste oder das Gruppenschild wählt
  sie wieder, zweimal kurz hintereinander holt sie ins Bild.
- **Minikarte:** zeigt Gelände, Gebäude und Truppen. Klicken oder Ziehen bewegt die Kamera.
- **Befehlstafel:** erscheint, sobald du etwas auswählst. Bei Leibeigenen zeigt sie das **Baumenü** mit allen
  Gruppen auf einen Blick: *Wohnen*, *Rohstoffe*, *Veredelung*, *Militär*, *Verwaltung*. Ein roter Punkt heißt
  „zu teuer“, ein Schloss „noch nicht erforscht“ – der Hinweis nennt, was fehlt.

![Minikarte](site/hud-minimap.webp)

### Gebäude auswählen

![Burg ausgewählt: Leibeigene kaufen, Steuern, Miliz, Ausbau](site/hud-building.webp)

Wählst du ein Gebäude, zeigt das Panel Lebenspunkte, Arbeiter und alle Aktionen: **Ausbauen**, **Überstunden**,
**Abreißen**, Forschung, Rekrutieren oder Handeln – je nach Gebäude. Fährst du über einen Knopf, nennt ein
Hinweis Kosten und Bedingungen. Ist etwas gesperrt, steht dort der Grund.

### Meldungen

Rechts erscheinen Meldungen: fertige Gebäude, Angriffe, abgeschlossene Forschung, Handel, Wetter. Ein Klick auf
eine Meldung mit Ortsangabe springt dorthin, das **×** daneben schließt sie. Wichtiges steht oben: Angriffe,
Brände und ein bewusstloser Held bleiben als **Dauerwarnung** (pulsierendes Symbol) stehen, solange der Anlass
anhält – ein Angriff, bis einige Sekunden lang nichts Eigenes mehr getroffen wurde. Gleiche Meldungen werden
zusammengefasst („12 Beförderungen“, „×3“), und jede Art von Meldung bekommt einen Platz: Auch mitten im Kampf
siehst du, dass ein Gebäude fertig ist.

**Angriffe** meldet das Spiel dreifach: Die Sturmglocke läutet, die Getroffenen rufen um Hilfe (bei Gebäuden ein
Leibeigener, sonst die Figur selbst), und auf der Minikarte pulsiert die Stelle **rot**, solange dort gekämpft
wird. Am Handy pulsiert dann der Kartenknopf.

## Siedlung aufbauen {#settlement}

### Leibeigene

Leibeigene sind deine Allrounder. Du kaufst sie in der **Burg** für {{serfCost}} Taler. Sie

- **bauen** Gebäude (bis zu {{maxBuilders}} je Baustelle – mehr Helfer, schnellerer Bau),
- **fällen Bäume** und **bauen Rohstoffhaufen ab** (Lehm, Stein, Eisen, Schwefel),
- **reparieren** beschädigte Gebäude,
- **greifen an** wie beim Holzhacken: Leibeigene wählen und statt eines Baums einen **Gegner** anklicken bzw.
  antippen – sie gehen mit bloßen Fäusten auf ihn los.
- greifen in der Not mit **„Zu den Waffen!“** (Burg) alle als Miliz zu Mistgabeln.
- **fliehen**, wenn sie unbewaffnet angegriffen werden, und machen danach mit ihrer Arbeit weiter.

Nach getaner Arbeit suchen sie sich in der Nähe gleichartige Arbeit. Leibeigene brauchen weder Haus noch
Essen und zahlen keine Steuern.

### Bauen

1. Leibeigene auswählen (optional – dann fangen sie gleich an).
2. Im Baumenü ein Gebäude wählen.
3. Einen freien Platz anklicken – auch am Hang (siehe [Bauen am Hang](#slope)). Die Vorschau färbt sich grün, gelb oder rot,
   das Panel zeigt, ob der Platz passt – und wenn nicht, warum (zu steil, belegt, unerkundet …).

Es gibt **keine Wege und kein Territorium** – du baust frei. Zwei Ausnahmen:

- **Dorfzentren** nur auf den markierten **Siedlungsplätzen**,
- **Minen** nur auf **Schächten** der passenden Rohstoffart.

Die Kosten werden beim Platzieren abgezogen. Abreißen erstattet die Hälfte.

### Ausbauen

Fast jedes Gebäude hat mehrere **Ausbaustufen** (Wohnhaus → Mittleres → Großes Wohnhaus). Ausbauen kostet
Rohstoffe, oft eine Technologie und dauert eine Weile; das Gebäude arbeitet währenddessen weiter. Alle
Stufen, Kosten und Bedingungen stehen im [Kompendium](compendium/#buildings).

### Bevölkerung

Wie viele Leibeigene, Arbeiter und Soldaten du haben kannst, bestimmen deine **Dorfzentren**: {{popLevels}}
Plätze je Stufe. Plätze je Truppeneinheit: {{popByLine}}; Helden brauchen keinen.

## Rohstoffe und Wirtschaft {#economy}

| Rohstoff | Gewinnung | Veredelung |
|---|---|---|
| Taler | Steuern am Zahltag | Bank |
| Holz | Leibeigene fällen Bäume | Sägemühle |
| Lehm | Haufen, Lehmgrube | Ziegelhütte |
| Stein | Haufen, Steingrube | Steinmetzhütte |
| Eisen | Haufen, Eisengrube | Schmiede |
| Schwefel | Haufen, Schwefelgrube | Alchimistenhütte |

- Rohstoffe landen **sofort** in deinem Vorrat – keine Träger, keine Lager nötig.
- Jeder Rohstoff hat zwei Konten: **roh** und **veredelt**. Beides ist verbaubar; bezahlt wird zuerst mit Veredeltem.
- **Veredler** holen Rohware selbst ab und machen daraus die **doppelte Menge**. Eine Ziegelhütte verwandelt
  so 100 Lehm in 200 Ziegel.
- **Rohstoffhaufen** gehen zur Neige, **Schächte** nicht. Baue früh Minen – Bergleute arbeiten viel schneller als Leibeigene.
- Der **Marktplatz** (ausgebautes Lager) tauscht Rohstoffe in {{marketStep}}er-Schritten. Wer viel verkauft,
  drückt den Preis – für alle Spieler.

## Arbeiter, Motivation und Steuern {#workers}

### Arbeiter

Arbeiter kommen **von selbst** aus dem Dorfzentrum, sobald in einer Werkstatt, Mine oder Hochschule ein
Platz frei ist und die Bevölkerung es erlaubt. Du steuerst sie nicht direkt.

Ihr Tag: **arbeiten → essen → schlafen → weiterarbeiten.** Jeder Arbeitsgang kostet Ausdauer. Gegessen wird
im **Bauernhof** ({{farmSeats}} Plätze je Stufe), geschlafen im **Wohnhaus** ({{residenceBeds}} Betten je Stufe).
Fehlt beides, wärmen sie sich am Lagerfeuer – und arbeiten dann nur einen Bruchteil so schnell.

> **Faustregel:** Baue zu jeder Werkstatt in der Nähe ein Wohnhaus und einen Bauernhof.
> Ein Steinmetz mit Haus und Hof schafft etwa fünfmal so viel wie einer am Lagerfeuer.

### Motivation

Jeder Arbeiter hat eine Motivation, zu Beginn {{startMotivation}} %. Sie wirkt auf das Arbeitstempo.

- Steigt durch **niedrige Steuern**, **Segnungen** der Kapelle und **Ziergebäude** (Uhr, Windrad heben auch den Höchstwert).
- Sinkt durch **hohe Steuern** und **Überstunden**.
- Höchstwert {{baseMaxMotivation}} %, mit Ziergebäuden bis {{hardMaxMotivation}} %.
- Unter {{noNewSettlers}} % im Durchschnitt kommen **keine neuen Siedler**; ein Arbeiter unter {{leaveBelow}} % **wandert ab**.

### Zahltag und Steuern

Alle **{{paydaySec}} Sekunden** ist Zahltag: Jeder Arbeiter zahlt Steuern, jeder Hauptmann will {{wage}} Taler Sold.
Den Steuersatz stellst du in der **Burg** ein, sobald **Bildung** erforscht ist:

{{taxTable}}

### Überstunden und Segnungen

- **Überstunden** (Knopf im Gebäude) lassen eine Werkstatt schneller arbeiten, kosten aber Motivation.
- In der **Kapelle** erzeugen Priester **Glauben**. Mit genug Glauben segnest du eine Berufsgruppe – deren Motivation steigt deutlich. Oben rechts im Wappen steht dein Glaube; solange du keinen hast, ist er ausgegraut.

## Forschung {#research}

In der **Hochschule** erforschen Gelehrte Technologien in vier Linien: **Verwaltung**, **Bauwesen**, **Alchimie**
und **Militär**, jeweils vier Stufen. Technologien schalten Gebäude, Ausbauten, Truppen und den Steuersatz frei.

- Stufe 2 einer Linie braucht die **Festung** (ausgebaute Burg), Stufe 3 und 4 die **Universität** (ausgebaute Hochschule).
- Je mehr Gelehrte arbeiten, desto schneller geht es.

Dazu kommen **Gebäude-Technologien**: Die Schmiede verbessert Rüstungen und Klingen, die Sägemühle Speere und
Pfeile, der Alchimist Kanonen und Wettertechnik, Burg und Dorfzentrum Fährtenlesen, Stadtwache, Webrahmen und
Schuhe. Den ganzen Baum mit Kosten und Wirkung zeigt das [Kompendium](compendium/#techs).

![Hochschule ausgewählt: Technologien der vier Linien](site/hud-research.webp)

## Militär und Helden {#military}

### Truppen

In **Kaserne**, **Schießplatz**, **Reiterei** und **Kanonengießerei** rekrutierst du Einheiten: einen
**Hauptmann** mit Soldaten (oder nur den Hauptmann und füllst später auf). Truppengattungen:
Schwertkämpfer, Speerträger, Bogenschützen, leichte und schwere Reiterei, Kanonen.

- Der Hauptmann ist **unverwundbar**, solange ein Soldat bei ihm ist.
- Fehlende Soldaten kaufst du mit **Auffüllen** nach – dafür muss der Hauptmann am Militärgebäude stehen.
- **Aufwerten** hebt eine ganze Gattung auf die nächste Stufe, auch bestehende Truppen.
- Jede Gattung hat Stärken und Schwächen: Speere gegen Reiter, Schwerter gegen Speere, Kanonen gegen Gebäude.
  Die genaue Schadenstabelle steht im [Kompendium](compendium/#units).

![Truppen ausgewählt: Hauptleute, Held und Befehle](site/hud-army.webp)

### Befehle

| Befehl | Wirkung |
|---|---|
| Laufen (Rechtsklick / Tippen auf Boden) | Truppen laufen hin und ignorieren Feinde unterwegs |
| Angreifen (Rechtsklick / Tippen auf Feind) | greift das Ziel an |
| Angriffsbewegung ([[Strg]] + Rechtsklick, Knopf „Angreifen“) | läuft hin und greift alles unterwegs an |
| Halten | bleibt stehen, kämpft nur in eigener Reichweite |
| Verteidigen | verteidigt die Umgebung, verfolgt Feinde nicht zu weit |

### Erfahrung

Hauptleute sammeln mit jedem Treffer ihrer Truppe Erfahrung und steigen in fünf Sternen auf – vom Gefreiten bis
zum General. Jeder Stern bringt etwas: kritische Treffer, mehr Reichweite, Selbstheilung, mehr Angriff.

### Helden

Du startest mit einem Helden. Helden sterben nicht: Fallen sie, werden sie **bewusstlos** und stehen nach
{{reviveSec}} Sekunden ohne Feinde in der Nähe wieder auf.

{{heroList}}

Fähigkeiten löst du über die Knöpfe im Panel oder mit [[1]] / [[2]] aus; danach laden sie sich wieder auf.

### Türme und Miliz

**Türme** sehen weit und schießen ab dem Ballistaturm selbst auf Feinde: Wachturm → Ballistaturm → Kanonenturm. In der Not ruft
**„Zu den Waffen!“** in der Burg alle Leibeigenen als Miliz zusammen.

![Hauptleute mit ihren Truppen und der Held im Gefecht](site/combat.webp)

## Brücken und Zierden {#bridges}

### Brücken

Flüsse trennen die Karte – an manchen Stellen lässt sich eine **Brücke** schlagen. Die Technologie **Mathematik**
(Steinmetzhütte) schaltet sie frei; im Baumenü erscheinen dann die möglichen Brückenstellen. Fertige Brücken
benutzen alle, auch der Feind. Wird eine Brücke zerstört, ertrinkt, wer gerade darauf steht.

### Brunnen und Denkmal

Zwei Ziergebäude heben die **höchste Motivation** deiner Arbeiter: der **Brunnen** (ab {{fountainTech}}) um
{{fountainMot}} Prozentpunkte, das **Denkmal** (ab {{statueTech}}) um {{statueMot}} Prozentpunkte. Mehrere Zierden zählen
zusammen, bis zur Obergrenze von {{hardMaxMotivation}} %.

## Wetter {#weather}

Auf jeder Karte wechseln sich **Sommer**, **Regen** und **Winter** ab.

- **Regen:** Fernkämpfer treffen schlechter, alle sehen weniger weit.
- **Winter:** Flüsse und Seen **frieren zu** und werden begehbar – auch für den Feind! Truppen sind langsamer.
  Taut es, ertrinkt, wer noch auf dem Eis steht.

Mit der Alchimisten-Technologie **Wettervorhersage** baust du einen **Wetterturm**, der die nächsten Wetterlagen
ankündigt. **Meteorologie** schaltet das **Wetterkraftwerk** frei: Wettertechniker laden Energie, mit voller
Ladung bestimmst du selbst das Wetter.

![Winter: Schnee auf den Dächern, Flüsse und Seen frieren zu](site/winter.webp)

## Nebel des Krieges {#fog}

Ist der Nebel an, kennt jede Stelle der Karte drei Zustände:

| Zustand | Was du siehst |
|---|---|
| **unerkundet** | schwarz – nichts |
| **erkundet** | abgedunkelt: Landschaft, Bäume, Rohstoffe; feindliche Gebäude so, wie du sie zuletzt gesehen hast |
| **sichtbar** | alles, auch feindliche Truppen |

Sicht haben alle deine Figuren und Gebäude; **Türme**, die **Burg** und der **Wetterturm** sehen besonders weit.
Zu Beginn ist ein Umkreis von {{startReveal}} Kacheln um jede Burg erkundet. Gebaut werden kann nur auf
erkundetem Gebiet. Die Computergegner schummeln nicht: Sie sehen nur, was ihre Figuren sehen.

Im freien Spiel schaltest du den Nebel im Startmenü ab.

![Nebel des Krieges: nur das Erkundete ist sichtbar](site/fog.webp)

## Bauen am Hang {#slope}

Kronland hat Hügel, Täler und Gebirge – und du musst nicht nur auf ebenem Boden bauen. Beim Platzieren zeigt die
**Bauvorschau** in Farbe, was passiert:

| Vorschau | Bedeutung |
|---|---|
| **grün** | Der Boden ist eben – das Gebäude kommt ohne Erdarbeiten aus. |
| **gelb** | Hang: Das Gelände wird beim Setzen der Baustelle **eingeebnet** („Platz passt – Gelände wird eingeebnet“). |
| **rot** | Zu steil – mehr als **{{maxSlope}} cm** Höhenunterschied unter dem Gebäude („Gelände zu steil“). |

Eingeebnet wird auf die **mittlere Höhe** der Grundfläche; ein schmaler Rand rundum wird sanft angeglichen.
Nachbargebäude, Bäume, Wasser, Fels sowie Siedlungsplätze und Schächte bleiben dabei unverändert. Die Ebene bleibt
dauerhaft, auch wenn das Gebäude später abgerissen wird. Klippen und Gipfel sind nie bebaubar.

> **Tipp:** Brauchst du einen Platz an einem steilen Hang, versuch es eine Kachel weiter oben oder unten – oft
> reicht das für Gelb. Die genaue Formel mit Rechenbeispiel steht im [Kompendium](compendium/#slope).

![Bauvorschau am Hang: gelb – das Gelände wird beim Bauen eingeebnet](site/slope.webp)

## Kampagne und Tutorial {#campaign}

Das **Tutorial** erklärt in kleinen Schritten Leibeigene, Bauen, Arbeiter, Forschung und Kampf. Es
wartet jeweils, bis du den Schritt ausgeführt hast; „Weiter“ und „Überspringen“ helfen, wenn du es schon kennst.

Die **Kampagne** „Krone aus Eis“ erzählt in {{campaignCount}} Kapiteln:

{{campaignList}}

Jedes Kapitel beginnt mit einem **Briefing** und hat **Hauptziele** (müssen erfüllt werden) und
**Nebenziele** (Belohnung, Ehre). Ziele siehst du jederzeit oben links. Gewonnene Kapitel schalten das nächste frei;
Fortschritt und Bestzeiten merkt sich der Browser.

In vielen Kapiteln führst du **mehrere Helden** (Nelia, Orrin, später Taran). Figuren mit einem **Ausrufezeichen**
wollen reden – schick den richtigen Helden hin. Unter **Angebote** stehen Tribute: Wer bezahlt, kauft zum Beispiel
eine Zacke frei oder heuert Söldner an. Zwei Angebote derselben Sache sind eine Wahl – nach dem Bezahlen
verschwindet das andere. **Dörfer** können verbündet, neutral oder feindlich sein; Lieferungen gewinnen sie zurück.
Wer zu wem steht, zeigt ein Klick auf eine fremde Figur oder ein fremdes Gebäude: ein **roter** Punkt heißt Feind,
ein **goldener** neutral, ein **grüner** verbündet. Bei fremden Gebäuden siehst du nur Stufe und Lebenspunkte.

## Freies Spiel und Einstellungen {#free-play}

Im **Freien Spiel** wählst du:

- **Gegner:** 1 bis 3 Computergegner,
- **Stärke:** Leicht, Normal oder Schwer,
- **Held:** {{heroNames}},
- **Nebel des Krieges:** an oder aus,
- **Karte:** eine Kartennummer – jede Nummer erzeugt immer dieselbe Welt; „Würfeln“ wählt eine zufällige.

Gewonnen hat, wer alle gegnerischen Burgen zerstört.

Unter **Sonderkarten** im Startmenü liegen fertige Einzelkarten ohne Sieg und Niederlage: der **Schaukasten**
(jedes Gebäude und jede Figur einmal, ohne Nebel) und das **Gewimmel** (vier volle Städte, über tausend Figuren,
zwei Dauerschlachten – zum Ausprobieren, wie flüssig das Spiel auf deinem Gerät läuft). Die Ziele-Liste führt
mit „Ziel zeigen“ zu den einzelnen Orten.

Unter **Einstellungen** (Startmenü und Spielmenü) findest du Sprache (Deutsch/Englisch), Grafikstufe
(Automatisch, Niedrig, Mittel, Hoch), Lautstärken für Musik und Effekte, Größe der Oberfläche, Randscrollen
und Hilfetexte.

**Karte teilen:** Im Spielmenü (Pause) steht die Karte, z. B. „Karte: 62921“, darunter **„Link kopieren“** (am
Handy **„Link teilen“**). Wer den Link öffnet, beginnt dieselbe Karte mit denselben Einstellungen **von vorn** –
dein aktueller Spielstand ist nicht enthalten. Bei Missionen enthält der Link nur die Mission; geladene
Spielstände haben keinen Link.

> **Für Fortgeschrittene:** Das Spiel lässt sich über die Adresse direkt starten, z. B.
> `play/?seed=42&ai=hard&players=3&hero=orrin`, `&fog=off` ohne Nebel, `?mission=c1` für ein Kampagnenkapitel
> oder `?quality=low` für schwache Geräte.

### Auf dem Handy installieren

Kronland lässt sich als App installieren: im Browser-Menü **„Zum Startbildschirm hinzufügen“** bzw.
**„App installieren“** wählen. Danach startet es im Vollbild und ist nach dem ersten Laden offline spielbar.

## Speichern und Laden {#saving}

Öffne im Spiel das **Menü** ([[Esc]] oder Knopf oben rechts).

- **Spiel speichern** legt einen Spielstand an. Du kannst **mehrere Spielstände** führen; jeder zeigt Name,
  Datum und Spielzeit. Ältere Stände lassen sich überschreiben oder löschen.
- **Laden** zeigt die Liste deiner Spielstände. Im Startmenü setzt **„Weiterspielen“** den
  neuesten Stand fort.
- **Exportieren** lädt einen Spielstand als **JSON-Datei** herunter – zur Sicherung oder für ein anderes Gerät.
- **Importieren** liest eine solche Datei wieder ein.

**Automatisch gespeichert** wird außerdem regelmäßig in einen eigenen Platz („Autosave“). Er erscheint in der Liste
wie ein normaler Spielstand und wird bei jedem automatischen Speichern überschrieben – für eigene Sicherungen
nimm einen eigenen Platz.

Spielstände liegen im Speicher deines Browsers. Löschst du die Website-Daten oder spielst im privaten Modus,
sind sie weg – exportiere wichtige Stände.

## Programmier-Abenteuer {#coding}

In den **Programmier-Abenteuern** steuerst du deinen Helden nicht mit der Maus, sondern mit einem Programm in
**Python**. Gedacht ist das für alle, die programmieren lernen wollen – auch im Unterricht. Vorwissen brauchst du
keins: Jedes Abenteuer erklärt, was neu ist.

Öffne im Startmenü **Programmier-Abenteuer**. Die Abenteuer bauen aufeinander auf:

{{adventureList}}

Dazu kommt die Skript-Mission {{scriptMissions}}, ein ganz normales Spiel, dessen Ablauf komplett in Python
geschrieben ist.

### Das Code-Panel

Rechts steht dein Programm – am Handy öffnest du es über die goldene Münze **Code**. Oben im Panel liegen die Knöpfe:

| Knopf | Wirkung |
|---|---|
| **Ausführen** | startet das Programm; der Held setzt es sofort in der Welt um |
| **Stopp** | beendet das Programm |
| **Schritt** | führt genau eine Anweisung aus, auch in Funktionen hinein |
| **Über** | nächste Zeile – Funktionsaufrufe laufen am Stück durch |
| **Heraus** | weiter, bis die aktuelle Funktion fertig ist |
| **Weiter** / **Anhalten** | läuft bis zum nächsten Haltepunkt bzw. hält an |

Ein Klick auf eine **Zeilennummer** setzt einen **Haltepunkt**. Hält das Programm an, ist die aktuelle Zeile grün
markiert, und du siehst alle Variablen und den Aufrufstapel. Bei einem Fehler wird die Zeile rot; ein Kasten erklärt,
was schiefging, und macht oft einen Vorschlag („Meintest du `turn_left`?“).

Unter **Befehle** stehen alle Befehle mit Erklärung und Beispiel, das du mit einem Tipp einfügst. Ausführlich –
mit Parametern, Rückgabewerten, Fehlern und vielen Beispielen – erklärt sie die [Programmier-Referenz](scripting/). Die wichtigsten:
`hero.step()`, `hero.turn_left()`, `hero.turn_right()`, `hero.ahead()`, `hero.chop()`, `hero.take()` und `print()`.

```
for i in range(10):
    hero.step()
```

Am Handy hilft eine Tastenleiste mit Einrücken, Doppelpunkt, Klammern und Anführungszeichen. Dein Code wird im
Browser gemerkt – du kannst jederzeit weitermachen.

![Programmier-Abenteuer: Das Programm hält am Haltepunkt (grüne Zeile), darunter die Variablen](site/programming.webp)

### Welteneditor

Unter **Programmier-Abenteuer → Welteneditor** baust du eigene Karten: Gelände heben und senken, Wasser, Wald,
Rohstoffe, Startplätze und benannte Orte setzen. Den Ablauf schreibst du ebenfalls in Python – Dialoge,
Kamerafahrten, Ziele, Angriffswellen. **Testspielen** startet deine Welt sofort; speichern kannst du sie als
Datei und unter **Szenario-Datei öffnen** wieder spielen oder weitergeben.

> **Für Lehrkräfte:** Welche Teile von Python es gibt und alle Befehle stehen in der
> [Beschreibung der Skripte](https://github.com/wi-wissen/Kronland/blob/main/docs/SKRIPTE.md).

## Entwicklermodus {#developer-mode}

Wie funktioniert ein Spiel „unter der Haube“? Der **Entwicklermodus** macht es sichtbar – gedacht für Neugierige
und ausdrücklich für den **Informatik-Unterricht**. Er verändert das Spiel nicht, alles wird nur gelesen.

- **Einschalten:** Menü → Einstellungen → „Entwicklermodus“, Adresse `play/?dev=1` oder Taste [[F3]] bzw. [[Strg]] + [[Shift]] + [[D]].
- **Polygone:** Drahtgitter von Gelände, Gebäuden und Figuren, Detailstufen farbig, Dreieckszahlen je Objekt.
- **Wegsuche:** Figur antippen – ihr Pfad und die **A\*-Suche** Schritt für Schritt mit offener und geschlossener Liste und f = g + h je Feld.
- **Raster:** Begehbarkeit, Höhenkarte, Bebaubarkeit und Steigung, Sicht und Nebel je Kachel.
- **Figuren:** Zustand jeder Figur (läuft, arbeitet, isst, kämpft …) und der State-Hash der Simulation.
- **Statistik für Nerds:** Bilder je Sekunde, Bildzeit, Zeichenaufrufe, Speicher und mehr.

Auf dem Handy liegt das Panel als ausklappbares Blatt unten. Unterrichtsideen und alle Einzelheiten stehen in der
[Beschreibung des Entwicklermodus](https://github.com/wi-wissen/Kronland/blob/main/docs/ENTWICKLERMODUS.md).

![Entwicklermodus: A*-Suche einer Figur mit offener und geschlossener Liste](site/developer.webp)

## Tipps {#tips}

1. **Früh Leibeigene kaufen.** Mehr Hände bauen schneller und sammeln mehr Holz.
2. **Erst Wohnhaus und Bauernhof, dann Werkstätten.** Ohne Versorgung arbeiten Arbeiter kaum.
3. **Hochschule früh bauen** und **Bildung** und **Konstruktion** erforschen – sie schalten viel frei.
4. **Minen statt Haufen:** Haufen sind irgendwann leer, Schächte nie.
5. **Veredeln lohnt sich:** Eine Ziegelhütte verdoppelt deinen Lehm.
6. **Steuern im Blick:** „Hoch“ füllt die Kasse, kostet aber Motivation. Senke sie, bevor sie unter 70 % fällt.
7. **Türme an die Grenze** und eine Kaserne in Burgnähe – die ersten Angriffe kommen früher als gedacht.
8. **Gemischte Armeen:** Speere schützen gegen Reiter, Bogenschützen dahinter, Schwerter vorne.
9. **Winter einplanen:** Zugefrorene Flüsse sind Einfallstore. Halte Truppen bereit.
10. **[[.]] drücken** findet untätige Leibeigene.

## Häufige Fragen {#faq}

**Meine Arbeiter arbeiten so langsam – warum?**
Ihnen fehlen Wohnhaus oder Bauernhof in der Nähe, oder die Motivation ist niedrig. Prüfe die Motivation oben
und senke ggf. die Steuern.

**Es kommen keine neuen Arbeiter.**
Entweder ist die Bevölkerungsgrenze erreicht (baue oder erweitere ein Dorfzentrum), die Motivation liegt im
Schnitt unter {{noNewSettlers}} %, oder es gibt keinen freien Arbeitsplatz.

**Warum kann ich hier nicht bauen?**
Der Platz ist zu steil (mehr als {{maxSlope}} cm Höhenunterschied, Vorschau rot), belegt, nicht erkundet oder (bei Dorfzentren und Minen) kein Siedlungsplatz bzw. Schacht.
Das Panel nennt beim Platzieren den Grund.

**Ein Gebäude ist gesperrt.**
Fahre mit der Maus darüber bzw. tippe es an: Meist fehlt eine Technologie oder die Burg muss ausgebaut werden.

**Mein Gebäude brennt!**
Gebäude unter {{burnBelow}} % Lebenspunkten brennen und verlieren weiter LP. Schicke Leibeigene zum Reparieren (Rechtsklick auf das Gebäude).

**Mein Held ist umgefallen.**
Helden werden nur bewusstlos. Nach {{reviveSec}} Sekunden ohne Feinde in der Nähe stehen sie wieder auf.

**Das Spiel ruckelt.**
Stelle unter Einstellungen eine niedrigere **Grafikstufe** ein oder starte mit `?quality=low`.

**Läuft das Spiel offline?**
Ja, nach dem ersten Laden – besonders, wenn du es als App installiert hast.

**Wo finde ich genaue Zahlen?**
Im [Kompendium](compendium/): alle Gebäude, Einheiten, Technologien und Formeln.

## Lizenzen und Danksagung {#licenses}

{{credits}}
