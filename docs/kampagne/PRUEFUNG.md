# Prüfbericht: Drehbuch „Krone aus Eis“ gegen die Missions-Technik

Geprüft: [DREHBUCH.md](DREHBUCH.md) (Stand Commit 73c6a72) gegen [MISSIONEN.md](../MISSIONEN.md),
`src/sim/missions/runtime.js`, `setupApi.js`, `campaign/c1…c6`, `tutorial.js`, `speakers.js`, `UiPointer.vue`,
`ObjectivePanel.vue`, `CommandBar.vue`, `Engine.js` (Zeigerwahl) und die `data-testid`-Werte in `src/ui`.
Am Drehbuch und am Code ist nichts geändert.

**Bewertung:** ✅ direkt umsetzbar · 🟡 umsetzbar mit kleiner Erweiterung oder kleiner Drehbuch-Korrektur ·
❌ widerspricht Mechanik/Simulation oder geht so nicht. „E1 …“ verweist auf die Erweiterungsliste am Ende.

---

## Zusammenfassung

| | ✅ | 🟡 | ❌ | Schritte |
|---|---|---|---|---|
| M1 Lindgrund | 23 | 6 | 0 | 29 |
| M2 Beaucroix | 17 | 3 | 1 | 21 |
| M3 Wetterwerk | 12 | 4 | 0 | 16 |
| M4 Eisenhain | 14 | 2 | 0 | 16 |
| M5 Morvale | 13 | 4 | 0 | 17 |
| M6 Thronsee | 17 | 4 | 0 | 21 |
| **Summe** | **96** | **23** | **1** | **120** |

**Ergebnis:** Das Drehbuch ist fast vollständig mit vorhandenen Bausteinen umsetzbar. Die Ablaufsteuerung (Ziele,
Auslöser mit `delay`/`not`/Funktionsbedingung, Tribute als Wahl, Gesprächsfiguren mit Heldenliste, Merker,
`debrief(st)` je Weg) trägt alle sechs Missionen. Die vier ⚠-Änderungen (Eintreiber nach der Lehmgrube, Dorfälteste
spricht mit beiden Helden, Moorbrook-Geständnis, Orrins zweiter Auslöser) brauchen **keine** neue Mechanik, nur
Funktionsaktionen in den Missionsdateien.

**Die wichtigsten Probleme**

1. **Kampagnen-Zustand zwischen Missionen fehlt (K1).** `createMissionSim(id, { seed })` bekommt nichts aus der
   Vormission; `progress.js` speichert nur Bestzeit und Nebenziele. Alle Rückbezüge (Einleitung M3, Dark Night M5,
   Erlenhof M5, Krönung M6) brauchen Erweiterung E1 (mittel, ~1 Tag). Die neutralen Fassungen funktionieren ohne.
2. **Hilfe-Zeilen „entfallen, wenn der Spieler schon handelt“** gehen mit Auslösern – aber nur für Handlungen, die die
   Simulation sieht (Bau gesetzt, Rohstoff abgebaut, Fähigkeit, Tribut, Handel, Steuerstufe, Miliz, Heldenposition).
   **Nicht prüfbar** sind reine Oberflächenhandlungen: Kamera bewegt, Held/Leibeigene ausgewählt, Ziele-Liste oder
   Baumenü geöffnet, Steuergruppe angelegt. Die `ui`-Bedingung gibt es nur im Tutorial (und nur `camera`,
   `selectSerfs`). Außerdem: Ein Auslöser prüft im Moment des Auslösens; die Zeilen davor laufen noch in der
   Dialogschlange (siehe 4).
3. **Zeiger:** Es leuchtet immer nur **ein** Knopf, und zwar der des ersten offenen Ziels mit `hint.ui`
   (Hauptziele zuerst). Folgen: Zeiger von Nebenzielen (M1 „Leibeigene kaufen“, „Nachbardorf“) sind unsichtbar,
   solange ein Hauptziel zeigt; Zeiger-**Folgen** innerhalb eines Ziels („erst Burg, dann ‚Zu den Waffen!‘, dann
   ‚Mut machen‘“, Lager → Ausbauen, Hochschule → Forschung → Schießplatz) gehen nur teilweise über die Reihenfolge
   der Liste („erster sichtbarer gewinnt“). Bei der Steuer-Wahl würde ein einzelner Zeiger eine Stufe bevorzugen.
   Lösung E3 (Zeiger-Phasen) und E4 (Zeiger aus Auslösern), beide klein.
4. **Sim-Sekunden ≠ Lesezeit.** „Block 2, 4 s später“, „Hilfe nach 5 s ohne Bewegung“ sind Spielsekunden; ein Block
   aus 4–6 Zeilen läuft im Dialogfenster 15–30 s. Die Sätze stapeln sich also nur hintereinander, und „5 s ohne
   Bewegung“ ist erfüllt, während der Spieler noch den Startdialog liest. Pausen im Drehbuch auf ≥ 15–20 s setzen oder
   E6 (geschätztes Dialogende als Bedingung).
5. **Tauwetter meldet keine Ertrunkenen.** `Sim.setWeather` löscht Figuren auf dem Eis ohne `killed`-Ereignis (nur
   der Brückeneinsturz meldet `drowned: true`). Der im Drehbuch genannte Auslöser „Ereignis `killed` mit `drowned`“
   (M6 Köder, M3 „Sie waren aus Lindgrund“) feuert so nie. E5 (klein, nur Ereignisse, kein Zustand).
6. **Steuer-Wahl M2 verspricht mehr, als die Mechanik liefert (❌).** Normal 5 Taler je Arbeiter und Zahltag,
   „hoch“ 7,5: bei 10–15 Arbeitern +25–40 Taler alle 2 min. Orrins „dann haben wir sie (1200) in ein paar
   Zahltagen“ stimmt nicht. Abwanderung erst unter 25 % Stimmung (bei „sehr hoch“ −12 je Zahltag ab 100 %: nach
   ~7 Zahltagen = 14 min), neue Siedler bleiben ab < 30 % aus – die Mission dauert 5–12 min. „Lagerfeuer leeren sich
   nicht“ hat mit Steuern nichts zu tun (Lagerfeuer = fehlendes Bett/Essen). Zeilen ehrlich formulieren.
7. **Story-Lücken:** Taran erkennt Nelia nur, wenn sie selbst ans vordere Lager geht (sonst ist M5 unbegründet);
   M1-Abschluss „Wahl B / ohne Nachbardorf“ lässt die Alte nicken, die man nie besucht hat; Übungsmission und M1
   widersprechen sich (Orrin „zeigt Nelia“ im Tutorial, in M1 treffen sie sich zum ersten Mal); Wahlen-Tabelle
   verspricht eine M4-Folge in M5 (Start), die im M5-Text fehlt. Details unten.
8. **Umfang:** ~340 gesprochene Zeilen (heute ~130), alle noch ohne Englisch; Vertonung ×2 Sprachen.

**Geschätzter Aufwand** (ohne Vertonung): Technik-Erweiterungen E1–E12 ~2,5 Tage · sechs Missionsdateien neu
schreiben (DE+EN, Auslöser, Funktionsbedingungen) ~5 Tage · Test-Bot/Kampagnenmatrix, Vitest je Mission, E2E-Fotos
~2 Tage. **Summe ~9–10 Personentage.** Vertonung zusätzlich (~680 Aufnahmen, Pipeline vorhanden, Kosten/Prüfung
groß).

---

## Querschnitt: Antworten auf die Prüffragen

**Zeiger auf Knöpfe und Handy.** Alle 60 Kennungen aus der Prüfliste existieren (dynamisch:
`quick-hero-*`, `objective-go-*`, `build-*`, `tribute-pay-*`, `market-give/take-*`, `recruit-full-*`, `tax-0…4`,
`tech-*`, `btech-*`, `ability-*`, `weather-*`; fest: `quick-all/hq/army/idle`, `serf-build`, `place-confirm`,
`payday`, `buy-serf`, `militia`, `militia-off`, `tributes-toggle`, `upgrade`, `trade-go`, `order-attack`,
`motivation`, `repair`, `group-save`, `weather-energy`, `minimap-toggle`, `objectives-toggle`, `res-bar`,
`relation`). Handy funktioniert über zwei Wege:
- `data-hint-for`: Der Kartenknopf (`minimap-toggle`) leuchtet für `quick-hq/idle/all/army`, der Knopf „Bauen“
  (`serf-build`) und die Baumenü-Reiter für jede `build-*`-Kachel.
- Reihenfolge der Liste: `['objective-go-root', 'objectives-toggle']`, `['tribute-pay-clay', 'tributes-toggle']`,
  `['ability-courage', 'quick-hero-nelia']`, `['place-confirm', 'build-villageCenter', 'quick-all']` – der erste
  sichtbare gewinnt. So zeigt das Handy automatisch auf den aufklappenden Knopf.
- Lücken: `relation` ist nur sichtbar, wenn ein fremdes Gebäude ausgewählt ist (Zeiger zeigt praktisch nie);
  `upgrade` ist für jedes ausgewählte Gebäude derselbe Knopf; die Marktfolge „Bezahlen mit → Kaufen → Handeln“ ist
  Oberflächenzustand; für die Steuerreihe fehlt eine gemeinsame Kennung (E11).

**Wie erklärt die Übungsmission Desktop vs. Touch?** Über das Coach-Feld: jeder Schritt hat `text` und optional
`touch`, `TutorialCoach.vue` zeigt am Touchgerät `touch`. Orrins *gesprochene* Zeilen sind dort selten und
geräteneutral; ein „du da oben“ gibt es in der Übungsmission nicht (das Drehbuch behauptet es). Für Missionsziele gibt
es kein `touch` (K2 = E2, klein). Empfehlung: gesprochene Hilfe geräteneutral („wähl Nelia aus und schick sie
hin“), die Geräte-Details nur in den Zieltext mit Handy-Fassung (E2) – kürzer, und keine doppelten Aufnahmen.

**Wahlen und ihre Auslöser.**

| Wahl | Erkennung | Bewertung |
|---|---|---|
| M1 Wer spricht mit der Ältesten | Gesprächsfigur `hero: ['orrin', 'nelia']`; Ereignis `npcTalked` trägt `hero` → Auslöser `{ type: 'event', event: 'npcTalked', match: { id: 'elder', hero: 'orrin' } }` | 🟡 Gleichstand: Laufen beide Helden zusammen hin, gewinnt der erste in Entity-Reihenfolge (meist Nelia) – Zufallswahl. E7 |
| M2 Freikaufen/Stürmen | Tribut bezahlt / `destroyed robbersGuards` (vorhanden) | ✅ |
| M2 Steuern | Funktionsbedingung `sim.players[0].taxLevel`; endgültige Einordnung per `onVictory` | ✅ Erkennung, ❌ versprochene Wirkung (siehe M2) |
| M3 Tor/Schlucht | `area` an `gate`/`gorge` mit `who: 'army'`; bestechen über Ereignis `ability` mit `match: { ability: 'bribe' }` (das Ereignis `bribed` hat kein `player`/`owner` und passt nicht zur `event`-Bedingung) | ✅ |
| M4 Söldner/Geflohene | Tribute `group: 'help'` | ✅ |
| M5 Wahrheit selbst | Gesprächsfigur nur Nelia + Merker `confessed`; Herold in zwei Auslösern | ✅ |
| M6 Kaufen/Forschen | Tribut | ✅ |
| M6 Köder/Ufer | Köder: eigene Figuren ertrinken (E5), Ufer: Malvors Kraftwerk zerstört (vorhanden) | 🟡 |

**Startvorräte.** M1: Gesamtbedarf Dorfzentrum + 2 Wohnhäuser + 2 Höfe + Lehmgrube = 1250 Holz, 950 Lehm. Start
1400 Lehm → Lehmgrube ist für Lehm unnötig (wie im Drehbuch als Frage 4 erkannt); sie ist aber für das Ziel „6
Arbeiter“ zwingend (2 Bauern + 5 Bergleute), deshalb trägt der Auslöser „Lehmgrube fertig“. Holz 600 → „doppelt so
viel“ stimmt. M2: Ausbau 200 Taler/200 Stein stimmt; Lehmschuld 800 bezahlbar (1800 − 550 für Höfe/Lager).
M3: Bestechen 200 + 50 je Soldat → Posten in der Schlucht 350, Trupp am Werk 400 (genau die Börse). M4: Geflohene
(400) sofort, Söldner (1400) nicht – wie beschrieben. M6: Forschungsweg 950 Taler/450 Schwefel, Kauf 1800 Taler –
mit 1500 Startgold ist der Kauf **nicht sofort** möglich; „Dialog, wenn nicht gekauft“ ist damit immer wahr.
MISSIONEN.md nennt noch alte Startwerte (M2 1500, M4 2000, M6 3500 Taler) – Doku veraltet.

**Sprecher und Figuren.** Alle Sprecher gibt es in `speakers.js` (Nelia, Orrin, Taran, Malvor, Dorfälteste,
Dorfbewohnerin, Eintreiber, Wache, Kaufmann, Räuberhauptmann, Gefangener, Bergmeister, Herold, Gelehrte). Nelias
Vater braucht keinen Sprecher (nur Text). Empfohlen: eigener Sprecher für die **Dorfälteste von Moorbrook** (M5
spricht sie neben der Ältesten von Erlenhof – gleiche Stimme, gleicher Name „Dorfälteste“). Der „Gefangene“ in M2
(Räuber) und M3 (Mann aus Lindgrund) teilen sich eine Stimme – vertretbar. Figuren-Looks: `serf`, `worker`,
`worker.miner`, `hero.orrin` reichen; keine neuen Modelle nötig.

**Dialoglängen.** Keine gesprochene Zeile über 20 Wörter, kein Block über 6 Zeilen, längste Zeile 121 Zeichen
(heute bis ~150). In Ordnung. Aber: ~340 Zeilen statt ~130 – dreimal so viel Vertonung, plus Englisch.

**Nebenbefund Technik.** `MissionRuntime.hash()` mischt Ziele, Auslöser, Tribute und Gesprächsfiguren in den
State-Hash, aber **keine Merker** (`state.flags`). Mit K1 und vielen Wahl-Merkern wächst die Bedeutung; Merker in den
Hash aufnehmen (winzig, Regel „neuer Sim-Zustand in den State-Hash“).

---

## Mission 1 – Lindgrund

| Schritt | Bewertung | Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start „Kein Rauch“ | ✅ | `start`: 3× `dialog`, `npc stranger` (vorhanden) | – |
| Schritt 1 Ziel + Zeiger | ✅ | Ziel `flag orrin`, `hint: { entity: 'stranger', ui: ['quick-hero-nelia'], uiWhile: <Nelia nicht bewegt> }` (Startposition in `setup` als Bezug merken, Funktionsbedingung) | – |
| Schritt 1 Hilfe „nach 5 s ohne Bewegung“ | 🟡 | Funktionsbedingung „Nelia steht noch“ geht; 5 s Spielzeit sind aber vorbei, bevor der Startdialog gelesen ist. Kamera-Schieben ist nicht prüfbar | Nach 20 s; „Siehst du mich nicht?“ ohne Bedingung oder weglassen (E6 optional) |
| Schritt 2 Orrin, Block 1 + Anschluss | ✅ | `npc` `onTalk`: Dialog, `remove`, `hero`, `flag`, `reveal root`, `reveal area` (vorhanden) | – |
| Schritt 2 Block 2 „4 s später“ | ✅ | Auslöser `when: flag orrin` als Anker, `delay` 4 s | Wird hinten angehängt (siehe Querschnitt 4) |
| Schritt 3 Ziel Baum + Zeiger | ✅ | `reach oldRoot who nelia`; `hint.ui: ['objective-go-root', 'objectives-toggle']` | – |
| Schritt 3 Hilfe „Ziel zeigen“ | ✅ | `delay` nach Anker-Auslöser + `not`: Nelia hat sich dem Baum genähert (Funktion). Klick auf „Ziel zeigen“ selbst ist nicht prüfbar | – |
| Fund: Dialog Kronstück | ✅ | `onDone` des Ziels | – |
| „Drei Leibeigene treten aus dem Wald“ | 🟡 | `give serfs` setzt sie an die Burg (`spawnSerf`) – nicht an den Waldrand | Funktionsaktion setzt die drei an den Baum, oder `give` um `at` erweitern (E9) |
| Dorfbewohnerin / Prinzessinnen-Lüge | ✅ | Dialog, Sprecher `villager` | – |
| Schritt 4 Balken + Zeiger | ✅ | `flag hauling` über `job wood` (vorhanden), `hint: { area: 'ruins', ui: ['quick-all'] }` – am Handy leuchtet `minimap-toggle` | – |
| Schritt 4 Hilfe | ✅ | `not job wood` | Rahmenziehen am Handy gibt es nicht – Zeile 2 nur Desktop, passt |
| Schritt 5 Dorfzentrum + Zeiger | ✅ | `build villageCenter`, `hint.ui: ['place-confirm', 'build-villageCenter', 'quick-all']`, Ring `square`; Taste B gibt es | – |
| Schritt 5 Hilfe | ✅ | `not built villageCenter placed` | – |
| Während des Baus (Kronstück-Recht), Block 2 | ✅ | `built … placed` + `delay` | – |
| Schritt 6 Wohnhäuser | ✅ | `build residence 2`, `build-residence`; „ausgegraut“ = `available` | – |
| Schritt 7 Höfe + „Erster Arbeiter“ | ✅ | `build farm 2`; `workers 1` (vorhanden) | – |
| Schritt 8 Arbeit für sechs | ✅ | `workers 6`, `hint` mit `uiWhile` (vorhanden) | Story: Lehm wird nicht gebraucht (Frage 4); Begründung „Arbeit + Steuern“ trägt |
| „Erstes Lagerfeuer“ | ✅ | `event campLit` | – |
| „Zahltag“ + Hilfe Burg | ✅ | `event payday` + `workers 1` (vorhanden), Hilfe mit `not event serfBought`-Merker | „Burg anklicken“ = `quick-hq`, Taste H gibt es |
| Schritt 9 Auslöser „Lehmgrube fertig, spätestens 25 min“ (⚠1) | ✅ | `any: [built clayMine, time 1500]` | – |
| Schritt 9 Ziel + Zeigerfolge Burg → „Zu den Waffen!“ → „Mut machen“ | 🟡 | `['militia', 'quick-hq']` geht über die Reihenfolge; der Wechsel zu `ability-courage`, sobald die Miliz steht, braucht Zeiger-Phasen | E3 (oder Hilfsziel) |
| Schritt 9 Hilfe Block 1/2, Sieg, „Entwarnung“ | ✅ | Funktionsbedingung „eigene Leibeigene mit `militia`“, `event ability` `courage`; Sieg = `onDone` | – |
| Nebenziel Leibeigene kaufen (2) | 🟡 | Zählen per Auslöser auf `serfBought` (Merker hochzählen) + `custom`-Ziel – geht. Zeiger `buy-serf` erscheint nicht, solange ein Hauptziel zeigt | E4 (Zeiger aus Auslöser) oder auf den Zeiger verzichten |
| Nebenziel Nachbardorf (⚠2) | 🟡 | `npc` mit `hero: ['orrin', 'nelia']`, Ausgang über `npcTalked.hero`. Gleichstand bei gemeinsamer Ankunft entscheidet die Entity-Reihenfolge; Zeiger `quick-hero-orrin` von Hauptzielen verdeckt | E7: Älteste spricht nur, wenn genau ein Held in Reichweite ist („Einer von euch soll reden.“) |
| Wahl A / Wahl B, Folgen | ✅ | Dialog, `diplomacy`, `give`, `flag neighborsLie`/`neighborsTruth` | Story: Nelias „(leise)“ in A und Orrins Kommentar in B, obwohl der Held evtl. nicht dabei ist – als „aus der Ferne“ akzeptabel |
| Niederlage | ✅ | `defeatTexts.hq` | – |
| Abschluss je Weg | 🟡 | `debrief(st)` mit Merkern – technisch ✅ | Story: „Wahl B / ohne Nachbardorf“ trennen – ohne Besuch nickt keine Alte. Dritte Fassung schreiben |

## Mission 2 – Beaucroix

| Schritt | Bewertung | Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start, Kaufmann mit Ausrufezeichen | ✅ | `npc merchant` in `start` (heute erst beim Herold) | – |
| Schritt 1 Höfe | ✅ | `build farm 3` | – |
| Schritt 2 Kaufmann: Ruf nach 3 min, nur Orrin | ✅ | `all: [time 180, not talked merchant]`; `hero: 'orrin'`, `wrongHero` | – |
| Lehm-Angebot + Zeiger | ✅ | `tribute clay`, `hint.ui: ['tribute-pay-clay', 'tributes-toggle']` | – |
| Rabatt vor/nach dem Herold | ✅ | Zwei Auslöser: `all: [tribute clay, fired offer]` → `closeTribute buyShard`, `tribute buyShardCheap`; Herold öffnet `buyShard` nur ohne `clayDelivered` | Heute öffnet der Lehm das Rabatt-Angebot schon vor dem Herold – beim Umbau korrigieren |
| Schritt 3 Lager | ✅ | `build storehouse` mit `uiWhile` (vorhanden) | – |
| Schritt 4 Ausbau, Zeiger + Ring aufs eigene Lager | 🟡 | Ring: Auslöser „Lager fertig“ merkt dessen ID als Bezug (wie `refOwn` im Tutorial). Zeigerwechsel `build-storehouse` → `upgrade` braucht Phasen; `upgrade` leuchtet bei jedem ausgewählten Gebäude | E3; oder eigenes Teilziel „Baue das Lager aus“ |
| Schritt 5 Handel + Zeigerfolge | 🟡 | Folge „Bezahlen mit → Kaufen → Handeln“ ist Oberflächenzustand, nicht darstellbar. Hilfe-Unterdrückung ✅ (`event tradeStarted`) | Ein Zeiger auf `trade-go`, Ring auf den Marktplatz; Folge nur im Text |
| Erster Handel | ✅ | `event tradeDone` (vorhanden) | – |
| Schritt 6 Herold, Kaserne, Angebot | ✅ | vorhanden (`unlock`, `tribute`, `reveal`) | Story: Herold und Eintreiber (M1) sagen „das **zweite** Kronstück“ – zählt aus Nelias Sicht. „das Kronstück im Flusswald“ |
| Schritt 6 Block 2 Kaserne/Sold | ✅ | `delay` | – |
| Wahl A Freikaufen | ✅ | Tribute, Merker `shardBought` | – |
| Wahl B Stürmen + Hilfe erster Trupp | ✅ | `destroyed robbersGuards` (vorhanden), `event recruited`, `quick-army`, `order-attack` | – |
| Schritt 7 Steuer-Wahl: Auslöser | ✅ | `all: [event payday, fired offer]`; Merker per Funktionsbedingung `taxLevel ≥ 3` / `≤ 1`; Endstand per `onVictory` | Festlegen, was zählt (Stand bei Sieg) |
| Schritt 7 Zeiger auf die Steuerstufen | 🟡 | Nur ein Element leuchtet: `tax-3` oder `tax-1` würde eine Wahl vorgeben | E11: Kennung `tax-row` für die ganze Reihe |
| Schritt 7 Wirkung der Wahl | ❌ | Mechanik: „hoch“ = +2,5 Taler/Arbeiter je Zahltag; Abwanderung frühestens nach ~14 min „sehr hoch“, Neuzuzug stoppt nach ~12 min; Lagerfeuer hängen nicht an Steuern | Zeilen anpassen: Orrin „Ein paar Taler mehr je Zahltag – und jeder drückt die Stimmung“; „Lagerfeuer leeren sich nicht“ und „in ein paar Zahltagen“ streichen; Folge vor allem im Abschlusstext |
| „Arbeiter geht“ | ✅ | `event workerLeft` mit `match: { reason: 'motivation' }` | Wird selten zu sehen sein (siehe oben) |
| Überfälle + Wundsalbe-Hilfe | ✅ | Auslöser vorhanden; `not event ability salve` | Zeiger `ability-salve` nur mit E4 sichtbar |
| „Es brennt“ | ✅ | Funktionsbedingung mit `isBurning` (`systems/damage.js`); Reparieren kostet wirklich nichts | – |
| Niederlage, Abschluss je Weg | ✅ | `defeatTexts`, `debrief(st)` (Freikauf/Sturm × Steuern) | – |

## Mission 3 – Das Wetterwerk

| Schritt | Bewertung | Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung mit „Taler/Schwert“-Satz | 🟡 | Satz braucht K1 (E1); neutrale Fassung ✅ | – |
| Start Block 1, Tor aufdecken, Kamera | ✅ | vorhanden | – |
| Start Block 2 Hilfe „Truppen“ | ✅ | Auswahl nicht prüfbar; Ersatz „Truppe hat sich bewegt“ (Funktion) | – |
| Schritt 1 Weitblick (neues Hauptziel) | ✅ | Ziel `flag`, Auslöser `event ability` `match: { ability: 'farsight' }`; Zeiger `['ability-farsight', 'quick-hero-nelia']`; Taste X stimmt | Als Hauptziel blockiert es den Sieg, falls nie benutzt: nach 60 s per `complete` erledigen oder optional machen |
| Weitblick erfüllt: Schlucht aufdecken | ✅ | `reveal area gorge`, `camera`. Weitblick selbst reicht 18 Kacheln, die Schlucht liegt ~30 entfernt – das Aufdecken macht das Skript | – |
| Schritt 2 Ins Tal, zwei Ringe | 🟡 | Ziel `reach valley` ✅; es gibt nur einen Ring (erstes Ziel mit Ort) | Zwei optionale Wegweiser-Ziele „Weg A: das Tor“ / „Weg B: die Schlucht“ mit je „Ziel zeigen“ (Ring nur am ersten) – oder E3-artige Mehrfachorte |
| Wahl A Tor (beim Sichten) | ✅ | `area gate who army` (vorhanden) | – |
| Wahl B Schlucht + Hilfe Bestechen | ✅ | `area gorge` (vorhanden); `ability-bribe`, Preis „200 + 50 je Mann“ stimmt (350) | – |
| Ins Tal gelangt: Steuergruppen-Hilfe | ✅ | ohne Bedingung (Steuergruppen sind Oberflächenzustand, nicht prüfbar); Umschalt+Zahl stimmt | – |
| Schritt 3 Pläne erst im Tal | ✅ | `hidden` + `reveal` beim Auslöser `valley` | – |
| Schritt 4 Werk, Edrian-Hinweis, Alarm, Zerstörung | ✅ | vorhanden, Dialoge tauschen | – |
| Schritt 5 Tauwetter (60 s, Ufer, Zurufe) | ✅ | `survive` + `footing` (vorhanden) | – |
| „Ertrinkt eine Truppe“ | 🟡 | `setWeather` meldet keine Ertrunkenen; Sieg fällt im selben Takt wie das Tauwetter (wenn die Pläne schon da sind) – Zeile und Bild gehen unter | E5; in `thaw` Truppen vorher/nachher zählen; Sieg 4–5 s später über einen Merker |
| Nebenziel Gefangene | ✅ | vorhanden; Dialog tauschen | Story: Woher kennt ein Gefangener im abgelegenen Tal die „Prinzessin“? Orrins „Später“ fängt es auf – ok |
| Niederlagen (Helden, Eis, Insel) | ✅ | vorhanden | – |
| Abschluss Tor/Bestochen | 🟡 | Merker über `area` und `event ability bribe` ✅; Abschluss-Satz „Bestochen“ setzt voraus, dass jemand bestochen hat – auch am Tor möglich | Merker `bribed` unabhängig vom Weg setzen, Torsatz nur ohne Bestechung |

## Mission 4 – Eisenhain

| Schritt | Bewertung | Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start Block 1/2, zwei Angebote | ✅ | vorhanden; Zeiger `tributes-toggle` | – |
| Wahl A Söldner / B Geflohene | ✅ | Tribute `group: 'help'`, Merker im `onPaid` | – |
| Schritt 1 Eisen + Ring am Schacht | ✅ | `build ironMine`; `ensureShaft` liefert den Schacht → als Bezug merken | – |
| Schritt 2 Schwefel | ✅ | `build sulfurMine` | – |
| Schritt 3 Stehendes Heer, Zeigerfolge | 🟡 | Ziel und Auslöser vorhanden; Folge Hochschule → `tech-standingArmy` → `build-archery` braucht Phasen | E3 |
| Schritt 4 Belagerung + Ringe | ✅ | `destroy siegeGuards`; Ring über `hint.entity: 'siegeGuards'` folgt dem ersten verbliebenen Trupp (ein Ring zur Zeit) | – |
| Truppenarten-Dialog | ✅ | `any: [eigene Hauptleute > 0, time 180]` | – |
| Taran erkennt Nelia | 🟡 | `area siegeAArea who nelia` (vorhanden) – aber nur, wenn Nelia selbst hingeht | Story-Lücke (M5 baut darauf): Rückfall-Auslöser bei `heroDown taran` oder Belagerung gebrochen, falls `meetTaran` nicht lief (Kurzfassung „Ich kenne dein Gesicht …“) |
| Taran bewusstlos, Rückzug | ✅ | `heroDown taran`, `remove` (vorhanden) | `remove` lässt ihn verschwinden; wer „abziehen“ zeigen will: erst `move` zum Rand, dann `remove` |
| Schritt 5 Bergmeister, Orrin redet dazwischen, „unter vier Augen“ | ✅ | `npc miner` nur Nelia (vorhanden), `delay` | – |
| Ausfälle + Wachturm-Hilfe | ✅ | vorhanden; `not built tower placed` | – |
| Wetter: Regen, Spätfrost | ✅ | Bedingung `weather` (`rain`, `winter`); Frost kommt fest nach 18,5 min | Spielt die Mission kürzer (Bot 9–21 min), entfällt die Szene – passt |
| Nebenziel 4 Truppen | ✅ | vorhanden | – |
| Niederlage | ✅ | vorhanden | – |
| Abschluss Söldner/Geflohene | ✅ | `debrief(st)` | – |

## Mission 5 – Morvale

| Schritt | Bewertung | Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start-Dialog | ✅ | `start` | Sprecher: Älteste von Moorbrook ≠ Älteste von Erlenhof – eigenen Sprecher anlegen (E12) |
| Optionales Ziel „vor dem Herold zur Ältesten“ (⚠3) | 🟡 | Gesprächsfigur `elderMoor` nur Nelia ✅, `fail` + `remove` beim Herold ✅. Restzeit als Uhr: `custom`-Ziele zeigen keine Zeit (`time` nur bei `survive`) | E8 (winzig) oder zweites `survive`-Ziel. Weg: ~24 Kacheln, ~11 s – leicht schaffbar, also eine echte Wahl |
| Wahl A Geständnis | ✅ | `onTalk`: Dialog, Merker `confessed` | – |
| Schritt 1 Herold Fassung A/B | ✅ | Zwei Auslöser `all: [time 150, flag confessed]` / `not`; gemeinsamer Anker-Auslöser `herald` (`any fired`) für spätere `delay`s. A: Moorbrook bleibt verbündet, `helpers` in setup auf zwei Bezüge teilen, einer bleibt | Festlegen: bleiben beide Speertrupps oder nur der von Moorbrook? |
| Hilfe „neutral“ | ✅ | `delay` | – |
| Dark Night | ✅ | `delay herald 4 s` | – |
| Dark Night mit K1-Zeile | 🟡 | E1. Braucht `neighborsLie` **und** `neighborsTruth` (K1-Liste nennt nur `neighborsTruth`; sonst ist „A“ nicht von „kein Besuch“ zu trennen) | K1-Liste ergänzen |
| Schritt 2 Lieferungen | ✅ | Tribute vorhanden; in A ohne `supplyMoorbrook`; Fortschritt `custom` 1/3 | – |
| Ring auf dem Eisenschacht | 🟡 | c5 legt keinen Eisenschacht an (nur `keepShafts`) – kein Bezug, keine Garantie in Reichweite | `ensureShaft('iron', hq, 22)` + Bezug (winzig) |
| Je Lieferung | ✅ | `onPaid` | – |
| Schritt 3 Befehl, Überlaufen, Block 2 | ✅ | `taranDefects` (vorhanden) | – |
| Taran-Hilfe + Zeiger | ✅ | `event ability` `shieldBash`/`intimidate`; `['ability-shieldBash', 'quick-hero-taran']`; Tasten X/C stimmen | – |
| Zeiger `relation` | 🟡 | Nur sichtbar, wenn ein Dorfgebäude ausgewählt ist | Ring aufs Dorf + Fortschritt „1/3“ statt Zeiger |
| Verstärkung | ✅ | vorhanden | – |
| Schritt 4 Erlenhof (+ K1-Steuerzeile) | ✅ | vorhanden; K1-Zeile mit E1 | – |
| Nebenziel, Niederlagen, Abschluss je Wahl | ✅ | vorhanden, `debrief(st)` | – |

## Mission 6 – Der Thronsee

| Schritt | Bewertung | Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | „Wetterturm“ im heutigen Text ist ein anderes Gebäude (`weatherTower`) – das Drehbuch sagt richtig „Wetterkraftwerk“ |
| Start Block 1/2, Angebot, Kamera | ✅ | vorhanden; Dialogkamera fährt zu Malvor | – |
| Schritt 1 drei Forschungsziele | ✅ | `research weatherForecast`, `build alchemist level 1`, `research meteorology`; Kauf erfüllt die Forschung von selbst, den Ausbau per `complete` | – |
| Schritt 1 Zeigerfolge | 🟡 | Alchimistenhütte → `btech-weatherForecast` → `upgrade` → `btech-meteorology` als Phasen | E3 |
| Hilfe Forschungsweg | ✅ | `not event researchStarted` | Kauf ist mit 1500 Startgold nicht sofort bezahlbar – „wenn nicht gekauft“ ist immer wahr |
| Wahl A Kauf | ✅ | Tribut; Merker `knowledgeBought` ergänzen | – |
| Malvors Garde | ✅ | vorhanden | – |
| Schritt 2 Kraftwerk | ✅ | `build weatherPlant`, `build-weatherPlant` (Gruppe „Verwaltung“ stimmt) | – |
| Schritt 3 Winter + Zeiger | ✅ | `weather winter` (vorhanden); `['weather-winter', 'weather-energy']` | – |
| Winter-Dialog (Köder-Idee) | ✅ | vorhanden, Text tauschen | – |
| Schritt 4 Malvors Tauwetter | ✅ | vorhanden (`malvorThaw`, gleiche Regeln) | – |
| Köder: Merker `drowned` | 🟡 | `killed`/`drowned` kommt beim Tauwetter nicht. Malvors Tauwetter läuft über die Mission (vorher/nachher zählen geht), das Ende des eigenen Winters nicht | E5 |
| Erstes Tauwetter | ✅ | `fired malvorThaw` (vorhanden) | – |
| Erste eigene Ertrunkene | 🟡 | wie oben; „Orrin (falls noch da)“ über `orrinWounded` ✅ | E5 |
| Malvors Kraftwerk zerstört | ✅ | vorhanden | – |
| Schritt 5 Orrin bricht ein, Fassung Sturm | ✅ | vorhanden | – |
| Schritt 5 Fassung Tauwetter (⚠4) | ✅ | In `malvorThaws` vor dem Befehl prüfen, ob Orrin auf Wasser steht → `orrinFalls`; `orrinHit` mit `not flag orrinWounded` sichern | – |
| Schritt 6 Schloss, Malvors Fähigkeiten | ✅ | `event ability` mit `player: 'enemy'`, `match: { ability: 'fieldGun' }`; die KI nutzt Fähigkeiten, sobald Malvor ein Ziel hat | – |
| Schloss unter halber Kraft | ✅ | vorhanden | – |
| Nebenziele, Niederlage | ✅ | vorhanden | – |
| Abschluss je Weg (+ K1 Moorbrook) | 🟡 | `debrief(st)` mit `knowledgeBought`, `drowned` ✅; `confessed` aus M5 braucht E1 | – |

---

## Nötige Erweiterungen der Technik

| Nr. | Erweiterung | Wo | Aufwand |
|---|---|---|---|
| E1 | **Kampagnen-Merker (K1):** Missionsdatei nennt `carry: ['neighborsLie', 'neighborsTruth', 'taxedHard', 'taxedLight', 'shardBought', 'shardStormed', 'bribed', 'mercs', 'refugees', 'confessed']`; `recordWin` speichert sie je Mission; `Engine` → `createMissionSim(id, { seed, carry })` → `state.carry` (im Spielstand und im Hash); Bedingung `{ type: 'carried', flag }`; `briefing`/`debrief` als Funktion auch mit `carry`; `CampaignMenu` reicht sie ans Briefing. Direktstart `?mission=c5` = neutral | `progress.js`, `Engine.js`, `runtime.js`, `CampaignMenu.vue`, Tests | mittel (~1 Tag) |
| E2 | **Zieltext mit Handy-Fassung (K2):** `touch` am Ziel, `uiState` reicht es durch, `ObjectivePanel` bekommt `touch`-Prop (wie `TutorialCoach`) | `runtime.js`, `ObjectivePanel.vue`, `MissionHud.vue` | klein (~2 h) |
| E3 | **Zeiger-Phasen:** `hint.ui` als Liste von Phasen `[{ ui, while }]` (erste, deren Bedingung gilt) – für Burg → Miliz → Mut machen, Lager → Ausbauen, Hochschule → Forschung → Schießplatz, Hütte → Forschung → Ausbau | `runtime.objectiveHint` | klein |
| E4 | **Zeiger aus Auslösern:** Aktion `{ type: 'pointer', ui, while, seconds }`, hat Vorrang vor Ziel-Zeigern – für Zahltag/`buy-serf`, Überfall/`ability-salve`, Nachbardorf/`quick-hero-orrin` | `runtime.js`, `Engine.js` (Zeigerwahl) | klein |
| E5 | **Tauwetter meldet Ertrunkene:** `setWeather` schickt `killed` mit `drowned: true` (wie `bridges.js`) | `src/sim/sim.js` | klein (nur Ereignisse, kein neuer Zustand) |
| E6 | **Dialogende schätzen** (optional): `say` schätzt Dauer aus der Wortzahl (fest, deterministisch), Bedingung `{ type: 'quiet', seconds }` = so lange nach der letzten Zeile | `runtime.js` | klein–mittel |
| E7 | **Gesprächsfigur „nur einer“:** Option `single: true` – spricht nur, wenn genau ein passender Held in Reichweite ist, sonst Hinweis | `runtime.updateNpcs` | klein |
| E8 | `custom`-Ziel darf `time: true` liefern (Uhr statt „37/150“) | `runtime.uiState` | winzig |
| E9 | `give` mit `at` (Leibeigene erscheinen an einem Ort statt an der Burg) | `runtime.js` | winzig |
| E10 | Merker in den State-Hash aufnehmen (Nebenbefund) | `runtime.hash` | winzig |
| E11 | Kennung für die Steuerreihe (`tax-row`), damit kein einzelner Steuerknopf leuchtet | Burg-Panel | winzig |
| E12 | Sprecher „Dorfälteste von Moorbrook“ (eigene Stimme) | `speakers.js`, Stimmen-Cast | klein (+ Vertonung) |
| (opt.) | `ui`-Prüfungen auch außerhalb des Tutorials (Held ausgewählt, Ziele-Liste geöffnet) – nur nötig, wenn Hilfe auch bei reinen Oberflächenhandlungen entfallen soll | `runtime.command`, `Engine.js` | klein–mittel |

Keine Erweiterung verletzt den Determinismus: alles sind Befehle, Ereignisse oder JSON-Zustand.

## Empfohlene Änderungen am Drehbuch

1. **Pausen in Sim-Zeit denken:** „4 s später“, „5 s ohne Bewegung“ → ≥ 15–20 s oder „nach dem Block“; ein Block
   von 4–6 Zeilen dauert im Spiel 15–30 s.
2. **Hilfe-Bedingungen nur auf Sichtbares:** bei Kamera, Auswahl, Ziele-Liste, Steuergruppen nicht „entfällt“
   versprechen (oder E-opt.); Liste der Ersatzbedingungen je Hilfe-Zeile ins Drehbuch.
3. **Hilfe geräteneutral sprechen**, Maus/Handy nur im Zieltext (E2) – spart Länge und Aufnahmen; Satz „wie in der
   Übungsmission“ streichen (dort gibt es kein „du da oben“, sondern Coach-Texte je Gerät).
4. **Ein Zeiger zur Zeit:** Zeigerfolgen als Phasen notieren (E3) oder auf den wichtigsten Knopf reduzieren; Marktfolge
   und `relation` nicht als Zeiger, sondern als Ring/Text.
5. **M1 Nachbardorf:** im Text sagen, dass nur **einer** gehen soll („Schick nur einen.“), mit E7.
6. **M1 Abschluss:** eigene Fassung „ohne Nachbardorf“ (ohne die nickende Alte).
7. **M1/M2 Wortlaut:** Eintreiber und Herold sagen nicht „das zweite Kronstück“, sondern „das Kronstück in
   Beaucroix/im Flusswald“.
8. **M2 Steuer-Wahl ehrlich:** „in ein paar Zahltagen“, „deutlich mehr Taler“, „Lagerfeuer leeren sich nicht“
   streichen; Folge spürbar vor allem im Abschluss und in M5 (K1). Wer sie im Spiel spüren will: Startstimmung oder
   Arbeiterzahl der Mission anders setzen – Balancing, keine neue Mechanik.
9. **M2 Herold „Korn zum halben Preis“:** Korn ist keine Ware; als reine Erzählung kennzeichnen, damit niemand Korn am
   Markt sucht.
10. **M3 Weitblick:** optional machen oder nach 60 s automatisch erledigen; Tauwetter: Sieg 4–5 s nach dem Tauen,
    damit Ertrinken und Wetterwechsel zu sehen sind.
11. **M4 Taran-Erkennung absichern:** Rückfallszene, wenn Nelia nie am vorderen Lager war (sonst hängt M5 in der
    Luft).
12. **M5:** eigener Sprecher für die Älteste von Moorbrook; festlegen, ob in Fassung A ein oder beide Speertrupps
    bleiben; K1-Liste um `neighborsLie` (und `bribed`) ergänzen; Wahlen-Tabelle: die versprochene M4-Folge „M5,
    Start (wer in Nelias Lager steht)“ fehlt im M5-Text – Zeile schreiben (z. B. Geflohene erkennen die Leute aus dem
    Kornlager) oder aus der Tabelle streichen.
13. **M6:** Merker `knowledgeBought` und Ertrinken (E5) als Bausteine nennen; die Forschungsweg-Hilfe nicht an „wenn
    nicht gekauft“ knüpfen (Kauf geht anfangs nicht).
14. **Übungsmission vs. M1:** Tutorial-Zusammenfassung „Der Händler Orrin zeigt Nelia …“ widerspricht dem ersten
    Treffen in M1. Tutorial als Rahmen außerhalb der Geschichte formulieren („Orrin zeigt dir …“).
15. **Doku angleichen:** MISSIONEN.md (Startgold M2/M4/M6, „Zacke“, `build-toggle` gibt es nicht mehr) und
    KAMPAGNE.md nach Freigabe des Drehbuchs.
