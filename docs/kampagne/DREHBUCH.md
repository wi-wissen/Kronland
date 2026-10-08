# Drehbuch „Krone aus Eis“

Inhaltliches Drehbuch der sechs Kampagnenmissionen: Geschichte, Motivation, Spielerführung, Dialoge. Grundlage ist
die Weltbeschreibung [WELT.md](WELT.md); Karten und Kernablauf der bestehenden Missionen
(`src/sim/missions/campaign/c1-…c6-*.js`, [KAMPAGNE.md](../KAMPAGNE.md)) bleiben, die Erzählung wird neu gebaut.
Alles hier ist mit den Bausteinen aus [MISSIONEN.md](../MISSIONEN.md) umsetzbar (Ziele, Auslöser, Aktionen, Tribute,
Gesprächsfiguren, Zeiger); Abweichungen sind mit **⚠ Änderung:** markiert und in der Prüfliste (Teil 3) gesammelt.

**Schreibweisen in diesem Dokument**

- **Sprecher: Zeile** – gesprochener, vertonter Satz (höchstens ~20 Wörter, höchstens ~6 Zeilen am Stück; ein neuer
  Block beginnt erst nach einer Spielhandlung oder einer Pause).
- *(Hilfe)* vor einer Zeile: Steuerungshinweis. Er kommt wenige Sekunden nach dem Ziel und **entfällt**, wenn der
  Spieler die Handlung schon begonnen hat (Auslöser mit `not`-Bedingung). Wer die Steuerung kennt, hört nur die
  Geschichte.
- **Maus / Handy:** Befehle heißen am Rechner „Rechtsklick“, am Handy „antippen“; Auswählen heißt „anklicken“ bzw.
  „antippen“. Gesprochene Zeilen nennen beides; Zieltexte nennen es in Klammern („Maus: … · Handy: …“).
- **Zeiger:** Was leuchtet (Knopf, Gebäudekachel) oder wo ein Ring auf der Karte steht. Die technischen Kennungen
  (`data-testid`) stehen gesammelt in der Prüfliste.
- **Orrin spricht Steuerungshinweise an „dich da oben“** – den Spieler –, wie in der Übungsmission. Das passt zu
  ihm (er redet mit jedem, auch mit dem Himmel) und trennt Bedienung von Geschichte. Nelia und Taran erklären ihre
  eigenen Fähigkeiten selbst.
- **Kronstücke immer mit Zahl:** „das erste Kronstück“, „drei von fünf Kronstücken“. Das Wort fällt zum ersten Mal
  beim Fund in Mission 1 und wird dort sofort erklärt.

---

# Teil 1 – Überblick

## Logline

Eine davongelaufene Leibeigene findet unter dem Baum, an dem ihr Vater immer die Familiensachen versteckte, ein
Stück der zerbrochenen Königskrone – und ein redseliger Händler macht sie mit einer Lüge zur „verlorenen
Prinzessin“. Um Statthalter Malvor, der das Land mit ewigem Winter aushungert, die fünf Kronstücke abzujagen, muss
sie Dörfer satt machen, einen Winter brechen und am Ende zeigen, dass man ihr nicht wegen ihres Blutes folgt,
sondern wegen ihrer Taten.

## Thema

**Folgt man jemandem wegen seines Blutes oder wegen seiner Taten?** Ausgesprochen wird es früh und zynisch von
Orrin („Die Leute fragen nie, was einer tut. Nur, wessen Kind er ist.“), beantwortet von der Dorfältesten in
Morvale („Wir folgen dir – nicht deinem Blut.“) und von den Provinzen, die eine Leibeigene krönen.

**Zweites Motiv: Korn ist Macht.** Malvor nimmt – Abgaben, Korn, Menschen, am Ende den Winter selbst. Nelia gibt –
Betten, Tische, Lieferungen. Das Spiel belohnt genau das: Arbeiter kommen nur, wo es Arbeit, Bett und Essen gibt,
und bleiben nur, wenn man sie nicht auspresst. Jede Mission stellt diese Frage einmal ganz praktisch (Steuern,
Söldner oder Flüchtlinge, Lieferungen statt Forderungen, ein Leibeigener als Köder auf dem Eis).

**Drittes Motiv: Arbeiter kann man nicht rufen.** „Man kann ihnen nur einen Grund geben“ (Orrin, Mission 1). Malvor
befiehlt, Nelia gibt Gründe. Das ist zugleich die wichtigste Spielregel der Wirtschaft.

**Was nie aufgelöst wird:** Wie das erste Kronstück unter Vaters Baum kam – und ob Nelia vielleicht doch mehr ist
als die Tochter eines Holzfällers. Ebenso, ob Malvor am Tod König Edrians schuld ist. Beides wird angedeutet,
nie bewiesen. Am Ende stellt Nelia die Frage nach ihrer Herkunft bewusst nicht mehr: Sie spielt keine Rolle.

## Bögen der Hauptfiguren

| Figur | Will (äußeres Ziel) | Braucht (inneres Ziel) | Anfang | Ende |
|---|---|---|---|---|
| **Nelia** | Ihr Dorf satt durch den Winter bringen und die Leute aus Malvors Kornlager heimholen – auch ihren Vater. Später: Malvor die Kronstücke wegnehmen, bevor er König wird. | Glauben, dass eine Leibeigene etwas zu sagen hat – mit eigener Stimme statt mit Orrins Geschichte. | „Ich bin das Kind eines Leibeigenen. Mich fragt keiner was.“ Lässt Orrin reden, widerspricht leise, nimmt den Vorteil der Lüge stillschweigend mit. | Gibt die Lüge öffentlich zu, gewinnt die Dörfer durch Taten, führt den Sturm auch ohne Orrin weiter. Wird als Leibeigene gekrönt und schafft die Leibeigenschaft ab. Fragt ihren Vater nicht, woher das Kronstück kam. |
| **Orrin** | Geschäft: ein heiles Karrenrad, Kunden, ein voller Beutel. | An etwas glauben, das man nicht verkaufen kann. | Verkauft eine Prinzessin wie Knöpfe; rechnet sogar ein geschenktes Brot nach, das er „nicht verbuchen“ kann. | Glaubt an Nelia, nicht an ihr Blut. Bricht im Sturm auf das Schloss ins Eis ein, erlebt die Krönung, stirbt in der Nacht danach – „Jetzt sind wir quitt. Das Brot.“ |
| **Taran** | Ordnung und volle Speicher, damit nie wieder ein Kind verhungert wie seine Schwester. | Erkennen, dass Malvors Ordnung den Hunger selbst als Waffe benutzt; sich für Menschen entscheiden statt für Befehle. | Malvors Hauptmann, belagert Eisenhain, erkennt Nelia und meldet ihre Herkunft – aus Pflicht. | Verweigert den Befehl, Höfe zu verbrennen, läuft über, gesteht seinen Anteil an der Enthüllung, führt den Sturm übers Eis, zieht Orrin heraus. Wacht danach über offene Speicher – „für alle“. |
| **Malvor** | König werden, damit ihm niemand mehr widerspricht; Ordnung durch Korn. | (Was er nie bekommt:) Vertrauen statt Gehorsam. | Unsichtbar, spürbar durch Boten: Eintreiber, Herold, Wachen, Befehle. Höflich, rechnend, nie grausam ohne Zweck. | Verteidigt sein Schloss selbst mit denselben Waffen wie Nelia (Wetterkraftwerk) und verliert, weil ihm keiner aus freien Stücken folgt. Wird gefangen; das fünfte Kronstück nimmt man ihm vom Hals. |

**Malvors Logik, Stufe für Stufe.** Er eskaliert nur, wenn das billigere Mittel versagt:
**nehmen** (Eintreiber, M1) → **kaufen** (Herold bietet Taler, M2) → **aushungern** (Wetterwerk, M3) → **Gewalt**
(Taran belagert, M4) → **Wahrheit als Waffe und verbrannte Erde** (Enthüllung, Brandbefehl, M5) → **selbst
kämpfen** (Inselschloss, eigenes Kraftwerk, M6). Er hält Nelia lange für eine Kleinigkeit; erst nach dem Wetterwerk
nimmt er sie ernst, und erst in Mission 6 spricht er selbst zu ihr.

## Save the Cat über die ganze Kampagne

| Beat | Mission | Moment |
|---|---|---|
| Opening Image | M1, Einleitung | Lindgrund im Schnee: kein Rauch, kein Hund. Nelia allein mit einem Bündel. |
| Theme Stated | M1, Schritt 2 | Orrin: „Die Leute fragen nie, was einer tut. Nur, wessen Kind er ist.“ |
| Set-up | M1, Schritte 1–8 | Ewiger Winter, Malvors Kornlager, das leere Dorf; Arbeiter brauchen Arbeit, Bett, Essen; Nelias Selbstbild („mich fragt keiner“); Orrins Art (verkauft, was er nicht hat). |
| Save the Cat | M1, Schritt 2 | Nelia gibt dem verfrorenen Fremden ihr letztes Brot. Orrin weiß nicht, wie er das „verbuchen“ soll. |
| Catalyst | M1, Schritt 3 | Unter Vaters Baum liegt kein Saatkorn, sondern das erste Kronstück. Orrin erfindet die „verlorene Prinzessin“, drei Leibeigene bleiben. |
| Debate | M1, Schritte 4–8 | Darf sie die Lüge stehen lassen? Was ist ein Kronstück wert, wenn keiner davon satt wird? Bleiben oder weiterlaufen? |
| Break into Two | M1, Schritt 9 + Abschluss | Die Eintreiber fordern das Kronstück; Nelia gibt es nicht her. Als sie hört, dass Malvor die Kronstücke aufkauft, bricht sie selbst auf, um ihm zuvorzukommen. |
| B-Story | ab M2 | Nelia und Orrin: Wahrheit gegen Geschäft. Beginnt mit Orrins Lehmschuld in Beaucroix („Wer liefert, dem glaubt man“), später kommt Taran dazu. |
| Fun and Games | M2, M3 | Markt und Handel, kaufen oder stürmen; Kommando ohne Burg übers Eis ins Tal des Wetterwerks. |
| Midpoint | M3, Ende | Das Wetterwerk fällt, es taut – falscher Sieg. Malvor verliert seine schärfste Waffe und greift deshalb zum Schwert. Man erfährt: Das fünfte Kronstück hängt an seinem Hals. |
| Bad Guys Close In | M4, M5 Anfang | Offener Krieg. Taran erkennt Nelia aus dem Kornlager und meldet es. Der Bergmeister gibt sein Kronstück „dem rechten Blut“, Orrin redet Nelia ins Wort. |
| All Is Lost | M5, Herold | Malvors Herold enthüllt die Lüge. Die Dörfer wenden sich ab, die Helfer gehen. Orrins Ruf stirbt („whiff of death“). |
| Dark Night of the Soul | M5, direkt danach | Orrin will gehen: „Ein Händler weniger, eine Lüge weniger.“ Nelia: „Wir fangen von vorn an. Wie in Lindgrund.“ |
| Break into Three | M5, Lieferungen bis Erlenhof | Nelia liefert, ohne zu fordern; Taran verweigert den Brandbefehl und läuft über. „Wir folgen dir – nicht deinem Blut.“ A- und B-Story treffen sich. |
| Finale | M6 | 1. Team und Plan (Wetterkraftwerk) · 2. Ausführung (See friert) · 3. Überraschung (Malvors eigenes Kraftwerk taut, Orrin bricht ein) · 4. Tiefster Punkt ohne Mentor (Nelia führt weiter) · 5. neuer Plan (Kraftwerk vom Ufer brechen oder Nachladen abpassen), Sturm, Malvor fällt. |
| Final Image | M6, Abschluss | Krönung einer Leibeigenen, Orrins Tod, Ende der Leibeigenschaft. Frühling in Lindgrund: Rauch aus jedem Schornstein, unter dem alten Baum schlägt Nelias Vater Holz – als freier Mann. |

## Die fünf Kronstücke

Die Krone des Kronlands **zerbrach**, als König Edrian im Sturm auf dem Thronsee ertrank. Die fünf Kronstücke
verschwanden; die Legende sagt, in jeder Provinz liege eines. Das alte Recht sagt nur: **Wer alle fünf vereint,
den müssen die Provinzen krönen.** Jedes Kronstück ist eine handbreite goldene Spitze der alten Krone mit einem
Stein darin, ohne Zauberkraft.

| Nr. | Provinz | Wie Nelia es bekommt | Was Malvor dort will |
|---|---|---|---|
| 1 | Lindgrund (M1) | Unter dem alten Baum am Waldrand, wo ihr Vater immer die Familiensachen versteckt hat. Wie es dorthin kam, weiß niemand. Gegen Malvors Eintreiber verteidigt. | Routine-Abgaben – bis das Gerücht von einer „Prinzessin mit Gold aus dem Boden“ seine Eintreiber erreicht. Dann will er es billig einsammeln. |
| 2 | Beaucroix (M2) | Räuber haben es aus der Stadtkasse geraubt und verkaufen es an den Meistbietenden. Freikaufen (über den Markt verdient) **oder** das Lager im Flusswald stürmen. | Kaufen statt kämpfen: Sein Herold bietet tausend Taler und verkauft der hungrigen Stadt Korn zum halben Preis. |
| – | Tal des Wetterwerks (M3) | Kein Kronstück. Dafür Hrimgars Pläne – und die Nachricht, dass Malvor das Kronstück von Hagenfurt an einer Kette um den Hals trägt. | Sein Wetterwerk schützen: Solange Winter ist, wächst Korn nur bei ihm. |
| 3 | Eisenhain (M4) | Der Bergmeister holt es aus dem tiefsten Stollen und gibt es „der Prinzessin“, nachdem Nelia Tarans Belagerung gebrochen hat. | Eisen für ein Heer, Schwefel für ein neues Wetterkraftwerk – und das Kronstück. Darum lässt er belagern. |
| 4 | Morvale (M5) | Die Dorfälteste von Erlenhof gibt es Nelia, nachdem die Lüge aufgeflogen ist – wegen ihrer Taten. | Morvale unterwerfen: erst Nelia entzaubern, dann die Höfe verbrennen, damit die Dörfer nur noch von seinem Korn leben. Das Kronstück verlangt er gleich mit. |
| 5 | Hagenfurt (M6) | An Malvors Hals im Inselschloss. Den Thronsee zufrieren lassen, das Schloss stürmen. | Es behalten, Nelia aufs Eis locken und tauen lassen. |

**Zählstand für Einleitungen:** M1 Start: 0 · M2: 1 · M3: 2 · M4: 2 · M5: 3 · M6: 4 · Ende: 5.

## Rote Fäden

| Faden | Gesät | Gepflegt | Geerntet |
|---|---|---|---|
| **Das Brot** (Orrin kann Geschenke nicht verbuchen) | M1, Schritt 2: Nelia gibt ihm ihr letztes Brot. | M2: Orrin bezahlt seine Lehmschuld erst, als Nelia darauf besteht. M5: „Ich schulde dir mehr als Lehm.“ | M6, Abschluss: Orrins letzte Worte: „Jetzt sind wir quitt. Das Brot.“ |
| **Rauch über Lindgrund** | M1, Einleitung: kein Rauch. | M1, Schritt 8: Der Rauch der Lehmgrube lockt die Eintreiber („Das sieht man bis zur Straße“). | M6, Schlussbild: Rauch aus jedem Schornstein. |
| **Vater und der alte Baum** (Herkunft, nie aufgelöst) | M1: Vater versteckte dort immer die Familiensachen; Nelia: „Wie kommt das unter Vaters Baum?“ | M3: Ein Gefangener aus Lindgrund: Der Vater lebt, schlägt Holz in Hagenfurt. M4: Taran erkennt „die Holzfällerstochter“. | M6, Schlussbild: Der Vater ist frei und daheim. Nelia will fragen – und lässt es. |
| **Die Lüge** | M1: Orrin erfindet die verlorene Prinzessin. | M3: Der Gefangene stutzt. M4: Taran erkennt Nelia; der Bergmeister gibt „dem rechten Blut“, Orrin redet dazwischen. | M5: Der Herold enthüllt sie. M6: Malvor höhnt („eine Leibeigene mit einer Lüge“) – Nelia: „Die, die ich satt gemacht habe.“ |
| **Liefern** | M2: Orrins Lehmschuld. Kaufmann: „Wer liefert, dem glaubt man.“ | M4: Die Bergleute vertrauen dem, der die Belagerung bricht. | M5: Nelia gewinnt die Dörfer durch Lieferungen zurück. |
| **Leibeigene kaufen** | M1: Erster Kauf in der Burg; Nelia: „Menschen kaufen. Wie Mehl.“ | M2/M4: wiederkehrendes Unbehagen; in M4 nimmt sie Geflohene auf statt sie zu kaufen (Wahl). | M6, Abschluss: Erste Amtshandlung: Die Leibeigenschaft ist abgeschafft. |
| **Nehmen oder halten** (Steuern) | M1: Eintreiber fordern den Zehnten. | M2: Wahl der Steuerhöhe – „Malvors Weg“ oder „Nelias Weg“. | M5: Die Dörfer folgen dem, der gibt. M6: Malvor: „Wer gehorcht, isst.“ Nelia: „Du hast es hungern lassen, damit es gehorcht.“ |
| **Eis und Tauwetter** | M3, Start: „Wer auf dem Eis steht, wenn es taut, ertrinkt.“ | M3: Flucht vom See in 60 Sekunden. | M6: Malvor taut den Thronsee mit seinem eigenen Kraftwerk; Orrin bricht ein. |
| **Hrimgars Pläne und der Schwefel** | M3: Pläne in den Ruinen. | M4: Orrin liest darin: Wetter braucht Schwefel – Malvor will ihn auch. | M6: Nelias eigenes Wetterkraftwerk (Startvorrat Schwefel aus Eisenhain). |
| **Tarans Schwester** | M4: „Unter dem gütigen König sind auch Kinder verhungert.“ | M5: „Meine Schwester war sieben. Ich zünde kein Korn an.“ | M6, Abschluss: Taran öffnet Malvors Kornlager – „für alle“. |
| **Edrians Tod** (Verdacht, nie bewiesen) | M1, Einleitung: Edrian ertrank im Sturm. | M3: Orrin am Wetterwerk: „Ein Sturm mitten im Sommer. Kurz darauf lief das hier wieder.“ | M6: Nelia fragt Malvor; er weicht aus. Offen. |
| **„Man kann ihnen nur einen Grund geben“** | M1: erster Arbeiter. | M4: Söldner (bezahlt) oder Geflohene (freiwillig). | M5: Die Dörfer kehren zurück; M6: Die Provinzen krönen Nelia. |
| **„Seltener als eine Prinzessin“** | M1, Wahl B: Die Dorfälteste über eine Leibeigene, die nicht lügt. | – | M5: Orrin über Taran: „Ein Hauptmann, der Nein sagt. Seltener als jede Prinzessin.“ |

## Wahlen und ihre Folgen (Übersicht)

| Mission | Wahl | Folge in der Mission | Spätere Erwähnung |
|---|---|---|---|
| M1 | Wer spricht mit der Dorfältesten nebenan? **A** Orrin (mit der Prinzessinnen-Geschichte) · **B** Nelia (mit der Wahrheit) | A: 3 Leibeigene + 300 Holz. B: 3 Leibeigene, kein Holz, aber ein Versprechen. Abschlusstext je Weg. | M5, nach dem Herold: Nelia erinnert sich (B) bzw. bereut (A). |
| M2 | Steuern: **hoch** (Malvors Weg) · **niedrig** (Nelias Weg) · normal (keine Wahl) | Hoch: schneller Taler, sinkende Stimmung, Lagerfeuer leeren sich nicht. Niedrig: langsamer, aber mehr Arbeiter bleiben. Reaktionen von Nelia/Orrin, Abschlusstext. | M5, Dorfälteste von Erlenhof. |
| M2 | Kronstück **freikaufen** · **stürmen** | Wer den Hinweis aufs Wetterwerk gibt (Räuberhauptmann oder Gefangener). | M3, Einleitung („Taler“ oder „Schwert“). |
| M3 | **Tor** · **Schlucht**; dort **bestechen** · **kämpfen** | Verluste, Orrins Börse. | M3, Abschluss. |
| M4 | **Söldner** · **Geflohene Leibeigene** | Sofort kampfbereit vs. stärkere Wirtschaft; Bergmeister reagiert. | M5, Start (wer in Nelias Lager steht). |
| M5 | Nelia sagt die Wahrheit **selbst**, bevor der Herold kommt · der **Herold** sagt sie | Selbst: Moorbrook bleibt verbündet, seine Speerträger bleiben. Herold: alle drei Dörfer neutral. | M6, Krönung. |
| M6 | **Wissen kaufen** · **selbst forschen** | Zeit gegen Taler/Schwefel. | M6, Abschluss (ein Satz). |
| M6 | Malvor mit Leuten auf dem Eis **zum Tauen verleiten** · sein Kraftwerk **vom Ufer zerstören** | Wer auf dem Eis steht, ertrinkt; Nelia reagiert. | M6, Abschluss: Nelias erste Worte als Königin. |

Spätere Erwähnungen über Missionsgrenzen hinweg brauchen eine kleine Erweiterung (⚠ siehe Prüfliste, Punkt K1);
jede Zeile hat deshalb eine neutrale Fassung, die ohne sie funktioniert.

---
# Teil 2 – Die Missionen

## Mission 1 – Lindgrund: „Was unter dem Baum liegt“

**Dramatische Frage:** Kann Nelia ihr verlassenes Dorf wieder zum Leben bringen und das Kronstück unter Vaters Baum
vor Malvors Eintreibern behalten?

**Beats:** Opening Image · Theme Stated · Set-up · Save the Cat · Catalyst · Debate · Break into Two (am Ende).

**Malvors Ziel hier:** Nichts Besonderes – Lindgrund ist leer, seine Eintreiber holen wie jedes Jahr „den
Zehnten“ von dem wenigen, was übrig ist. Erst als das Gerücht von einer Prinzessin mit Gold aus dem Boden die Runde
macht, wollen sie das Kronstück. Malvors Logik: Ein Kronstück in Bauernhand ist eine Kleinigkeit, die man
einsammelt, bevor sie jemand ernst nimmt.

**Karte und Start (unverändert):** Burg leer, vom Dorfzentrum nur Grundmauern, zwei eingestürzte Häuser mit
Balkenhaufen daneben, Lehmschacht in Reichweite, der alte Baum zwischen Dorf und Kartenmitte, ein kleines
Nachbardorf seitlich. Nelia kommt allein, ohne Leibeigene. Vorrat: 400 Taler, 1400 Lehm, 600 Holz, 200 Stein.
Freigeschaltet: Dorfzentrum, Wohnhaus, Bauernhof, Lehmgrube.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Kamera bewegen | Start (Orrin, Hilfe) |
| Helden auswählen und laufen lassen | Schritt 1 |
| Gesprächsfiguren (Ausrufezeichen) | Schritt 1 |
| Ziele-Liste, Knopf „Ziel zeigen“, goldener Ring | Schritt 2 |
| Leibeigene auswählen („Alle“, Rahmen) | Schritt 4 |
| Holz abbauen (Balken, Bäume), Vorrat oben | Schritt 4 |
| Baumenü öffnen, Gebäude setzen („Hier bauen“), Siedlungsplatz | Schritt 5 |
| Mehr Bauleute = schneller | Schritt 5 |
| Dorfzentrum: ohne es keine Arbeiter | Schritt 5 |
| Ausgegraute Gebäude („in dieser Mission nicht verfügbar“) | Schritt 6 |
| Wohnhaus: Betten; Lagerfeuer als Zeichen | Schritt 6, Auslöser „Erstes Lagerfeuer“ |
| Bauernhof: Essen | Schritt 7 |
| Arbeiter kommen von selbst, wenn es Arbeit gibt | Auslöser „Erster Arbeiter“, Schritt 8 |
| Schacht und Grube | Schritt 8 |
| Zahltag, Steuern, Taler | Auslöser „Zahltag“ |
| Burg auswählen, Leibeigene kaufen | Auslöser „Zahltag“, Nebenziel |
| Zweiten Helden auswählen; nur ein bestimmter Held spricht mit einer Figur; Verbündete | Nebenziel „Nachbardorf“ |
| „Zu den Waffen!“, Miliz, Angreifen, „Entwarnung“ | Schritt 9 |
| Heldenfähigkeit („Mut machen“) | Schritt 9 |
| Helden werden bewusstlos, nicht getötet | Schritt 9 |

### Einleitung

> Seit König Edrian im Sturm auf dem Thronsee ertrank, ist Winter im Kronland – seit Jahren. Mit dem König zerbrach
> seine Krone; die Legende sagt, ihre fünf Stücke seien in alle Provinzen verstreut. Korn wächst nur noch in
> Hagenfurt, wo Statthalter Malvor herrscht. Wer essen will, arbeitet in seinen Kornlagern – für eine Schüssel am
> Tag. Auch die Leute aus Lindgrund sind gegangen.
>
> Nelia, Tochter eines Leibeigenen, hat drei Winter in Malvors Kornlager geschuftet. Ihr Vater schlägt dort noch
> immer Holz für die Öfen. Vor einer Woche ist sie davongelaufen. Jetzt steht sie am Rand ihres Heimatdorfs.
> Kein Rauch steigt auf. Kein Hund bellt.

### Ablauf

#### Start – Kein Rauch

- *Auslöser:* Missionsbeginn. Kamera auf Nelia am Dorfrand; am Dorfplatz sitzt ein Fremder mit Ausrufezeichen.
- *Dialog:*
  > **Nelia:** Lindgrund. Kein Rauch, kein Hund. Alle sind zu Malvor gegangen – für eine Schüssel Korn.
  >
  > **Orrin:** He! Du da, mit dem Bündel! Hier drüben, am Dorfplatz! Ich beiße nicht, ich handle nur.
  >
  > **Nelia:** Ein Fremder? Hier wohnen ja nicht mal mehr Mäuse.

#### Schritt 1 – Der Fremde auf dem Dorfplatz

- *Auslöser:* direkt nach dem Startdialog.
- *Ziel:* „Schick Nelia zum Fremden auf dem Dorfplatz (Maus: Nelia anklicken, dann Rechtsklick neben ihn · Handy:
  Nelia antippen, dann neben ihn tippen)“
- *Warum:* Er ist das einzige lebende Wesen in Lindgrund. Wer allein im Schnee steht, hört sich an, was ein Fremder
  zu sagen hat – vielleicht weiß er, wo die Leute geblieben sind.
- *Erklärung:* Helden auswählen und laufen lassen; Kamera schieben. Zeiger: Nelias rundes Bild im Schnellzugriff
  unten links; Ring und Ausrufezeichen am Fremden.
- *Dialog (Hilfe, nach 5 s ohne Bewegung):*
  > **Orrin:** Und du da oben, der zuschaut: Wähl Nelia aus – anklicken oder antippen. Ihr Bild unten links geht auch.
  >
  > **Orrin:** Dann Rechtsklick auf den Boden neben mir. Am Handy tippst du einfach dorthin.
  >
  > **Orrin:** Siehst du mich nicht? Karte schieben: WASD oder mittlere Maustaste, am Handy mit einem Finger ziehen.

#### Schritt 2 – Orrin

- *Auslöser:* Nelia erreicht den Fremden (Gesprächsfigur, jeder Held).
- *Ziel:* erfüllt sich mit dem Gespräch.
- *Warum:* Save the Cat und Thema. Nelia hat selbst nichts – und gibt trotzdem.
- *Dialog (Block 1, am Dorfplatz):*
  > **Orrin:** Endlich ein Gesicht! Orrin, Händler in Bändern, Knöpfen und guten Ratschlägen. Mein Karrenrad ist gebrochen.
  >
  > **Nelia:** Nelia. Ich bin hier geboren. Du siehst verfroren aus. Hier – mein letztes Brot.
  >
  > **Orrin:** Geschenkt? Wie soll ich das verbuchen? Mir hat noch nie jemand etwas geschenkt.
  >
  > **Nelia:** Dann verbuch es nicht. Iss.
  >
  > **Orrin:** Gute Knöpfe hab ich. Aber die Leute kaufen nur von Leuten mit Namen.
  >
  > **Orrin:** Die fragen nie, was einer tut. Nur, wessen Kind er ist.

  Orrin schließt sich als zweiter Held an. Das Ziel „alter Baum“ erscheint, der Baum wird kurz aufgedeckt.

- *Dialog (Block 2, 4 s später – Nelia läuft schon oder steht noch):*
  > **Nelia:** Ich bin das Kind eines Leibeigenen. Mich fragt keiner was.
  >
  > **Nelia:** Vater schlägt Holz in Malvors Kornlager. Bevor er ging, hat er unter dem alten Baum versteckt, was wir hatten.
  >
  > **Nelia:** Das hat er immer so gemacht, wenn die Eintreiber kamen. Vielleicht liegt da noch Saatkorn.
  >
  > **Orrin:** Saatkorn wäre mehr wert als alles in meinem Karren. Geh nachsehen.

#### Schritt 3 – Der alte Baum (Catalyst)

- *Auslöser:* nach Block 2 von Schritt 2.
- *Ziel:* „Schick Nelia zum alten Baum am Waldrand (Knopf ‚Ziel zeigen‘ neben dem Ziel fährt die Karte hin)“
- *Warum:* Nelia will, was ihr Vater für die Familie versteckt hat – Saatkorn hieße: Lindgrund könnte im Frühjahr
  wieder säen. Mehr erhofft sie nicht.
- *Erklärung:* Ziele-Liste, „Ziel zeigen“, goldener Ring. Zeiger: der Knopf „Ziel zeigen“ an diesem Ziel (am Handy
  zuerst der Knopf „Ziele“).
- *Dialog (Hilfe, 6 s nach Erscheinen des Ziels):*
  > **Orrin:** Links steht jetzt euer Ziel. Am Handy hinter dem Knopf „Ziele“.
  >
  > **Orrin:** Der kleine Knopf daneben fährt die Karte hin. Der goldene Ring zeigt die Stelle.

- *Fund (Nelia erreicht den Ring):*
  > **Nelia:** Kein Korn. Ein Tuch … und darin Gold. Eine Spitze mit einem roten Stein.
  >
  > **Orrin:** Bei allen Märkten. Weißt du, was du da hältst? Ein Kronstück.
  >
  > **Orrin:** Ein Stück von Edrians Krone. Sie zerbrach in fünf, als er ertrank. In jeder Provinz soll eins liegen.
  >
  > **Nelia:** Unter Vaters Baum? Wie kommt das dahin?

  Drei Leibeigene treten aus dem Wald (sie hatten sich dort vor den Eintreibern versteckt; `give serfs: 3`).

  > **Dorfbewohnerin:** Gold mit Stein? Gehört ihr zu Malvors Leuten? Dann sind wir weg!
  >
  > **Orrin:** Malvors Leute? Seht ihr nicht, wer da steht? Edrian hatte keine *bekannten* Kinder!
  >
  > **Orrin:** Die verlorene Prinzessin, Leute! Mit dem ersten Kronstück, aus der Erde von Lindgrund!
  >
  > **Dorfbewohnerin:** Die Prinzessin … in Lindgrund? Dann bleiben wir. Sag uns, was wir tun sollen!
  >
  > **Nelia:** Ich … Holt Holz. Wir bauen das Dorf wieder auf. Damit die anderen heimkommen können.

  Ziel „Holz“ erscheint.

#### Schritt 4 – Balken aus den Trümmern

- *Auslöser:* Fund am Baum.
- *Ziel:* „Schick die Leibeigenen an die Balken bei den Trümmern (Maus: ‚Alle‘ unten links, dann Rechtsklick auf die
  Balken · Handy: ‚Alle‘ antippen, dann die Balken antippen)“
- *Warum:* Die drei wollen helfen, und Nelia will ein Dorf, in das die Leute aus dem Kornlager heimkehren können.
  Holz ist knapp: 600 im Vorrat, für Dorfzentrum, Häuser, Höfe und Grube braucht man doppelt so viel. Die Balken der
  eingestürzten Häuser sind trocken und liegen schon da.
- *Erklärung:* Leibeigene auswählen, Rohstoffe abbauen. Zeiger: Knopf „Alle“ (am Handy hinter dem Kartenknopf);
  Ring an den Balkenhaufen. Bäume gehen auch.
- *Dialog (Hilfe, 4 s nach dem Ziel):*
  > **Orrin:** Leibeigene tun, was man ihnen zeigt. Du da oben: „Alle“ unten links wählt alle Leibeigenen.
  >
  > **Orrin:** Oder zieh mit der Maus einen Rahmen um sie. Dann Rechtsklick auf die Balken.
  >
  > **Orrin:** Am Handy: „Alle“ antippen, dann die Balken antippen. Oben siehst du, wie das Holz wächst.

#### Schritt 5 – Das Dorfzentrum

- *Auslöser:* Leibeigene tragen Holz (Balken oder Baum).
- *Ziel:* „Bau das Dorfzentrum auf den alten Grundmauern wieder auf (Leibeigene wählen → ‚Bauen‘ → Dorfzentrum →
  Grundmauern anklicken · Handy: … antippen, ‚Hier bauen‘)“
- *Warum:* Freie Leute – Bauern, Bergleute, Handwerker – ziehen nur dorthin, wo ein Dorfzentrum steht. Ohne es kommt
  niemand aus dem Kornlager zurück, auch Vater nicht. Die Grundmauern sind ein **Siedlungsplatz**: nur dort darf ein
  Dorfzentrum stehen.
- *Erklärung:* Baumenü öffnen, Gebäude setzen. Zeiger: Knopf „Bauen“, dann die Kachel „Dorfzentrum“; Ring auf den
  Grundmauern.
- *Dialog:*
  > **Orrin:** Gut. Jetzt der Dorfplatz. Freie Leute ziehen nur her, wo ein Dorfzentrum steht.
  >
  > **Nelia:** Die aus Lindgrund sitzen in Malvors Kornlager. Mit einem Dorfzentrum kommen sie heim?
  >
  > **Orrin:** Wenn es hier Arbeit, Betten und Essen gibt. Eins nach dem anderen.
  >
  > **Orrin:** *(Hilfe)* Leibeigene wählen, dann „Bauen“ – oder Taste B. Im Baumenü das Dorfzentrum, dann auf die Grundmauern klicken.
  >
  > **Orrin:** *(Hilfe)* Am Handy: „Bauen“, Dorfzentrum antippen, Grundmauern antippen, dann „Hier bauen“.
  >
  > **Orrin:** *(Hilfe)* Wer ausgewählt ist, fängt sofort an. Je mehr Hände am Bau, desto schneller.

- *Während des Baus (Auslöser: Baustelle gesetzt, 5 s später) – was ein Kronstück wert ist:*
  > **Nelia:** Orrin. Das Kronstück. Davon wird keiner satt.
  >
  > **Orrin:** Davon nicht. Aber damit. Es gibt ein altes Recht, Kind.
  >
  > **Orrin:** Wer alle fünf Kronstücke vereint, den müssen die Provinzen krönen. Egal, wer er ist.
  >
  > **Nelia:** Malvor herrscht doch längst.
  >
  > **Orrin:** Als Statthalter. Mit fünf Kronstücken wäre er König. Dann dürfte ihm keiner mehr widersprechen.
  >
  > **Nelia:** Dann bekommt er dieses nicht. Und warum hast du den dreien eine Prinzessin erzählt?

- *Block 2 (nach 3 s Pause):*
  > **Orrin:** Weil sie sonst weitergelaufen wären. Drei Paar Hände für einen Satz – guter Handel.
  >
  > **Nelia:** Und wenn sie merken, dass es nicht stimmt?
  >
  > **Orrin:** Dann haben sie ein Dach überm Kopf. Wer satt ist, verzeiht viel.

#### Schritt 6 – Betten

- *Auslöser:* Dorfzentrum fertig.
- *Ziel:* „Baue 2 Wohnhäuser – Arbeiter brauchen ein Bett“
- *Warum:* Wer heimkehrt, will nicht wieder in einer Scheune schlafen wie im Kornlager. Ohne Bett hockt ein
  Arbeiter am Lagerfeuer und schafft kaum ein Siebtel.
- *Erklärung:* freier Bauplatz (kein Siedlungsplatz nötig); ausgegraute Gebäude. Zeiger: Kachel „Wohnhaus“.
- *Dialog:*
  > **Nelia:** Das Dorfzentrum steht. Wie früher. Nur leerer.
  >
  > **Orrin:** Nicht mehr lange. Aber wer hier arbeiten soll, muss schlafen. Sechs Betten hat ein Wohnhaus.
  >
  > **Nelia:** Im Kornlager schliefen wir zu dreißig in einer Scheune. Hier bekommt jeder ein Bett.
  >
  > **Orrin:** *(Hilfe)* Wohnhaus steht im Baumenü unter „Wohnen“. Freier Boden genügt.
  >
  > **Orrin:** Was grau ist, gibt's hier noch nicht. Erst das Nötige, dann das Schöne.

#### Schritt 7 – Essen

- *Auslöser:* zwei Wohnhäuser fertig.
- *Ziel:* „Baue 2 Bauernhöfe – Arbeiter brauchen Essen“
- *Warum:* Essen ist das, womit Malvor das Land in der Hand hat. Wer in Lindgrund satt wird, muss nicht zu ihm.
- *Erklärung:* wie Schritt 6. Zeiger: Kachel „Bauernhof“.
- *Dialog:*
  > **Orrin:** Wer geschlafen hat, will essen. Und Essen ist alles, womit Malvor das Land festhält.
  >
  > **Nelia:** Dann bauen wir Höfe. Wer bei uns isst, muss nicht zu ihm.
  >
  > **Orrin:** Acht Plätze am Tisch hat ein Hof. Und der Bauer ist gleich unser erster Arbeiter.

- *Auslöser „Erster Arbeiter“ (erster Arbeiter erscheint):*
  > **Nelia:** Da kommt einer! Den hat keiner gerufen.
  >
  > **Orrin:** Arbeiter kann man nicht rufen, Kind. Man kann ihnen nur einen Grund geben.

#### Schritt 8 – Arbeit für sechs

- *Auslöser:* zwei Bauernhöfe fertig.
- *Ziel:* „Gib 6 Arbeitern Arbeit, Bett und Essen – bau eine Lehmgrube auf dem Schacht“
- *Warum:* Zwei Bauern sind noch kein Dorf. Mehr Leute kommen nur, wenn es mehr Arbeit gibt; eine Lehmgrube gibt
  fünf Bergleuten Arbeit. Lehm braucht man für jedes Haus und jeden Hof, und wer heimkehrt, braucht Häuser. Und wer
  arbeitet, zahlt Steuern – Lindgrund hat seit Jahren keinen Taler gesehen.
- *Erklärung:* Schacht und Grube. Zeiger: Kachel „Lehmgrube“ (Gruppe „Rohstoffe“), Ring auf dem Schacht; der
  Kachelzeiger verschwindet, sobald die Baustelle steht.
- *Dialog:*
  > **Orrin:** Zwei Bauern haben wir. Mehr kommen nur, wenn es mehr Arbeit gibt.
  >
  > **Orrin:** Dort drüben tritt Lehm zutage – ein Schacht. Darauf passt eine Lehmgrube.
  >
  > **Nelia:** Fünf Bergleute, die Lehm graben. Und Lehm brauchen wir für jedes Haus, das noch kommt.
  >
  > **Orrin:** Und wer arbeitet, zahlt Steuern. Dann klimpert es endlich mal in Lindgrund.
  >
  > **Orrin:** *(Hilfe)* Die Lehmgrube steht im Baumenü unter „Rohstoffe“. Sie passt nur auf den Schacht im Ring.

- *Auslöser „Erstes Lagerfeuer“ (ein Arbeiter entzündet ein Lagerfeuer, einmalig):*
  > **Orrin:** Siehst du das Feuer? Da sitzt einer, dem ein Bett oder ein Platz am Tisch fehlt.
  >
  > **Nelia:** Dann bauen wir, bis keins mehr brennt.
  >
  > **Orrin:** Lagerfeuer sind die ehrlichsten Boten im Dorf. Sie sagen immer, was fehlt.

- *Auslöser „Zahltag“ (erster Zahltag mit mindestens einem Arbeiter):*
  > **Orrin:** Hörst du das? Zahltag. Alle zwei Minuten zahlt jeder Arbeiter seine Steuern.
  >
  > **Orrin:** Für Taler kauft man in der Burg Leibeigene. Fünfzig das Stück, und das Dorf hat mehr Hände.
  >
  > **Nelia:** Menschen kaufen. Wie Mehl. Mich hat auch mal einer gekauft.
  >
  > **Orrin:** So ist das im Kronland. Willst du's ändern, brauchst du erst ein Dorf, das überlebt.
  >
  > **Orrin:** *(Hilfe)* Burg anklicken oder antippen – oder der Knopf „Burg“, Taste H. Dann „Leibeigenen kaufen“.

  Nebenziel „Leibeigene kaufen“ erscheint (siehe unten).

#### Schritt 9 – Malvors Eintreiber (Break into Two)

- *Auslöser:* Die Lehmgrube ist fertig – Rauch steigt über Lindgrund auf –, spätestens nach 25 Minuten.
  ⚠ Änderung: bisher kamen die Eintreiber, sobald die zwei Höfe stehen. Begründung: So überlagert der Kampf nicht
  die Erklärung der Grube, und der Rauch (Gegenbild zum „kein Rauch“ der Einleitung) ist der sichtbare Grund, warum
  sie kommen.
- *Ziel:* „Vertreibe Malvors Eintreiber (Burg → ‚Zu den Waffen!‘, dann Rechtsklick bzw. Tippen auf die Eintreiber)“
- *Warum:* Die Eintreiber wollen den Zehnten von einem Dorf, das gerade erst wieder isst – und das Kronstück.
  Gibt Nelia es her, hat Malvor das erste von fünf. Das Gerücht, das die Leute zurückgebracht hat, hat auch sie
  hergeführt.
- *Erklärung:* Miliz, Angriff, Heldenfähigkeit, Bewusstlosigkeit, „Entwarnung“. Zeiger: erst Knopf „Burg“, dann
  „Zu den Waffen!“; später Nelias Fähigkeit „Mut machen“. Kamera springt zu den Eintreibern.
- *Dialog (Block 1):*
  > **Nelia:** Rauch über Lindgrund. Das sieht man bis zur Straße.
  >
  > **Eintreiber:** Im Namen des Statthalters! Jeder zehnte Sack gehört Malvor.
  >
  > **Eintreiber:** Und man erzählt sich von Gold aus dem Boden. Her mit dem Kronstück!
  >
  > **Nelia:** Was unter Vaters Baum lag, bleibt in Lindgrund.
  >
  > **Orrin:** Meine Schuld, die Geschichte lief schneller als wir. Das sind nur vier Speerträger, Nelia.
  >
  > **Orrin:** *(Hilfe)* Burg wählen, „Zu den Waffen!“. Dann greifen alle Leibeigenen zu Mistgabeln.

- *Dialog (Block 2, 8 s später):*
  > **Orrin:** *(Hilfe)* Dann alle wählen – Rahmen oder „Alle“ – und Rechtsklick auf die Eintreiber. Am Handy antippen.
  >
  > **Nelia:** Ich gehe vorneweg. Wenn sie mich sehen, fassen sie Mut.
  >
  > **Orrin:** *(Hilfe)* Wähl Nelia allein aus. Dann „Mut machen“, Taste C: Wer bei ihr ist, schlägt doppelt so hart.
  >
  > **Orrin:** Und keine Angst. Wir fallen höchstens in Ohnmacht. Sind die Feinde fort, stehen wir wieder auf.

- *Sieg über die Eintreiber:*
  > **Eintreiber:** Das wird Malvor erfahren! Sein Herold kauft die Kronstücke längst – in Beaucroix bietet er schon für das zweite!
  >
  > **Nelia:** Dann muss er sich beeilen.
  >
  > **Orrin:** *(Hilfe)* Vergiss nicht: In der Burg „Entwarnung“. Sonst stehen die Mistgabeln herum, statt zu arbeiten.

### Nebenziele

**Optional: Leibeigene kaufen**
- *Auslöser:* Zahltag-Dialog.
- *Ziel:* „Optional: Kauf in der Burg 2 Leibeigene – mehr Hände bauen schneller“
- *Warum:* Die Gebäude stehen schneller; die Miliz gegen die Eintreiber wird größer.
- *Abschluss (beim zweiten Kauf):*
  > **Nelia:** Zwei mehr. Ich werde mich nie daran gewöhnen.

**Optional: Das Nachbardorf – Wahl**
- *Auslöser:* Fund am Baum (das Gerücht läuft). Die Dorfälteste nebenan bekommt ein Ausrufezeichen, ihr Dorf wird
  kurz aufgedeckt.
- *Ziel:* „Optional: Schick Orrin oder Nelia zur Dorfältesten nebenan“
- *Warum:* Das Nachbardorf hat Holz und Leute, aber es hat Angst vor Malvor. Wer es überzeugt, gewinnt Verbündete.
- *Erklärung:* einen bestimmten Helden auswählen (Bild im Schnellzugriff), zweiter Held. Zeiger: Orrins Bild.
- *Dialog (beim Erscheinen):*
  > **Orrin:** Nebenan wohnt noch jemand! Lass mich hin. Ich erzähl ihr von unserer Prinzessin.
  >
  > **Nelia:** Oder ich geh selbst. Und sag ihr, wer ich wirklich bin.
  >
  > **Orrin:** *(Hilfe)* Wen du schickst, wählst du mit seinem Bild unten links. Dann Rechtsklick bei der Alten.

- ⚠ Änderung: Die Dorfälteste spricht mit Orrin **oder** Nelia (bisher nur Orrin); der Ausgang hängt davon ab, wer
  zuerst ankommt (Funktionsaktion prüft den nächsten Helden, setzt Merker `neighborsLie` bzw. `neighborsTruth`).
  Begründung: erste spürbare Wahl zum Thema der Kampagne.

- **Wahl A – Orrin erzählt von der Prinzessin:**
  > **Orrin:** Ehrwürdige Mutter! Die verlorene Prinzessin ist zurück – und sie friert in Lindgrund.
  >
  > **Dorfälteste:** Eine Prinzessin! Dann schicken wir Leute. Und Holz für ihre Dächer.
  >
  > **Nelia:** *(leise)* Wieder eine, die es glaubt.

  Folge: Bündnis, 3 Leibeigene und 300 Holz.

- **Wahl B – Nelia sagt die Wahrheit:**
  > **Nelia:** Ich bin keine Prinzessin. Ich bin Nelia, die Tochter vom Holzfäller. Wir brauchen Hilfe.
  >
  > **Dorfälteste:** Eine Leibeigene, die nicht lügt, wenn's ihr nützen würde. Das ist seltener als eine Prinzessin.
  >
  > **Dorfälteste:** Holz haben wir selbst zu wenig. Aber Leute schick ich dir. Und ich halte den Mund.
  >
  > **Orrin:** Dreihundert Holz, einfach verschenkt. Für einen ehrlichen Satz.

  Folge: Bündnis, 3 Leibeigene, kein Holz.

### Niederlage

- *Burg gefallen:* „Die Eintreiber haben die Burg genommen. Lindgrund gehört wieder niemandem – und das erste
  Kronstück reitet in einer Satteltasche nach Hagenfurt.“

### Abschluss

*Sieg, wenn alle Hauptziele erfüllt sind.*

> **Wahl A:** Das Gerücht von der verlorenen Prinzessin läuft schneller durch den Schnee als jeder Bote. Aus dem
> Nachbardorf kommen Leute, aus dem Wald noch mehr. Am Abend steigt Rauch aus vier Schornsteinen. Nelia hört, wie die
> Kinder „Prinzessin“ rufen, und widerspricht nicht mehr – es hat ja doch keiner zugehört.
>
> **Wahl B / ohne Nachbardorf:** Am Abend steigt Rauch aus vier Schornsteinen. Die Leute nennen sie Prinzessin, und
> Nelia widerspricht – aber nur die Alte aus dem Nachbardorf nickt, als wüsste sie es besser.
>
> **Gemeinsam:** Nelia sitzt unter dem alten Baum, das erste Kronstück in der Hand. Wie es hierherkam, weiß sie nicht.
> Sie weiß nur: Wenn Malvor alle fünf Kronstücke bekommt, wird er König, und keiner darf ihm je wieder widersprechen.
> Und er kauft sie schon. „In Beaucroix bietet sein Herold für das zweite“, hat der Eintreiber gerufen.
>
> „Dann gehen wir nach Beaucroix“, sagt Nelia. – „Wir?“, fragt Orrin. „Mein Karrenrad ist gebrochen.“ – „Dann
> gehst du zu Fuß.“ Am nächsten Morgen ziehen sie los, mit zehn Leibeigenen und dreihundert Talern.

*Antwort auf die dramatische Frage:* Ja – Lindgrund lebt wieder, das erste Kronstück ist sicher. Aber nur dank einer
Lüge, die Nelia nicht wollte.

---
## Mission 2 – Beaucroix: „Wer zahlt, hat recht“

**Dramatische Frage:** Bekommt Nelia das zweite Kronstück, bevor Malvors Taler es kaufen – ohne dabei so zu
herrschen wie er?

**Beats:** B-Story beginnt (Orrins Schuld) · Fun and Games.

**Malvors Ziel hier:** Kaufen statt kämpfen. Sein Herold bietet den Räubern tausend Taler für das Kronstück und
verkauft der hungrigen Stadt Korn zum halben Preis – so kauft er Beaucroix gleich mit. Als Nelia überbietet, gibt
er den Räubern eine Anzahlung; von dem Geld rüsten sie auf und überfallen ihr Lager.

**Karte und Start (unverändert):** Lager am Rand von Beaucroix, das Kaufmannsviertel (verbündet) seitlich, das
Räuberlager im Flusswald zur Kartenmitte hin. 10 Leibeigene, Nelia und Orrin, 300 Taler, viel Lehm, Holz und Stein,
400 Eisen. Bekannt: Bildung, Handelswesen, Wehrpflicht. Freigeschaltet: Dorfzentrum, Wohnhaus, Bauernhof,
Lehmgrube, Lager (Ausbau zum Marktplatz), Steingrube; die Kaserne kommt mit dem Herold.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Angebote (Tribute): bezahlen, zwei schließen einander aus | Schritt 2 (Lehmschuld), Schritt 6 |
| Gebäude ausbauen (Lager → Marktplatz), Ausbau ohne Leibeigene | Schritt 4 |
| Händler sind Arbeiter (brauchen Bett und Essen) | Schritt 3/4 |
| Marktplatz: tauschen, Preise fallen beim Verkaufen | Schritt 5 |
| Steuern einstellen, Stimmung (Motivation) | Schritt 7 |
| Kaserne, Truppen ausbilden („Volle Einheit“), Sold am Zahltag | Schritt 6, Weg „Sturm“ |
| Alle Truppen wählen („Truppen“), angreifen, Angriffsbewegung | Weg „Sturm“, Überfälle |
| Räuberlager: Wachen besiegen | Weg „Sturm“ |
| Orrins „Wundsalbe“ | Erster Überfall |
| Brennende Gebäude reparieren | Auslöser „Es brennt“ |

### Einleitung

> **Bisher:** Ein Kronstück von fünf trägt Nelia bei sich – das erste, aus Lindgrund. Die Legende sagt, in jeder
> Provinz liege eines, und das alte Recht sagt: Wer alle fünf vereint, den müssen die Provinzen krönen. Malvor weiß
> das. Er sammelt. Der vertriebene Eintreiber hat es verraten: In Beaucroix bietet sein Herold schon für das zweite.
>
> Beaucroix, die Handelsstadt am großen Fluss, ist voll und hungrig. Malvors Agenten kaufen jedes Korn auf. Das
> Kronstück der Provinz lag in der Stadtkasse, bis Räuber es raubten; jetzt hausen sie damit im Flusswald und
> verkaufen es an den, der am meisten zahlt.
>
> Nelia hat zehn Leibeigene aus Lindgrund mitgebracht und dreihundert Taler. Orrin kennt hier jeden Markt. Und
> jeder Markt kennt Orrin.

### Ablauf

#### Start – Ankunft

- *Auslöser:* Missionsbeginn. Der Kaufmann im Viertel nebenan hat ein Ausrufezeichen.
- *Dialog:*
  > **Orrin:** Beaucroix! Hier riecht sogar der Schnee nach Geld.
  >
  > **Nelia:** Ich rieche nur Hunger. Malvors Leute kaufen das Korn weg, und die Stadt sieht zu.
  >
  > **Orrin:** Die Räuber haben das zweite Kronstück. Sie verkaufen an den, der am meisten bietet.
  >
  > **Nelia:** Und Malvor bietet. Wir haben dreihundert Taler.
  >
  > **Orrin:** Dann verdienen wir mehr. Wir brauchen einen eigenen Markt. Lehm und Stein haben wir genug.
  >
  > **Orrin:** Ah – und den Kaufmann da drüben … den besuchen wir besser später. Viel später.

#### Schritt 1 – Bauernhöfe

- *Auslöser:* nach dem Startdialog.
- *Ziel:* „Baue 3 Bauernhöfe – Händler und Arbeiter brauchen Essen“
- *Warum:* Ein Markt braucht Händler, und Händler sind Arbeiter: Sie kommen nur, wenn es Bett und Essen gibt. In
  einer Stadt, deren Korn Malvor wegkauft, ist ein eigener Hof mehr wert als Gold.
- *Erklärung:* bekannt aus Mission 1. Zeiger: Kachel „Bauernhof“.
- *Dialog:*
  > **Nelia:** Erst die Höfe. Wer bei uns arbeitet, soll nicht zu Malvors Korn betteln gehen.
  >
  > **Orrin:** Und Händler essen viel. Glaub mir, ich bin einer.

#### Schritt 2 – Der Kaufmann (B-Story)

- *Auslöser:* Orrin kommt in die Nähe des Kaufmanns **oder** 3 Minuten nach Start der Kaufmann ruft:
  > **Kaufmann:** Orrin! Ich seh dich doch! Komm her, du alter Fuchs!
- *Ziel:* „Optional: Schick Orrin zum Kaufmann von Beaucroix“ (nur Orrin; andere Helden hören: „Ich warte auf Orrin.
  Er schuldet mir etwas.“)
- *Warum:* Der Kaufmann hat Einfluss bei den Räubern – und eine Rechnung offen.
- *Dialog (Gespräch):*
  > **Kaufmann:** Achthundert Lehm hast du mir verkauft, Orrin. Vor einem Monat. Bezahlt hab ich. Wo ist er?
  >
  > **Orrin:** Unterwegs! Sozusagen. Er … liegt noch in der Erde.
  >
  > **Nelia:** Du hast etwas verkauft, das du nicht hast?
  >
  > **Orrin:** Das nennt man Vorauszahlung. Alle machen das. Fast alle.
  >
  > **Nelia:** Wir liefern. Achthundert Lehm. Sonst glaubt dir hier keiner mehr – und mir auch nicht.
  >
  > **Kaufmann:** Liefert ihr, rede ich mit den Räubern, wenn's ums Kronstück geht. Wer liefert, dem glaubt man.

  Angebot „Den versprochenen Lehm liefern (800 Lehm)“ erscheint; Nebenziel „Liefere dem Kaufmann den Lehm, den Orrin
  verkauft hat“.
- *Erklärung:* Angebote. Zeiger: das Feld „Angebote“, dann „Bezahlen“ am Lehm-Angebot.
  > **Orrin:** *(Hilfe)* Angebote stehen im Feld „Angebote“. Bezahlen heißt hier: liefern. Der Lehm geht sofort ab.
- *Bezahlt:*
  > **Kaufmann:** Der Lehm ist da, und sogar trocken! Für ehrliche Leute rede ich mit jedem.
  >
  > **Orrin:** Ehrlichkeit ist mein zweiter Vorname. Gleich nach Gewinn.
  >
  > **Nelia:** Dein erster Vorname ist Schulden.

  Folge: Merker `clayDelivered`. Ist der Herold schon da, wird „Freikaufen (1200)“ durch „Freikaufen mit Rabatt
  (800)“ ersetzt; sonst erscheint gleich das Rabatt-Angebot, sobald der Herold kommt.

#### Schritt 3 – Ein Lager

- *Auslöser:* gleichzeitig mit Schritt 1 sichtbar.
- *Ziel:* „Errichte einen Marktplatz: baue ein Lager und baue es aus“
- *Warum:* Am Markt tauscht man, was man übrig hat, gegen Taler. Ohne Taler kein Kronstück.
- *Erklärung:* Lager bauen. Zeiger: Kachel „Lager“ (Gruppe „Wohnen“), bis die Baustelle steht.
- *Dialog:*
  > **Orrin:** Ein Markt fängt als Lager an. Bau eins, dann machen wir einen Marktplatz daraus.

#### Schritt 4 – Ausbau zum Marktplatz

- *Auslöser:* Lager fertig.
- *Ziel:* (dasselbe Ziel, jetzt mit Zeiger auf „Ausbauen“)
- *Warum:* Erst der Marktplatz hat Händler – zwei Arbeiter, die Waren hin- und hertragen.
- *Erklärung:* Gebäude auswählen, „Ausbauen“; der Ausbau kostet 200 Taler und 200 Stein und läuft von selbst, ohne
  Leibeigene. Zeiger: Knopf „Ausbauen“ (Lager vorher anklicken lassen: Ring auf dem Lager).
- *Dialog:*
  > **Orrin:** *(Hilfe)* Lager anklicken oder antippen, dann „Ausbauen“. Das geht von selbst, Leibeigene braucht's nicht.
  >
  > **Orrin:** Zweihundert Taler kostet das. Ja, das sind zwei Drittel von allem. Investition, Kind.
  >
  > **Nelia:** Dann muss der Markt schnell zurückzahlen.

#### Schritt 5 – Der erste Handel

- *Auslöser:* Marktplatz fertig.
- *Ziel:* „Tausche Waren am Markt gegen Taler (Marktplatz wählen → ‚Bezahlen mit‘ Lehm oder Stein → ‚Kaufen‘ Taler →
  ‚Handeln‘)“
- *Warum:* Malvor bietet tausend Taler. Wer mithalten will, muss Lehm und Stein zu Geld machen.
- *Erklärung:* Marktfenster. Zeiger: „Bezahlen mit“ → „Kaufen“ → „Handeln“.
- *Dialog:*
  > **Orrin:** *(Hilfe)* Marktplatz wählen. Bei „Bezahlen mit“ den Lehm, bei „Kaufen“ die Taler. Dann „Handeln“.
  >
  > **Orrin:** Ohne Händler kein Handel. Sind sie nicht da, fehlt ihnen Bett oder Tisch.
  >
  > **Orrin:** Und merk dir: Wer viel verkauft, drückt den Preis. Lieber öfter ein bisschen.
- *Erster Handel abgeschlossen:*
  > **Orrin:** Hörst du das? Der schönste Klang der Welt. Taler, die klimpern.

#### Schritt 6 – Der Herold (Wahl: Taler oder Schwert)

- *Auslöser:* erster abgeschlossener Handel (Meilenstein). Das Räuberlager wird kurz aufgedeckt, die Kaserne
  freigeschaltet, das Angebot „Kronstück freikaufen“ erscheint (1200 Taler, mit Lehmlieferung 800).
- *Ziel:* „Hol das zweite Kronstück: freikaufen (Angebot) oder das Räuberlager im Flusswald stürmen“
- *Warum:* Verkaufen die Räuber an Malvor, hat er das erste Kronstück, das er sich nicht nehmen musste – und Nelia
  hat eins weniger, als sie braucht.
- *Dialog:*
  > **Herold:** Hört, Leute von Beaucroix! Statthalter Malvor grüßt die Stadt und schickt Korn – zum halben Preis.
  >
  > **Herold:** Und er zahlt tausend Taler für das zweite Kronstück, das im Flusswald liegt.
  >
  > **Räuberhauptmann:** Tausend vom Statthalter! Wer zwölfhundert bietet, kriegt's. Sonst geht's nach Hagenfurt.
  >
  > **Orrin:** Zwölfhundert. Ich zähl nach … wir haben zu wenig. Noch.
  >
  > **Nelia:** Dann holen wir's uns. Eine Kaserne bildet Leute an Schwert und Speer aus.
  >
  > **Orrin:** Oder wir verdienen es am Markt. Zwei Wege. Nimm einen, bevor Malvor nachlegt.

- *Erklärung (Block 2, 5 s später):*
  > **Nelia:** *(Hilfe)* Die Kaserne steht im Baumenü unter „Militär“. Darin: „Volle Einheit“ – ein Hauptmann und seine Leute.
  >
  > **Orrin:** Soldaten wollen am Zahltag Sold. Jede Truppe frisst Taler, die dem Kronstück fehlen.

- **Wahl A – Freikaufen:** Taler über Markt und Steuern sammeln, Angebot bezahlen. Mit Lehmlieferung 800, sonst 1200.
  > **Räuberhauptmann:** Taler sind Taler. Nimm dein Goldstück, Händler.
  >
  > **Herold:** Der Statthalter wird sich merken, wer ihn überboten hat.

- **Wahl B – Stürmen:** Kaserne bauen, Schwertkämpfer ausbilden (Taler und Eisen), Lager angreifen.
  - *Erklärung beim ersten fertigen Trupp:*
    > **Nelia:** *(Hilfe)* Knopf „Truppen“ wählt alle Soldaten und uns Helden. Dann Rechtsklick auf die Räuber, am Handy antippen.
    >
    > **Nelia:** *(Hilfe)* „Angreifen“ heißt: unterwegs alles angreifen, was sich in den Weg stellt.
  - *Wachen besiegt:*
    > **Gefangener:** Gnade! Hier, nehmt das Ding. Es hat uns nur Unglück gebracht.
    >
    > **Herold:** Der Statthalter wird sich merken, wer seine Ware gestohlen hat.
    >
    > **Nelia:** Seine Ware? Es lag in der Stadtkasse von Beaucroix.

  Folge in beiden Fällen: Merker `shard2`, offene Angebote zur Kronstück-Frage schließen sich, Überfälle hören auf.

#### Schritt 7 – Steuern (Wahl: nehmen oder halten)

- *Auslöser:* erster Zahltag nach dem Herold.
- *Ziel:* keins – eine Entscheidung im Spiel. Zeiger: Knopf „Burg“, dann die Steuerstufen.
- *Warum:* Das Kronstück kostet Taler, und Taler kommen aus Steuern. Malvor nimmt viel. Was nimmt Nelia?
- *Dialog:*
  > **Orrin:** Zwölfhundert Taler … Dreh die Steuern hoch, dann haben wir sie in ein paar Zahltagen.
  >
  > **Nelia:** So macht es Malvor. Nehmen, bis keiner mehr kommt.
  >
  > **Orrin:** Malvor hat volle Speicher. Wir haben einen Händler mit Schulden.
  >
  > **Orrin:** *(Hilfe)* In der Burg unter „Steuern“. Hoch bringt Taler, drückt aber die Stimmung.
  >
  > **Nelia:** Und wer unzufrieden ist, kommt nicht mehr. Oder er geht.

- **Wahl A – „Malvors Weg“ (Steuern auf „Hoch“ oder „Sehr hoch“, Merker `taxedHard`):**
  > **Nelia:** Gut. Aber ich zähle die Lagerfeuer, Orrin. Jeden Abend.
  
  Folge: deutlich mehr Taler je Zahltag; die Stimmung sinkt, neue Arbeiter bleiben aus, bei sehr hohen Steuern ziehen
  welche weg. Beim ersten Arbeiter, der geht:
  > **Nelia:** Da geht einer. Mit leerem Beutel und vollem Bauch hätte er gestanden.

- **Wahl B – „Nelias Weg“ (Steuern auf „Niedrig“ oder „Keine“, Merker `taxedLight`):**
  > **Orrin:** Niedrig! Mein Beutel weint. Aber die Leute lächeln. Das ist auch eine Währung.

  Folge: weniger Taler, Stimmung steigt, Arbeiter bleiben und arbeiten schneller; der Markt muss mehr leisten.

- *Umsetzung:* Auslöser mit Funktionsbedingung auf die Steuerstufe des Spielers, je einmal. Keine neue Mechanik.

#### Die Überfälle

- *Auslöser:* 5 Minuten nach dem Herold, danach alle 5 Minuten, höchstens dreimal, solange das Kronstück fehlt.
- *Dialog (erster Überfall):*
  > **Räuberhauptmann:** Malvors Anzahlung reicht für neue Klingen. Holt euch, was die Prinzessin hortet!
  >
  > **Orrin:** Er bezahlt sie dafür, uns arm zu machen. Billiger kann man nicht Krieg führen.
  >
  > **Orrin:** *(Hilfe)* Wähl mich allein und nimm „Wundsalbe“, Taste C. Wer bei mir steht, wird geheilt.
- *Auslöser „Es brennt“ (erstes eigenes Gebäude unter halber Kraft):*
  > **Nelia:** *(Hilfe)* Da brennt ein Haus! Leibeigene hinschicken – Rechtsklick oder antippen. Reparieren kostet nichts.

### Nebenziele

- **Lehmschuld** (Schritt 2): spart 400 Taler beim Freikauf.
- Keine weiteren; die Steuerfrage ist eine Wahl, kein Ziel.

### Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Malvors Herold zahlt die tausend Taler, und das zweite Kronstück fährt
  den Fluss hinauf nach Hagenfurt.“

### Abschluss

> **Freigekauft:** Der Räuberhauptmann zählt die Taler zweimal. Beim Abschied grinst er: „Wisst ihr, warum euer
> Statthalter so gern Korn verkauft? Weil nur er welches hat. Der Winter ist nicht echt. Im Gebirge hinter
> Hagenfurt steht ein altes Wetterwerk. Malvor hat es wieder angeworfen.“
>
> **Gestürmt:** Der gefangene Räuber zittert, aber nicht vor Kälte. „Wir haben für Malvor Fuhren ins Gebirge
> geschützt. Hinter Hagenfurt, in einem Tal, steht ein Werk. Es brummt Tag und Nacht. Seitdem schneit es.“
>
> **Steuern hoch:** In Beaucroix sagen sie, die Prinzessin nehme wie ein Statthalter. Orrin findet das ein
> Kompliment. Nelia nicht.
> **Steuern niedrig:** In Beaucroix sagen sie, bei der Prinzessin bleibe einem mehr im Beutel als bei Malvor.
> Orrin rechnet nach, wie viel ihn das gekostet hat, und hört bei vierhundert auf.
>
> **Gemeinsam:** Zwei Kronstücke von fünf. Orrin wird blass. „Ein gemachter Winter. Dann sind die Kornlager kein
> Glück, sondern eine Falle.“ Nelia packt ihren Mantel. „Solange es Winter ist, muss jeder zu Malvor, der essen
> will. Erst das Werk. Dann die Kronstücke.“

*Antwort:* Ja – das zweite Kronstück ist Nelias, mit Talern oder mit Schwertern. Und sie weiß jetzt, worauf Malvors
Macht steht.

---
## Mission 3 – Das Wetterwerk: „Hrimgars Winter“

**Dramatische Frage:** Kann eine Handvoll Leute ohne Burg Malvors Winter brechen – und rechtzeitig vom Eis kommen?

**Beats:** Fun and Games (zweite Hälfte) · Midpoint (falscher Sieg am Ende).

**Malvors Ziel hier:** Das Werk muss laufen. Solange Winter ist, wächst Korn nur in Hagenfurt, und wer essen will,
arbeitet für ihn. Er bewacht das Tal mit einem starken Tor; die Schlucht hält er für unpassierbar und lässt dort nur
einen kleinen Posten auf dem Eis stehen. Bei Alarm schickt er die Torwache an den See.

**Karte und Start (unverändert):** Bergkamm vor dem Tal; das **Tor** (Pass, fünf Trupps, Ballistaturm) und die
**Schlucht** (zugefrorener Fluss, Posten aus zwei Trupps). Im Tal der See mit dem Wetterwerk auf der Insel,
Hrimgars Ruinen am anderen Rand, ein Gefangenenlager. Keine Burg, keine Wirtschaft. Nelia, Orrin, zwei Trupps
Schwertkämpfer und ein Trupp Bogenschützen; 400 Taler in Orrins Börse.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Mission ohne Burg: nichts nachkaufen, jede Truppe zählt | Einleitung, Start |
| Alle Truppen und Helden wählen („Truppen“), mehrere Truppen führen | Start |
| Nelias „Weitblick“ | Schritt 1 |
| Eis trägt im Winter – Seen und Flüsse werden zu Wegen | Schritt 2 |
| Orrins „Bestechen“ (kostet Taler) | Schritt 2, Weg „Schlucht“ |
| Tauwetter: Wer auf dem Eis steht, ertrinkt | Start, Schritt 4, Schritt 5 |
| Gefangene befreien → kämpfen mit | Nebenziel |
| Steuergruppen (optional, für Fortgeschrittene) | Schritt 2, Hilfe |

### Einleitung

> **Bisher:** Zwei Kronstücke von fünf hat Nelia – aus Lindgrund und aus Beaucroix. Malvor hat keins von beiden
> bekommen. Noch nicht. Doch in Beaucroix hat Nelia erfahren, worauf seine Macht wirklich steht: Der Winter ist
> gemacht. *(Mit Kampagnen-Merkern, K1 – Freikauf: „Der Räuberhauptmann hat es ihr verraten.“ Sturm: „Ein gefangener
> Räuber hat es ihr verraten.“ Ohne K1 entfällt der Satz.)*
>
> Vor Jahrhunderten hungerte der Kriegsherr Hrimgar das Kronland mit einem Wetterwerk aus. Malvor hat es wieder
> angeworfen. Solange Schnee liegt, wächst Korn nur in Hagenfurt, und wer essen will, muss zu ihm.
>
> Das Werk steht auf einer Insel in einem Bergsee hinter Hagenfurt. Zwei Wege führen ins Tal: das bewachte Tor und
> der zugefrorene Fluss durch die Schlucht. Nelia und Orrin haben keine Burg und keinen Nachschub – nur drei Trupps
> Freiwillige aus Lindgrund und Beaucroix und vierhundert Taler in Orrins Börse.

### Ablauf

#### Start – Vor dem Bergkamm

- *Auslöser:* Missionsbeginn; das Tor wird kurz aufgedeckt, die Kamera fährt hin.
- *Dialog (Block 1):*
  > **Orrin:** Kein Dach, kein Feuer, kein Markt. Ich hasse Abenteuer.
  >
  > **Nelia:** Hinter dem Kamm liegt das Tal. Das Tor dort ist zu stark für uns.
  >
  > **Orrin:** Und merk dir eins, bevor wir loslaufen: Fällt das Werk, kommt das Tauwetter.
  >
  > **Orrin:** Wer dann auf dem Eis steht, ertrinkt. Wir alle. Auch die mit Schwertern.
  >
  > **Nelia:** Dann laufen wir schnell. Hier gibt es keine Burg, Leute. Wer fällt, kommt nicht wieder.
- *Erklärung (Block 2, Hilfe):*
  > **Nelia:** *(Hilfe)* Knopf „Truppen“ wählt alle Soldaten und uns Helden. Ein Rechtsklick, und alle laufen.

#### Schritt 1 – Weitblick

- *Auslöser:* nach dem Start.
- *Ziel:* „Sieh mit Nelias Weitblick über den Bergkamm (Nelia allein wählen → ‚Weitblick‘, Taste X)“
- *Warum:* Wer blind ins Tal läuft, läuft in eine Wache. Nelia hat als Kind von jedem Baum in Lindgrund das ganze
  Tal überblickt – „Weitblick“ ist genau das.
- *Erklärung:* Fähigkeit eines einzeln gewählten Helden. Zeiger: Nelias Bild, dann Knopf „Weitblick“.
- *Dialog:*
  > **Orrin:** Bevor wir hineinlaufen: Schau nach, wer da steht. Du siehst doch weiter als wir alle.
  >
  > **Nelia:** *(Hilfe)* Wähl mich allein aus und nimm „Weitblick“ – Taste X oder der Knopf. Dann seh ich weit übers Land.
- *Erfüllt (Fähigkeit benutzt, Merker über das Ereignis „Fähigkeit“):* Die Schlucht wird kurz aufgedeckt, die Kamera
  schwenkt hin.
  > **Nelia:** Da. Der Fluss läuft durch die Schlucht ins Tal. Und er ist zugefroren.
  >
  > **Orrin:** Ein gefrorener Fluss ist eine Straße. Hrimgars Winter baut uns den Weg zu seinem eigenen Werk.

#### Schritt 2 – Ins Tal (Wahl: Tor oder Schlucht)

- *Auslöser:* Weitblick benutzt (oder 60 s nach Start).
- *Ziel:* „Bring die Gruppe ins Tal – durchs Tor oder über den gefrorenen Fluss in der Schlucht“
- *Warum:* Nur aus dem Tal erreicht man die Insel.
- *Erklärung:* Eis ist im Winter begehbar; Bestechen. Zeiger: Ringe an Tor und Schlucht (beide „Ziel zeigen“).
- **Wahl A – Das Tor** (beim Sichten):
  > **Nelia:** Ein Turm und fünf Trupps. Hier durch kommen wir nur mit viel Mut.
  >
  > **Orrin:** Mut kostet nichts. Leute schon. Rechne gut, Nelia.

  Folge: harter Kampf, „Mut machen“ fast Pflicht; Orrins Börse bleibt voll für später (etwa einen Trupp am See).
- **Wahl B – Die Schlucht** (beim Sichten des Postens):
  > **Orrin:** Nur zwei Trupps auf dem Eis. Und die frieren für Malvors Sold. Das ist ein Angebot.
  >
  > **Orrin:** *(Hilfe)* Wähl mich allein, geh nah ran und nimm „Bestechen“, Taste X. Zweihundert Taler und fünfzig je Mann.
  >
  > **Nelia:** Du kaufst Soldaten wie Knöpfe.
  >
  > **Orrin:** Ich kaufe Leben. Ihre und unsere. Billiger geht's heute nicht.

  Folge: Ein bestochener Trupp kämpft für uns; die Börse ist leer. Oder kämpfen: kleine Verluste, Börse voll für
  später.
- *Ins Tal gelangt:*
  > **Orrin:** *(Hilfe)* Für Fortgeschrittene: Umschalt und eine Zahl merkt sich eine Truppe. Die Zahl allein holt sie zurück.

#### Schritt 3 – Hrimgars Pläne

- *Auslöser:* Ankunft im Tal (die Ruinen werden aufgedeckt).
- *Ziel:* „Sichere Hrimgars Pläne in den Ruinen am Talrand (ein Held genügt)“
- *Warum:* Malvor hat Hrimgars Pläne gefunden, so hat er das Werk wieder angeworfen. Wer weiß, wie das Werk gebaut
  ist, kann es nachbauen – Malvor kann es, und Nelia soll es auch können. „Was er weiß, sollen wir auch wissen.“
- *Dialog:*
  > **Nelia:** Da drüben, die Ruinen. Hrimgars Festung.
  >
  > **Orrin:** Wo ein Werk gebaut wurde, liegen Zeichnungen. Wissen ist die einzige Ware, die man verkaufen und behalten kann.
  >
  > **Nelia:** Malvor hat seine. Wir brauchen unsere.
- *Erfüllt:*
  > **Orrin:** Türme, Röhren, Zahlen … und hier: „Schwefel“. Immer wieder Schwefel.
  >
  > **Nelia:** Pass gut darauf auf. Vielleicht brauchen wir sie noch.

#### Schritt 4 – Das Wetterwerk

- *Auslöser:* Ankunft im Tal (gleichzeitig mit Schritt 3).
- *Ziel:* „Zerstöre das Wetterwerk auf der Insel“
- *Warum:* Ohne Winter wächst überall Korn, und niemand muss mehr für eine Schüssel in Malvors Kornlager. Das ist
  der Kern von Nelias Wunsch: Vater und alle anderen könnten heimgehen.
- *Erklärung:* Gebäude angreifen (Rechtsklick/antippen); Wiederholung: Tauwetter.
- *Dialog (das Werk kommt in Sicht):*
  > **Nelia:** Da ist es. Mitten im See. Hörst du das Brummen?
  >
  > **Orrin:** Ein Sturm mitten im Sommer hat König Edrian ertränkt. Kurz darauf lief das hier wieder.
  >
  > **Nelia:** Du meinst, Malvor …
  >
  > **Orrin:** Ich meine gar nichts. Ich zähle nur Zufälle. Das ist mein Beruf.
- *Alarm (jemand von uns betritt die Insel):*
  > **Wache:** Eindringlinge am Werk! Torwache, zum See!
  >
  > **Nelia:** Sie kommen übers Eis. Schnell – bevor die anderen da sind!
- *Werk zerstört:*
  > **Nelia:** Es ist still. Das Brummen ist weg … und das Eis knackt.
  >
  > **Orrin:** Runter vom See! Alle! In einer Minute ist das hier Wasser!

#### Schritt 5 – Tauwetter

- *Auslöser:* Werk zerstört. Die Uhr läuft 60 Sekunden.
- *Ziel:* „Tauwetter! Bring Nelia und Orrin auf festen Talboden – runter vom Eis und von der Insel“
- *Warum:* Hrimgars Winter rächt sich: Wer auf dem Eis steht, ertrinkt; wer auf der Insel bleibt, sitzt fest, bis
  Malvors Leute kommen.
- *Erklärung:* Ring am festen Ufer („Ziel zeigen“). Truppen auf dem Eis ertrinken ebenfalls (keine Niederlage, aber
  Verlust).
- *Dialog:*
  > **Wache:** *(5 s danach)* Das Werk brennt! Fangt sie am Ufer ab!
  >
  > **Orrin:** *(15 s vor Schluss)* Das Eis wird grau! Lauf, Nelia!
- *Tauwetter:* Das Wetter wechselt auf Sommer. Ertrinkt eine Truppe:
  > **Nelia:** Sie waren aus Lindgrund. Ich vergesse ihre Namen nicht.

### Nebenziele

**Optional: Die Gefangenen**
- *Auslöser:* Das Gefangenenlager kommt in Sicht.
- *Ziel:* „Optional: Vertreibe die Wachen am Gefangenenlager – die Befreiten kämpfen mit dir“
- *Warum:* Dort sitzen Leute aus den Dörfern, die Malvor ins Gebirge geschleppt hat, um sein Werk zu heizen.
- *Dialog (Sichten):*
  > **Nelia:** Da drüben, ein Lager mit Gefangenen. Leute aus den Dörfern.
  >
  > **Nelia:** Vertreiben wir die Wachen, kämpfen sie mit uns. Und vielleicht ist einer aus Lindgrund dabei.
- *Befreit (zwei Trupps Speerträger schließen sich an):*
  > **Gefangener:** Ihr seid aus Lindgrund? … Nelia? Die Holzfällertochter! Und die nennen dich Prinzessin?
  >
  > **Nelia:** Nicht ich. Er.
  >
  > **Orrin:** Später, später. Erst das Werk, dann die Familiengeschichten.
  >
  > **Gefangener:** Dein Vater lebt, Nelia. Er schlägt Holz in Hagenfurt und fragt jeden nach dir.
  >
  > **Nelia:** Dann hat sich der Weg schon gelohnt.

### Niederlage

- *Beide Helden bewusstlos:* „Nelia und Orrin liegen im Schnee, und die Wachen kommen. Der Winter bleibt.“
- *Ein Held auf dem Eis beim Tauwetter:* „Das Eis ist gebrochen – mitten auf dem See. Hrimgars Winter hat sich
  gerächt.“
- *Ein Held auf der Insel beim Tauwetter:* „Das Eis ist geschmolzen. Auf der Insel sitzen Nelia und Orrin fest, bis
  Malvors Leute mit Booten kommen.“

### Abschluss (Midpoint)

> Zum ersten Mal seit Jahren tropft es von den Dächern. Über den Bergen reißt der Himmel auf, und in den Tälern
> riecht es nach nasser Erde. In Lindgrund, erzählt man später, hat jemand gesät.
>
> In Orrins Tasche knistern Hrimgars Pläne. Ein gefangener Wächter verrät noch etwas, für ein Stück Brot: Malvor
> trägt selbst ein Kronstück – das von Hagenfurt, an einer Kette um den Hals. Er legt es nie ab.
>
> *(Torweg: Am Tor liegen viele. Orrin zählt sie nicht laut.)* *(Bestochen: Die bestochenen Soldaten bleiben. „Wer
> einmal die Seite wechselt“, sagt Orrin, „hat Übung.“)*
>
> In Hagenfurt erfährt Malvor in derselben Nacht, wer ihm den Winter genommen hat. Er sagt nur einen Satz, so
> erzählt man: „Wenn der Hunger sie nicht mehr hält, dann eben das Eisen.“

*Antwort:* Ja – der Winter ist gebrochen. Aber Malvor ist jetzt gewarnt, und er greift zum Schwert.

---
## Mission 4 – Eisenhain: „Das rechte Blut“

**Dramatische Frage:** Kann Nelia Eisenhain befreien, bevor Malvor Eisen, Schwefel und das dritte Kronstück
bekommt – und bleibt ihr Geheimnis dabei gewahrt?

**Beats:** Bad Guys Close In – außen offener Krieg, innen erkennt Taran Nelia, und sie nimmt ein Kronstück „für
das rechte Blut“ an.

**Malvors Ziel hier:** Der Frühling hat ihm den Hunger als Waffe genommen. Jetzt braucht er ein Heer – also
**Eisen** für Schwerter – und ein neues Wetterkraftwerk – also **Schwefel**. Beides liegt in Eisenhain, dazu das
dritte Kronstück. Taran soll die Stadt belagern, bis sie alles herausgibt. Als Nelia ein Lager aufschlägt, befiehlt
er Ausfälle, „bevor es wächst“.

**Karte und Start (unverändert):** Eigenes Lager mit Burg und Kaserne, Eisen- und Schwefelschacht in Reichweite;
die Bergwerksstadt (verbündet) zur Kartenmitte, davor und dahinter je ein Belagerungslager, Taran am vorderen.
10 Leibeigene, 900 Taler, Vorräte. Bekannt: Bildung, Wehrpflicht, Bauwesen. Neu freigeschaltet: Eisen- und
Schwefelgrube, Hochschule, Schießplatz, Wachturm; Forschung „Stehendes Heer“. Wetter: Frühling mit Regen, gegen Ende
ein kurzer Spätfrost.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Wahl Söldner oder Geflohene (Angebote, schließen einander aus) | Start |
| Eisen und Schwefel, Gruben auf ihren Schächten | Schritte 1 und 2 |
| Hochschule, Forschung, Gelehrte brauchen Bett und Essen | Schritt 3 |
| Schießplatz, Bogenschützen | Schritt 3 |
| Truppenarten: wer schlägt wen | Schritt 4 |
| Wachturm | Ausfälle |
| Feindlicher Held (wird bewusstlos, zieht sich zurück) | Schritt 4 |
| Regen (Bogenschützen treffen schlechter), Spätfrost | Auslöser „Wetter“ |

### Einleitung

> **Bisher:** Zwei Kronstücke von fünf hat Nelia – aus Lindgrund und aus Beaucroix. Das dritte soll im tiefsten
> Stollen von Eisenhain liegen, das fünfte trägt Malvor an einer Kette um den Hals.
>
> Das Wetterwerk ist zerstört; zum ersten Mal seit Jahren taut es im Kronland. Damit hat Malvor seine schärfste Waffe
> verloren: Wo wieder Korn wächst, muss niemand mehr für ihn arbeiten. Also greift er zum Schwert. Dafür braucht er
> Eisen – und das liegt in Eisenhain, der Stadt der Bergleute. Hauptmann Taran, Malvors bester Mann, belagert sie.
>
> In Hrimgars Plänen hat Orrin noch etwas gelesen: Wer das Wetter machen will, braucht Schwefel. Auch den gibt es in
> Eisenhain.

### Ablauf

#### Start – Zwei Wege zu Soldaten (Wahl)

- *Auslöser:* Missionsbeginn; die Stadt wird aufgedeckt, die Kamera fährt hin. Zwei Angebote erscheinen.
- *Dialog (Block 1):*
  > **Orrin:** Eisenhain. Eisen, Schwefel – und eine Armee davor. Ich hätte in Beaucroix bleiben sollen.
  >
  > **Nelia:** Eine ganze Armee gegen ein paar Bergleute?
  >
  > **Orrin:** Malvor hat seinen Winter verloren. Jetzt will er Schwerter. Und Schwefel, für ein neues Wetter.
  >
  > **Orrin:** Und man sagt, im tiefsten Stollen liegt das dritte Kronstück.
  >
  > **Nelia:** Die Bergleute halten nicht mehr lange. Wir brauchen Soldaten, Orrin.
- *Dialog (Block 2):*
  > **Orrin:** Ich kenne zwei Wege. Söldner: teuer, aber sie kämpfen sofort. Vierzehnhundert Taler.
  >
  > **Orrin:** Oder Leibeigene, die Malvor davongelaufen sind. Vierhundert für Brot und Decken. Ausbilden musst du sie selbst.
  >
  > **Nelia:** Leute, die von selbst kommen. Wenigstens kaufen wir diesmal keinen.
  >
  > **Orrin:** Nur eins von beiden, Kind. Wer Söldner hat, braucht keine Flüchtlinge – sagen die Söldner.
- *Erklärung:* Zeiger: Feld „Angebote“. Mit 900 Talern gehen die Geflohenen sofort; Söldner erst nach etwas
  Wirtschaft (Steuern, Gruben).

- **Wahl A – Söldner anheuern** (4 kampfbereite Truppen, Merker `mercs`):
  > **Orrin:** Bezahlt und bereit. Sie fragen nicht, wofür sie kämpfen.
  >
  > **Nelia:** Malvors Soldaten fragen auch nicht.
- **Wahl B – Geflohene aufnehmen** (8 Leibeigene und Vorräte, Merker `refugees`):
  > **Dorfbewohnerin:** Wir sind aus dem Kornlager getürmt. Da drin redet jeder von der Prinzessin aus Lindgrund.
  >
  > **Nelia:** Ihr arbeitet für euch selbst. Nicht für eine Prinzessin.
  >
  > **Dorfbewohnerin:** Für wen auch immer – hier gibt's Brot.

#### Schritt 1 – Eisen

- *Auslöser:* nach dem Start.
- *Ziel:* „Baue eine Eisengrube – Schwerter brauchen Eisen“
- *Warum:* Die Kaserne bildet Schwertkämpfer nur mit Talern und Eisen aus. Und jedes Stück Eisen, das wir fördern,
  hat Malvor nicht.
- *Erklärung:* wie die Lehmgrube, aber auf dem Eisenschacht. Zeiger: Kachel „Eisengrube“, Ring auf dem Schacht.
- *Dialog:*
  > **Nelia:** *(Hilfe)* Eisengrube, wie die Lehmgrube daheim – nur auf dem Eisenschacht. Der Ring zeigt ihn.
  >
  > **Orrin:** Bergleute wollen Bett und Tisch, wie alle. Vergiss die Höfe nicht.

#### Schritt 2 – Schwefel

- *Auslöser:* nach dem Start (gleichzeitig mit Schritt 1).
- *Ziel:* „Baue eine Schwefelgrube – Malvor will den Schwefel für ein neues Wetterwerk“
- *Warum:* Hrimgars Pläne sagen es: Kein Wetter ohne Schwefel. Malvor will ein neues Werk. Wer den Schwefel hat,
  entscheidet, ob es je wieder ewigen Winter gibt.
- *Erklärung:* Zeiger: Kachel „Schwefelgrube“.
- *Dialog:*
  > **Orrin:** In Hrimgars Plänen steht's auf jeder zweiten Seite: Schwefel. Ohne den kein Wetter.
  >
  > **Nelia:** Dann graben wir ihn, bevor Malvor ihn bekommt.
  >
  > **Orrin:** Und heben ihn gut auf. Wer weiß, wofür wir ihn noch brauchen.

#### Schritt 3 – Gelehrte und Bogen (optional)

- *Auslöser:* Eisengrube fertig.
- *Ziel:* „Optional: Erforsche ‚Stehendes Heer‘ in einer Hochschule – dann bildet der Schießplatz Bogenschützen aus“
- *Warum:* Tarans Lager stehen hinter Palisaden. Bogenschützen treffen aus der Ferne, ohne dass man hineinlaufen muss.
- *Erklärung:* Hochschule bauen, auswählen, unter „Forschung“ die Technik wählen; Gelehrte sind Arbeiter (Bett,
  Essen). Zeiger: Kachel „Hochschule“ (Gruppe „Verwaltung“), dann „Stehendes Heer“, dann Kachel „Schießplatz“.
- *Dialog:*
  > **Orrin:** Schwerter allein brechen keine Belagerung. In einer Hochschule tüfteln Gelehrte.
  >
  > **Orrin:** *(Hilfe)* Hochschule bauen, anklicken, unter „Forschung“ „Stehendes Heer“. Dann bildet ein Schießplatz Bogenschützen aus.
  >
  > **Nelia:** Gelehrte essen auch, oder?
  >
  > **Orrin:** Mehr als Bergleute. Denken macht hungrig.

#### Schritt 4 – Die Belagerung brechen

- *Auslöser:* Missionsbeginn (Hauptziel ab Start sichtbar).
- *Ziel:* „Brich die Belagerung von Eisenhain: besiege die Wachen beider Lager“
- *Warum:* Solange Taran vor den Toren steht, kommt kein Brot in die Stadt und kein Eisen heraus.
- *Erklärung:* Truppenarten. Zeiger: Ringe an beiden Lagern.
- *Dialog (erste eigene Truppe oder nach 3 Minuten):*
  > **Nelia:** Das vordere Lager hat Schwertkämpfer und Bogen, das hintere Speerträger.
  >
  > **Orrin:** Schwerter schlagen Speere und Bogen. Speere schlagen Reiter. Bogen treffen, bevor man sie erreicht.
  >
  > **Nelia:** Und Mut schlägt alles. Wenn ich vorne stehe.

- *Taran (Nelia kommt ans vordere Lager):*
  > **Taran:** Halt. … Ich kenne dein Gesicht. Kornlager Hagenfurt, der Holzplatz.
  >
  > **Taran:** Du bist die Tochter vom Holzfäller aus Lindgrund. Und jetzt Prinzessin?
  >
  > **Nelia:** Ich habe nie gesagt, dass ich eine bin.
  >
  > **Taran:** Aber auch nie laut genug, dass du keine bist. Geh nach Hause. Hier wird gekämpft.
  >
  > **Nelia:** Warum dienst du Malvor? Er lässt die Dörfer hungern.
  >
  > **Taran:** Unter dem gütigen König sind auch Kinder verhungert. Malvor bringt Ordnung. Volle Speicher.

- *Taran bewusstlos:*
  > **Taran:** Genug. Rückzug! … Wir sehen uns, Holzfällerstochter.
  >
  > **Orrin:** Er weiß es. Und er reitet nach Hagenfurt.
  >
  > **Nelia:** Dann haben wir nicht viel Zeit.

  Taran verlässt die Karte. Erklärung zum feindlichen Helden:
  > **Orrin:** Helden fallen nicht, auch seine nicht. Sie stehen wieder auf. Er hat nur klüger gezählt als wir.

#### Schritt 5 – Der Bergmeister

- *Auslöser:* Belagerung gebrochen.
- *Ziel:* „Schick Nelia zum Bergmeister in Eisenhain“ (nur Nelia: „Die Prinzessin soll selbst kommen.“)
- *Warum:* Die Bergleute wollen sich bedanken – und wer Eisenhain befreit hat, dem geben sie, was Malvor wollte.
- *Dialog (Ruf):*
  > **Bergmeister:** Sie ziehen ab! Kommt in die Stadt, Prinzessin. Ich hab etwas für euch.
- *Dialog (Gespräch):*
  > **Bergmeister:** Aus dem tiefsten Stollen. Das dritte Kronstück. Malvor wollte es – ihr bekommt es.
  >
  > **Bergmeister:** Für die Prinzessin. Eisenhain gibt es nur dem rechten Blut.
  >
  > **Nelia:** Bergmeister, ich muss dir etwas …
  >
  > **Orrin:** … sagen, wie dankbar sie ist! Sprachlos vor Dank. Das passiert ihr oft.
- *Dialog (5 s später, unter vier Augen):*
  > **Nelia:** Das nächste Mal sag ich's, Orrin. Ganz gleich, was du dazwischenredest.
  >
  > **Orrin:** Das nächste Mal haben wir vier Kronstücke und nichts mehr zu verlieren.

#### Die Ausfälle

- *Auslöser:* erste eigene Truppe (angeheuert oder ausgebildet), spätestens nach 10 Minuten; 2 Minuten danach,
  dann alle 5 Minuten, höchstens dreimal, solange die Belagerung steht.
- *Dialog (erster Ausfall):*
  > **Taran:** Schlagt das Lager dieser Prinzessin, bevor es wächst.
  >
  > **Nelia:** Ein Wachturm am Lager schießt, auch wenn wir weg sind.
  >
  > **Orrin:** *(Hilfe)* Wachturm im Baumenü unter „Militär“. Stein kostet er, Schlaf nicht.

#### Wetter

- *Erster Regen:*
  > **Orrin:** Regen! Seit Jahren der erste. Schön für die Felder – schlecht für Bogenschützen. Die treffen jetzt kaum.
- *Spätfrost (Winterphase gegen Ende):*
  > **Nelia:** Schnee? Ist das Werk wieder …
  >
  > **Orrin:** Nein. Nur ein gewöhnlicher Spätfrost, wie früher. Der geht vorbei. Malvors Winter ging nie vorbei.

### Nebenziele

- **Stehendes Heer** (Schritt 3).
- **Optional: Bilde 4 eigene Truppen aus** – *Warum:* Die Bergleute vertrauen einem Heer, das bleibt.
  *Erfüllt:* 300 Eisen.
  > **Bergmeister:** Gute Leute, die da bei euch stehen. Nehmt Eisen für ihre Klingen.

### Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Eisenhain öffnet die Tore, und Malvor bekommt Eisen, Schwefel und das
  dritte Kronstück.“

### Abschluss

> Eisenhain ist frei. Der Bergmeister lässt die Schmieden anheizen, und zum ersten Mal seit Monaten fährt Eisen aus
> dem Berg, das nicht nach Hagenfurt geht. Den Schwefel lässt Nelia in Fässer füllen und gut verwahren.
>
> *(Söldner: Der Bergmeister mustert die Söldner. „Geld kämpft auch“, sagt er. „Aber es bleibt nicht.“)*
> *(Geflohene: Die Geflohenen aus dem Kornlager bleiben in Eisenhain und graben. „Für uns selbst“, sagen sie, wie
> Nelia es ihnen gesagt hat.)*
>
> Drei Kronstücke von fünf. Nelia sieht Taran nach, wie er mit dem Rest seiner Leute nach Norden abzieht. „Er sah
> nicht aus wie einer, der gern kämpft“, sagt sie.
>
> Am selben Abend steht Taran vor Malvor in Hagenfurt und erstattet Bericht, wie es seine Pflicht ist. Er erzählt
> alles. Auch von einem Gesicht vom Holzplatz des Kornlagers. Malvor hört zu, lächelt und lässt seinen Herold rufen.

*Antwort:* Eisenhain ist frei, das dritte Kronstück gehört Nelia. Ihr Geheimnis nicht mehr.

---
## Mission 5 – Morvale: „Nicht deinem Blut“

**Dramatische Frage:** Folgen die Moordörfer Nelia noch, wenn sie wissen, dass sie keine Prinzessin ist?

**Beats:** All Is Lost (Herold) · Dark Night of the Soul (Orrin will gehen) · Break into Three (Lieferungen,
Tarans Weigerung, Erlenhof).

**Malvors Ziel hier:** Morvale unterwerfen und das vierte Kronstück holen. Seine Logik: Nelia muss er nicht
schlagen, nur **entzaubern** – die Wahrheit ist billiger als ein Heer. Danach sollen Tarans Leute die Höfe der
Moordörfer verbrennen: Wer kein eigenes Korn mehr hat, muss seins essen, und wer seins isst, gehorcht.

**Karte und Start (unverändert):** Eigenes Lager mit Kaserne; drei Moordörfer (Moorbrook, Schilfheim, Erlenhof) im
Halbkreis, anfangs verbündet; zwei Trupps Speerträger der Dörfer bewachen Nelias Lager; Tarans Lager hinter
Moorbrook. 12 Leibeigene, 800 Taler, kein Eisen. Schächte: Lehm, Stein, Eisen. Gebäude wie in Mission 4.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Diplomatie: verbündet, neutral, feindlich – was das heißt | Herold |
| Lieferungen an Dörfer (Angebote) | Schritt 2 |
| Taran als eigener Held: „Schildstoß“, „Einschüchtern“ | Schritt 3 |
| Gebäude anderer schützen (Ziel scheitert, wenn alle fallen) | Schritt 3 |

### Einleitung

> **Bisher:** Drei Kronstücke von fünf hat Nelia – aus Lindgrund, Beaucroix und Eisenhain. Das vierte verwahrt die
> Dorfälteste von Erlenhof in Morvale. Das fünfte trägt Malvor an einer Kette um den Hals.
>
> Die Moordörfer – Moorbrook, Schilfheim, Erlenhof – haben nie einem Herrn gehorcht. Nelia folgen sie, weil sie die
> verlorene Prinzessin sein soll. Malvor lässt sie hungern, damit sie sich ihm unterwerfen, und hinter Moorbrook
> lagert Hauptmann Taran mit seinen Leuten.
>
> Aus Hagenfurt reitet ein Herold heran. Nelia weiß, was er verkünden wird. Taran hat sie in Eisenhain erkannt.

### Ablauf

#### Start – Bevor der Herold kommt (Wahl)

- *Auslöser:* Missionsbeginn. Die Dorfälteste von Moorbrook bekommt ein Ausrufezeichen.
- *Dialog:*
  > **Dorfälteste:** Prinzessin! Morvale steht zu dir. Unsere Speerträger halten Wache an deinem Lager.
  >
  > **Orrin:** Seht ihr? Königsblut öffnet Türen. Und Speicher.
  >
  > **Nelia:** Orrin. Hör auf. Der Herold kommt, und er weiß, wer ich bin.
  >
  > **Nelia:** Ich sag es ihnen selbst. Jetzt. Bevor es ein anderer tut.
  >
  > **Orrin:** Bist du verrückt? Nach der Ernte! Nach dem fünften Kronstück! Irgendwann!
  >
  > **Nelia:** Das hast du in Eisenhain auch gesagt.
- *Ziel:* „Optional: Bring Nelia zur Dorfältesten von Moorbrook, bevor Malvors Herold da ist“ (Fortschritt zeigt die
  verbleibende Zeit)
- *Warum:* Dieselbe Wahrheit wiegt anders, je nachdem, wer sie sagt.
- ⚠ Änderung: neue Gesprächsfigur (Dorfälteste von Moorbrook, nur Nelia) mit Frist bis zum Herold (2,5 Minuten);
  hat Nelia vorher mit ihr gesprochen, bleibt Moorbrook verbündet und seine Speerträger bleiben im Lager. Begründung:
  Nelias Wachstum wird zur Spielerhandlung, und Ehrlichkeit hat einen spürbaren Lohn.

- **Wahl A – Nelia sagt es selbst** (Merker `confessed`):
  > **Nelia:** Ich bin keine Prinzessin. Ich bin die Tochter eines Holzfällers aus Lindgrund.
  >
  > **Nelia:** Orrin hat's erfunden, und ich hab geschwiegen, weil es geholfen hat. Das war falsch.
  >
  > **Dorfälteste:** Eine, die die Wahrheit sagt, bevor sie muss. Das ist mehr wert als Blut. Moorbrook bleibt.
  >
  > **Orrin:** *(leise)* Gratuliere. Ein Dorf von dreien. Den Rest erledigt jetzt der Herold.

#### Schritt 1 – Der Herold (All Is Lost)

- *Auslöser:* 150 Sekunden nach Start.
- **Fassung A (Nelia hat es schon gesagt):**
  > **Herold:** Hört, Leute von Morvale! Die „Prinzessin“ ist die Tochter eines Holzfällers aus Lindgrund!
  >
  > **Dorfälteste:** Wissen wir. Sie hat's uns selbst gesagt.
  >
  > **Herold:** Dann folgt ihr einer, die sich ertappt fühlt. Ein Händler hat die Lüge erfunden – für Geld.
  >
  > **Herold:** Und das Kronstück in Erlenhof gehört dem Statthalter. Gebt es heraus!

  Schilfheim und Erlenhof werden neutral.
- **Fassung B (der Herold sagt es):**
  > **Herold:** Hört, Leute von Morvale! Die „Prinzessin“ ist die Tochter eines Holzfällers aus Lindgrund!
  >
  > **Herold:** Ein Händler hat die Lüge erfunden, um Geld zu machen. Wer ihr folgt, folgt einem Märchen.
  >
  > **Herold:** Und das Kronstück in Erlenhof gehört dem Statthalter. Gebt es heraus!
  >
  > **Nelia:** Es stimmt. Ich bin keine Prinzessin. Ich hab's von Anfang an gesagt. Nur zu leise.
  >
  > **Orrin:** Nelia … nein.
  >
  > **Dorfälteste:** Unsere Speerträger gehen heim. Wir wissen nicht mehr, wem wir glauben sollen.

  Alle drei Dörfer werden neutral, die Speerträger der Dörfer verlassen das Lager.
- *Erklärung (Hilfe, gleich danach):*
  > **Orrin:** *(Hilfe)* Neutral heißt: Sie greifen nicht an, aber sie helfen nicht und zeigen uns nichts mehr.

#### Dark Night of the Soul

- *Auslöser:* 4 Sekunden nach dem Herold.
- *Dialog:*
  > **Orrin:** Das ist meine Schuld. Ohne mich wärst du eine Leibeigene, die heimgekehrt ist. Mehr nicht.
  >
  > **Nelia:** Ohne dich hätte mir in Lindgrund keiner zugehört. Das ist auch wahr.
  >
  > **Orrin:** Ich geh zurück nach Beaucroix. Ein Händler weniger, eine Lüge weniger.
  >
  > **Nelia:** Du bleibst. Du schuldest mir noch ein Brot.
  >
  > **Nelia:** Wir fangen von vorn an. Wie in Lindgrund: Dach, Tisch, Arbeit. Ohne Geschichte.
  >
  > **Orrin:** Ohne Geschichte. Das hab ich noch nie verkauft.
- *Mit Kampagnen-Merkern (K1), eine Zeile vorn angehängt:*
  - M1 Wahl B: **Nelia:** „Die Alte in Lindgrund hat mir geglaubt, als ich die Wahrheit sagte. Die hier werden es auch.“
  - M1 Wahl A: **Nelia:** „Schon in Lindgrund hab ich dich reden lassen. Hier nicht mehr.“

#### Schritt 2 – Lieferungen (Break into Three)

- *Auslöser:* nach der Dark Night. Drei Angebote erscheinen (bzw. zwei, wenn Moorbrook verbündet blieb).
- *Ziel:* „Gewinne die Dörfer durch Lieferungen zurück (verbündete Dörfer: 1 von 3 …)“
- *Warum:* Die Dörfer folgen dem, der sie satt macht und Wort hält. Malvor fordert, Nelia liefert – ohne etwas zu
  verlangen. Moorbrook braucht Dächer (Holz, Lehm), Schilfheim einen Deich (Stein, Eisen), Erlenhof Saatgut und eine
  Scheune (Taler, Lehm).
- *Erklärung:* Lieferungen sind Angebote; Eisen muss erst gefördert werden. Zeiger: Feld „Angebote“; Ring auf dem
  Eisenschacht.
- *Dialog:*
  > **Nelia:** Sie wollen keine Prinzessin. Sie wollen Dächer, einen Deich und Saatgut.
  >
  > **Orrin:** Liefern. „Wer liefert, dem glaubt man“, hat der Kaufmann in Beaucroix gesagt.
  >
  > **Nelia:** Gesagt hat er's zu dir. Bezahlt hab ich.
  >
  > **Orrin:** *(Hilfe)* Die Lieferungen stehen bei den Angeboten. Bezahlen heißt: Die Ware geht sofort ins Dorf.
  >
  > **Nelia:** Für den Deich brauchen wir Eisen, und wir haben keins. Eine Eisengrube auf den Schacht, schnell.
- *Je Lieferung (Dorf wird wieder verbündet):*
  - Moorbrook: **Dorfbewohnerin:** „Ihr habt geliefert, ohne etwas zu verlangen. Moorbrook steht zu euch.“
  - Schilfheim: **Dorfbewohnerin:** „Der Deich hält wieder. Schilfheim vergisst das nicht.“
  - Erlenhof: **Dorfälteste:** „Saatgut von einer Leibeigenen. Das hat uns noch kein König geschickt.“

#### Schritt 3 – Der Befehl (Taran läuft über)

- *Auslöser:* erste Lieferung, spätestens 5 Minuten nach dem Herold (Meilenstein). Kamera auf Moorbrook.
- *Dialog (Block 1):*
  > **Herold:** Hauptmann Taran! Befehl des Statthalters: Brennt die Höfe von Moorbrook nieder.
  >
  > **Herold:** Wer Morvale satt macht außer Malvor, ist ein Feind. Wer nichts zu essen hat, gehorcht.
  >
  > **Taran:** … Nein. Ich habe ein Dorf verhungern sehen. Meine Schwester war sieben.
  >
  > **Taran:** Ich zünde kein Korn an. Wer mit mir geht, kommt mit.

  Taran wechselt mit zwei Trupps auf Nelias Seite; die übrigen Getreuen marschieren auf Moorbrook.
- *Dialog (Block 2):*
  > **Taran:** Holzfällerstochter. Ich habe Malvor gesagt, wer du bist. Das war meine Pflicht.
  >
  > **Taran:** Höfe anzünden ist keine. Wo brauchst du mich?
  >
  > **Nelia:** Bei den Höfen von Moorbrook. Malvors Getreue sind schon unterwegs.
  >
  > **Orrin:** Ein Hauptmann, der Nein sagt. Seltener als jede Prinzessin.
- *Ziele:* „Schütze die Höfe von Moorbrook“ und „Vertreibe Malvors restliche Truppen“
- *Warum:* Brennen die Höfe, hungert Moorbrook – und Morvale gehört Malvor, weil nur er noch Korn hat. Die Dörfer
  sehen genau hin, wer ihre Höfe verteidigt.
- *Erklärung:* Tarans Fähigkeiten; Schutzziel. Zeiger: Tarans Bild, dann „Schildstoß“; Ring an den Höfen.
- *Dialog (Hilfe, 6 s später):*
  > **Taran:** *(Hilfe)* Wähl mich allein. „Schildstoß“, Taste X, trifft alle rundum.
  >
  > **Taran:** *(Hilfe)* „Einschüchtern“, Taste C, jagt sie eine Weile davon. Dann greifen sie nicht an.

#### Verstärkung

- *Auslöser:* 5,5 Minuten nach dem Befehl.
  > **Herold:** Verstärkung für die Getreuen! Morvale wird gehorchen!
  >
  > **Taran:** Das sind meine alten Leute. Ich kenne jeden. Lasst mich vorne stehen.

#### Schritt 4 – Erlenhof

- *Auslöser:* alle Dörfer verbündet **und** Malvors Truppen vertrieben.
- *Ziel:* „Schick Nelia zur Dorfältesten von Erlenhof“ (nur Nelia: „Nelia soll selbst kommen.“)
- *Warum:* Der Herold wollte das vierte Kronstück. Erlenhof gibt es lieber der, die geliefert hat.
- *Dialog (Ruf):*
  > **Dorfälteste:** Komm nach Erlenhof, Nelia. Der Herold wollte etwas von uns. Ich geb es lieber dir.
- *Dialog (Gespräch):*
  > **Dorfälteste:** Du hast geliefert, als dir keiner mehr etwas schuldete. Und du hast unsere Höfe gehalten.
  >
  > **Dorfälteste:** Das vierte Kronstück. Es lag bei uns, keiner weiß, seit wann.
  >
  > **Dorfälteste:** Nimm es. Wir folgen dir – nicht deinem Blut.
  >
  > **Nelia:** Ich bin eine Leibeigene.
  >
  > **Dorfälteste:** Dann wird es Zeit, dass mal eine gefragt wird.
- *Mit K1 (M2 Steuern), eine Zeile davor:*
  - niedrig: **Dorfälteste:** „Man erzählt, in Beaucroix hast du den Leuten mehr gelassen als jeder Statthalter.“
  - hoch: **Dorfälteste:** „Man erzählt, in Beaucroix hast du genommen wie Malvor. Hier hast du gegeben. Das zählt.“

### Nebenziele

- **Optional: Baue 4 eigene Bauernhöfe** – *Warum:* Wer selbst Korn hat, muss das der Dörfer nicht nehmen.
  *Erfüllt:* 400 Taler.
  > **Dorfbewohnerin:** Wer selbst Korn anbaut, will uns unseres nicht wegnehmen.

### Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Morvale gehorcht Malvor – aus Hunger.“
- *Höfe von Moorbrook verbrannt:* „Die Höfe von Moorbrook sind niedergebrannt. Wer jetzt essen will, muss zu Malvor.
  Die Dörfer werden Nelia nie wieder folgen.“

### Abschluss

> Taran steht abseits am Feuer. Er hat nicht gelächelt, seit er hier ist. Aber er ist geblieben, und seine Leute mit
> ihm. Orrin setzt sich zu ihm und bietet ihm Knöpfe an. Taran nimmt einen. Keiner von beiden weiß, warum.
>
> *(Wahl A: In Moorbrook sagen sie: Die Leibeigene hat's selbst gesagt, bevor einer sie zwingen konnte.)*
> *(Wahl B: In Morvale sagen sie: Die Leibeigene hat nicht gelogen, als es ihr geschadet hätte.)*
>
> Vier Kronstücke von fünf. In der Nacht bringt ein Bote ein Schreiben mit Malvors Siegel. Nur drei Zeilen: „Vier
> hast du. Das fünfte trage ich. Komm und hol es dir – der See ist tief.“
>
> Nelia gibt das Schreiben Taran. „Du kennst sein Schloss.“ – „Mitten im Thronsee“, sagt Taran. „Keine Brücke, kein
> Boot. Im Winter trägt der See. Aber Winter gibt es nicht mehr.“ Orrin zieht Hrimgars Pläne aus der Tasche.
> „Noch nicht.“

*Antwort:* Ja – die Dörfer folgen ihr wieder, diesmal ihrer Taten wegen.

---
## Mission 6 – Der Thronsee: „Krone aus Eis“

**Dramatische Frage:** Kann Nelia Malvor das fünfte Kronstück nehmen, ohne so zu werden wie er?

**Beats:** Finale in fünf Schritten – 1. Team und Plan · 2. Ausführung (der See friert) · 3. Überraschung (Malvors
Tauwetter, Orrin bricht ein) · 4. ohne Mentor weiter · 5. neuer Plan und Sturm. Final Image im Abschluss.

**Malvors Ziel hier:** Das Schloss halten und das fünfte Kronstück behalten. Er wartet: Sein Kraftwerk ist geladen,
und wer aufs Eis tritt, ertrinkt, sobald er taut. Seine Garde aus Hagenfurt greift Nelias Ufersiedlung an, sobald
sie mit der Wetterforschung beginnt. Seine Logik ist dieselbe wie immer: Menschen sind Mittel. Er rechnet damit,
dass Nelia ebenso rechnet.

**Karte und Start (unverändert):** Nelias Ufersiedlung (Burg, Wohnhaus, Hof, Hochschule, Kaserne,
Alchimistenhütte), der Thronsee mit dem Inselschloss, davor die kleine Werkinsel mit Malvors Wetterkraftwerk (voll
geladen); Sommer. 16 Leibeigene, 1500 Taler, 600 Schwefel (aus Eisenhain), reichlich Baustoffe. Helden: Nelia,
Orrin, Taran. Alles ist freigeschaltet.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Alles freigeschaltet – kein grauer Knopf mehr | Start |
| Forschung in einer Werkstatt (Alchimistenhütte) | Schritt 1 |
| Ausbau einer Werkstatt für die nächste Forschung (Laboratorium) | Schritt 1 |
| Wissen kaufen statt forschen (Wahl) | Start, Schritt 1 |
| Wetterkraftwerk, Wettertechniker, Wetterenergie | Schritt 2 |
| Wetter herbeiführen; 3 Minuten Winter, danach Sperre | Schritt 3 |
| Ladebalken eines gegnerischen Kraftwerks | Start, Nebenziel |
| Fernkampf vom Ufer auf eine Insel | Schritt 4 |
| Malvors Fähigkeiten (Feldgeschütz, Fußangeln) | Schritt 6 |

### Einleitung

> **Bisher:** Vier Kronstücke von fünf hat Nelia – aus Lindgrund, Beaucroix, Eisenhain und Morvale. Die Dörfer
> folgen ihr, obwohl sie wissen, dass sie keine Prinzessin ist. Hauptmann Taran ist mit seinen Leuten übergelaufen.
> Das fünfte Kronstück, das von Hagenfurt, trägt Malvor an einer Kette um den Hals.
>
> Er hat sich im Inselschloss verschanzt, mitten im Thronsee, wo einst König Edrian residierte. Es ist Sommer. Kein
> Boot kommt hinüber, keine Brücke führt hin. Im Winter aber trägt der See.
>
> Nelia hat Hrimgars Pläne und den Schwefel aus Eisenhain. Damit kann sie ein eigenes Wetterkraftwerk bauen und den
> Thronsee zufrieren lassen. Doch Malvor kennt dieselbe Kunst: Auf einer kleinen Insel vor seinem Schloss steht
> sein eigenes Kraftwerk. Hinter dem See liegen seine Kornlager. Dort schlägt Nelias Vater Holz für die Öfen.

### Ablauf

#### Start – Malvor spricht (Team und Plan)

- *Auslöser:* Missionsbeginn; die Inseln werden aufgedeckt, die Kamera fährt zum Schloss. Angebot „Wissen der
  Gelehrten kaufen“ erscheint.
- *Dialog (Block 1):*
  > **Malvor:** Nelia aus Lindgrund. Eine Leibeigene mit einem Händler und einem Verräter.
  >
  > **Malvor:** Vier Kronstücke hast du gesammelt. Das fünfte trage ich. Komm und hol es dir.
  >
  > **Malvor:** Aber der See ist tief, Mädchen. Und das Wetter gehorcht mir.
  >
  > **Nelia:** Hinter dem See sind seine Kornlager. Vater ist da drin.
  >
  > **Taran:** Der See ist tief. Aber im Winter trägt er.
  >
  > **Orrin:** Und Winter kann man machen. Hrimgars Pläne, Nelia. Dafür haben wir sie geholt.
- *Dialog (Block 2):*
  > **Taran:** Malvor hat sein eigenes Kraftwerk. Dort, auf der kleinen Insel vor dem Schloss.
  >
  > **Taran:** Ist es geladen, taut er den See, sobald einer von uns aufs Eis tritt.
  >
  > **Taran:** Aber vom Ufer treffen es Bogenschützen. Kanonen auch, wenn ihr die Zeit habt.
  >
  > **Orrin:** Für unser Kraftwerk brauchen wir Alchimisten, Schwefel, Geduld. Oder Geld.
  >
  > **Orrin:** Ich kenne Gelehrte in Beaucroix. Achtzehnhundert Taler, und sie schenken uns ein halbes Jahr Tüftelei.
  >
  > **Nelia:** Und lernen wir's selbst, bleiben die Taler für Soldaten. Beides auf einmal geht nicht.
- *Erklärung:* Zeiger: Feld „Angebote“; dann die Alchimistenhütte. Malvors Ladebalken steht beim Nebenziel.

#### Schritt 1 – Wetterkunde (Wahl: kaufen oder forschen)

- *Auslöser:* nach dem Start.
- *Ziele (nacheinander, nur auf dem Forschungsweg sichtbar; der Kauf erfüllt sie auf einmal):*
  1. „Erforsche ‚Wettervorhersage‘ in der Alchimistenhütte“
  2. „Baue die Alchimistenhütte zum Laboratorium aus“
  3. „Erforsche ‚Meteorologie‘ im Laboratorium“
- *Warum:* Erst wer das Wetter versteht, kann es machen. Jede Stufe kostet Schwefel – den Schwefel, den Malvor in
  Eisenhain nicht bekommen hat.
- *Erklärung:* Werkstattforschung; Ausbau als Voraussetzung; Alchimisten sind Arbeiter (Bett, Essen). Zeiger:
  Alchimistenhütte, dann „Technologien“ → „Wettervorhersage“, später „Ausbauen“, dann „Meteorologie“.
- *Dialog (Forschungsweg, 20 s nach Start, wenn nicht gekauft):*
  > **Orrin:** *(Hilfe)* Alchimistenhütte anklicken. Unter „Technologien“ steht „Wettervorhersage“. Kostet Schwefel.
  >
  > **Orrin:** Ohne Alchimisten forscht keiner. Und Alchimisten wollen essen. Wie immer.
- *„Wettervorhersage“ fertig:*
  > **Orrin:** *(Hilfe)* Für „Meteorologie“ braucht's ein Laboratorium. Hütte anklicken, „Ausbauen“.
  >
  > **Nelia:** Hrimgar hat Jahre gebraucht. Wir haben Hagenfurts Garde im Nacken.
- **Wahl A – Wissen kaufen** (1800 Taler, 400 Schwefel; Merker `knowledgeBought`):
  > **Gelehrte:** Hrimgars Zeichnungen sind wirr, aber vollständig. Ihr könnt sofort bauen.
  >
  > **Orrin:** Teuer, ja. Aber Zeit ist das Einzige, was man nicht nachkaufen kann.
- **Wahl B – selbst forschen:** günstiger, langsamer; das Gold bleibt für Truppen.
- *Malvors Garde (Meilenstein: Wettervorhersage erforscht oder gekauft, spätestens nach 10 Minuten; danach alle
  5 Minuten):*
  > **Malvor:** Hagenfurts Garde! Zeigt dieser Bauernmagd, was Ordnung heißt.
  >
  > **Taran:** Sie kommen über Land, von Norden. Wachtürme dort, und eine Truppe, die hält.

#### Schritt 2 – Das Wetterkraftwerk

- *Auslöser:* „Meteorologie“ erforscht oder gekauft.
- *Ziel:* „Baue das Wetterkraftwerk – drei Wettertechniker brauchen Bett und Essen“
- *Warum:* Erst mit dem eigenen Kraftwerk kann Nelia den See frieren lassen. Und erst wenn sie das kann, muss Malvor
  sein eigenes einsetzen.
- *Erklärung:* Kachel „Wetterkraftwerk“ (Gruppe „Verwaltung“); Wettertechniker sammeln Energie, nur mit Bett und
  Essen schnell.
- *Dialog:*
  > **Orrin:** Röhren, Kessel, Zahnräder. Genau wie auf Hrimgars Blättern. Nur diesmal gehört es uns.
  >
  > **Nelia:** Und diesmal hungert keiner dafür.
  >
  > **Orrin:** *(Hilfe)* Wetterkraftwerk unter „Verwaltung“. Drei Wettertechniker ziehen ein. Ohne Bett laden sie langsam.

#### Schritt 3 – Winter (Ausführung)

- *Auslöser:* Wetterkraftwerk fertig.
- *Ziel:* „Lass den Thronsee zufrieren (Wetterkraftwerk wählen, Ladung abwarten → ‚Wetter herbeiführen‘ → Winter)“
- *Warum:* Nur im Winter führt ein Weg zum Schloss.
- *Erklärung:* Ladebalken, Wetterwechsel, Dauer und Sperre. Zeiger: „Wetterenergie“, dann „Wetter herbeiführen“ →
  Winter.
- *Dialog:*
  > **Orrin:** *(Hilfe)* Kraftwerk anklicken. Der Balken zeigt die Ladung. Ist er voll: „Wetter herbeiführen“, Winter.
  >
  > **Taran:** Drei Minuten Winter, dann taut es, und das Kraftwerk muss neu laden. Wer dann auf dem Eis steht …
  >
  > **Nelia:** … ertrinkt. Ich weiß. Ich war im Tal.
- *Winter (Merker `frozen`):*
  > **Taran:** Der See trägt. Aber seht auf sein Kraftwerk. Solange es geladen ist, taut er, sobald wir drauf sind.
  >
  > **Nelia:** Dann zerschießen wir es vom Ufer. Oder wir warten, bis er leer ist, und frieren nach.
  >
  > **Orrin:** Oder ein Leibeigener läuft vor, und Malvor verschießt sein Pulver an einem einzigen Mann.
  >
  > **Nelia:** Einen Menschen als Köder?
  >
  > **Orrin:** Du hast gefragt, was geht. Nicht, was schön ist.

#### Schritt 4 – Malvors Tauwetter (Überraschung, Wahl)

- *Auslöser:* Jemand von uns steht auf dem gefrorenen See, und Malvors Kraftwerk ist geladen und bereit
  (unverändert: derselbe Befehl wie beim Spieler).
- **Wahl A – Köder** (Leibeigene oder Truppen aufs Eis, um ihn zum Tauen zu bringen): Wer auf dem Eis steht, ertrinkt;
  danach muss Malvor laden und drei Minuten warten. Merker `drowned`, sobald eigene Figuren ertrunken sind.
- **Wahl B – vom Ufer:** Bogenschützen (später Kanonen) beschießen sein Kraftwerk von einer Uferstelle in Reichweite;
  im Sommer kann niemand es reparieren. Ist es zerstört, gehört der Winter Nelia allein.
- *Dialog (jedes Tauwetter):*
  > **Malvor:** Tauwetter!
- *Erstes Tauwetter:*
  > **Orrin:** Sein Kraftwerk ist leer. Jetzt muss er laden und warten – wie wir.
  >
  > **Taran:** Frieren wir nach, sobald unseres bereit ist, kann er nichts tun. Drei Minuten lang.
- *Erste eigene Ertrunkene (Merker `drowned`):*
  > **Nelia:** Sie sind ertrunken. Für einen Schritt aufs Eis.
  >
  > **Taran:** So gewinnt man Kriege. Ich hab's oft genug gesehen.
  >
  > **Nelia:** So rechnet Malvor. Ich will nicht so rechnen.
  >
  > **Orrin:** *(falls noch da)* Ich rechne mit Talern. Die ertrinken wenigstens nicht.
- *Sein Kraftwerk zerstört:*
  > **Malvor:** Mein Kraftwerk! Ihr wisst nicht, was ihr zerstört!
  >
  > **Nelia:** Doch. Hrimgars Winter. Zum zweiten Mal.

#### Schritt 5 – Orrin bricht ein (feste Szene)

- *Auslöser (unverändert):* Winter und unser Heer erreicht den Ring um das Inselschloss.
  ⚠ Änderung, zusätzlicher Auslöser: Malvor taut den See, während Orrin selbst auf dem Eis steht – was zuerst
  eintritt. Begründung: Die Vorgabe „Malvor taut den See mit seinem eigenen. Orrin bricht ein“ soll kausal sein,
  wo sie es sein kann. Der Held wird ohnehin vom Eis gerettet (Sim setzt ihn an die Burg); die Szene macht daraus
  die Verwundung.
- *Dialog (Fassung Tauwetter):*
  > **Orrin:** Nelia! Das Eis … es bricht!
- *Dialog (Fassung Sturm – Malvors Leute haben am Schloss Löcher ins Eis geschlagen):*
  > **Orrin:** Nelia! Hier ist das Eis dünn – sie haben Löcher geschlagen …
- *Weiter (beide Fassungen):*
  > **Taran:** Ich hab ihn! Er lebt. Aber er ist schwer verwundet.
  >
  > **Orrin:** Nicht umkehren. Ich hab schon angezahlt. Mit einem Bein.
  >
  > **Nelia:** Bringt ihn ans Ufer. Das war mein Befehl. Ich bring's zu Ende.
  >
  > **Taran:** Dann geh vorne. Und mach ihnen Mut. Heute zählt jeder Schlag doppelt.

  Orrin verlässt das Spiel (unverändert).

#### Schritt 6 – Das Inselschloss (Sturm)

- *Auslöser:* Missionsbeginn (Hauptziel ab Start sichtbar).
- *Ziel:* „Erobere das Inselschloss“
- *Warum:* Am Hals des Mannes darin hängt das fünfte Kronstück. Und hinter ihm stehen die Kornlager offen, sobald er
  fällt.
- *Erklärung:* Burgen fallen nur mit vielen Truppen, „Mut machen“ oder Kanonen. Malvors Fähigkeiten.
- *Malvor stellt ein Geschütz auf / legt eine Falle (erstes Mal):*
  > **Taran:** Ein Feldgeschütz! Erst das Geschütz, dann ihn.
  >
  > **Taran:** Und seht, wohin ihr tretet. Er legt Fußangeln.
- *Schloss unter halber Kraft:*
  > **Malvor:** Ich habe dieses Land vor dem Chaos bewahrt. Unter Edrian verhungerten sie. Unter mir gehorchen sie und essen.
  >
  > **Nelia:** Du hast es hungern lassen, damit es gehorcht.
  >
  > **Malvor:** Und dir? Wer folgt einer Leibeigenen mit einer Lüge?
  >
  > **Nelia:** Die, die ich satt gemacht habe.
  >
  > **Nelia:** Und Edrian? Der Sturm mitten im Sommer?
  >
  > **Malvor:** Stürme kommen, Mädchen. Man muss nur bereit sein.

### Nebenziele

- **Optional: Zerstöre Malvors Wetterkraftwerk** (Balken: seine Ladung) – siehe Schritt 4, Wahl B.
- **Optional: Zerstöre Malvors Turm am Ufer der Insel** – *Warum:* Er schießt auf jeden, der übers Eis kommt.
- **Optional: Stelle ein Heer aus 8 Truppen auf** – *Erfüllt:* 500 Taler.
  > **Taran:** Gute Leute. Sie wissen, wofür sie kämpfen. Das wussten meine nie.

### Niederlage

- *Burg gefallen:* „Die Ufersiedlung ist gefallen. Malvor trägt bald fünf Kronstücke, und niemand wird ihm je wieder
  widersprechen.“

### Abschluss (Finale und Final Image)

> Das Inselschloss ist gefallen. Taran bringt Malvor in Ketten über das Eis, und Nelia nimmt ihm die Kette vom Hals.
> Fünf Kronstücke von fünf. Malvor sagt kein Wort. Über ihn sollen die Provinzen richten, nach altem Recht, nicht
> eine Königin allein.
>
> Nach dem alten Recht krönen die Provinzen Nelia zur Königin des Kronlands. Die Dorfälteste aus Lindgrunds
> Nachbardorf ist da, der Kaufmann aus Beaucroix, der Bergmeister aus Eisenhain, die Älteste von Erlenhof – und für
> Hagenfurt Hauptmann Taran, weil die Leute aus den Kornlagern ihn darum gebeten haben. Keiner von ihnen sagt
> „Prinzessin“.
>
> *(Wissen gekauft: Die Gelehrten aus Beaucroix schicken eine Rechnung. Orrin bezahlt sie mit Vergnügen – mit
> Talern der Krone.)*
>
> Orrin erlebt die Krönung noch, auf einer Trage in der ersten Reihe. In der Nacht ruft er Nelia. „Das Brot aus
> Lindgrund“, flüstert er. „Ich hab's nie verbucht. Jetzt sind wir quitt.“ Er lacht noch einmal. „Einmal hab ich
> eine Prinzessin verkauft, die ich nicht hatte. Jetzt hab ich eine Königin. Bestes Geschäft meines Lebens.“
> Gegen Morgen ist er still.
>
> Am nächsten Tag spricht Königin Nelia ihr erstes Gesetz: „Im Kronland kauft keiner mehr einen Menschen. Auch ich
> nicht mehr. Ich hab es oft genug getan.“ Taran öffnet Malvors Kornlager. „Volle Speicher“, sagt er. „Für alle.“
> Das Wetterkraftwerk bleibt stehen, aber es gehört keinem mehr allein: Die fünf Provinzen entscheiden gemeinsam, wann
> es eine Missernte abwendet.
>
> *(Köder ertrunken: Ihr zweites Gesetz: „Keine Krone schickt mehr Menschen aufs Eis, um zu gewinnen.“ Sie hat es
> getan, sagt sie, einmal. Das reicht für ein ganzes Leben.)*
> *(Mit K1, M5 Wahl A: „Ich hab in Moorbrook die Wahrheit gesagt, bevor ich musste“, sagt sie zu den Ältesten. „So
> will ich es halten.“)*
>
> Im Frühling geht Nelia nach Lindgrund. Aus jedem Schornstein steigt Rauch. Ein Hund bellt. Unter dem alten Baum am
> Waldrand schlägt ein Mann Holz – ihr Vater, frei, mit grauem Bart. Sie will ihn fragen, wie das Kronstück unter
> seinen Baum gekommen ist.
>
> Sie fragt nicht. Es spielt keine Rolle mehr.
>
> **Ende der Kampagne „Krone aus Eis“ – danke fürs Spielen!**

*Antwort:* Ja – Malvor ist gefallen, die Krone vereint, und Nelia herrscht nicht wie er. Es hat Orrin das Leben
gekostet.

---
# Teil 3 – Prüfliste

## Wo wird was zum ersten Mal erklärt?

Kennungen in der letzten Spalte sind `data-testid`-Werte für `hint.ui` (Zeiger). „Ring“ = Zielort auf der Karte
(`hint.area`/`hint.entity`).

| Steuerung / Mechanik | Erstmals | Wer erklärt | Zeiger |
|---|---|---|---|
| Kamera schieben, drehen, zoomen | M1 Start / Schritt 1 (Hilfe) | Orrin | – |
| Held auswählen, laufen lassen | M1 Schritt 1 | Orrin | `quick-hero-nelia`, Ring am Fremden |
| Gesprächsfigur (Ausrufezeichen) ansprechen | M1 Schritt 1–2 | Orrin (Ziel) | Ring an der Figur |
| Ziele-Liste, „Ziel zeigen“, goldener Ring | M1 Schritt 3 | Orrin | `objective-go-root` (Handy: `objectives-toggle`) |
| Leibeigene auswählen („Alle“, Rahmen) | M1 Schritt 4 | Orrin | `quick-all` (Handy über `minimap-toggle`) |
| Holz abbauen (Haufen, Bäume), Vorrat oben | M1 Schritt 4 | Orrin | Ring an den Balken, `res-bar` |
| Baumenü öffnen, Gebäude setzen, „Hier bauen“ | M1 Schritt 5 | Orrin | `serf-build`, `build-villageCenter`, `place-confirm` |
| Siedlungsplatz (nur dort Dorfzentrum) | M1 Schritt 5 | Orrin | Ring auf den Grundmauern |
| Mehr Bauleute = schneller | M1 Schritt 5 | Orrin | – |
| Dorfzentrum: ohne es keine Arbeiter | M1 Schritt 5 | Orrin | – |
| Ausgegraute Gebäude | M1 Schritt 6 | Orrin | – |
| Wohnhaus: Betten | M1 Schritt 6 | Orrin, Nelia | `build-residence` |
| Lagerfeuer zeigen, was fehlt | M1 Auslöser „Erstes Lagerfeuer“ | Orrin | – |
| Bauernhof: Essen | M1 Schritt 7 | Orrin, Nelia | `build-farm` |
| Arbeiter kommen von selbst, wenn es Arbeit gibt | M1 „Erster Arbeiter“, Schritt 8 | Orrin | – |
| Schacht und Grube | M1 Schritt 8 | Orrin | `build-clayMine`, Ring am Schacht |
| Zahltag, Steuern, Taler | M1 „Zahltag“ | Orrin | `payday` |
| Burg auswählen, Leibeigene kaufen | M1 „Zahltag“, Nebenziel | Orrin | `quick-hq`, `buy-serf` |
| Zweiten Helden wählen, bestimmter Held für ein Gespräch | M1 Nebenziel „Nachbardorf“ | Orrin | `quick-hero-orrin` |
| Verbündete | M1 Nebenziel | (Abschluss) | – |
| „Zu den Waffen!“, Miliz, angreifen | M1 Schritt 9 | Orrin | `quick-hq`, `militia` |
| Heldenfähigkeit („Mut machen“) | M1 Schritt 9 | Orrin | `ability-courage` |
| Helden bewusstlos statt tot | M1 Schritt 9 | Orrin | – |
| „Entwarnung“ | M1 Schritt 9 (Sieg) | Orrin | `militia-off` |
| Angebote (Tribute), bezahlen | M2 Schritt 2 | Orrin | `tributes-toggle`, `tribute-pay-clay` |
| Ausbauen (ohne Leibeigene) | M2 Schritt 4 | Orrin | `upgrade` |
| Händler sind Arbeiter | M2 Schritt 1/5 | Orrin | – |
| Marktplatz: tauschen, Preise | M2 Schritt 5 | Orrin | `market-give-clay`, `market-take-gold`, `trade-go` |
| Zwei Angebote schließen einander aus | M2 Schritt 6 | Orrin | `tributes-toggle` |
| Kaserne, „Volle Einheit“, Sold | M2 Schritt 6 | Nelia, Orrin | `build-barracks`, `recruit-full-sword` |
| Alle Truppen wählen, angreifen, Angriffsbewegung | M2 Weg „Sturm“ (spätestens M3 Start) | Nelia | `quick-army`, `order-attack` |
| Steuern einstellen, Stimmung | M2 Schritt 7 | Orrin, Nelia | `quick-hq`, `tax-3`/`tax-1`, `motivation` |
| „Wundsalbe“ | M2 erster Überfall | Orrin | `ability-salve` |
| Reparieren | M2 Auslöser „Es brennt“ | Nelia | `repair` |
| Mission ohne Burg | M3 Start | Nelia | – |
| „Weitblick“ | M3 Schritt 1 | Nelia | `quick-hero-nelia`, `ability-farsight` |
| Eis trägt im Winter | M3 Schritt 1–2 | Orrin | Ring an der Schlucht |
| „Bestechen“ | M3 Schritt 2 (Schlucht) | Orrin | `ability-bribe` |
| Steuergruppen | M3 Schritt 2 (Hilfe) | Orrin | `group-save` |
| Tauwetter | M3 Start, Schritte 4–5 | Orrin | Ring am Ufer |
| Gefangene befreien | M3 Nebenziel | Nelia | Ring am Lager |
| Eisen- und Schwefelgrube | M4 Schritte 1–2 | Nelia, Orrin | `build-ironMine`, `build-sulfurMine` |
| Hochschule, Forschung | M4 Schritt 3 | Orrin | `build-university`, `tech-standingArmy` |
| Schießplatz, Bogenschützen | M4 Schritt 3 | Orrin | `build-archery` |
| Truppenarten | M4 Schritt 4 | Orrin, Nelia | – |
| Feindlicher Held | M4 Schritt 4 | Orrin | – |
| Wachturm | M4 erster Ausfall | Orrin | `build-tower` |
| Regen, Spätfrost | M4 Wetter | Orrin | – |
| Neutral / verbündet | M5 Herold | Orrin | `relation` (prüfen, wo es sichtbar ist) |
| Lieferungen an Dörfer | M5 Schritt 2 | Orrin | `tributes-toggle` |
| Taran: „Schildstoß“, „Einschüchtern“ | M5 Schritt 3 | Taran | `quick-hero-taran`, `ability-shieldBash`, `ability-intimidate` |
| Schutzziel | M5 Schritt 3 | (Ziel) | Ring an den Höfen |
| Werkstattforschung (Alchimist) | M6 Schritt 1 | Orrin | `btech-weatherForecast`, `btech-meteorology` |
| Ausbau als Voraussetzung (Laboratorium) | M6 Schritt 1 | Orrin | `upgrade` |
| Wetterkraftwerk, Wettertechniker | M6 Schritt 2 | Orrin | `build-weatherPlant` |
| Wetterenergie, „Wetter herbeiführen“ | M6 Schritt 3 | Orrin, Taran | `weather-energy`, `weather-winter` |
| Gegnerisches Kraftwerk, Fernkampf vom Ufer | M6 Start, Schritt 4 | Taran | Ladebalken im Nebenziel |
| Malvors Feldgeschütz, Fußangeln | M6 Schritt 6 | Taran | – |

## ⚠ Änderungen gegenüber den bestehenden Missionen

| Nr. | Mission | Änderung | Begründung |
|---|---|---|---|
| ⚠ 1 | M1 | Eintreiber kommen, wenn die **Lehmgrube fertig** ist (spätestens nach 25 min), statt wenn zwei Höfe stehen. | Keine Überlagerung mit der Grubenerklärung; der Rauch ist der sichtbare Grund (Gegenbild zur Einleitung). |
| ⚠ 2 | M1 | Die Dorfälteste nebenan spricht mit **Orrin oder Nelia**; Ausgang je nach Held (A: 3 Leibeigene + 300 Holz; B: 3 Leibeigene). Umsetzung: Gesprächsfigur mit `hero: ['orrin', 'nelia']`, `onTalk` als Funktionsaktion, die den nächsten Helden prüft. | Erste spürbare Wahl zum Thema. |
| ⚠ 3 | M5 | Neue Gesprächsfigur: Dorfälteste von **Moorbrook** (nur Nelia), Frist bis zum Herold. Wer vorher spricht, behält Moorbrook verbündet und dessen Speerträger. | Nelias Wachstum wird Spielerhandlung; Ehrlichkeit hat einen Lohn. Balancing prüfen (eine Lieferung weniger). |
| ⚠ 4 | M6 | Orrins feste Szene hat einen **zweiten Auslöser**: Malvor taut, während Orrin auf dem Eis steht. Sonst wie bisher beim Sturm. | Vorgabe „Malvor taut … Orrin bricht ein“ wird kausal. |
| ⚠ K1 | alle | **Kampagnen-Merker** (optional): Beim Sieg werden ausgewählte Merker (`neighborsTruth`, `taxedHard`/`taxedLight`, `shardBought`/`shardStormed`, `mercs`/`refugees`, `confessed`) im Kampagnenfortschritt gespeichert und der nächsten Mission beim Start als Eingabe mitgegeben (deterministisch, im Spielstand). Einleitung und einzelne Zeilen dürfen davon abhängen. | „Wahl mit Folgen, die später erwähnt werden“. Ohne K1 gilt jeweils die neutrale Fassung; das Drehbuch funktioniert auch so. |
| ⚠ K2 | alle | **Zieltexte mit Handy-Fassung** (optional), wie `touch` bei den Tutorial-Schritten. | Kürzere Ziele. Ohne K2 gelten die Zieltexte mit „Maus: … · Handy: …“. |

**Geänderte Abläufe ohne neue Mechanik** (frei verbesserbar laut Auftrag, hier nur zur Übersicht):

- M1: Save-the-Cat- und Themen-Dialog bei Orrin; das Kronstück wird beim Fund kurz, während des Dorfzentrum-Baus
  ausführlich erklärt; Auslöser „Erstes Lagerfeuer“ (Ereignis `campLit`); Nebenziel „2 Leibeigene kaufen“
  (Ereignis `serfBought`); der Satz „Steuern stellst du in der Burg ein“ entfällt (ohne „Bildung“ gibt es das in M1
  nicht); Hilfe-Zeilen nur, wenn der Spieler noch nicht handelt.
- M2: Kaufmann von Anfang an da (Rabatt gilt unabhängig davon, ob vor oder nach dem Herold geliefert wird);
  Auslöser auf die Steuerstufe (Funktionsbedingung); Auslöser „Es brennt“; Wundsalbe beim ersten Überfall.
- M3: Neues Hauptziel „Weitblick“ (Merker über das Ereignis `ability`); Pläne-Ziel erst bei Ankunft im Tal; Hinweis
  auf Edrians Tod.
- M4: Taran erkennt Nelia (Dialog); Bergmeister-Szene mit Orrins Einwurf; Wetter-Auslöser; Hinweis auf Wachturm.
- M5: Dark-Night-Dialog; Taran gesteht die Meldung an Malvor.
- M6: Forschung als drei Zwischenziele (auf dem Kaufweg per `complete` erledigt); Auslöser „eigene Ertrunkene“
  (Ereignis `killed` mit `drowned`); Auslöser auf Malvors Fähigkeiten (Ereignis `ability`); Malvor wird gefangen.
- Alle: Kronstück statt Zacke; jede Einleitung beginnt mit „Bisher“ und dem Zählstand.

## Offene Fragen an den Projektinhaber

1. **Malvors Ende:** Das Drehbuch lässt ihn gefangen nehmen („über ihn richten die Provinzen“), weil das zu Nelias
   Weg passt. WELT.md sagt „Malvor fällt“. Soll er sterben?
2. **K1 (Kampagnen-Merker):** umsetzen? Sonst entfallen die Rückbezüge über Missionsgrenzen (Einleitung M3,
   Dark Night M5, Erlenhof M5, Krönung M6) und es bleiben nur die Folgen innerhalb der Mission und im Abschlusstext.
3. **„Du da oben“:** Darf Orrin den Spieler direkt ansprechen (wie in der Übungsmission)? Alternative: Hilfe-Zeilen
   ohne Anrede, nur als Zieltext.
4. **Lehm in Mission 1:** Der Startvorrat (1400) reicht für alle Bauten; die Lehmgrube ist erzählerisch begründet
   (Arbeit, Steuern, künftige Häuser), aber nicht nötig. Startlehm senken (etwa 1000), damit der Grund auch im Spiel
   spürbar ist?
5. **Vertonung:** Das Drehbuch hat deutlich mehr Zeilen. Sollen Hilfe-Zeilen vertont werden oder nur als Text
   erscheinen?
6. **Nelias Vater:** bleibt eine Figur nur in Texten (kein Modell, keine Stimme). Im Schlussbild sichtbar machen
   (Gesprächsfigur ohne Ziel), wenn es eine spielbare Schlussszene geben soll?
7. **Aussehen der Kronstücke:** goldene Spitze „mit einem Stein“; im Drehbuch ist der Stein des ersten rot. Je
   Provinz eine eigene Farbe?
8. **Untertitel der Missionen** („Was unter dem Baum liegt“ …): ins Menü übernehmen oder nur als Arbeitstitel?
9. **Balancing:** Wahl B in M1 (300 Holz weniger), ⚠ 3 in M5 (eine Lieferung weniger) und die Steuerwahl in M2
   sollten mit dem Test-Bot gegengeprüft werden.
10. **KAMPAGNE.md** spricht noch von „Zacken“, die Missionsdateien ebenso; nach Freigabe des Drehbuchs angleichen.
