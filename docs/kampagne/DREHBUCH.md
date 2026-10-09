# Drehbuch „Krone aus Eis“

Inhaltliches Drehbuch der sechs Kampagnenmissionen: Geschichte, Motivation, Spielerführung, Dialoge. Grundlage ist
die Weltbeschreibung [WELT.md](WELT.md); Karten und Kernablauf der bestehenden Missionen
(`src/sim/missions/campaign/c1-…c6-*.js`, [KAMPAGNE.md](../KAMPAGNE.md)) bleiben, die Erzählung wird neu gebaut.
Alles hier ist mit den Bausteinen aus [MISSIONEN.md](../MISSIONEN.md) umsetzbar (Ziele, Auslöser, Aktionen, Tribute,
Gesprächsfiguren, Zeiger); Abweichungen sind mit **⚠ Änderung:** markiert und in der Prüfliste (Teil 3) gesammelt.

**Schreibweisen in diesem Dokument**

- **Sprecher: Zeile** – gesprochener, vertonter Satz. Keine feste Längengrenze: Ein Gespräch ist so lang, wie es braucht,
  damit der Spieler danach weiß, wo er ist, was zu tun ist und warum.
- **Zeit:** Das Missionsskript wartet, bis ein Satz gesprochen ist; ein Folgegespräch beginnt erst danach.
- **Hilfe-Zeilen** sind mit **[Hilfe: …]** markiert, dahinter steht ihre Bedingung:
  - **[Hilfe, entfällt wenn …]** – die Simulation sieht die Handlung (Bau gesetzt, Rohstoff abgebaut, Fähigkeit
    benutzt, Tribut bezahlt, Handel begonnen, Miliz, Heldenposition …); dann wird die Zeile nicht gesprochen.
  - **[Hilfe, kommt immer]** – reine Oberflächenhandlungen (Kamera bewegen, auswählen, Ziele-Liste öffnen,
    Steuergruppen) sieht die Simulation nicht. Dort verspricht das Drehbuch nichts; die Zeile ist so geschrieben,
    dass sie auch für Kundige nicht stört.
- **Gesprochen geräteneutral:** Figuren sagen *was* zu tun ist, im Gespräch miteinander („Ruf alle zusammen und
  lass sie bauen“, „Wähl mich allein, dann mach ich ihnen Mut“). Niemand spricht den Spieler direkt an. Die
  Handgriffe für Maus und Handy stehen **im Zieltext**: „Ziel (Maus)“ und „Ziel (Handy)“ – die Handy-Fassung braucht
  Erweiterung E2; ohne E2 gilt die Maus-Fassung mit angehängtem „· Handy: …“.
- **Ein Zeiger zur Zeit:** Es leuchtet immer nur ein Knopf – der des ersten offenen Ziels (Hauptziele zuerst). Folgen
  stehen als **Zeiger-Phasen** („1. … solange …, 2. …“, Erweiterung E3); Zeiger aus Auslösern (Zahltag, Überfall)
  brauchen E4. Ringe auf der Karte sind davon unabhängig.
- **Bausteine** in Klammern nennen, womit ein Auslöser gebaut wird (`event payday`, Merker `confessed`, E5 …). Die
  Erweiterungen E1–E12 sind in [PRUEFUNG.md](PRUEFUNG.md#nötige-erweiterungen-der-technik) beschrieben und in der
  Prüfliste (Teil 3) zusammengefasst.
- **Kronstücke immer mit Zahl:** „das erste Kronstück“, „drei von fünf Kronstücken“. Das Wort fällt zum ersten Mal
  beim Fund in Mission 1 und wird dort sofort erklärt. Fremde Figuren zählen nicht aus Nelias Sicht: Sie sagen „das
  Kronstück in Beaucroix“, nicht „das zweite“.
- **Ohne Entscheidung spielbar:** Wo eine offene Frage besteht (Teil 3), ist die Fassung geschrieben, die ohne
  Entscheidung funktioniert (K1 neutral).

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
| **Malvor** | König werden, damit ihm niemand mehr widerspricht; Ordnung durch Korn. | (Was er nie bekommt:) Vertrauen statt Gehorsam. | Unsichtbar, spürbar durch Boten: Eintreiber, Herold, Wachen, Befehle. Höflich, rechnend, nie grausam ohne Zweck. | Verteidigt sein Schloss selbst mit denselben Waffen wie Nelia (Wetterkraftwerk) und verliert, weil ihm keiner aus freien Stücken folgt. Fällt in der letzten Schlacht um sein Schloss; Nelia nimmt das fünfte Kronstück von seinem Hals. |

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
| 2 | Beaucroix (M2) | Räuber haben es aus der Stadtkasse geraubt und verkaufen es an den Meistbietenden. Freikaufen (über den Markt verdient) **oder** das Lager im Flusswald stürmen. | Kaufen statt kämpfen: Sein Herold bietet tausend Taler und verspricht der hungrigen Stadt Kornwagen (nur Erzählung). |
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
| M1 | Wer spricht mit der Dorfältesten nebenan? Nur einer darf gehen. **A** Orrin (mit der Prinzessinnen-Geschichte) · **B** Nelia (mit der Wahrheit) · **C** niemand | A: 3 Leibeigene + 300 Holz. B: 3 Leibeigene, kein Holz, aber ein Versprechen. Abschlusstext je Weg (drei Fassungen). | M5, Dark Night (K1, eine Zeile). |
| M2 | Steuern: **hoch** (Malvors Weg) · **niedrig** (Nelias Weg) · normal (keine Wahl); zählt der Stand beim Sieg | Im Spiel klein: hoch ≈ 2,5 Taler mehr je Arbeiter und Zahltag, die Stimmung sinkt langsam; niedrig umgekehrt. Spürbar vor allem in den Reaktionen und im Abschluss. | M5, Dorfälteste von Erlenhof (K1). |
| M2 | Kronstück **freikaufen** · **stürmen** | Wer den Hinweis aufs Wetterwerk gibt (Räuberhauptmann oder Gefangener). | M3, Einleitung (K1, ein Satz). |
| M3 | **Tor** · **Schlucht**; unabhängig davon **bestechen** oder nicht | Verluste, Orrins Börse. | M3, Abschluss (Merker `bribed`). |
| M4 | **Söldner** · **Geflohene Leibeigene** | Sofort kampfbereit vs. stärkere Wirtschaft; Bergmeister reagiert. | M5, Start (K1, eine Zeile). |
| M5 | Nelia sagt die Wahrheit **selbst**, bevor der Herold kommt · der **Herold** sagt sie | Selbst: Moorbrook bleibt verbündet, sein Speertrupp bleibt im Lager (der von Schilfheim geht). Herold: alle drei Dörfer neutral, beide Speertrupps gehen. | M6, Abschluss (K1). |
| M6 | **Wissen kaufen** · **selbst forschen** | Zeit gegen Taler/Schwefel. | M6, Abschluss (ein Satz). |
| M6 | Malvor mit Leuten auf dem Eis **zum Tauen verleiten** · sein Kraftwerk **vom Ufer zerstören** | Wer auf dem Eis steht, ertrinkt; Nelia reagiert. | M6, Abschluss: Nelias erste Worte als Königin. |

Spätere Erwähnungen über Missionsgrenzen hinweg brauchen Kampagnen-Merker (K1 = Erweiterung E1). Ohne E1 entfallen
diese Zeilen ersatzlos; jede Mission funktioniert in der neutralen Fassung.

---
# Teil 2 – Die Missionen

> **Stand:** Missionen 1 und 3 sind neu geschrieben (mit Erzählerin, Figuren sprechen den Spieler nicht an) und haben
> den Kaltleser-Test bestanden, siehe [Leitfaden](LEITFADEN.md). Die Missionen 2, 4, 5 und 6 sind noch die alte Fassung
> und werden in diesem Stil neu geschrieben.

## Mission 1 – Lindgrund

Die Erzählerin spricht nur zum Spieler: Einleitung, jedes neue Ziel (was und warum), Bedienung, die neu ist. Die Figuren
reden nur miteinander. In dieser Mission erklärt sie die gesamte Grundsteuerung; Rechner und Handy nennt sie beim
ersten Mal beide, danach nur noch, was zu tun ist.

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Kann Nelia ihr verlassenes Heimatdorf wieder zum Leben bringen – und das Kronstück unter dem alten Baum vor Malvors
Eintreibern behalten?** Im Gesamtbogen: **Opening Image** (das leere Dorf im Schnee), **Save the Cat** (Nelia gibt
einem Fremden ihr letztes Brot), **Catalyst** (der Fund und Orrins Lüge), am Ende **Break into Two** (Nelia bricht auf,
um Malvor bei den Kronstücken zuvorzukommen).

### 2. Einleitungstext (liest die Erzählerin vor)

> Seit Jahren liegt Schnee auf dem Kronland. Seit König Edrian im Sturm auf dem Thronsee ertrank, wird es nicht mehr
> Frühling. Nur einer hat noch Korn: Malvor, der Statthalter von Hagenfurt. Wer essen will, arbeitet in seinen
> Kornlagern – für eine Schüssel am Tag.
>
> Auch die Leute aus Lindgrund sind gegangen. Nelia, die Tochter eines Leibeigenen, hat zwei Winter in Malvors
> Kornlager geschuftet. Ihr Vater ist noch dort. Vor einer Woche ist sie davongelaufen – zurück nach Hause.
>
> Jetzt steht sie am Rand ihres Heimatdorfs. Kein Rauch steigt auf. Kein Hund bellt.

**Startvorrat:** 400 Taler, 1000 Lehm, 600 Holz, 200 Stein. Keine Leibeigenen.

### 3. Ablauf

#### Start – Kein Rauch

- *Auslöser:* Missionsbeginn. Kamera auf Nelia am Dorfrand; auf dem Dorfplatz sitzt ein Fremder mit Ausrufezeichen.
- *Dialog:*
  > **Nelia:** Lindgrund. Kein Rauch, kein Hund. Alle sind zu Malvor gegangen – für eine Schüssel Korn.
  >
  > **Orrin:** He! Du da, mit dem Bündel! Hier drüben, auf dem Dorfplatz! Ich beiße nicht, ich handle nur.
  >
  > **Nelia:** Ein Fremder? Hier wohnen ja nicht mal mehr Mäuse.
- *Ziel:* „Schick Nelia zum Fremden auf dem Dorfplatz“
  > **Erzählerin:** Willkommen in Lindgrund. Du lenkst Nelia. Klicke sie an – oder tippe sie an, wenn du am Handy
  > spielst.
  >
  > **Erzählerin:** Dann zeig ihr, wohin sie gehen soll: am Rechner mit einem Rechtsklick auf den Boden, am Handy mit
  > einem Tipp. Schick sie zu dem Fremden mit dem Ausrufezeichen.
  >
  > **Erzählerin:** Die Karte verschiebst du am Rechner mit den Tasten W, A, S, D, am Handy mit einem Finger.
- *Erklärung:* Rahmen auf Nelias Bild unten links; Ring am Fremden.

#### Schritt 1 – Der Fremde

- *Auslöser:* Nelia erreicht den Fremden.
- *Dialog:*
  > **Orrin:** Endlich ein Gesicht! Orrin, Händler in Bändern, Knöpfen und guten Ratschlägen. Mein Karrenrad ist
  > gebrochen, und hier kauft keiner mehr.
  >
  > **Nelia:** Ich bin Nelia. Ich bin hier geboren. Du siehst verfroren aus – hier, mein letztes Brot.
  >
  > **Orrin:** Geschenkt? Wie soll ich das verbuchen? Mir hat noch nie jemand etwas geschenkt.
  >
  > **Nelia:** Dann verbuch es nicht. Iss.
  >
  > **Orrin:** Danke. Und was willst du hier, in einem Dorf ohne Leute?
  >
  > **Nelia:** Mein Vater hat immer unter dem alten Baum am Waldrand versteckt, was wir hatten – wenn die Eintreiber
  > kamen. Vielleicht liegt dort noch Saatkorn. Mit Saatkorn kann Lindgrund im Frühjahr wieder säen.
  >
  > **Orrin:** Saatkorn ist mehr wert als alles in meinem Karren. Ich komme mit.
- Orrin schließt sich an.
- *Ziel:* „Schick Nelia zum alten Baum am Waldrand – dort hat ihr Vater versteckt, was die Familie hatte“
  > **Erzählerin:** Orrin begleitet Nelia jetzt. Dein neues Ziel steht links oben in der Zielliste: Schick Nelia zum
  > alten Baum am Waldrand.
  >
  > **Erzählerin:** Weißt du nicht, wo etwas liegt? Neben jedem Ziel ist ein kleiner Knopf mit einer Zielscheibe –
  > er fährt die Karte dorthin. Am Handy findest du die Ziele hinter dem Knopf „Ziele“. Der goldene Ring zeigt die Stelle.
- *Erklärung:* Rahmen auf den Knopf „Ziel zeigen“ (Handy: zuerst „Ziele“).

#### Schritt 2 – Der Fund (Catalyst)

- *Auslöser:* Nelia erreicht den Baum.
- *Dialog:*
  > **Nelia:** Kein Korn. Ein Tuch … und darin Gold. Eine goldene Spitze mit einem roten Stein.
  >
  > **Orrin:** Bei allen Märkten. Weißt du, was du da hältst? Ein Kronstück.
  >
  > **Orrin:** Als König Edrian ertrank, zerbrach seine Krone in fünf Stücke. Man erzählt, in jeder Provinz liegt eins.
  > Und du hast das von Lindgrund gefunden.
  >
  > **Nelia:** Unter Vaters Baum? Wie kommt so etwas dahin?
- Drei Leibeigene treten aus dem Wald; sie hatten sich vor den Eintreibern versteckt.
  > **Dorfbewohnerin:** Gold? Gehört ihr zu Malvors Leuten? Dann sind wir gleich wieder weg!
  >
  > **Orrin:** Malvors Leute? Seht ihr nicht, wer da steht? Der König hatte keine *bekannten* Kinder!
  >
  > **Orrin:** Die verlorene Prinzessin, Leute! Mit dem Kronstück von Lindgrund, aus der Erde ihrer Heimat!
  >
  > **Dorfbewohnerin:** Die Prinzessin … in Lindgrund? Dann bleiben wir! Sag uns, was wir tun sollen!
  >
  > **Nelia:** Ich … Wir bauen das Dorf wieder auf. Damit die anderen heimkommen können.
- *Unter vier Augen, direkt danach:*
  > **Nelia:** Orrin! Ich bin keine Prinzessin. Warum erzählst du so etwas?
  >
  > **Orrin:** Weil sie sonst weitergelaufen wären. Drei Paar Hände für einen Satz – das ist ein guter Handel.
  >
  > **Nelia:** Und wenn sie merken, dass es nicht stimmt?
  >
  > **Orrin:** Dann haben sie ein Dach über dem Kopf. Wer satt ist, verzeiht viel. Aber zuerst brauchen wir Holz.
  > Die eingestürzten Häuser dort drüben – ihre Balken sind trocken.

#### Schritt 3 – Holz

- *Ziel:* „Schick die Leibeigenen an die Balken bei den eingestürzten Häusern – ohne Holz kein neues Dach“
  > **Erzählerin:** Dein Ziel: Lindgrund braucht Holz, um Häuser und den Dorfplatz wieder aufzubauen. Die Balken der
  > eingestürzten Häuser am Dorfrand sind trocken und liegen schon bereit.
  >
  > **Erzählerin:** Die drei Leute aus dem Wald sind Leibeigene. Sie sammeln Holz, Lehm und Stein und bauen Häuser –
  > aber nur, wenn du ihnen sagst, was sie tun sollen.
  >
  > **Erzählerin:** Wähle alle drei mit dem Knopf „Alle“ unten links aus. Am Rechner kannst du auch einen Rahmen um sie
  > ziehen.
  >
  > **Erzählerin:** Dann ein Rechtsklick auf die Balkenhaufen – am Handy ein Tipp. Oben siehst du, wie dein Holz wächst.
- *Erklärung:* Rahmen auf „Alle“ (Handy: hinter dem Kartenknopf); Ring an den Balken.

#### Schritt 4 – Das Dorfzentrum

- *Auslöser:* Die Leibeigenen bauen Holz ab.
- *Dialog:*
  > **Orrin:** Gut so. Jetzt der Dorfplatz. Freie Leute – Bauern, Bergleute, Handwerker – ziehen nur dorthin, wo ein
  > Dorfzentrum steht.
  >
  > **Nelia:** Die Leute aus Lindgrund sitzen in Malvors Kornlager. Wenn hier wieder ein Dorfzentrum steht, kommen sie
  > dann heim?
  >
  > **Orrin:** Wenn es hier Arbeit, Betten und Essen gibt. Eins nach dem anderen. Zuerst das Dorfzentrum – auf den
  > alten Grundmauern.
- *Ziel:* „Bau das Dorfzentrum auf den alten Grundmauern wieder auf – ohne Dorfzentrum zieht kein Arbeiter her“
  > **Erzählerin:** Gebaut wird mit Leibeigenen. Wähle sie aus und öffne das Baumenü mit dem Knopf „Bauen“.
  >
  > **Erzählerin:** Wähle das Dorfzentrum und setze es auf die alten Grundmauern im Ring. Ein Dorfzentrum passt nur auf
  > solche Siedlungsplätze. Am Handy bestätigst du mit „Hier bauen“.
  >
  > **Erzählerin:** Die ausgewählten Leibeigenen fangen sofort an. Je mehr mitbauen, desto schneller geht es.
- *Erklärung:* Rahmen auf „Bauen“, dann auf „Dorfzentrum“; Ring auf den Grundmauern.

#### Schritt 5 – Betten

- *Auslöser:* Dorfzentrum fertig.
- *Dialog:*
  > **Nelia:** Das Dorfzentrum steht. Wie früher. Nur leerer.
  >
  > **Orrin:** Nicht mehr lange. Aber wer hier arbeiten soll, braucht ein Bett. Sonst sitzt er die Nacht am
  > Lagerfeuer und schafft am Tag kaum etwas.
  >
  > **Nelia:** Im Kornlager schliefen wir zu dreißig in einer Scheune. Hier bekommt jeder ein Bett.
- *Ziel:* „Baue 2 Wohnhäuser – Arbeiter brauchen ein Bett“
  > **Erzählerin:** Baue zwei Wohnhäuser. In jedem schlafen sechs Arbeiter. Wohnhäuser kannst du auf jeden freien Boden
  > setzen.
  >
  > **Erzählerin:** Graue Gebäude im Baumenü gibt es in dieser Mission noch nicht. Sie kommen später dazu.

#### Schritt 6 – Essen

- *Auslöser:* zwei Wohnhäuser fertig.
- *Dialog:*
  > **Orrin:** Wer geschlafen hat, will essen. Und Essen ist alles, womit Malvor das Land festhält.
  >
  > **Nelia:** Dann bauen wir Höfe. Wer in Lindgrund satt wird, muss nicht zu ihm.
- *Ziel:* „Baue 2 Bauernhöfe – Arbeiter brauchen Essen“
  > **Erzählerin:** Baue zwei Bauernhöfe. An jedem Hof essen acht Arbeiter. Und jeder Hof braucht einen Bauern – das
  > werden deine ersten Arbeiter.
- *Der erste Arbeiter kommt:*
  > **Nelia:** Da kommt einer! Den hat keiner gerufen.
  >
  > **Orrin:** Arbeiter kann man nicht rufen. Man kann ihnen nur einen Grund geben – Arbeit, ein Bett und einen Platz
  > am Tisch.

#### Schritt 7 – Arbeit und Lehm

- *Auslöser:* zwei Bauernhöfe fertig.
- *Dialog:*
  > **Orrin:** Zwei Bauern haben wir. Mehr Leute kommen nur, wenn es mehr Arbeit gibt.
  >
  > **Nelia:** Und unser Lehm ist fast weg. Ohne Lehm kein Haus mehr für die, die noch heimkommen.
  >
  > **Orrin:** Dort drüben tritt Lehm aus dem Boden – ein Schacht. Darauf passt eine Lehmgrube. Fünf Bergleute finden
  > dort Arbeit und graben Lehm genug für ganz Lindgrund.
  >
  > **Nelia:** Und wer arbeitet, zahlt Steuern.
  >
  > **Orrin:** Du lernst schnell. Dann klimpert es endlich mal in Lindgrund.
- *Ziel:* „Baue eine Lehmgrube auf dem Schacht und gib 6 Arbeitern Arbeit, Bett und Essen“
  > **Erzählerin:** Baue eine Lehmgrube. Gruben passen nur auf Schächte – Stellen, an denen ein Rohstoff aus dem Boden
  > tritt. Der Ring zeigt den Lehmschacht.
  >
  > **Erzählerin:** Sobald es Arbeit gibt, ziehen neue Arbeiter von selbst ins Dorfzentrum. Brennt irgendwo ein
  > Lagerfeuer, fehlt jemandem ein Bett oder ein Platz am Tisch.
- *Erklärung:* Rahmen auf „Lehmgrube“ im Baumenü, bis die Baustelle steht; Ring am Schacht.

#### Zwischendurch – Der erste Zahltag

- *Auslöser:* erster Zahltag, an dem es Arbeiter gibt.
- *Dialog:*
  > **Orrin:** Hörst du das Klimpern? Zahltag. Jeder Arbeiter zahlt Steuern – endlich Taler in Lindgrund.
  >
  > **Orrin:** Für Taler bekommst du in der Burg neue Leibeigene. Fünfzig das Stück, und das Dorf hat mehr Hände.
  >
  > **Nelia:** Menschen kaufen. Wie Mehl. Mich hat auch mal einer gekauft.
  >
  > **Orrin:** So ist das im Kronland. Willst du es ändern, brauchst du erst ein Dorf, das überlebt.
- *Nebenziel:* „Optional: Kauf in der Burg 2 Leibeigene – mehr Hände bauen schneller“
  > **Erzählerin:** Alle zwei Minuten ist Zahltag: Jeder Arbeiter zahlt Steuern. Wähle die Burg aus und kaufe dort
  > Leibeigene für je 50 Taler. Mehr Leibeigene bauen schneller.

#### Schritt 8 – Malvors Eintreiber (Break into Two)

- *Auslöser:* Die Lehmgrube ist fertig – Rauch steigt über Lindgrund auf. Spätestens nach 25 Minuten.
- Kamera springt zu den Eintreibern (zwei Trupps Speerträger) am Dorfrand.
- *Dialog:*
  > **Nelia:** Rauch über Lindgrund. Das sieht man bis zur Straße.
  >
  > **Eintreiber:** Im Namen des Statthalters! Jeder zehnte Sack gehört Malvor.
  >
  > **Eintreiber:** Und man erzählt sich, hier hat jemand Gold aus dem Boden gegraben. Her damit!
  >
  > **Nelia:** Was unter Vaters Baum lag, bleibt in Lindgrund.
  >
  > **Orrin:** Meine Schuld – die Geschichte von der Prinzessin lief schneller als wir. Aber das sind nur ein paar
  > Speerträger. Wenn alle zusammen anpacken, jagen wir sie davon.
  >
  > **Nelia:** Und ich gehe vorneweg. Wenn sie mich sehen, fassen sie Mut.
- *Ziel:* „Vertreibe Malvors Eintreiber – sie wollen das Kronstück“
  > **Erzählerin:** Malvors Eintreiber wollen das Kronstück. Vertreibe sie.
  >
  > **Erzählerin:** Wähle die Burg und drücke „Zu den Waffen!“. Dann greifen alle Leibeigenen zu Mistgabeln und werden
  > zur Miliz.
  >
  > **Erzählerin:** Wähle die Miliz und Nelia aus und schick sie mit Rechtsklick – am Handy mit einem Tipp – auf die
  > Eintreiber.
  >
  > **Erzählerin:** Nelia kann ihren Leuten Mut machen: Wähle sie allein und drücke „Mut machen“. Wer in ihrer Nähe
  > kämpft, schlägt eine Minute lang doppelt so hart zu.
  >
  > **Erzählerin:** Keine Sorge um Nelia und Orrin: Helden sterben nicht. Werden sie verwundet, stehen sie nach einer
  > Weile wieder auf.
- *Erklärung:* Rahmen auf die Burg, dann „Zu den Waffen!“, dann „Mut machen“.
- *Eintreiber vertrieben:*
  > **Eintreiber:** Das wird Malvor erfahren! Und ihr seid nicht die Einzigen. Sein Herold kauft die Kronstücke längst
  > – in Beaucroix bietet er schon für das nächste!
  >
  > **Nelia:** Malvor sammelt die Kronstücke? Orrin, was passiert, wenn er alle fünf hat?
  >
  > **Orrin:** Dann wird er König. Das alte Recht sagt: Wer alle fünf Kronstücke vereint, den müssen die Provinzen
  > krönen. Und einem König darf keiner mehr widersprechen.
  >
  > **Nelia:** Dann bekommt er dieses nicht. Und das in Beaucroix auch nicht.
  >
  > **Erzählerin:** Vergiss nicht: In der Burg rufst du mit „Entwarnung“ die Miliz zurück an die Arbeit.
- Damit sind alle Hauptziele erfüllt; die Mission ist gewonnen.

### 4. Nebenziel: Das Nachbardorf

- *Auslöser:* nach dem Fund am Baum; die Dorfälteste im Nachbardorf bekommt ein Ausrufezeichen, ihr Dorf wird kurz
  aufgedeckt.
- *Dialog:*
  > **Orrin:** Sieh mal, dort drüben steigt Rauch auf. Ein Nachbardorf – da wohnt noch jemand!
  >
  > **Orrin:** Lass mich mit ihnen reden. Ein guter Händler bekommt Holz und Leute, wo andere nur Türen sehen.
- *Ziel:* „Optional: Schick Orrin zur Dorfältesten im Nachbardorf – sie könnte Leute und Holz schicken“
  > **Erzählerin:** Ein freiwilliges Ziel: Schick Orrin zur Dorfältesten im Nachbardorf. Du hast jetzt zwei Helden –
  > wähle Orrin über sein Bild unten links aus.
- *Wenn Nelia hingeht:*
  > **Dorfälteste:** Schick mir den Händler, Kind. Der redet für zwei.
- *Gespräch mit Orrin:*
  > **Orrin:** Ehrwürdige Mutter! Ihr habt es gehört: Die verlorene Prinzessin ist zurück, und sie friert in Lindgrund.
  >
  > **Dorfälteste:** Prinzessin oder nicht – ein Mädchen, das Malvors Kornlager davonläuft und ihr Dorf wieder
  > aufbaut, verdient Hilfe. Wir schicken drei Leute und Holz nach Lindgrund.
- *Folge:* Das Nachbardorf wird verbündet, 3 Leibeigene und 300 Holz.
  > **Erzählerin:** Das Nachbardorf ist jetzt mit dir verbündet: Es hilft dir und greift dich nicht an. Die drei
  > neuen Leibeigenen warten an deiner Burg – setz sie gleich beim Aufbau von Lindgrund ein.

### 5. Niederlage

- *Burg gefallen:* „Die Eintreiber haben die Burg genommen. Lindgrund gehört wieder niemandem – und das erste
  Kronstück reitet in einer Satteltasche nach Hagenfurt.“

### 6. Abschlusstext (liest die Erzählerin vor)

> Am Abend steigt Rauch aus vier Schornsteinen. Aus dem Wald kommen Leute, aus dem Nachbardorf noch mehr. Die Kinder
> rufen „Prinzessin“, und Nelia widerspricht – aber niemand hört zu.
>
> Sie sitzt unter dem alten Baum, das Kronstück in der Hand. Eines von fünf. Wie es hierher kam, weiß sie nicht. Sie
> weiß nur: Wenn Malvor alle fünf bekommt, wird er König, und keiner darf ihm je wieder widersprechen. Und in Beaucroix
> bietet sein Herold schon für das nächste.
>
> „Dann gehen wir nach Beaucroix“, sagt Nelia. – „Wir?“, fragt Orrin. „Mein Karrenrad ist gebrochen.“ – „Dann gehst du
> zu Fuß.“ Am nächsten Morgen ziehen sie los, mit zehn Leibeigenen und dreihundert Talern.

---
## Mission 2 – Beaucroix: „Wer zahlt, hat recht“

**Dramatische Frage:** Bekommt Nelia das zweite Kronstück, bevor Malvors Taler es kaufen – ohne dabei so zu
herrschen wie er?

**Beats:** B-Story beginnt (Orrins Schuld) · Fun and Games.

**Malvors Ziel hier:** Kaufen statt kämpfen. Sein Herold bietet den Räubern tausend Taler für das Kronstück und
lässt der hungrigen Stadt Kornwagen versprechen – so kauft er Beaucroix gleich mit. Als Nelia überbietet, gibt er
den Räubern eine Anzahlung; von dem Geld rüsten sie auf und überfallen ihr Lager.

**Karte und Start (unverändert):** Lager am Rand von Beaucroix, das Kaufmannsviertel (verbündet) seitlich, das
Räuberlager im Flusswald zur Kartenmitte hin. 10 Leibeigene, Nelia und Orrin, 300 Taler, viel Lehm, Holz und Stein,
400 Eisen. Bekannt: Bildung, Handelswesen, Wehrpflicht. Freigeschaltet: Dorfzentrum, Wohnhaus, Bauernhof,
Lehmgrube, Lager (Ausbau zum Marktplatz), Steingrube; die Kaserne kommt mit dem Herold.

**Neu für den Spieler**

| Was | Wo erklärt |
|---|---|
| Angebote (Tribute): bezahlen, zwei schließen einander aus | Schritt 2 (Lehmschuld), Schritt 6 |
| Gebäude ausbauen (Lager → Marktplatz), Ausbau ohne Leibeigene | Schritt 4 |
| Händler sind Arbeiter (brauchen Bett und Essen) | Schritt 1, Schritt 5 |
| Marktplatz: tauschen, Preise fallen beim Verkaufen | Schritt 5 |
| Kaserne, Truppen ausbilden („Volle Einheit“), Sold am Zahltag | Schritt 6 |
| Alle Truppen wählen („Truppen“), angreifen | Weg „Sturm“ |
| Räuberlager: Wachen besiegen | Weg „Sturm“ |
| Steuern einstellen, Stimmung (Motivation) | Schritt 7 |
| Orrins „Wundsalbe“ | Erster Überfall |
| Brennende Gebäude reparieren | Auslöser „Es brennt“ |

### Einleitung

> **Bisher:** Ein Kronstück von fünf trägt Nelia bei sich – das erste, aus Lindgrund. Die Legende sagt, in jeder
> Provinz liege eines, und das alte Recht sagt: Wer alle fünf vereint, den müssen die Provinzen krönen. Malvor weiß
> das. Er sammelt. Der vertriebene Eintreiber hat es verraten: In Beaucroix bietet sein Herold schon.
>
> Beaucroix, die Handelsstadt am großen Fluss, ist voll und hungrig. Malvors Agenten kaufen jedes Korn auf. Das
> Kronstück der Provinz lag in der Stadtkasse, bis Räuber es raubten; jetzt hausen sie damit im Flusswald und
> verkaufen es an den, der am meisten zahlt.
>
> Nelia hat zehn Leibeigene aus Lindgrund mitgebracht und dreihundert Taler. Orrin kennt hier jeden Markt. Und
> jeder Markt kennt Orrin.

### Ablauf

#### Start – Ankunft

- *Auslöser:* Missionsbeginn. Der Kaufmann im Viertel nebenan hat ein Ausrufezeichen (Gesprächsfigur ab Start).
- *Dialog:*
  > **Orrin:** Beaucroix! Hier riecht sogar der Schnee nach Geld.
  >
  > **Nelia:** Ich rieche nur Hunger. Malvors Leute kaufen das Korn weg, und die Stadt sieht zu.
  >
  > **Orrin:** Die Räuber im Flusswald haben das Kronstück der Stadt. Sie verkaufen an den, der am meisten bietet.
  >
  > **Nelia:** Und Malvor bietet. Wir haben dreihundert Taler.
  >
  > **Orrin:** Dann verdienen wir mehr. Mit einem eigenen Markt. Lehm und Stein haben wir genug.
  >
  > **Orrin:** Ah – und den Kaufmann da drüben … den besuchen wir besser später. Viel später.

#### Schritt 1 – Bauernhöfe

- *Auslöser:* nach dem Startdialog.
- *Ziel:* „Baue 3 Bauernhöfe – Händler und Arbeiter brauchen Essen“
- *Warum (im Dialog):* Ein Markt braucht Händler, und Händler sind Arbeiter: Sie kommen nur, wenn es Bett und Essen
  gibt. In einer Stadt, deren Korn Malvor wegkauft, ist ein eigener Hof mehr wert als Gold.
- *Erklärung:* bekannt aus Mission 1. Zeiger: Kachel „Bauernhof“.
- *Dialog (nach dem Startblock: + 25 s):*
  > **Nelia:** Erst die Höfe. Wer bei uns arbeitet, soll nicht zu Malvors Korn betteln gehen.
  >
  > **Orrin:** Und Händler essen viel. Glaub mir, ich bin einer. Ohne Tisch kein Händler, ohne Händler kein Markt.

#### Schritt 2 – Der Kaufmann (B-Story)

- *Auslöser:* Orrin kommt in die Nähe des Kaufmanns, **oder** nach 3 Minuten ruft der Kaufmann
  (`all: [time 180, not talked merchant]`):
  > **Kaufmann:** Orrin! Ich seh dich doch! Komm her, du alter Fuchs!
- *Ziel:* „Optional: Schick Orrin zum Kaufmann von Beaucroix“ (nur Orrin; andere Helden hören: „Ich warte auf
  Orrin. Er schuldet mir etwas.“)
- *Warum (im Dialog):* Der Kaufmann hat eine Rechnung offen – und Einfluss bei den Räubern.
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

  Angebot „Den versprochenen Lehm liefern (800 Lehm)“ erscheint; Nebenziel „Optional: Liefere dem Kaufmann den Lehm,
  den Orrin verkauft hat (Feld ‚Angebote‘ → ‚Bezahlen‘)“.
- *Erklärung:* Angebote. Zeiger: „Bezahlen“ am Lehm-Angebot, sonst „Angebote“ – nur mit E4 sichtbar, solange
  Hauptziele zeigen.
- *Dialog (Hilfe, nach dem Block: 20 s):*
  > **Orrin:** *[Hilfe, entfällt wenn der Lehm geliefert ist]*
  > Der Kaufmann hat's angeschrieben. Zahlen wir, geht der Lehm sofort zu ihm.
- *Bezahlt:*
  > **Kaufmann:** Der Lehm ist da, und sogar trocken! Für ehrliche Leute rede ich mit jedem.
  >
  > **Orrin:** Ehrlichkeit ist mein zweiter Vorname. Gleich nach Gewinn.
  >
  > **Nelia:** Dein erster Vorname ist Schulden.

  Folge: Merker `clayDelivered`. Der Rabatt gilt in jeder Reihenfolge: Kommt der Herold später, öffnet er gleich
  „Freikaufen mit Rabatt (800)“; ist er schon da, ersetzt die Lieferung „Freikaufen (1200)“ durch das Rabatt-Angebot.

#### Schritt 3 – Ein Lager

- *Auslöser:* gleichzeitig mit Schritt 1 sichtbar.
- *Ziel:* „Baue ein Lager (Baumenü → ‚Wohnen‘ → Lager)“
- *Warum (im Dialog):* Am Markt tauscht man, was man übrig hat, gegen Taler. Ohne Taler kein Kronstück.
- *Erklärung:* Zeiger: Kachel „Lager“, bis die Baustelle steht.
- *Dialog (zusammen mit Schritt 1):*
  > **Orrin:** Ein Markt fängt als Lager an. Bau eins, dann machen wir einen Marktplatz daraus.

#### Schritt 4 – Ausbau zum Marktplatz

- *Auslöser:* Lager fertig. Der Auslöser merkt sich das Lager als Bezug (Ring darauf).
- *Ziel:* „Baue das Lager zum Marktplatz aus (Lager wählen → ‚Ausbauen‘; kostet 200 Taler und 200 Stein)“ – eigenes
  Teilziel statt Zeiger-Phase, damit kein E3 nötig ist.
- *Warum (im Dialog):* Erst der Marktplatz hat Händler – zwei Arbeiter, die tauschen.
- *Erklärung:* Ausbau läuft von selbst, ohne Leibeigene. Zeiger: „Ausbauen“; Ring auf dem Lager.
- *Dialog:*
  > **Orrin:** Jetzt bauen wir es aus. Zweihundert Taler. Ja, das sind zwei Drittel von allem. Investition, Kind.
  >
  > **Nelia:** Dann muss der Markt schnell zurückzahlen.
- *Dialog (Hilfe, nach dem Block: 20 s):*
  > **Orrin:** *[Hilfe, entfällt wenn der Ausbau begonnen hat (`event upgradeStarted`)]*
  > Der Ausbau geht von selbst. Die Leibeigenen können derweil Holz holen.

#### Schritt 5 – Der erste Handel

- *Auslöser:* Marktplatz fertig.
- *Ziel (Maus/Handy gleich):* „Tausche Waren gegen Taler: Marktplatz wählen → bei ‚Bezahlen mit‘ Lehm oder Stein,
  bei ‚Kaufen‘ Taler → ‚Handeln‘“
- *Warum (im Dialog):* Malvor bietet tausend Taler. Wer mithalten will, muss Lehm und Stein zu Geld machen.
- *Erklärung:* Marktfenster; die Reihenfolge steht nur im Zieltext. Zeiger: „Handeln“; Ring auf dem Marktplatz.
- *Dialog:*
  > **Orrin:** Gib den Händlern Lehm und nimm Taler dafür. Je mehr Taler, desto lauter können wir bieten.
  >
  > **Orrin:** Wer viel auf einmal verkauft, drückt den Preis. Lieber öfter ein bisschen.
- *Dialog (Hilfe, nach dem Block: 25 s):*
  > **Orrin:** *[Hilfe, entfällt wenn ein Handel begonnen hat (`event tradeStarted`)]*
  > Keine Händler da? Dann fehlt ihnen Bett oder Tisch.
- *Erster Handel abgeschlossen (`event tradeDone`):*
  > **Orrin:** Hörst du das? Der schönste Klang der Welt. Taler, die klimpern.

#### Schritt 6 – Der Herold (Wahl: Taler oder Schwert)

- *Auslöser:* erster abgeschlossener Handel (Meilenstein). Das Räuberlager wird kurz aufgedeckt, die Kaserne
  freigeschaltet, das Angebot „Kronstück freikaufen“ erscheint (1200 Taler, mit Lehmlieferung 800).
- *Ziel:* „Hol das zweite Kronstück: freikaufen (Angebot) oder das Räuberlager im Flusswald stürmen“
- *Warum (im Dialog):* Kauft Malvor es, besitzt er sein erstes Kronstück, ohne einen Finger zu rühren – und Nelia
  fehlt eins der fünf, die sie braucht, damit er nie König wird.
- *Dialog:*
  > **Herold:** Hört, Leute von Beaucroix! Statthalter Malvor grüßt die Stadt. Seine Kornwagen kommen – für alle, die ihm treu sind.
  >
  > **Herold:** Und er zahlt tausend Taler für das Kronstück im Flusswald.
  >
  > **Räuberhauptmann:** Tausend vom Statthalter! Wer zwölfhundert bietet, kriegt's. Sonst geht's nach Hagenfurt.
  >
  > **Nelia:** Kriegt Malvor es, hat er eins von fünf. Und uns fehlt eins.
  >
  > **Orrin:** Zwölfhundert. Wir haben zu wenig. Noch. Am Markt verdienen – oder holen.
  >
  > **Nelia:** Dann holen wir's uns, wenn's sein muss. Eine Kaserne bildet Leute an Schwert und Speer aus.

  (Die Kornwagen sind Erzählung: Korn ist keine Ware, am Markt gibt es keins.)
- *Dialog (Block 2, nach dem Block: + 30 s):*
  > **Orrin:** Zwei Wege, Kind. Nimm einen, bevor Malvor nachlegt.
  >
  > **Orrin:** Aber Soldaten wollen am Zahltag Sold. Jede Truppe frisst Taler, die dem Freikauf fehlen.
  >
  > **Nelia:** *[Hilfe, entfällt wenn eine Kaserne-Baustelle steht]* Die Kaserne steht bei „Militär“. Dort bildet man ganze Truppen auf einmal aus.
- *Zeiger:* „Bezahlen“ am Kronstück-Angebot bzw. Kachel „Kaserne“ – ein Zeiger: „Angebote“ für 90 s, danach die
  Kaserne, solange keine steht (Phasen, E3; ohne E3 nur die Kaserne wie heute). Ring auf dem Räuberlager.

- **Wahl A – Freikaufen:** Taler über Markt und Steuern sammeln, Angebot bezahlen (Merker `shardBought`).
  > **Räuberhauptmann:** Taler sind Taler. Nimm dein Goldstück, Händler.
  >
  > **Herold:** Der Statthalter wird sich merken, wer ihn überboten hat.

- **Wahl B – Stürmen:** Kaserne bauen, Schwertkämpfer ausbilden (Taler und Eisen), Lager angreifen.
  - *Ziel-Zusatz nach dem ersten Trupp:* „(Maus: ‚Truppen‘ wählt alle Soldaten und Helden, Rechtsklick aufs Lager ·
    Handy: ‚Truppen‘, dann das Lager antippen)“
  - *Erster Trupp ausgebildet (`event recruited`):*
    > **Nelia:** *[Hilfe, entfällt wenn eigene Truppen am Räuberlager stehen]* Alle zusammen, dann aufs Lager. Einzeln holen sie uns.
  - *Wachen besiegt (Merker `shardStormed`):*
    > **Gefangener:** Gnade! Hier, nehmt das Ding. Es hat uns nur Unglück gebracht.
    >
    > **Herold:** Der Statthalter wird sich merken, wer seine Ware gestohlen hat.
    >
    > **Nelia:** Seine Ware? Es lag in der Stadtkasse von Beaucroix.

  Folge in beiden Fällen: Merker `shard2`, offene Kronstück-Angebote schließen sich, Überfälle hören auf.

#### Schritt 7 – Steuern (Wahl: nehmen oder halten)

- *Auslöser:* erster Zahltag nach dem Herold (`all: [event payday, fired offer]`).
- *Ziel:* keins – eine Entscheidung im Spiel. Zeiger: „Burg“, mit E11 die ganze Steuerreihe (ohne E11 kein Zeiger
  auf eine einzelne Stufe, damit keine Wahl vorgegeben wird).
- *Warum (im Dialog):* Das Kronstück kostet Taler, und Taler kommen aus Steuern. Malvor nimmt viel. Was nimmt Nelia?
- *Mechanik ehrlich:* „Hoch“ bringt etwa 2,5 Taler mehr je Arbeiter und Zahltag (bei 10–15 Arbeitern 25–40 Taler alle
  zwei Minuten) und drückt die Stimmung langsam; „niedrig“ umgekehrt. In der Spieldauer dieser Mission sind das kleine
  Unterschiede. Die Zeilen versprechen deshalb nichts Großes; die Folge zeigt sich in den Reaktionen und im Abschluss.
- *Dialog:*
  > **Orrin:** Zwölfhundert Taler … Dreh die Steuern hoch. Ein paar Taler mehr an jedem Zahltag.
  >
  > **Nelia:** So macht es Malvor. Nehmen, bis keiner mehr kommen will.
  >
  > **Orrin:** Ein paar Taler machen noch keinen Malvor.
  >
  > **Nelia:** Aber einen Anfang.
  >
  > **Orrin:** *[Hilfe, kommt immer]* In der Burg stellt man's ein. Hoch bringt etwas mehr, und die Stimmung sinkt.

- **Wahl A – „Malvors Weg“** (Steuern „Hoch“ oder „Sehr hoch“; Funktionsbedingung auf die Steuerstufe; Merker
  `taxedHard`):
  > **Nelia:** Gut. Aber ich will ihre Gesichter sehen, nicht nur die Taler.

  Selten, nur bei lange „sehr hohen“ Steuern (`event workerLeft`, Grund Motivation):
  > **Nelia:** Da geht einer. Für ein paar Taler.

- **Wahl B – „Nelias Weg“** (Steuern „Niedrig“ oder „Keine“; Merker `taxedLight`):
  > **Orrin:** Niedrig! Mein Beutel weint. Aber die Leute lächeln. Das ist auch eine Währung.

- *Was zählt:* der Stand beim Sieg (`onVictory` setzt den endgültigen Merker).

#### Die Überfälle

- *Auslöser:* 5 Minuten nach dem Herold, danach alle 5 Minuten, höchstens dreimal, solange das Kronstück fehlt.
- *Dialog (erster Überfall):*
  > **Räuberhauptmann:** Malvors Anzahlung reicht für neue Klingen. Holt euch, was die Prinzessin hortet!
  >
  > **Orrin:** Er bezahlt sie dafür, uns arm zu machen. Billiger kann man nicht Krieg führen.
  >
  > **Orrin:** *[Hilfe, entfällt wenn „Wundsalbe“ benutzt wurde]* Bringt mir die Verwundeten. Meine Salbe heilt jeden, der nah bei mir steht.
- *Zeiger:* „Wundsalbe“ nur mit E4. Zieltext-Zusatz am Kronstück-Ziel während des Überfalls: „(Orrin allein wählen →
  ‚Wundsalbe‘, C)“.
- *Auslöser „Es brennt“ (erstes eigenes Gebäude unter halber Kraft, Funktionsbedingung, einmalig):*
  > **Nelia:** *[Hilfe, kommt einmal]* Da brennt ein Haus! Leibeigene hin, sie flicken es. Reparieren kostet nichts.

### Nebenziele

- **Lehmschuld** (Schritt 2): spart 400 Taler beim Freikauf.

### Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Malvors Herold zahlt die tausend Taler, und das Kronstück aus der
  Stadtkasse fährt den Fluss hinauf nach Hagenfurt.“

### Abschluss

> **Freigekauft:** Der Räuberhauptmann zählt die Taler zweimal. Beim Abschied grinst er: „Wisst ihr, warum euer
> Statthalter so gern Korn verspricht? Weil nur er welches hat. Der Winter ist nicht echt. Im Gebirge hinter
> Hagenfurt steht ein altes Wetterwerk. Malvor hat es wieder angeworfen.“
>
> **Gestürmt:** Der gefangene Räuber zittert, aber nicht vor Kälte. „Wir haben für Malvor Fuhren ins Gebirge
> geschützt. Hinter Hagenfurt, in einem Tal, steht ein Werk. Es brummt Tag und Nacht. Seitdem schneit es.“
>
> **Steuern hoch:** In Beaucroix sagen sie, die Prinzessin nehme wie ein Statthalter. Orrin findet das ein
> Kompliment. Nelia nicht.
> **Steuern niedrig:** In Beaucroix sagen sie, bei der Prinzessin bleibe einem mehr im Beutel als bei Malvor.
> Orrin rechnet nach, was ihn das gekostet hat, und hört lieber auf.
> **Steuern normal:** kein Satz.
>
> **Gemeinsam:** Zwei Kronstücke von fünf. Orrin wird blass. „Ein gemachter Winter. Dann sind die Kornlager kein
> Glück, sondern eine Falle.“ Nelia packt ihren Mantel. „Solange es Winter ist, muss jeder zu Malvor, der essen
> will. Erst das Werk. Dann die Kronstücke.“

*Antwort:* Ja – das zweite Kronstück ist Nelias, mit Talern oder mit Schwertern. Und sie weiß jetzt, worauf Malvors
Macht steht.

---
## Mission 3 – Das Wetterwerk

**Neu: ein Erzähler.** Er spricht nur zum Spieler: Er sagt jedes neue Ziel an (was und warum, ein bis zwei Sätze) und
erklärt Bedienung, die neu ist. Die Figuren reden nur miteinander und sprechen den Spieler nie an.

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Kann eine Handvoll Leute ohne Burg Malvors Winter brechen – und lebend vom Eis kommen?** Im Gesamtbogen ist das der
**Midpoint**: ein großer Sieg, der alles verändert. Der Winter endet, aber Malvor verliert damit seine stillste Waffe,
den Hunger, und greift ab jetzt zum Schwert. Und Nelia erfährt, dass das letzte Kronstück an Malvors eigenem Hals hängt.

### 2. Einleitungstext

> Zwei von fünf Kronstücken trägt Nelia bei sich, aus Lindgrund und aus Beaucroix. Doch in Beaucroix hat sie etwas
> erfahren, das schwerer wiegt als Gold: Der Winter ist nicht echt. Seit Jahren läuft hinter Hagenfurt, in einem Tal
> im Gebirge, eine alte Maschine – das Wetterwerk. Solange es läuft, liegt Schnee auf allen Feldern, und wer essen
> will, muss in Malvors Kornlager.
>
> Nelia und Orrin sind mit drei Trupps Freiwilliger aus Lindgrund und Beaucroix aufgebrochen, um das Werk zu
> zerstören. Eine Burg gibt es hier nicht, kein Dorf, keinen Nachschub. Wer fällt, ist fort. Nur Orrins Börse ist
> dabei: 400 Taler.

### 3. Ablauf

#### Start – Vor dem Bergkamm

- *Auslöser:* Missionsbeginn. Kamera auf die Gruppe vor dem Bergkamm, dann kurzer Schwenk über den Kamm.
- *Dialog:*
  > **Nelia:** Da ist der Bergkamm. Dahinter liegt das Tal mit dem Wetterwerk – der Maschine, die den Winter macht.
  >
  > **Orrin:** Zerstören wir sie, taut es im ganzen Kronland. Dann wächst überall Korn, und keiner muss mehr zu Malvor
  > betteln gehen.
  >
  > **Nelia:** Drei Trupps, wir zwei, keine Burg im Rücken. Wer hier fällt, kommt nicht wieder.
  >
  > **Orrin:** Und vierhundert Taler. Das ist alles, was zwischen uns und dem Heldentod steht.
- *Ziel:* „Zerstöre das Wetterwerk im Tal hinter dem Bergkamm – damit der Winter endet“
  > **Erzähler:** Dein Ziel: Zerstöre das Wetterwerk im Tal hinter dem Bergkamm. In dieser Mission hast du keine Burg –
  > du kannst keine neuen Soldaten ausbilden. Gib auf jeden Trupp acht.

#### Schritt 1 – Wie kommen wir ins Tal?

- *Auslöser:* direkt nach dem Startgespräch.
- *Dialog:*
  > **Orrin:** Der Kamm ist zu steil zum Klettern. Irgendwo muss es einen Durchgang geben. Nur wo?
  >
  > **Nelia:** Lass mich schauen. In Lindgrund sagen sie, ich sehe weiter als jeder andere im Dorf.
- *Ziel:* „Sieh mit Nelias Weitblick über den Bergkamm“
  > **Erzähler:** Nelia hat eine besondere Fähigkeit: Weitblick. Wähle Nelia allein aus und drücke den Knopf
  > „Weitblick“ – dann siehst du ein großes Stück Land hinter dem Kamm.
- *Erklärung:* Rahmen erst auf Nelias Bild, dann auf den Knopf „Weitblick“.
- *Falls nach einer Minute nichts passiert ist:* Das Spiel deckt Tor und Schlucht selbst auf; Nelia sagt: „Ich klettere
  auf den Felsen hier und schau selbst.“

#### Schritt 2 – Zwei Wege

- *Auslöser:* Weitblick benutzt. Tor und Schlucht werden aufgedeckt, die Kamera zeigt erst das Tor, dann die Schlucht.
- *Dialog:*
  > **Nelia:** Zwei Wege führen hinein. Da vorn das Tor: fünf Trupps und ein Turm mit einer Riesenarmbrust.
  >
  > **Orrin:** Fünf Trupps gegen unsere drei? Da rechne ich nicht lange. Und der zweite Weg?
  >
  > **Nelia:** Die Schlucht dort links. Durch sie fließt der Fluss ins Tal, und der ist zugefroren. Im Winter trägt das
  > Eis uns wie eine Straße.
  >
  > **Orrin:** Malvors eigener Winter baut uns den Weg zu seiner Maschine. Das gefällt mir.
  >
  > **Nelia:** Aber wenn das Werk fällt, taut das Eis. Wer dann darauf steht, ertrinkt.
- *Ziel:* „Bring die Gruppe durch die Schlucht ins Tal – über den gefrorenen Fluss“
  > **Erzähler:** Im Winter sind Flüsse und Seen zugefroren, und man kann über das Eis laufen. Führe die Gruppe durch
  > die Schlucht ins Tal. Das Tor ist zu stark bewacht.
  >
  > **Erzähler:** Mit dem Knopf „Truppen“ wählst du alle Soldaten und beide Helden auf einmal aus.

#### Schritt 3 – Der Posten in der Schlucht

- *Auslöser:* Der Posten am Ausgang der Schlucht kommt in Sicht.
- *Dialog:*
  > **Nelia:** Zwei Trupps Wachen auf dem Eis, am Ende der Schlucht. Die lassen uns nicht einfach durch.
  >
  > **Orrin:** Die stehen seit Wochen in der Kälte, für Malvors Sold. Leute, die frieren, kann man kaufen.
  >
  > **Nelia:** Und wenn sie nicht wollen?
  >
  > **Orrin:** Jeder will. Es ist nur eine Frage des Preises.
  >
  > **Erzähler:** Orrin kann einen feindlichen Trupp bestechen: Wähle Orrin allein, führe ihn nah an den Trupp und
  > drücke „Bestechen“. Das kostet 200 Taler und 50 je Soldat. Du kannst den Posten auch im Kampf besiegen – dann
  > behältst du das Geld, verlierst aber vielleicht Leute.
- *Erklärung:* Rahmen auf Orrins Bild, dann auf „Bestechen“.
- *Nach dem Bestechen:*
  > **Orrin:** Bezahlt und umgedreht. Der beste Handel, den ich diesen Winter gemacht habe.

#### Schritt 4 – Im Tal

- *Auslöser:* Die Gruppe erreicht den Talboden hinter der Schlucht. Kamera zeigt den See mit der Insel, dann die Ruinen.
- *Dialog:*
  > **Nelia:** Wir sind drin. Da, mitten im See, auf der Insel – das ist das Wetterwerk. Hörst du das Brummen?
  > Solange das läuft, schneit es im ganzen Kronland.
  >
  > **Orrin:** Und dort drüben am Talrand die Ruinen. Das war Hrimgars Festung – der Mann, der das Werk vor Jahrhunderten
  > gebaut hat.
  >
  > **Orrin:** Wer so eine Maschine baut, hinterlässt Zeichnungen. Holen wir sie, bevor wir das Werk zerschlagen.
  >
  > **Nelia:** Wozu brauchen wir die Pläne einer Maschine, die wir kaputt machen wollen?
  >
  > **Orrin:** Weil Malvor sie auch hat. Was er weiß, sollten wir auch wissen.
- *Ziele:* „Zerstöre das Wetterwerk auf der Insel im See“ · „Hol Hrimgars Baupläne aus den Ruinen am Talrand“
  > **Erzähler:** Zwei Ziele im Tal: Zerstöre das Wetterwerk auf der Insel. Und schick Nelia oder Orrin zu den Ruinen
  > am Talrand – dort liegen die Baupläne der Maschine.
- *Pläne gefunden (ein Held erreicht die Ruinen):*
  > **Orrin:** Hier sind die Pläne! Türme, Röhren, Kessel … und überall dasselbe Wort: Schwefel. Ich verstehe kaum
  > etwas davon, aber ich hebe die Blätter gut auf.
  >
  > **Nelia:** Gut. Jetzt das Werk.

#### Schritt 5 – Vor dem Angriff

- *Auslöser:* Die Gruppe nähert sich dem Seeufer.
- *Dialog:*
  > **Nelia:** Bevor wir aufs Eis gehen: Fällt das Werk, haben wir eine Minute, bis das Eis bricht.
  >
  > **Orrin:** Und auf der Insel bleiben geht auch nicht. Sobald das Wasser offen ist, sitzen wir dort fest.
  >
  > **Nelia:** Also zuschlagen und sofort zurück ans Ufer.
  >
  > **Orrin:** Ich schwimme wie ein Sack Mehl. Nur dass du's weißt.
  >
  > **Erzähler:** Merke dir den Weg zurück: Nach der Zerstörung des Wetterwerks hast du 60 Sekunden, um Nelia und Orrin
  > auf festes Ufer zu bringen. Der Ring zeigt eine sichere Stelle.
- *Erklärung:* Ein Ring markiert das feste Ufer.

#### Schritt 6 – Alarm

- *Auslöser:* Jemand von uns betritt die Insel.
- *Dialog:*
  > **Wache:** Eindringlinge am Werk! Alarm! Torwache, zum See!
  >
  > **Nelia:** Jetzt kommen sie vom Tor über das Eis. Schnell – das Werk zuerst, bevor sie hier sind!
  >
  > **Erzählerin:** Die Wachen haben Alarm geschlagen: Vom Tor kommen zwei weitere Trupps. Greif das Wetterwerk an –
  > wähle deine Truppen und klicke mit Rechtsklick auf das Gebäude – bevor die Verstärkung da ist.

#### Schritt 7 – Tauwetter

- *Auslöser:* Das Wetterwerk ist zerstört. Eine Uhr läuft 60 Sekunden.
- *Dialog:*
  > **Nelia:** Es ist still. Das Brummen ist weg … und das Eis knackt.
  >
  > **Orrin:** Runter vom See! Alle! In einer Minute ist das hier Wasser!
- *Ziel:* „Tauwetter! Bring Nelia und Orrin in 60 Sekunden auf festes Ufer“
  > **Erzähler:** Das Eis taut! Bring Nelia und Orrin in 60 Sekunden auf festes Ufer – nicht auf die Insel. Wer auf
  > dem Eis bleibt, ertrinkt.
- *Nach 5 Sekunden:*
  > **Wache:** Das Wetterwerk brennt! Fangt sie am Ufer ab, bevor sie entkommen!
- *15 Sekunden vor Schluss, falls ein Held noch auf dem Eis oder der Insel steht:*
  > **Orrin:** Das Eis wird grau! Lauf, Nelia, lauf!
- *Tauwetter überstanden:*
  > **Nelia:** Wir stehen auf festem Boden. Und schau – es tropft von den Felsen. Zum ersten Mal seit Jahren.
- *Nur wenn die Baupläne noch fehlen:*
  > **Erzählerin:** Das Wetterwerk ist zerstört. Jetzt fehlen nur noch Hrimgars Baupläne – die Zeichnungen der
  > Maschine. Schick Nelia oder Orrin zu den Ruinen am Talrand.
- *Sind die Pläne schon gesichert, ist die Mission gewonnen.*

### 4. Nebenziel: Die Gefangenen

- *Auslöser:* Das Gefangenenlager am Talrand kommt in Sicht.
- *Dialog:*
  > **Nelia:** Da drüben, hinter dem Zaun – Gefangene. Leute aus den Dörfern. Malvor lässt sie hier das Werk heizen.
  >
  > **Orrin:** Nur zwei Trupps Wachen. Und Leute, die man befreit, kämpfen gern mit.
- *Ziel:* „Optional: Vertreib die Wachen am Gefangenenlager – die Befreiten kämpfen mit dir“
  > **Erzähler:** Ein freiwilliges Ziel: Besiege die Wachen am Gefangenenlager. Die Befreiten schließen sich dir mit
  > zwei Trupps Speerträgern an.
- *Befreit:*
  > **Gefangener:** Ihr kommt aus Lindgrund? Dann seid ihr die mit der Prinzessin! Wir holen unsere Speere.
  >
  > **Nelia:** Holt eure Speere. Und dann helft uns, die Maschine abzustellen, die euch hierher gebracht hat.

### 5. Niederlagentexte

- *Nelia und Orrin bewusstlos:* „Nelia und Orrin liegen im Schnee, und Malvors Wachen kommen. Das Werk brummt weiter.
  Der Winter bleibt.“
- *Ein Held beim Tauwetter auf dem Eis:* „Das Eis bricht mitten auf dem See. Der Winter hat sich ein letztes Opfer
  geholt.“
- *Ein Held beim Tauwetter auf der Insel:* „Das Wasser ist offen. Auf der Insel sitzen Nelia und Orrin fest – bis
  Malvors Leute mit Booten kommen.“

### 6. Abschlusstext

> Zum ersten Mal seit Jahren tropft es von den Dächern. Über den Bergen reißt der Himmel auf, und in den Tälern riecht
> es nach nasser Erde. In Lindgrund, erzählt man später, hat jemand gesät.
>
> In Orrins Tasche knistern Hrimgars Pläne. Ein gefangener Wächter verrät für ein Stück Brot noch etwas: Malvor trägt
> selbst ein Kronstück – das von Hagenfurt –, an einer Kette um den Hals. Er legt es nie ab.
>
> Zwei von fünf Kronstücken hat Nelia. Eines hängt an Malvors Hals. Die anderen beiden liegen noch irgendwo im Land.
>
> In Hagenfurt erfährt Malvor in derselben Nacht, wer ihm den Winter genommen hat. Er sagt nur einen Satz: „Wenn der
> Hunger sie nicht mehr hält, dann eben das Eisen.“ Am nächsten Morgen marschiert Hauptmann Taran nach Eisenhain.

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
- *Erklärung:* Zeiger: „Angebote“ (ein Zeiger; die Gruben-Ziele zeigen erst danach). Mit 900 Talern gehen die
  Geflohenen sofort; Söldner erst nach etwas Wirtschaft (Steuern, Gruben).

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
- *Ziel:* „Baue eine Eisengrube – Schwerter brauchen Eisen (Baumenü → ‚Rohstoffe‘, nur auf dem Eisenschacht)“
- *Warum:* Die Kaserne bildet Schwertkämpfer nur mit Talern und Eisen aus. Und jedes Stück Eisen, das wir fördern,
  hat Malvor nicht.
- *Erklärung:* wie die Lehmgrube, aber auf dem Eisenschacht (Bezug aus `ensureShaft`). Zeiger: Kachel
  „Eisengrube“, Ring auf dem Schacht.
- *Dialog (nach dem Startblock: + 30 s):*
  > **Nelia:** Ohne Eisen keine Schwerter. Und jedes Stück, das wir graben, fehlt Malvor.
  >
  > **Nelia:** *[Hilfe, entfällt wenn die Baustelle der Eisengrube steht]* Eine Grube wie daheim die Lehmgrube – dort, wo das Eisen rostrot aus dem Hang tritt.
  >
  > **Orrin:** Bergleute wollen Bett und Tisch, wie alle. Vergiss die Höfe nicht.

#### Schritt 2 – Schwefel

- *Auslöser:* nach dem Start (gleichzeitig mit Schritt 1).
- *Ziel:* „Baue eine Schwefelgrube – Malvor will den Schwefel für ein neues Wetterwerk (Baumenü → ‚Rohstoffe‘)“
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
- *Ziel-Zusatz (Maus/Handy gleich):* „(Hochschule bauen → wählen → ‚Forschung‘ → ‚Stehendes Heer‘ → Schießplatz
  bauen)“
- *Erklärung:* Gelehrte sind Arbeiter (Bett, Essen). Zeiger-Phasen (E3): 1. Kachel „Hochschule“ (Gruppe
  „Verwaltung“), solange keine steht; 2. „Stehendes Heer“, bis erforscht; 3. Kachel „Schießplatz“. Ohne E3 nur
  Phase 1 (wie heute mit `uiWhile`). Als Nebenziel zeigt es ohnehin erst, wenn kein Hauptziel einen Zeiger hat.
- *Dialog:*
  > **Orrin:** Schwerter allein brechen keine Belagerung. Tarans Lager stehen hinter Palisaden.
  >
  > **Orrin:** *[Hilfe, entfällt wenn eine Hochschule-Baustelle steht]* Bau eine Hochschule und lass die Gelehrten „Stehendes Heer“ ausarbeiten. Dann bildet ein Schießplatz Bogenschützen aus.
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
  >
  > **Orrin:** Und je mehr eigene Leute wir haben, desto lieber geben die Bergleute Eisen dazu.

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

- *Rückfall, falls Nelia nie am vorderen Lager war* (Auslöser `heroDown taran` **oder** Belagerung gebrochen, mit
  `not fired meetTaran`; läuft vor der Zeile „Rückzug“): Die Erkennung muss passieren, Mission 5 baut darauf.
  > **Taran:** Warte. Die da, mit dem Zopf. Kornlager Hagenfurt, der Holzplatz.
  >
  > **Taran:** Die Tochter vom Holzfäller aus Lindgrund. Und die nennen sie Prinzessin?
  >
  > **Nelia:** Ich hab nie gesagt, dass ich eine bin.
  >
  > **Taran:** Aber auch nie laut genug, dass du keine bist.

- *Taran bewusstlos:*
  > **Taran:** Genug. Rückzug! … Wir sehen uns, Holzfällerstochter.
  >
  > **Orrin:** Er weiß es. Und er reitet nach Hagenfurt.
  >
  > **Nelia:** Dann haben wir nicht viel Zeit.

  Taran verlässt die Karte (wer den Abzug zeigen will: erst Laufbefehl zum Kartenrand, dann `remove`). Erklärung
  zum feindlichen Helden:
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
  > **Orrin:** *[Hilfe, entfällt wenn eine Wachturm-Baustelle steht]* Bau einen. Stein kostet er, Schlaf nicht.

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
| Diplomatie: verbündet, neutral, feindlich – was das heißt | Herold (Ring aufs Dorf, Fortschritt „1/3“; kein Zeiger) |
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
- *Sprecher:* Die Älteste von Moorbrook ist ein eigener Sprecher, **„Älteste von Moorbrook“** (E12; eigene Stimme,
  damit sie nicht mit der Dorfältesten von Erlenhof verwechselt wird). Die beiden Speertrupps im Lager kommen je
  einer aus Moorbrook und aus Schilfheim (in `setup` zwei Bezüge).
- *Mit K1 (M4), eine Zeile vor dem Dialog:*
  - `refugees`: **Dorfbewohnerin:** „Wir aus dem Kornlager sind mitgekommen, Nelia. Für uns selbst, wie du gesagt hast.“
  - `mercs`: **Orrin:** „Die Söldner aus Eisenhain sind weitergezogen. Bezahlt ist bezahlt.“
- *Dialog:*
  > **Älteste von Moorbrook:** Prinzessin! Morvale steht zu dir. Unsere Speerträger halten Wache an deinem Lager.
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
- *Ziel:* „Optional: Bring Nelia zur Ältesten von Moorbrook, bevor Malvors Herold da ist“ (Restzeit als Uhr mit E8,
  sonst ein zweites `survive`-Ziel „Der Herold kommt“; der Weg dauert nur ~11 s – eine echte Wahl, kein Rennen)
- *Warum:* Dieselbe Wahrheit wiegt anders, je nachdem, wer sie sagt.
- ⚠ Änderung: neue Gesprächsfigur (Dorfälteste von Moorbrook, nur Nelia) mit Frist bis zum Herold (2,5 Minuten);
  hat Nelia vorher mit ihr gesprochen, bleibt Moorbrook verbündet und **Moorbrooks** Speertrupp bleibt im Lager (der
  von Schilfheim geht). Beim Herold wird die Figur entfernt, das Ziel scheitert still. Begründung:
  Nelias Wachstum wird zur Spielerhandlung, und Ehrlichkeit hat einen spürbaren Lohn.

- **Wahl A – Nelia sagt es selbst** (Merker `confessed`):
  > **Nelia:** Ich bin keine Prinzessin. Ich bin die Tochter eines Holzfällers aus Lindgrund.
  >
  > **Nelia:** Orrin hat's erfunden, und ich hab geschwiegen, weil es geholfen hat. Das war falsch.
  >
  > **Älteste von Moorbrook:** Eine, die die Wahrheit sagt, bevor sie muss. Das ist mehr wert als Blut. Moorbrook bleibt.
  >
  > **Orrin:** *(leise)* Gratuliere. Ein Dorf von dreien. Den Rest erledigt jetzt der Herold.

#### Schritt 1 – Der Herold (All Is Lost)

- *Auslöser:* 150 Sekunden nach Start.
- **Fassung A (Nelia hat es schon gesagt):**
  > **Herold:** Hört, Leute von Morvale! Die „Prinzessin“ ist die Tochter eines Holzfällers aus Lindgrund!
  >
  > **Älteste von Moorbrook:** Wissen wir. Sie hat's uns selbst gesagt.
  >
  > **Herold:** Dann folgt ihr einer, die sich ertappt fühlt. Ein Händler hat die Lüge erfunden – für Geld.
  >
  > **Herold:** Und das Kronstück in Erlenhof gehört dem Statthalter. Gebt es heraus!

  > **Dorfbewohnerin:** Schilfheims Speerträger gehen heim. Wir wissen nicht mehr, wem wir glauben sollen.

  Schilfheim und Erlenhof werden neutral, Schilfheims Speertrupp verlässt das Lager.
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
  > **Älteste von Moorbrook:** Unsere Speerträger gehen heim. Wir wissen nicht mehr, wem wir glauben sollen.

  Alle drei Dörfer werden neutral, beide Speertrupps verlassen das Lager.
- *Baustein:* zwei Herold-Auslöser (`all: [time 150, flag confessed]` / `not flag confessed`) und ein gemeinsamer
  Anker `herald` (`any: [fired …]`) für alle späteren `delay`s.
- *Erklärung (Hilfe, gleich danach):*
  > **Orrin:** *[Hilfe, kommt immer, nach dem Herold-Block: Anker + 30 s]* Neutral heißt: Sie greifen nicht an. Aber sie helfen nicht, und wir sehen nicht mehr, was bei ihnen los ist.

#### Dark Night of the Soul

- *Auslöser:* nach dem Herold-Block und der Neutral-Zeile (Anker `herald` + 45 s).
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
- *Mit K1 (M1), eine Zeile vorn angehängt:*
  - `neighborsTruth`: **Nelia:** „Die Alte in Lindgrund hat mir geglaubt, als ich die Wahrheit sagte. Die hier werden es auch.“
  - `neighborsLie`: **Nelia:** „Schon in Lindgrund hab ich dich reden lassen. Hier nicht mehr.“
  - kein Besuch beim Nachbardorf: keine Zeile.

#### Schritt 2 – Lieferungen (Break into Three)

- *Auslöser:* nach der Dark Night. Drei Angebote erscheinen (bzw. zwei, wenn Moorbrook verbündet blieb).
- *Ziel:* „Gewinne die Dörfer durch Lieferungen zurück (verbündete Dörfer: 1 von 3 …)“
- *Warum:* Die Dörfer folgen dem, der sie satt macht und Wort hält. Malvor fordert, Nelia liefert – ohne etwas zu
  verlangen. Moorbrook braucht Dächer (Holz, Lehm), Schilfheim einen Deich (Stein, Eisen), Erlenhof Saatgut und eine
  Scheune (Taler, Lehm).
- *Ziel-Zusatz:* „(Feld ‚Angebote‘ → ‚Bezahlen‘; Eisen fördert eine Eisengrube auf dem Eisenschacht)“
- *Erklärung:* Lieferungen sind Angebote; Eisen muss erst gefördert werden. Zeiger: „Angebote“; Ring auf dem
  Eisenschacht (in `setup` per `ensureShaft('iron', …)` sicherstellen und als Bezug merken – c5 hat das heute nicht).
  Wer zu wem steht, zeigt der Fortschritt „verbündet 1/3“ und der Ring auf dem nächsten neutralen Dorf, kein Zeiger.
- *Dialog:*
  > **Nelia:** Sie wollen keine Prinzessin. Sie wollen Dächer, einen Deich und Saatgut.
  >
  > **Orrin:** Liefern. „Wer liefert, dem glaubt man“, hat der Kaufmann in Beaucroix gesagt.
  >
  > **Nelia:** Gesagt hat er's zu dir. Bezahlt hab ich.
  >
  > **Orrin:** *[Hilfe, entfällt wenn schon geliefert wurde]* Jedes Dorf hat aufgeschrieben, was es braucht. Zahlen wir, geht die Ware sofort hin.
  >
  > **Nelia:** Für den Deich brauchen wir Eisen, und wir haben keins. Eine Grube auf den Eisenschacht, schnell.
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
  > **Nelia:** Bei den Höfen von Moorbrook. Brennen die, gehört Morvale Malvor.
  >
  > **Orrin:** Ein Hauptmann, der Nein sagt. Seltener als jede Prinzessin.
- *Ziele:* „Schütze die Höfe von Moorbrook“ und „Vertreibe Malvors restliche Truppen“
- *Warum (im Dialog, Nelia in Block 2):* Brennen die Höfe, hungert Moorbrook – und Morvale gehört Malvor, weil nur er
  noch Korn hat. Die Dörfer sehen genau hin, wer ihre Höfe verteidigt.
- *Ziel-Zusatz (Maus):* „(Taran allein wählen → ‚Schildstoß‘ X trifft alle rundum, ‚Einschüchtern‘ C jagt Feinde
  davon)“ · *(Handy):* „(Tarans Bild antippen → ‚Schildstoß‘ oder ‚Einschüchtern‘)“
- *Erklärung:* Tarans Fähigkeiten; Schutzziel. Zeiger (Liste): „Schildstoß“ → Tarans Bild; Ring an den Höfen.
- *Dialog (Hilfe, nach Block 2: + 25 s):*
  > **Taran:** *[Hilfe, entfällt wenn „Schildstoß“ benutzt wurde]* Lasst mich vorn allein stehen. Mein Schildstoß trifft alle rundum.
  >
  > **Taran:** *[Hilfe, entfällt wenn „Einschüchtern“ benutzt wurde]* Und wenn ich brülle, laufen sie eine Weile. Dann greifen sie nicht an.

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
- *Mit K1 (M2 Steuern), eine Zeile davor (bei „normal“ keine):*
  - niedrig: **Dorfälteste:** „Man erzählt, in Beaucroix hast du den Leuten mehr gelassen als jeder Statthalter.“
  - hoch: **Dorfälteste:** „Man erzählt, in Beaucroix hast du genommen wie Malvor. Hier hast du gegeben. Das zählt.“

### Nebenziele

- **Optional: Baue 4 eigene Bauernhöfe** – *Warum (im Dialog, beim Erscheinen nach der ersten Lieferung):*
  > **Nelia:** Und wir bauen eigene Höfe. Wer selbst Korn hat, muss keinem etwas wegnehmen.

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
- *Dialog (Block 2, nach dem Block: + 30 s):*
  > **Taran:** Malvor hat sein eigenes Kraftwerk. Dort, auf der kleinen Insel vor dem Schloss.
  >
  > **Taran:** Ist es geladen, taut er den See, sobald einer von uns aufs Eis tritt.
  >
  > **Taran:** Aber vom Ufer treffen es Bogenschützen. Kanonen auch, wenn ihr die Zeit habt.
  >
  > **Orrin:** Für unser Kraftwerk: Alchimisten, Schwefel, Geduld. Oder Gelehrte aus Beaucroix – achtzehnhundert Taler.
  >
  > **Nelia:** Wir haben fünfzehnhundert. Und lernen wir's selbst, bleiben die Taler für Soldaten.
- *Erklärung:* Mit 1500 Startgold ist der Kauf (1800 Taler, 400 Schwefel) anfangs **nicht** bezahlbar – erst nach ein,
  zwei Zahltagen oder etwas Handel. Der Text sagt das ehrlich. Zeiger: die Forschungsphasen (Schritt 1); das Angebot
  steht sichtbar im Feld „Angebote“. Malvors Ladebalken steht beim Nebenziel.

#### Schritt 1 – Wetterkunde (Wahl: kaufen oder forschen)

- *Auslöser:* nach dem Start.
- *Ziele (nacheinander; der Kauf erfüllt alle drei – die Forschungen von selbst, den Ausbau per `complete`):*
  1. „Erforsche ‚Wettervorhersage‘ in der Alchimistenhütte (Hütte wählen → ‚Technologien‘)“
  2. „Baue die Alchimistenhütte zum Laboratorium aus (Hütte wählen → ‚Ausbauen‘)“
  3. „Erforsche ‚Meteorologie‘ im Laboratorium“
- *Warum:* Erst wer das Wetter versteht, kann es machen. Jede Stufe kostet Schwefel – den Schwefel, den Malvor in
  Eisenhain nicht bekommen hat.
- *Erklärung:* Werkstattforschung; Ausbau als Voraussetzung; Alchimisten sind Arbeiter (Bett, Essen).
  Zeiger-Phasen (E3): 1. „Wettervorhersage“, bis erforscht; 2. „Ausbauen“ (Ring auf der Hütte), bis begonnen;
  3. „Meteorologie“. Ohne E3: je Ziel sein eigener Zeiger, das genügt hier, weil die Ziele nacheinander erscheinen.
- *Dialog (nach Block 2: + 30 s):*
  > **Orrin:** *[Hilfe, entfällt wenn eine Forschung begonnen hat (`event researchStarted`) oder das Wissen gekauft ist]* Fang in der Alchimistenhütte an. Erst die Wettervorhersage. Die kostet Schwefel.
  >
  > **Orrin:** Ohne Alchimisten forscht keiner. Und Alchimisten wollen essen. Wie immer.
- *„Wettervorhersage“ fertig (auf dem Forschungsweg):*
  > **Orrin:** *[Hilfe, entfällt wenn der Ausbau begonnen hat]* Für die Meteorologie braucht's ein Laboratorium. Bau die Hütte aus.
  >
  > **Nelia:** Hrimgar hat Jahre gebraucht. Wir haben Hagenfurts Garde im Nacken.
- **Wahl A – Wissen kaufen** (1800 Taler, 400 Schwefel; im `onPaid` Merker `knowledgeBought` setzen):
  > **Gelehrte:** Hrimgars Zeichnungen sind wirr, aber vollständig. Ihr könnt sofort bauen.
  >
  > **Orrin:** Teuer, ja. Aber Zeit ist das Einzige, was man nicht nachkaufen kann.
- **Wahl B – selbst forschen:** günstiger, langsamer; das Gold bleibt für Truppen.
- *Malvors Garde (Meilenstein: Wettervorhersage erforscht oder gekauft, spätestens nach 10 Minuten; danach alle
  5 Minuten):*
  > **Malvor:** Hagenfurts Garde! Zeigt dieser Bauernmagd, was Ordnung heißt.
  >
  > **Taran:** Sie kommen über Land, von Norden. Wachtürme dort, und eine Truppe, die hält.
  >
  > **Taran:** Und für den Sturm übers Eis brauchen wir ein Heer. Acht Truppen, besser mehr.

#### Schritt 2 – Das Wetterkraftwerk

- *Auslöser:* „Meteorologie“ erforscht oder gekauft.
- *Ziel:* „Baue das Wetterkraftwerk – drei Wettertechniker brauchen Bett und Essen“
- *Warum:* Erst mit dem eigenen Kraftwerk kann Nelia den See frieren lassen. Und erst wenn sie das kann, muss Malvor
  sein eigenes einsetzen.
- *Ziel-Zusatz:* „(Baumenü → ‚Verwaltung‘ → Wetterkraftwerk)“
- *Erklärung:* Wettertechniker sammeln Energie, nur mit Bett und Essen schnell. Zeiger: Kachel „Wetterkraftwerk“.
- *Dialog:*
  > **Orrin:** Röhren, Kessel, Zahnräder. Genau wie auf Hrimgars Blättern. Nur diesmal gehört es uns.
  >
  > **Nelia:** Und diesmal hungert keiner dafür.
  >
  > **Orrin:** Drei Wettertechniker ziehen dort ein. Ohne Bett und Tisch laden sie langsam.

#### Schritt 3 – Winter (Ausführung)

- *Auslöser:* Wetterkraftwerk fertig.
- *Ziel:* „Lass den Thronsee zufrieren (Wetterkraftwerk wählen, Ladung abwarten → ‚Wetter herbeiführen‘ → Winter)“ –
  Maus und Handy gleich.
- *Warum:* Nur im Winter führt ein Weg zum Schloss.
- *Erklärung:* Ladebalken, Wetterwechsel, Dauer. Zeiger (Liste): „Winter“ → „Wetterenergie“ (solange der Winter
  noch nicht wählbar ist, leuchtet der Balken).
- *Dialog:*
  > **Orrin:** *[Hilfe, entfällt wenn wir das Wetter schon gewechselt haben]* Der Balken am Kraftwerk zeigt die Ladung. Ist er voll, ruf den Winter.
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
  >
  > **Taran:** Und sein Turm am Inselufer schießt auf jeden, der übers Eis kommt.

#### Schritt 4 – Malvors Tauwetter (Überraschung, Wahl)

- *Auslöser:* Jemand von uns steht auf dem gefrorenen See, und Malvors Kraftwerk ist geladen und bereit
  (unverändert: derselbe Befehl wie beim Spieler).
- **Wahl A – Köder** (Leibeigene oder Truppen aufs Eis, um ihn zum Tauen zu bringen): Wer auf dem Eis steht, ertrinkt;
  danach muss Malvor laden und drei Minuten warten. Merker `drowned`, sobald eigene Figuren ertrunken sind (Baustein:
  in `malvorThaws` eigene Figuren auf dem Eis vor dem Befehl zählen; allgemein E5).
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
- *Das Schloss fällt (Malvors letzte Worte, dann Sieg):*
  > **Malvor:** Ohne mich … wer gibt ihnen dann Korn?
  >
  > **Nelia:** Sie selbst. Das hätten sie immer gekonnt.

### Nebenziele

- **Optional: Zerstöre Malvors Wetterkraftwerk** (Balken: seine Ladung) – siehe Schritt 4, Wahl B.
- **Optional: Zerstöre Malvors Turm am Ufer der Insel** – *Warum:* Er schießt auf jeden, der übers Eis kommt.
- **Optional: Stelle ein Heer aus 8 Truppen auf** – *Erfüllt:* 500 Taler.
  > **Taran:** Gute Leute. Sie wissen, wofür sie kämpfen. Das wussten meine nie.

### Niederlage

- *Burg gefallen:* „Die Ufersiedlung ist gefallen. Malvor trägt bald fünf Kronstücke, und niemand wird ihm je wieder
  widersprechen.“

### Abschluss (Finale und Final Image)

> Das Inselschloss ist gefallen, und mit ihm Malvor. Er hat bis zuletzt auf der Treppe seines Schlosses gekämpft,
> mit seiner Garde, die ihm gehorchte, bis keiner mehr stand. Nelia kniet neben ihm und nimmt die Kette von seinem
> Hals. Fünf Kronstücke von fünf. Ob er am Tod des alten Königs schuld war, hat er mitgenommen.
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

Kennungen in der letzten Spalte sind `data-testid`-Werte für `hint.ui` (Zeiger). Mehrere Kennungen mit Komma sind eine
Liste (der erste sichtbare Knopf leuchtet; so zeigt das Handy automatisch auf den aufklappenden Knopf); „→“ sind
Phasen (E3). „Ring“ = Zielort auf der Karte (`hint.area`/`hint.entity`). Zeiger von Nebenzielen und aus Auslösern
sind nur mit E4 sichtbar, solange ein Hauptziel zeigt.

| Steuerung / Mechanik | Erstmals | Wer erklärt | Zeiger |
|---|---|---|---|
| Kamera schieben, drehen, zoomen | M1 Schritt 1 | Zieltext (Maus/Handy) | – |
| Held auswählen, laufen lassen | M1 Schritt 1 | Orrin | `quick-hero-nelia`, Ring am Fremden |
| Gesprächsfigur (Ausrufezeichen) ansprechen | M1 Schritt 1–2 | Orrin (Ruf), Zieltext | Ring an der Figur |
| Ziele-Liste, „Ziel zeigen“, goldener Ring | M1 Schritt 3 | Zieltext; Orrin (Ring) | `objective-go-root`, `objectives-toggle` |
| Leibeigene auswählen („Alle“, Rahmen) | M1 Schritt 4 | Zieltext; Orrin | `quick-all` (Handy: `minimap-toggle` über `data-hint-for`) |
| Holz abbauen (Haufen, Bäume), Vorrat oben | M1 Schritt 4 | Orrin | Ring an den Balken, `res-bar` |
| Baumenü öffnen, Gebäude setzen, „Hier bauen“ | M1 Schritt 5 | Zieltext; Orrin | `place-confirm`, `build-villageCenter`, `quick-all` |
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
| Burg auswählen, Leibeigene kaufen | M1 „Zahltag“, Nebenziel | Orrin, Zieltext | `buy-serf`, `quick-hq` (nur mit E4) |
| Zweiten Helden wählen, bestimmter Held für ein Gespräch | M1 Nebenziel „Nachbardorf“ | Orrin, Zieltext | `quick-hero-orrin` (nur mit E4) |
| Verbündete | M1 Nebenziel | (Abschluss) | – |
| „Zu den Waffen!“, Miliz, angreifen | M1 Schritt 9 | Orrin, Zieltext | Phase 1: `militia`, `quick-hq` |
| Heldenfähigkeit („Mut machen“) | M1 Schritt 9 | Nelia, Orrin, Zieltext | Phase 2 (E3): `ability-courage`, `quick-hero-nelia` |
| Helden bewusstlos statt tot | M1 Schritt 9 | Orrin | – |
| „Entwarnung“ | M1 Schritt 9 (Sieg) | Orrin | Phase 3 (E3): `militia-off` |
| Angebote (Tribute), bezahlen | M2 Schritt 2 | Orrin, Zieltext | `tribute-pay-clay`, `tributes-toggle` (Nebenziel: nur mit E4) |
| Ausbauen (ohne Leibeigene) | M2 Schritt 4 (eigenes Teilziel) | Orrin, Zieltext | `upgrade`, Ring auf dem Lager |
| Händler sind Arbeiter | M2 Schritt 1/5 | Orrin | – |
| Marktplatz: tauschen, Preise | M2 Schritt 5 | Orrin, Zieltext | `trade-go`, Ring auf dem Marktplatz (Folge nur im Text) |
| Zwei Angebote schließen einander aus | M2 Schritt 6 | Orrin | `tributes-toggle` |
| Kaserne, „Volle Einheit“, Sold | M2 Schritt 6 | Nelia, Orrin | `build-barracks` |
| Alle Truppen wählen, angreifen | M2 Weg „Sturm“ (sonst M3 Schritt 2) | Zieltext; Nelia | `quick-army` |
| Steuern einstellen, Stimmung | M2 Schritt 7 | Orrin, Nelia | `quick-hq`; mit E11 `tax-row` (kein einzelner `tax-*`) |
| „Wundsalbe“ | M2 erster Überfall | Orrin, Zieltext | `ability-salve` (nur mit E4) |
| Reparieren | M2 Auslöser „Es brennt“ | Nelia | `repair` |
| Mission ohne Burg | M3 Start | Nelia | – |
| „Weitblick“ | M3 Schritt 1 | Nelia, Zieltext | `ability-farsight`, `quick-hero-nelia` |
| Eis trägt im Winter | M3 Schritt 1–2 | Orrin | Ring an der Schlucht |
| „Bestechen“ | M3 Schritt 2 (Schlucht) | Orrin | `ability-bribe` |
| Steuergruppen | M3 Schritt 2 | nur Zieltext | – |
| Tauwetter | M3 Start, Schritte 4–5 | Orrin | Ring am Ufer |
| Gefangene befreien | M3 Nebenziel | Nelia | Ring am Lager |
| Mehrere Wege zeigen | M3 Schritt 2 | Wegweiser-Ziele | Ring am ersten, „Ziel zeigen“ an beiden |
| Eisen- und Schwefelgrube | M4 Schritte 1–2 | Nelia, Orrin | `build-ironMine`, `build-sulfurMine` |
| Hochschule, Forschung | M4 Schritt 3 | Orrin, Zieltext | Phasen (E3): `build-university` → `tech-standingArmy` → `build-archery` |
| Schießplatz, Bogenschützen | M4 Schritt 3 | Orrin | (Phase 3, s. o.) |
| Truppenarten | M4 Schritt 4 | Orrin, Nelia | – |
| Feindlicher Held | M4 Schritt 4 | Orrin | – |
| Wachturm | M4 erster Ausfall | Orrin | `build-tower` |
| Regen, Spätfrost | M4 Wetter | Orrin | – |
| Neutral / verbündet | M5 Herold | Orrin | kein Zeiger; Ring aufs Dorf, Fortschritt „1/3“ |
| Lieferungen an Dörfer | M5 Schritt 2 | Orrin | `tributes-toggle` |
| Taran: „Schildstoß“, „Einschüchtern“ | M5 Schritt 3 | Taran, Zieltext | `ability-shieldBash`, `quick-hero-taran` |
| Schutzziel | M5 Schritt 3 | (Ziel) | Ring an den Höfen |
| Werkstattforschung (Alchimist) | M6 Schritt 1 | Orrin, Zieltext | Phasen (E3): `btech-weatherForecast` → `upgrade` → `btech-meteorology` |
| Ausbau als Voraussetzung (Laboratorium) | M6 Schritt 1 | Orrin | (Phase 2, s. o.) |
| Wetterkraftwerk, Wettertechniker | M6 Schritt 2 | Orrin | `build-weatherPlant` |
| Wetterenergie, „Wetter herbeiführen“ | M6 Schritt 3 | Orrin, Taran, Zieltext | `weather-winter`, `weather-energy` |
| Gegnerisches Kraftwerk, Fernkampf vom Ufer | M6 Start, Schritt 4 | Taran | Ladebalken im Nebenziel |
| Malvors Feldgeschütz, Fußangeln | M6 Schritt 6 | Taran | – |

## ⚠ Änderungen gegenüber den bestehenden Missionen

Alle vier ⚠-Änderungen brauchen laut [PRUEFUNG.md](PRUEFUNG.md) keine neue Mechanik, nur Funktionsaktionen in den
Missionsdateien (⚠ 2 zusätzlich E7 für den Fall, dass beide Helden zugleich ankommen).

| Nr. | Mission | Änderung | Begründung |
|---|---|---|---|
| ⚠ 1 | M1 | Eintreiber kommen, wenn die **Lehmgrube fertig** ist (spätestens nach 25 min), statt wenn zwei Höfe stehen. | Keine Überlagerung mit der Grubenerklärung; der Rauch ist der sichtbare Grund (Gegenbild zur Einleitung). |
| ⚠ 2 | M1 | Die Dorfälteste nebenan spricht mit **Orrin oder Nelia**, aber nur mit genau einem (E7); Ausgang über `npcTalked.hero` (A: 3 Leibeigene + 300 Holz; B: 3 Leibeigene). | Erste spürbare Wahl zum Thema. |
| ⚠ 3 | M5 | Neue Gesprächsfigur: **Älteste von Moorbrook** (eigener Sprecher, E12; nur Nelia), Frist bis zum Herold. Wer vorher spricht, behält Moorbrook verbündet und dessen Speertrupp (der von Schilfheim geht in jedem Fall). | Nelias Wachstum wird Spielerhandlung; Ehrlichkeit hat einen Lohn. Balancing prüfen (eine Lieferung weniger). |
| ⚠ 4 | M6 | Orrins feste Szene hat einen **zweiten Auslöser**: Malvor taut, während Orrin auf dem Eis steht (Prüfung in `malvorThaws` vor dem Befehl; `orrinHit` mit `not flag orrinWounded`). Sonst wie bisher beim Sturm. | Vorgabe „Malvor taut … Orrin bricht ein“ wird kausal. |

**Geänderte Abläufe ohne neue Mechanik** (Auslöser, Ziele, Reihenfolge – frei verbesserbar laut Auftrag):

- M1: Save-the-Cat- und Themen-Dialog bei Orrin; Ziel „Baum“ erst nach Block 2; das Kronstück wird beim Fund kurz,
  während des Dorfzentrum-Baus ausführlich erklärt; die drei Leibeigenen erscheinen am Baum (Funktionsaktion oder
  E9); Auslöser „Erstes Lagerfeuer“ (`campLit`); Nebenziel „2 Leibeigene kaufen“ (`serfBought`); kein Satz zu
  Steuereinstellungen (ohne „Bildung“ gibt es sie in M1 nicht); Abschluss in drei Fassungen.
- M2: Kaufmann ab Start, Rabatt in jeder Reihenfolge; Lager und Ausbau als zwei Ziele; Herold ohne Preis-Versprechen
  für Korn; Steuer-Auslöser (Funktionsbedingung, Stand bei Sieg); Auslöser „Es brennt“; Wundsalbe beim ersten
  Überfall.
- M3: Hauptziel „Weitblick“, erledigt sich nach 60 s selbst; Wegweiser-Ziele für Tor und Schlucht; Pläne-Ziel erst im
  Tal; Merker `bribed` unabhängig vom Weg; Sieg 5 s nach dem Tauen.
- M4: Taran erkennt Nelia – mit Rückfallszene, falls sie nie am vorderen Lager war; Bergmeister-Szene mit Orrins
  Einwurf; Wetter-Auslöser.
- M5: Speertrupps der Dörfer als zwei Bezüge; Eisenschacht per `ensureShaft` sicherstellen; Dark Night; Taran
  gesteht die Meldung an Malvor; Nebenziel „4 Höfe“ erscheint nach der ersten Lieferung.
- M6: Forschung als drei Zwischenziele (Kauf erledigt sie, Ausbau per `complete`); Merker `knowledgeBought`;
  Ertrunkene über Zählen in `malvorThaws` bzw. E5; Malvors Fähigkeiten über `event ability` (`player: 'enemy'`);
  Malvor fällt in der Schlacht (Schloss zerstört = Sieg; im Spiel verschwinden seine Figuren mit der Burg).
- Alle: Kronstück statt Zacke; jede Einleitung beginnt mit „Bisher“ und dem Zählstand; Hilfe gesprochen
  geräteneutral, Handgriffe im Zieltext.

## Nötige Erweiterungen der Technik

Welche Stellen des Drehbuchs eine Erweiterung brauchen und was ohne sie gilt, steht verständlich in
[PRUEFUNG.md, „Zu entscheiden: Erweiterungen der Technik“](PRUEFUNG.md). Jede Stelle im Drehbuch hat eine Fassung, die
ohne Erweiterung funktioniert.

## Hinweis zur Übungsmission

Die Zusammenfassung der Übungsmission („Der Händler Orrin zeigt Nelia, wie ein Dorf wächst …“) widerspricht dem
ersten Treffen von Nelia und Orrin in Mission 1. Die Übungsmission soll als **Rahmen außerhalb der Geschichte**
formuliert werden („Orrin zeigt dir, wie ein Dorf wächst“), ohne Nelia als Schülerin.

## Offene Fragen an den Projektinhaber

Für jede Frage ist die Fassung geschrieben, die ohne Entscheidung funktioniert.

1. **K1/E1 umsetzen?** Geschrieben ist alles so, dass die Rückbezüge ersatzlos entfallen können.
2. **Vertonung.** Jeder gesprochene Satz im Spiel ist eine eigene Aufnahme (eine Sprechblase mit Porträt, eine
   Tondatei). Das Drehbuch hat **347 solche Sätze** (die heutigen Missionen haben 133). Auf Deutsch und Englisch sind
   das **694 Aufnahmen**. Verteilt auf **17 Sprecherrollen**: Orrin 138 Sätze, Nelia 116, Taran 32, Herold 13, Malvor
   10, die übrigen zwölf Nebenrollen zusammen 38.
   **Davon sind 31 Bedienhinweise** – Sätze, in denen ein Held erklärt, was man klicken soll („Ruf in der Burg ‚Zu
   den Waffen!‘“). Sie kommen nur, wenn der Spieler das noch nicht getan hat. Die übrigen 316 Sätze sind Geschichte.
   **Zu entscheiden:** Werden auch die 31 Bedienhinweise aufgenommen, oder stehen sie nur als Text in der
   Sprechblase? (Die Bedienhinweise werden gerade so umgeschrieben, dass die Helden den Spieler direkt ansprechen;
   ihre Zahl kann sich dabei leicht ändern.)
3. **Nelias Vater** wird in allen sechs Missionen nur erwähnt: Nelia spricht von ihm (Mission 1 und 6), ein
   Gefangener sagt, dass er lebt (Mission 3), und im Text nach dem Finale schlägt er frei Holz unter dem alten Baum.
   **Als Figur ist er nie zu sehen und hat keine Stimme.** Zu entscheiden – eine von drei Möglichkeiten:
   - **a)** so lassen (nur erwähnt);
   - **b)** Nelia befreit ihn in Mission 3 aus dem Gefangenenlager: Er steht als Figur dort, sagt zwei, drei Sätze
     und geht dann heim nach Lindgrund – das Nebenziel bekommt einen persönlichen Grund;
   - **c)** er erscheint in Mission 6 nach dem Sieg als Figur vor Malvors Kornlager, Nelia spricht mit ihm (eine kurze
     Szene vor dem Abschlusstext).
   Für b) und c) braucht er eine Figur (Modell wie ein Leibeigener reicht) und eine Stimme.
