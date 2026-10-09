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

> **Stand (Oktober 2026):** Mission 1 und 2 sind aus den abgenommenen [Ketten](KETTEN.md) neu geschrieben und auf
> Widersprüche geprüft. Mission 3 bis 6 stammen aus der vorigen Runde und werden nach Abnahme ihrer Ketten neu
> geschrieben. Für alle gilt der [Leitfaden](LEITFADEN.md): Die Erzählerin liest nur die Einleitungen und sagt sonst Bedienung; die Figuren sprechen nur
> miteinander; jede Mission endet mit normalen Szenen statt mit vorgelesenem Text. Der Kaltleser-Test steht für diese
> Fassung noch aus. Teil 1 und Teil 3 beschreiben noch die alte Fassung mit zusätzlichen Wahlen und werden nach der
> Abnahme angeglichen.

## Mission 1 – Lindgrund

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Kann Nelia ihr verlassenes Heimatdorf wieder zum Leben bringen – und das Kronstück unter dem alten Baum vor Malvors
Eintreibern behalten?** Im Gesamtbogen: **Opening Image** (das leere Dorf im Schnee), **Save the Cat** (Nelia gibt
einem Fremden ihr letztes Brot), **Catalyst** (der Fund und Orrins Lüge), am Ende **Break into Two** (Nelia bricht auf,
um Malvor bei den Kronstücken zuvorzukommen).

### 2. Einleitungstext (liest die Erzählerin vor)

> Seit Jahren liegt Schnee auf dem Kronland. Seit König Edrian im Sturm auf dem Thronsee ertrank, wird es nicht mehr
> Frühling. Nur einer hat noch Korn genug für alle: Malvor, der Statthalter von Hagenfurt. Wer essen will, arbeitet in seinen
> Kornlagern – für eine Schüssel am Tag.

**Startvorrat:** 400 Taler, 1000 Lehm, 600 Holz, 200 Stein. Keine Leibeigenen.

### 3. Ablauf

#### Start – Der Dorfplatz

- *Auslöser:* Missionsbeginn. Kamera auf Nelia am Dorfrand; auf dem Dorfplatz sitzt ein Fremder mit Ausrufezeichen.
- *Dialog:*
  > **Nelia:** Lindgrund. Kein Rauch, kein Hund. Alle sind zu Malvor gegangen – für eine Schüssel Korn.
  >
  > **Orrin:** He! Du da, mit dem Bündel! Hier drüben, auf dem Dorfplatz! Ich beiße nicht, ich handle nur.
  >
  > **Nelia:** Ein Fremder? Hier wohnen ja nicht mal mehr Mäuse.
- *Ziel:* „Schick Nelia zum Fremden auf dem Dorfplatz“
  > **Erzählerin:** Wähle Nelia aus und klicke mit rechts auf den Fremden.
  >
  > **Erzählerin:** Die Karte verschiebst du mit der mittleren Maustaste, Tastatur oder dem Finger.
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
  > **Nelia:** Ich war zwei Winter in Malvors Kornlager. Vor einer Woche bin ich davongelaufen, nach Hause. Mein Vater
  > ist noch dort. Er hat immer unter dem alten Baum am Waldrand versteckt, was wir hatten, wenn die Eintreiber kamen.
  > Vielleicht liegt dort noch Saatkorn, Winterkorn. Damit könnte Lindgrund wieder etwas anbauen.
  >
  > **Orrin:** Saatkorn ist mehr wert als alles in meinem Karren. Ich komme mit.
- Orrin schließt sich an.
- *Ziel:* „Schick Nelia zum alten Baum am Waldrand“
- Die Kamera fährt kurz zum alten Baum, ein Ring markiert ihn, dann zurück zu Nelia. Keine Erklärung nötig.

#### Schritt 2 – Der Fund (Catalyst)

- *Auslöser:* Nelia erreicht den Baum.
- *Dialog:*
  > **Nelia:** Kein Korn. Ein Tuch … und darin Gold. Eine goldene Spitze mit einem roten Stein.
  >
  > **Orrin:** Bei allen Märkten. Weißt du, was du da hältst? Ein Kronstück.
  >
  > **Orrin:** Als der König ertrank, zerbrach seine Krone in fünf Stücke. Man erzählt, in jeder Provinz liegt eins.
  > Und du hast das von Lindgrund gefunden.
  >
  > **Nelia:** Unter Vaters Baum? Wie kommt so etwas dahin?
- Drei Leibeigene treten aus dem Wald; sie hatten sich vor den Eintreibern versteckt.
  > **Dorfbewohnerin:** Gold? Gehört ihr zu Malvors Leuten? Wir haben uns vor den Eintreibern versteckt, mit dem letzten
  > Sack Winterkorn. Den bekommen sie nicht!
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
  > **Orrin:** Dann haben sie ein Dach über dem Kopf. Wer satt ist, verzeiht viel. Das alte Verwalterhaus am Dorfrand
  > steht noch, dort richten wir uns ein. Und für alles Weitere brauchen wir Holz: Bei den eingestürzten Häusern
  > liegen trockene Balken.

#### Schritt 3 – Holz

- *Ziel:* „Hol Holz von den Balken“
- Die Kamera zeigt kurz die Balkenhaufen bei den eingestürzten Häusern (Ring).
  > **Erzählerin:** Wähle die drei mit „Alle“ unten links aus und klicke mit rechts auf die Balken.
- *Erklärung:* Rahmen auf „Alle“ (Handy: hinter dem Kartenknopf).

#### Schritt 4 – Das Dorfzentrum

- *Auslöser:* Die Leibeigenen bauen Holz ab.
- *Dialog:*
  > **Orrin:** Gut so. Jetzt der Dorfplatz. Freie Leute – Bauern, Bergleute, Handwerker – ziehen nur dorthin, wo ein
  > Dorfzentrum steht.
  >
  > **Nelia:** Wenn hier wieder ein Dorfzentrum steht, kommen die anderen dann heim?
  >
  > **Orrin:** Wenn es hier Arbeit, Betten und Essen gibt. Eins nach dem anderen. Zuerst das Dorfzentrum – auf den
  > alten Grundmauern.
- *Ziel:* „Bau das Dorfzentrum auf den alten Grundmauern“
  > **Erzählerin:** Wähle Leibeigene aus, öffne „Bauen“ und setze das Dorfzentrum auf die Grundmauern. Je mehr mitbauen,
  > desto schneller geht es.
- *Erklärung:* Rahmen auf „Bauen“, dann auf „Dorfzentrum“; Ring auf den Grundmauern.

#### Schritt 5 – Betten

- *Auslöser:* Dorfzentrum fertig.
- *Dialog:*
  > **Nelia:** Als ich klein war, war hier jeden Sonntag Markt. Vater hat Brennholz verkauft.
  >
  > **Orrin:** Dann wird es wieder Markt geben. Aber wer hier arbeiten soll, braucht ein Bett. Sonst sitzt er die Nacht
  > am Lagerfeuer und schafft am Tag kaum etwas.
  >
  > **Nelia:** Im Kornlager schliefen wir zu dreißig in einer Scheune. Hier bekommt jeder ein Bett.
- *Ziel:* „Baue 2 Wohnhäuser“
  > **Erzählerin:** Graue Gebäude im Baumenü kommen später dazu.

#### Schritt 6 – Essen

- *Auslöser:* zwei Wohnhäuser fertig.
- *Dialog:*
  > **Orrin:** Wer geschlafen hat, will essen. Der Sack Winterkorn der drei reicht für die ersten Höfe. Und Essen ist
  > alles, womit Malvor das Land festhält.
  >
  > **Nelia:** Dann bauen wir Höfe. Wer in Lindgrund satt wird, muss nicht zu ihm.
- *Ziel:* „Baue 2 Bauernhöfe“
- *Der erste Arbeiter kommt:* Kamera kurz zu ihm.
  > **Orrin:** Ein Arbeiter, und keiner hat ihn gerufen. Arbeiter kann man nicht rufen. Man kann ihnen nur einen Grund
  > geben – Arbeit, ein Bett und einen Platz am Tisch.
  >
  > **Nelia:** Dann geben wir ihnen mehr davon.

#### Schritt 7 – Arbeit und Lehm

- *Auslöser:* zwei Bauernhöfe fertig.
- *Dialog:*
  > **Orrin:** Zwei Höfe geben nur zwei Bauern Arbeit. Mehr Leute kommen nur, wenn es mehr Arbeit gibt.
  >
  > **Nelia:** Und der Lehm geht zur Neige. Ohne Lehm kein Haus mehr für die, die noch heimkommen.
  >
  > **Orrin:** Dort drüben tritt Lehm aus dem Boden – ein Schacht. Darauf passt eine Lehmgrube. Fünf Bergleute finden
  > dort Arbeit und graben Lehm genug für ganz Lindgrund.
  >
  > **Nelia:** Und wer arbeitet, zahlt Steuern.
  >
  > **Orrin:** Du lernst schnell. Dann klimpert es endlich mal in Lindgrund.
- *Ziel:* „Baue eine Lehmgrube und versorge 6 Arbeiter“
- Die Kamera zeigt kurz den Lehmschacht (Ring).
  > **Erzählerin:** Gruben passen nur auf solche Schächte.
  >
  > **Erzählerin:** Ein Lagerfeuer heißt: Dort fehlt jemandem ein Bett oder Essen.
- *Erklärung:* Rahmen auf „Lehmgrube“ im Baumenü, bis die Baustelle steht.

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
- *Nebenziel:* „Optional: Kauf in der Burg 2 Leibeigene“

#### Schritt 8 – Malvors Eintreiber (Break into Two)

- *Auslöser:* Die Lehmgrube ist fertig – Rauch steigt über Lindgrund auf. Spätestens nach 25 Minuten.
- Kamera springt zu den Eintreibern (zwei Trupps Speerträger) am Dorfrand.
- *Dialog:*
  > **Eintreiber:** Rauch über Lindgrund – den sieht man bis zur Straße! Im Namen des Statthalters: Jeder zehnte Sack
  > gehört Malvor.
  >
  > **Eintreiber:** Und man erzählt sich, hier hat jemand Gold aus dem Boden gegraben. Her damit!
  >
  > **Nelia:** Was unter Vaters Baum lag, bleibt in Lindgrund.
  >
  > **Orrin:** Meine Schuld – die Geschichte von der Prinzessin lief schneller als wir. Aber das sind nur ein paar
  > Speerträger. Wenn alle zusammen anpacken, jagen wir sie davon.
  >
  > **Nelia:** Und ich gehe vorneweg. Wenn sie mich sehen, fassen sie Mut.
- *Ziel:* „Vertreibe Malvors Eintreiber“
  > **Erzählerin:** „Zu den Waffen!“ in der Burg macht alle Leibeigenen zur Miliz. Schick sie mit Nelia auf die
  > Eintreiber.
  >
  > **Erzählerin:** „Mut machen“ – Nelia allein ausgewählt – lässt alle bei ihr doppelt so hart zuschlagen.
  >
  > **Erzählerin:** Helden sterben nicht, sie stehen wieder auf.
- *Erklärung:* Rahmen auf die Burg, dann „Zu den Waffen!“, dann „Mut machen“.
- *Eintreiber vertrieben:*
  > **Eintreiber:** Das wird Malvor erfahren! Und ihr seid nicht die Einzigen. Sein Herold kauft die Kronstücke längst
  > – in Beaucroix bietet er schon für das nächste!
  >
  > **Nelia:** Malvor sammelt die Kronstücke? Dann will er König werden.
  >
  > **Orrin:** Das alte Recht sagt: Wer alle fünf Kronstücke vereint, den müssen die Provinzen krönen. Und einem König
  > darf keiner mehr widersprechen.
  >
  > **Nelia:** Dann bekommt er dieses nicht. Und das in Beaucroix auch nicht.
  >
  > **Erzählerin:** „Entwarnung“ in der Burg schickt die Miliz zurück an die Arbeit.
- Damit sind alle Hauptziele erfüllt; die Mission ist gewonnen.

### 4. Nebenziel: Das Nachbardorf

- *Auslöser:* nach dem Fund am Baum; die Dorfälteste im Nachbardorf bekommt ein Ausrufezeichen, ihr Dorf wird kurz
  aufgedeckt.
- *Dialog:*
  > **Orrin:** Hinter dem Wald liegt ein Nachbardorf, und dort wohnt noch jemand. Lass mich mit ihnen reden. Ein guter Händler bekommt Holz und Leute, wo andere nur Türen sehen.
- *Ziel:* „Optional: Schick Orrin zur Dorfältesten im Nachbardorf“
  > **Erzählerin:** Orrin wählst du über sein Bild unten links aus.
- *Wenn Nelia hingeht:*
  > **Dorfälteste:** Schick mir den Händler, Kind. Der redet für zwei.
- *Gespräch mit Orrin:*
  > **Orrin:** Ehrwürdige Mutter! Ihr habt es gehört: Die verlorene Prinzessin ist zurück. Aus Malvors Kornlager entkommen, und jetzt baut sie Lindgrund wieder auf.
  >
  > **Dorfälteste:** Prinzessin oder nicht – ein Mädchen, das Malvors Kornlager davonläuft und ihr Dorf wieder
  > aufbaut, verdient Hilfe. Wir schicken drei Leute und Holz nach Lindgrund.
- *Folge:* Das Nachbardorf wird verbündet, 3 Leibeigene und 300 Holz.
  > **Erzählerin:** Die drei neuen Leibeigenen warten an deiner Burg.

### 5. Niederlage

- *Burg gefallen:* „Die Eintreiber haben die Burg genommen. Lindgrund gehört wieder niemandem – und das erste
  Kronstück reitet in einer Satteltasche nach Hagenfurt.“

### 6. Abschluss (normale Szene)

- *Auslöser:* Alle Hauptziele erfüllt. Kamera auf Nelia und Orrin unter dem alten Baum; es wird Abend.
- *Dialog:*
  > **Dorfbewohnerin:** Prinzessin Nelia! Die Kinder wollen dir das neue Haus zeigen.
  >
  > **Nelia:** Ich bin keine … ach, ich komme gleich. Sie hören einfach nicht zu.
  >
  > **Orrin:** Man hört, was man hören will. Das ist das Schöne an Geschichten.
  >
  > **Nelia:** Unter diesem Baum lag das Kronstück, und ich weiß noch immer nicht, warum.
  >
  > **Orrin:** Vielleicht wusste dein Vater mehr als wir.
  >
  > **Nelia:** Dann frage ich ihn, sobald er frei ist. Morgen gehen wir nach Beaucroix.
  >
  > **Orrin:** Wir? Mein Karrenrad ist gebrochen.
  >
  > **Nelia:** Dann gehst du zu Fuß.
- *Übergabe an Mission 2:* zehn Leibeigene, dreihundert Taler.

---

## Mission 2 – Beaucroix

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Bekommt Nelia das Kronstück von Beaucroix, bevor Malvor es kauft?** Im Gesamtbogen der Beginn von **Fun and Games**:
Nelia ist in der Welt draußen, lernt Handel und Truppen. Zugleich beginnt die **B-Story** zwischen Nelia und Orrin:
Wahrheit gegen Geschäft (Orrins alte Lehmschuld). Am Ende erfährt Nelia, worauf Malvors Macht steht: Der Winter ist
gemacht.

### 2. Einleitungstext (liest die Erzählerin vor)

> Eines von fünf Kronstücken hat Nelia – das von Lindgrund. Die Krone des toten Königs ist zerbrochen, und wer alle fünf
> Stücke wieder zusammensetzt, den müssen die Provinzen krönen. Darum jagt Malvor ihnen nach.
>
> Das nächste liegt in Beaucroix, der Handelsstadt am großen Fluss. Räuber haben es aus der Stadtkasse gestohlen und
> verkaufen es an den, der am meisten zahlt.

**Startvorrat:** 300 Taler, 1800 Lehm, 2000 Holz, 1200 Stein, 400 Eisen; 10 Leibeigene. Burg vor der Stadt, das
Kaufmannsviertel von Beaucroix ist verbündet, das Räuberlager liegt im Flusswald.

### 3. Ablauf

#### Start – Ankunft in Beaucroix

- *Auslöser:* Missionsbeginn. Kamera zeigt Nelias Lager vor der Stadt, dann kurz den Flusswald.
- *Dialog:*
  > **Orrin:** Beaucroix! Hier riecht sogar der Schnee nach Geld.
  >
  > **Nelia:** Ich rieche nur Hunger. Die Straßen sind zugeschneit, und die Stadt kauft ihr Korn bei Malvor – für Gold.
  >
  > **Orrin:** Und mit diesem Gold bezahlt Malvor seine Gebote für das Kronstück. Beaucroix finanziert seinen eigenen
  > Verlust.
  >
  > **Nelia:** Wir haben dreihundert Taler. Das reicht nicht, um mitzubieten.
  >
  > **Orrin:** Dann verdienen wir. Die Lehmgruben der Stadt graben in gefrorenem Boden, bei uns kommt der Lehm aus dem
  > Schacht. Beaucroix zahlt gut dafür. Dafür bauen wir einen Markt.
  >
  > **Nelia:** Zuerst Höfe, wie in Lindgrund.
- *Ziele:* „Baue 3 Bauernhöfe“ · „Errichte einen Marktplatz“

#### Schritt 1 – Der Marktplatz

- *Auslöser:* direkt nach dem Start (parallel zu den Höfen).
  > **Erzählerin:** Ein Marktplatz entsteht aus einem Lager. Baue zuerst ein Lager.
- *Lager fertig:*
  > **Orrin:** Ein Lager. Daraus wird der Marktplatz.
  >
  > **Erzählerin:** Wähle das Lager aus und drücke „Ausbauen“. Das geht von selbst, ohne Leibeigene.
- *Erklärung:* Rahmen erst auf „Lager“ im Baumenü, nach dem Bau auf „Ausbauen“.

#### Schritt 2 – Der erste Handel

- *Auslöser:* Marktplatz fertig.
- *Dialog:*
  > **Orrin:** Ah, ein Marktplatz! Hörst du das? Da wird gleich gerechnet.
  >
  > **Nelia:** Dann rechne. Wir brauchen viele Taler.
  >
  > **Orrin:** Beaucroix braucht Lehm und Stein, und wir haben genug davon. Also verkaufen wir.
- *Ziel:* „Tausche Waren am Markt gegen Taler“
  > **Erzählerin:** Wähle den Marktplatz: bei „Bezahlen mit“ Lehm, bei „Kaufen“ Taler, dann „Handeln“.
  >
  > **Erzählerin:** Wer viel auf einmal verkauft, drückt den Preis.
- *Erster Handel abgeschlossen:*
  > **Orrin:** Taler, die klimpern. Der schönste Klang der Welt.

#### Schritt 3 – Malvors Herold (die Wahl)

- *Auslöser:* erster abgeschlossener Handel. Kamera auf den Marktplatz von Beaucroix; das Räuberlager wird kurz
  aufgedeckt.
- *Dialog:*
  > **Herold:** Hört, Leute von Beaucroix! Statthalter Malvor zahlt tausend Taler für das Kronstück, das die Räuber im
  > Flusswald haben.
  >
  > **Räuberhauptmann:** Tausend? Wer zwölfhundert bietet, bekommt es. Sonst geht es nach Hagenfurt.
  >
  > **Orrin:** Ich kenne den Mann: Malvors Herold, sein Ausrufer und Einkäufer. Seine Vollmacht reicht bis tausend Taler.
  > Für mehr muss er nach Hagenfurt reiten und fragen.
  >
  > **Nelia:** Dann bleibt uns ein wenig Zeit. Zwölfhundert Taler verdienen wir trotzdem nicht in einer Woche.
  >
  > **Orrin:** Am Markt schon, wenn wir fleißig handeln. Oder …
  >
  > **Ratsherr:** Der Rat von Beaucroix kann das Kronstück nicht zurückholen, die Räuber sind zu stark. Aber er gibt sein
  > Wort: Wer es ihnen abnimmt, darf es behalten. In dieser Stadt wäre es nicht sicher.
  >
  > **Nelia:** Dann holen wir es uns. Dafür bräuchten wir Soldaten.
  >
  > **Orrin:** Zwei Wege. Taler oder Schwerter. Nur zu lange warten dürfen wir nicht.
- *Ziel:* „Hol das Kronstück: Kauf es frei (1200 Taler) oder stürme das Räuberlager“
  > **Erzählerin:** Den Freikauf findest du unter „Angebote“.
  >
  > **Erzählerin:** Soldaten bildest du in der Kaserne aus, mit „Volle Einheit“. Sie wollen an jedem Zahltag Sold.
- *Erklärung:* Rahmen auf „Angebote“, danach auf „Kaserne“ im Baumenü; Ring am Räuberlager.

#### Weg A – Freikaufen

- *Auslöser:* Das Angebot „Kronstück freikaufen“ wird bezahlt (1200 Taler, mit Lehmlieferung 800).
- *Dialog:*
  > **Räuberhauptmann:** Taler sind Taler. Nimm dein Goldstück, Händler.
  >
  > **Herold:** Statthalter Malvor wird sich merken, wer ihm das Kronstück weggeschnappt hat.
  >
  > **Nelia:** Soll er. Das zweite Kronstück gehört jetzt uns.

#### Weg B – Stürmen

- *Erste eigene Truppe ausgebildet:*
  > **Nelia:** Das sind unsere ersten Soldaten. Sie kämpfen für Beaucroix, nicht für Malvor.
  >
  > **Erzählerin:** Der Knopf „Truppen“ wählt alle Soldaten und Helden aus. Klicke mit rechts auf das Räuberlager.
- *Lager erobert (alle Wachen besiegt):*
  > **Gefangener Räuber:** Gnade! Hier, nehmt das Ding. Es hat uns nur Unglück gebracht.
  >
  > **Herold:** Statthalter Malvor wird sich merken, wer ihm zuvorgekommen ist.
  >
  > **Nelia:** Soll er. Das zweite Kronstück gehört jetzt uns.

#### Die Überfälle

- *Auslöser:* 5 Minuten nach dem Herold, danach alle 5 Minuten, höchstens dreimal – solange die Entscheidung nicht
  gefallen ist (Weg A oder B). Jeweils zwei Trupps Schwertkämpfer der Räuber greifen Nelias Lager an.
- *Erster Überfall:*
  > **Räuberhauptmann:** Die Prinzessin bietet mit? Dann nehmen wir ihr das Geld ab, bevor sie es ausgibt! Auf sie!
  >
  > **Orrin:** Malvors Anzahlung bezahlt ihre Klingen, wetten wir? Einen Mitbieter ausräumen zu lassen ist billiger, als
  > ihn zu überbieten.
  >
  > **Erzählerin:** Orrins „Wundsalbe“ heilt alle Verwundeten in seiner Nähe.
- *Erstes Gebäude brennt:*
  > **Erzählerin:** Schick Leibeigene zum brennenden Gebäude, sie reparieren es kostenlos.

### 4. Nebenziel: Orrins Lehmschuld

- *Auslöser:* nach dem Herold. Der Ratsherr am Marktplatz von Beaucroix bekommt ein Ausrufezeichen.
  > **Ratsherr:** Orrin! Ich sehe dich doch! Komm her, du alter Fuchs!
- *Ziel:* „Optional: Schick Orrin zum Ratsherrn am Marktplatz“
- *Gespräch (nur Orrin; schickt man Nelia: „Ich warte auf Orrin. Er schuldet mir etwas.“):*
  > **Ratsherr:** Achthundert Lehm hast du mir verkauft, Orrin. Vor einem Monat. Bezahlt habe ich. Wo ist der Lehm?
  >
  > **Orrin:** Unterwegs! Sozusagen. Er … liegt noch in der Erde.
  >
  > **Nelia:** Du hast etwas verkauft, das du gar nicht hast?
  >
  > **Orrin:** Das nennt man Vorauszahlung. Alle machen das. Fast alle.
  >
  > **Nelia:** Wir liefern ihm den Lehm. Sonst glaubt dir hier keiner mehr – und mir auch nicht.
  >
  > **Ratsherr:** Liefert ihr, dann rede ich mit den Räubern. Für ehrliche Leute machen sie den Preis billiger.
- *Ziel:* „Optional: Liefere dem Ratsherrn 800 Lehm“
  > **Erzählerin:** Die Lieferung steht unter „Angebote“.
- *Geliefert:*
  > **Ratsherr:** Der Lehm ist da, und sogar trocken! Ich rede mit den Räubern.
  >
  > **Orrin:** Ehrlichkeit ist mein zweiter Vorname. Gleich nach Gewinn.
  >
  > **Nelia:** Dein erster Vorname ist Schulden.
  >
  > **Erzählerin:** Der Freikauf kostet jetzt nur noch 800 Taler.

### 5. Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Malvors Herold holt sich in Hagenfurt die Vollmacht für zwölfhundert Taler,
  und das Kronstück von Beaucroix reitet nach Hagenfurt.“

### 6. Abschluss (normale Szene)

- *Auslöser:* Das Kronstück ist in Nelias Hand. Abend, Kamera auf Nelia und Orrin am Fluss.
- *Weg A, davor kurz:*
  > **Räuberhauptmann:** Zum Abschied ein Rat umsonst. Wir haben für Malvor Fuhren ins Gebirge hinter Hagenfurt
  > geschützt. Dort steht eine Maschine, ein Wetterwerk. Es brummt Tag und Nacht. Seitdem schneit es.
- *Weg B, davor kurz:*
  > **Gefangener Räuber:** Wir haben für Malvor Fuhren ins Gebirge hinter Hagenfurt geschützt. Dort steht eine
  > Maschine, ein Wetterwerk. Es brummt Tag und Nacht. Seitdem schneit es.
- *Dialog (beide Wege):*
  > **Orrin:** Ein gemachter Winter. Dann sind Malvors Kornlager kein Glück, sondern eine Falle.
  >
  > **Nelia:** Solange diese Maschine läuft, hängt das Land an Malvors Korn. Ein Dorf wie Lindgrund kann sich vielleicht
  > selbst ernähren, ein ganzes Land nicht. Erst das Wetterwerk. Dann die Kronstücke.
  >
  > **Orrin:** Ins Gebirge, mitten im Winter. Das nenne ich ein Geschäft ohne Gewinn.
  >
  > **Nelia:** Das Geschäft heißt Frühling.
  >
  > **Orrin:** Klingt nach etwas, das ich nicht verkaufen kann.

---

## Mission 3 – Das Wetterwerk

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Kann eine Handvoll Leute ohne Burg Malvors Winter brechen – und lebend vom Eis kommen?** Im Gesamtbogen ist das der
**Midpoint**: ein großer Sieg, der alles verändert. Der Winter endet, aber Malvor verliert damit seine stillste Waffe,
den Hunger, und greift ab jetzt zum Schwert. Und Nelia erfährt, dass das letzte Kronstück an Malvors eigenem Hals hängt.

### 2. Einleitungstext (liest die Erzählerin vor)

> Zwei von fünf Kronstücken hat Nelia, aus Lindgrund und aus Beaucroix. Doch sie hat etwas erfahren, das schwerer wiegt
> als Gold: Der Winter ist nicht echt. Seit Jahren läuft hinter Hagenfurt, in einem Tal im Gebirge, eine alte Maschine,
> das Wetterwerk. Solange es läuft, liegt Schnee auf allen Feldern, und wer essen will, muss in Malvors Kornlager.
>
> Nelia und Orrin sind mit drei Trupps Freiwilliger aufgebrochen, um das Werk zu zerstören.

**Startvorrat:** keine Burg, kein Nachschub; drei Trupps Freiwillige, Nelia, Orrin; 400 Taler (Orrins Börse).

### 3. Ablauf

#### Start – Vor dem Bergkamm

- *Auslöser:* Missionsbeginn. Kamera auf die Gruppe vor dem Bergkamm, dann kurzer Schwenk über den Kamm.
- *Dialog:*
  > **Nelia:** Dahinter muss das Tal liegen.
  >
  > **Orrin:** Und im Tal die Maschine. Zerstören wir sie, taut es im ganzen Kronland. Dann wächst überall Korn, und
  > keiner muss mehr bei Malvor betteln gehen.
  >
  > **Nelia:** Drei Trupps, wir zwei, keine Burg im Rücken. Wer hier fällt, kommt nicht wieder.
  >
  > **Orrin:** Und vierhundert Taler. Das ist alles, was zwischen uns und dem Heldentod steht.
- *Ziel:* „Zerstöre das Wetterwerk hinter dem Bergkamm“

#### Schritt 1 – Wie kommen wir ins Tal?

- *Auslöser:* direkt nach dem Startgespräch.
- *Dialog:*
  > **Orrin:** Der Kamm ist zu steil zum Klettern. Irgendwo muss es einen Durchgang geben. Nur wo?
  >
  > **Nelia:** Lass mich schauen. In Lindgrund sagen sie, ich sehe weiter als jeder andere im Dorf.
- *Ziel:* „Sieh mit Nelias Weitblick über den Bergkamm“
  > **Erzählerin:** Wähle Nelia allein aus und drücke „Weitblick“.
- *Erklärung:* Rahmen erst auf Nelias Bild, dann auf den Knopf „Weitblick“.
- *Falls nach einer Minute nichts passiert ist:* Das Spiel deckt Tor und Schlucht selbst auf; Nelia sagt: „Ich klettere
  auf den Felsen hier und schau selbst.“

#### Schritt 2 – Zwei Wege

- *Auslöser:* Weitblick benutzt. Tor und Schlucht werden aufgedeckt, die Kamera zeigt erst das Tor, dann die Schlucht.
- *Dialog:*
  > **Nelia:** Zwei Wege führen hinein. Durch das Tor: fünf Trupps und ein Turm mit einer Riesenarmbrust.
  >
  > **Orrin:** Fünf Trupps gegen unsere drei? Da rechne ich nicht lange. Und der zweite Weg?
  >
  > **Nelia:** Die Schlucht. Durch sie fließt der Fluss ins Tal, und der ist zugefroren. Im Winter trägt das Eis uns
  > wie eine Straße.
  >
  > **Orrin:** Malvors eigener Winter baut uns den Weg zu seiner Maschine. Das gefällt mir.
- *Ziel:* „Bring die Gruppe durch die Schlucht ins Tal“
  > **Erzählerin:** Der Knopf „Truppen“ wählt alle Soldaten und beide Helden aus.

#### Schritt 3 – Der Posten in der Schlucht

- *Auslöser:* Der Posten am Ausgang der Schlucht kommt in Sicht. Kamera kurz auf die Wachen.
- *Dialog:*
  > **Nelia:** Die lassen uns nicht einfach durch.
  >
  > **Orrin:** Die stehen seit Wochen in der Kälte, für Malvors Sold. Leute, die frieren, kann man kaufen.
  >
  > **Nelia:** Und wenn sie nicht wollen?
  >
  > **Orrin:** Jeder will. Es ist nur eine Frage des Preises.
  >
  > **Erzählerin:** Wähle Orrin allein, geh nah an einen Trupp und drücke „Bestechen“. Das kostet 200 Taler und 50
  > je Soldat.
- *Erklärung:* Rahmen auf Orrins Bild, dann auf „Bestechen“.
- *Nach dem Bestechen:*
  > **Orrin:** Bezahlt und umgedreht. Der beste Handel, den ich diesen Winter gemacht habe.

#### Schritt 4 – Im Tal

- *Auslöser:* Die Gruppe erreicht den Talboden hinter der Schlucht. Kamera zeigt den See mit der Insel, dann die Ruinen.
- *Dialog:*
  > **Nelia:** Wir sind drin. Hörst du das Brummen? Das ist der Winter.
  >
  > **Orrin:** Und die Ruinen am Talrand waren Hrimgars Festung. Er hat das Werk vor Jahrhunderten gebaut.
  >
  > **Orrin:** Wer so eine Maschine baut, hinterlässt Zeichnungen. Holen wir sie, bevor wir das Werk zerschlagen.
  >
  > **Nelia:** Wozu brauchen wir die Pläne einer Maschine, die wir kaputt machen wollen?
  >
  > **Orrin:** Weil Malvor sie auch hat. Was er weiß, sollten wir auch wissen.
- *Ziele:* „Zerstöre das Wetterwerk auf der Insel“ · „Hol Hrimgars Baupläne aus den Ruinen“
- *Pläne gefunden (ein Held erreicht die Ruinen):*
  > **Orrin:** Hier sind die Pläne! Türme, Röhren, Kessel … und überall dasselbe Wort: Schwefel. Ich verstehe kaum
  > etwas davon, aber ich hebe die Blätter gut auf.
  >
  > **Nelia:** Gut. Jetzt das Wetterwerk.

#### Schritt 5 – Vor dem Angriff

- *Auslöser:* Die Gruppe nähert sich dem Seeufer.
- *Dialog:*
  > **Nelia:** Bevor wir aufs Eis gehen: Fällt das Werk, taut der See. Wir haben eine Minute, dann bricht das Eis.
  >
  > **Orrin:** Und auf der Insel bleiben geht auch nicht. Sobald das Wasser offen ist, sitzen wir dort fest.
  >
  > **Nelia:** Also zuschlagen und sofort zurück ans Ufer.
  >
  > **Orrin:** Ich schwimme wie ein Sack Mehl. Nur dass du's weißt.
- *Erklärung:* Kamera kurz zum Ufer; ein Ring markiert die feste Stelle.

#### Schritt 6 – Alarm

- *Auslöser:* Jemand von uns betritt die Insel.
- *Dialog:*
  > **Wache:** Eindringlinge am Werk! Alarm! Torwache, zum See!
  >
  > **Nelia:** Jetzt kommen sie vom Tor über das Eis. Schnell – das Werk zuerst, bevor sie hier sind!
  >
  > **Erzählerin:** Klicke mit rechts auf das Wetterwerk.

#### Schritt 7 – Tauwetter

- *Auslöser:* Das Wetterwerk ist zerstört. Eine Uhr läuft 60 Sekunden.
- *Dialog:*
  > **Nelia:** Es ist still. Das Brummen ist weg … und das Eis knackt.
  >
  > **Orrin:** Runter vom See! Alle! In einer Minute ist das hier Wasser!
- *Ziel:* „Bring Nelia und Orrin in 60 Sekunden aufs feste Ufer“
- *Nach 5 Sekunden:*
  > **Wache:** Das Wetterwerk brennt! Fangt die Eindringlinge am Ufer ab, bevor sie entkommen!
- *15 Sekunden vor Schluss, falls ein Held noch auf dem Eis oder der Insel steht:*
  > **Orrin:** Das Eis wird grau! Lauf, Nelia, lauf!
- *Tauwetter überstanden:*
  > **Nelia:** Hörst du das? Es tropft von den Felsen. Zum ersten Mal seit Jahren.
- *Nur wenn die Baupläne noch fehlen:*
  > **Orrin:** Fehlen nur noch die Pläne in den Ruinen.
- *Sind die Pläne schon gesichert, ist die Mission gewonnen.*

### 4. Nebenziel: Die Gefangenen

- *Auslöser:* Das Gefangenenlager am Talrand kommt in Sicht. Kamera kurz dorthin.
- *Dialog:*
  > **Nelia:** Leute aus den Dörfern. Malvor lässt sie hier das Werk heizen.
  >
  > **Orrin:** Nur zwei Trupps Wachen. Und Leute, die man befreit, kämpfen gern mit.
- *Ziel:* „Optional: Vertreib die Wachen am Gefangenenlager“
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

### 6. Abschluss (normale Szene)

- *Auslöser:* Tauwetter überstanden und Baupläne gesichert. Kamera auf die Gruppe am Ufer, dann auf einen gefangenen
  Wächter, den die Freiwilligen festhalten.
- *Dialog:*
  > **Wächter:** Ich sage alles, wenn ihr mir ein Stück Brot gebt. Der Statthalter selbst trägt ein Kronstück, das von
  > Hagenfurt, an einer Kette um den Hals. Er legt es nie ab.
  >
  > **Orrin:** Am Hals. Dann müssen wir es ihm abnehmen, und er wird es nicht hergeben.
  >
  > **Nelia:** Zwei Kronstücke haben wir. Eines trägt er. Die anderen beiden liegen irgendwo im Land.
  >
  > **Orrin:** Das Brot für den Mann bezahle ich. Es ist die beste Auskunft, die ich je gekauft habe.
- *Dann Ortswechsel nach Hagenfurt, Nacht. Malvor und ein Bote:*
  > **Bote:** Das Wetterwerk ist zerstört, Statthalter. Es war die Prinzessin aus Lindgrund.
  >
  > **Malvor:** Dann ist mein Winter vorbei. Der Hunger hält sie nicht mehr.
  >
  > **Malvor:** Wenn der Hunger sie nicht mehr hält, dann eben das Eisen. Ruft Hauptmann Taran. Er marschiert nach
  > Eisenhain.


---

## Mission 4 – Eisenhain

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Kann Nelia die Bergleute von Eisenhain befreien, bevor Malvor ihr Eisen und ihr Kronstück bekommt?** Im Gesamtbogen
**Bad Guys Close In**: Ohne seinen Winter greift Malvor zum Schwert. Und zum ersten Mal steht Nelia jemandem
gegenüber, der weiß, wer sie wirklich ist – Hauptmann Taran.

### 2. Einleitungstext (liest die Erzählerin vor)

> Das Wetterwerk ist zerstört. Zum ersten Mal seit Jahren taut es im Kronland, und auf den Feldern wird wieder gesät.
> Damit hat Malvor seine stärkste Waffe verloren: Wo Korn wächst, muss niemand mehr für ihn schuften.
>
> Also greift er zum Schwert. Für ein Heer braucht er Eisen, und das liegt in Eisenhain, der Stadt der Bergleute.
> Hauptmann Taran, Malvors bester Mann, belagert sie. Man sagt außerdem, im tiefsten Stollen liege das Kronstück von
> Eisenhain.
>
> Zwei von fünf Kronstücken hat Nelia. Das dritte darf Malvor nicht bekommen.

**Startvorrat:** 900 Taler, 1400 Lehm, 1800 Holz, 1200 Stein, 400 Eisen, 100 Schwefel; 10 Leibeigene, eine Kaserne.
Die Stadt Eisenhain ist verbündet; vor ihr liegen zwei Belagerungslager, am vorderen steht Taran. Wetter: Frühling
mit Regen, gegen Ende ein kurzer Spätfrost.

### 3. Ablauf

#### Start – Vor Eisenhain

- *Auslöser:* Missionsbeginn. Kamera auf Nelias Lager, dann auf die Stadt Eisenhain und die beiden Belagerungslager.
- *Dialog:*
  > **Orrin:** Eisenhain. Eisen, Schwefel – und eine ganze Armee davor. Ich hätte in Beaucroix bleiben sollen.
  >
  > **Orrin:** Seit Wochen kommt kein Brot hinein und kein Eisen heraus.
  >
  > **Nelia:** Dann brechen wir die Belagerung. Dafür brauchen wir Soldaten – mehr als wir haben.
- *Ziel:* „Brich die Belagerung: Besiege die Wachen beider Lager“

#### Schritt 1 – Zwei Wege zu Soldaten

- *Auslöser:* direkt nach dem Start. Zwei Angebote erscheinen.
- *Dialog:*
  > **Orrin:** Ich kenne zwei Wege zu Soldaten. Söldner: teuer, vierzehnhundert Taler, aber sie kämpfen sofort.
  >
  > **Orrin:** Oder Leibeigene, die aus Malvors Kornlagern geflohen sind. Vierhundert Taler für Brot und Decken. Sie
  > bringen Vorräte mit – aber kämpfen müssen sie erst lernen.
  >
  > **Nelia:** Leute, die von selbst zu uns kommen. Wenigstens kaufe ich dann keinen Menschen.
  >
  > **Orrin:** Nur eins von beiden, Kind. Wer Söldner hat, braucht keine Flüchtlinge – sagen die Söldner.
  >
  > **Erzählerin:** Beide stehen unter „Angebote“.
- *Söldner angeheuert:*
  > **Orrin:** Bezahlt und bereit. Sie fragen nicht, wofür sie kämpfen.
  >
  > **Nelia:** Malvors Soldaten fragen auch nicht.
- *Flüchtlinge aufgenommen:*
  > **Dorfbewohnerin:** Wir sind aus Malvors Kornlager getürmt. Da drin redet jeder von der Prinzessin aus Lindgrund.
  > Für die Prinzessin arbeiten wir gern.
  >
  > **Nelia:** Ihr arbeitet für euch selbst. Nicht für eine Prinzessin.

#### Schritt 2 – Eisen

- *Auslöser:* direkt nach dem Start.
- *Dialog:*
  > **Nelia:** Schwertkämpfer brauchen Eisen. Und jedes Stück Eisen, das wir aus dem Berg holen, fehlt Malvor.
- *Ziel:* „Baue eine Eisengrube“
- Die Kamera fährt kurz zum Eisenschacht, ein Ring markiert ihn.

#### Schritt 3 – Schwefel

- *Auslöser:* direkt nach dem Start.
- *Dialog:*
  > **Orrin:** Hier in Eisenhain gibt es Schwefel. Und in den Bauplänen des Wetterwerks steht es auf jeder zweiten
  > Seite: Ohne Schwefel kein Wetterwerk.
  >
  > **Nelia:** Und Malvor will ein neues bauen.
  >
  > **Orrin:** Dann graben wir den Schwefel, bevor er es tut. Und heben ihn gut auf.
- *Ziel:* „Baue eine Schwefelgrube“
- Die Kamera fährt kurz zum Schwefelschacht, ein Ring markiert ihn.

#### Schritt 4 – Bogenschützen (freiwillig)

- *Auslöser:* Eisengrube fertig.
- *Dialog:*
  > **Orrin:** Tarans Lager stehen hinter Palisaden. Wer da hineinläuft, läuft in Spieße.
  >
  > **Nelia:** Bogenschützen treffen von draußen.
  >
  > **Orrin:** Und wie man sie ausbildet, wissen die Gelehrten. Eine Hochschule, ein paar kluge Köpfe – und viel Suppe.
- *Ziel:* „Optional: Erforsche ‚Stehendes Heer‘ für Bogenschützen“
  > **Erzählerin:** Erforscht wird an der Hochschule. Danach bildest du Bogenschützen am Schießplatz aus.

#### Schritt 5 – Taran

- *Auslöser:* Nelia kommt in die Nähe des vorderen Lagers.
- *Dialog:*
  > **Taran:** Halt. … Ich kenne dein Gesicht. Kornlager Hagenfurt, der Holzplatz. Du hast dort Holz geschleppt.
  >
  > **Taran:** Du bist die Tochter vom Holzfäller aus Lindgrund. Und jetzt nennen sie dich Prinzessin?
  >
  > **Nelia:** Ich habe nie gesagt, dass ich eine bin.
  >
  > **Taran:** Aber auch nie laut genug, dass du keine bist. Geh nach Hause, Mädchen. Hier wird gekämpft.
  >
  > **Nelia:** Warum dienst du Malvor? Er lässt die Dörfer hungern.
  >
  > **Taran:** Unter dem gütigen König sind auch Kinder verhungert. Malvor bringt Ordnung. Volle Speicher.
- *Kommt Nelia nie ans vordere Lager, hört der Spieler dasselbe Gespräch, sobald Taran besiegt ist – vor seinem
  Rückzug.*
- *Taran besiegt:*
  > **Taran:** Genug. Rückzug! … Wir sehen uns wieder, Holzfällerstochter.
  >
  > **Orrin:** Er weiß, wer du bist. Und er reitet nach Hagenfurt.
  >
  > **Nelia:** Dann holen wir das Kronstück von Eisenhain, bevor Malvor davon erfährt. Ohne Taran halten seine Lager
  > nicht lange.

#### Tarans Ausfälle

- *Auslöser:* erste eigene Truppe (angeheuert oder ausgebildet), spätestens nach 10 Minuten; zwei Minuten danach,
  dann alle fünf Minuten, höchstens dreimal – solange die Belagerung steht. Jeweils zwei Trupps Schwertkämpfer greifen
  Nelias Lager an.
- *Erster Ausfall:*
  > **Taran:** Schlagt das Lager dieser Prinzessin, bevor es wächst!
  >
  > **Nelia:** Sie kommen zu uns! Haltet das Lager!
  >
  > **Erzählerin:** Ein Wachturm schießt auf Feinde in seiner Nähe.

#### Wetter

- *Erster Regen:*
  > **Orrin:** Regen! Seit Jahren der erste. Gut für die Felder – schlecht für Bogenschützen.
- *Spätfrost gegen Ende:*
  > **Nelia:** Schnee? Läuft Malvors Wetterwerk etwa wieder?
  >
  > **Orrin:** Nein. Nur ein gewöhnlicher Spätfrost, wie früher. Der geht vorbei. Malvors Winter ging nie vorbei.

#### Schritt 6 – Der Bergmeister

- *Auslöser:* Die Wachen beider Lager sind besiegt. Der Bergmeister bekommt ein Ausrufezeichen.
- *Dialog:*
  > **Bergmeister:** Sie ziehen ab! Kommt in die Stadt, Prinzessin. Ich habe etwas für euch.
- *Ziel:* „Schick Nelia zum Bergmeister in Eisenhain“
- *Gespräch (nur Nelia; ein anderer Held hört: „Die Prinzessin soll selbst kommen.“):*
  > **Bergmeister:** Aus dem tiefsten Stollen. Das Kronstück von Eisenhain. Malvor wollte es – ihr bekommt es.
  >
  > **Bergmeister:** Für die Prinzessin. Eisenhain gibt es nur dem rechten Blut.
  >
  > **Nelia:** Bergmeister, ich muss dir etwas …
  >
  > **Orrin:** … sagen, wie dankbar sie ist! Sprachlos vor Dank. Das passiert ihr oft.
  >
  > **Nelia:** *(leise)* Das nächste Mal sage ich es, Orrin. Ganz gleich, was du dazwischenredest.

### 4. Nebenziel: Eigene Truppen

- *Ziel:* „Optional: Bilde 4 eigene Truppen aus“
- *Erfüllt (300 Eisen):*
  > **Bergmeister:** Gute Leute, die da bei euch stehen. Nehmt Eisen für ihre Klingen.

### 5. Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Eisenhain öffnet die Tore, und Malvor bekommt Eisen, Schwefel und das
  dritte Kronstück.“

### 6. Abschluss (normale Szene)

- *Auslöser:* Alle Hauptziele erfüllt. Kamera auf die Schmieden von Eisenhain, dann auf Nelia und Orrin am Stadttor.
- *Dialog:*
  > **Bergmeister:** Heizt die Schmieden an! Zum ersten Mal seit Monaten verlässt Eisen den Berg, das nicht nach
  > Hagenfurt geht.
  >
  > **Nelia:** Den Schwefel lasst ihr in Fässer füllen und gut verwahren. Den bekommt keiner.
  >
  > **Orrin:** Drei Kronstücke. Wenn das so weitergeht, muss ich mir einen größeren Beutel kaufen.
  >
  > **Nelia:** Taran ist abgezogen. Er sah nicht aus wie einer, der gern kämpft.
  >
  > **Orrin:** Er sah aus wie einer, der Befehle ausführt. Das ist gefährlicher.
- *Dann Ortswechsel nach Hagenfurt, Nacht. Taran meldet sich bei Malvor:*
  > **Taran:** Eisenhain ist verloren, Statthalter. Das Kronstück auch.
  >
  > **Taran:** Und noch etwas. Die sogenannte Prinzessin ist keine. Ich habe sie auf dem Holzplatz im Kornlager gesehen.
  > Sie ist die Tochter eines Holzfällers aus Lindgrund, eine entlaufene Leibeigene.
  >
  > **Malvor:** Eine Leibeigene mit einem Kronstück. Und das ganze Kronland nennt sie Prinzessin.
  >
  > **Malvor:** Herold! Reite zu den Moordörfern und sag ihnen, wem sie folgen.


---

## Mission 5 – Morvale

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Folgen die Moordörfer Nelia noch, wenn sie wissen, dass sie keine Prinzessin ist?** Im Gesamtbogen **All Is Lost**
(die Lüge fliegt auf, die Dörfer wenden sich ab), **Dark Night of the Soul** (Orrin will gehen) und **Break into
Three** (Nelia gewinnt die Dörfer durch Taten zurück, Taran läuft über). Am Ende steht der Satz, um den die ganze
Geschichte kreist: „Wir folgen dir – nicht deinem Blut.“

### 2. Einleitungstext (liest die Erzählerin vor)

> Drei von fünf Kronstücken hat Nelia – aus Lindgrund, Beaucroix und Eisenhain. Das vierte liegt bei den Moordörfern
> von Morvale, bei der Dorfältesten von Erlenhof. Das fünfte trägt Malvor um den Hals.
>
> Die Moordörfer haben nie einem Herrn gehorcht. Nelia folgen sie, weil sie die verlorene Prinzessin sein soll. Malvor
> lässt sie hungern, damit sie sich ihm beugen, und hinter dem Dorf Moorbrook lagert Hauptmann Taran mit seinen
> Soldaten.

**Startvorrat:** 800 Taler, 1200 Lehm, 1500 Holz, 1000 Stein, kein Eisen; 12 Leibeigene. Die drei Dörfer Moorbrook,
Schilfheim und Erlenhof sind verbündet; zwei Trupps Speerträger der Dörfer bewachen Nelias Lager. Tarans Lager liegt
hinter Moorbrook.

### 3. Ablauf

#### Start – Bei den Moordörfern

- *Auslöser:* Missionsbeginn. Kamera auf Nelias Lager, dann über die drei Dörfer zu Tarans Lager.
- *Dialog:*
  > **Dorfälteste:** Prinzessin! Morvale steht zu dir. Meine Speerträger bleiben bei dir, solange du sie brauchst.
  >
  > **Orrin:** Seht ihr? Königsblut öffnet Türen. Und Speicher.
  >
  > **Nelia:** Orrin, hör auf. Taran weiß, wer ich bin. Und wenn Taran es weiß, weiß es Malvor.
  >
  > **Orrin:** Dann sei froh, dass die Dörfer es noch nicht wissen. Bauen wir, solange sie uns mögen.
  >
  > **Nelia:** Höfe zuerst. Wer in Morvale selbst Korn hat, muss es den Dörfern nicht wegnehmen.
- *Nebenziel:* „Optional: Baue 4 eigene Bauernhöfe“

#### Schritt 1 – Der Herold (All Is Lost)

- *Auslöser:* zweieinhalb Minuten nach Beginn. Kamera auf den Herold vor Moorbrook.
- *Dialog:*
  > **Herold:** Hört, Leute von Morvale! Statthalter Malvor lässt verkünden: Die „Prinzessin“ ist die Tochter eines
  > Holzfällers aus Lindgrund. Eine entlaufene Leibeigene!
  >
  > **Herold:** Ein Händler hat die Lüge erfunden, um Geld zu machen. Wer ihr folgt, folgt einem Märchen.
  >
  > **Herold:** Und das Kronstück, das in Erlenhof liegt, gehört dem Statthalter. Gebt es heraus!
  >
  > **Nelia:** Es stimmt. Ich bin keine Prinzessin. Ich habe es von Anfang an gesagt. Nur zu leise.
  >
  > **Orrin:** Nelia … nein.
  >
  > **Dorfälteste:** Meine Speerträger gehen heim. Wir wissen nicht mehr, wem wir glauben sollen.
- Die drei Dörfer werden neutral, ihre Speerträger verlassen das Lager.
  > **Erzählerin:** Neutral heißt: Sie greifen nicht an, helfen dir aber nicht mehr.

#### Schritt 2 – Orrin will gehen (Dark Night of the Soul)

- *Auslöser:* direkt nach dem Herold.
- *Dialog:*
  > **Orrin:** Das ist meine Schuld. Ohne meine Geschichte von der verlorenen Prinzessin wärst du eine Leibeigene,
  > die heimgekehrt ist. Mehr nicht.
  >
  > **Nelia:** Ohne deine Geschichte hätte mir in Lindgrund keiner zugehört. Das ist auch wahr.
  >
  > **Orrin:** Ich gehe zurück nach Beaucroix. Ein Händler weniger, eine Lüge weniger.
  >
  > **Nelia:** Du bleibst. Du schuldest mir noch ein Brot.
  >
  > **Nelia:** Wir fangen von vorn an. Wie in Lindgrund. Die Dörfer wollen keine Prinzessin – sie wollen Dächer, einen
  > Deich und Saatgut. Das können wir ihnen geben.
  >
  > **Orrin:** Ohne Geschichte. Das habe ich noch nie verkauft. Aber gut – liefern wir.

#### Schritt 3 – Lieferungen (Break into Three)

- *Auslöser:* direkt nach Orrins Gespräch. Drei Angebote erscheinen.
- *Ziel:* „Gewinne die drei Dörfer durch Lieferungen zurück“
  > **Erzählerin:** Die Lieferungen stehen unter „Angebote“. Bezahlst du, geht die Ware sofort ins Dorf.
  >
  > **Erzählerin:** Für Schilfheims Deich brauchst du Eisen: Baue eine Eisengrube.
- *Moorbrook beliefert:*
  > **Dorfbewohnerin:** Ihr habt geliefert, ohne etwas zu verlangen. Moorbrook steht wieder zu euch.
- *Schilfheim beliefert:*
  > **Dorfbewohnerin:** Der Deich hält wieder. Schilfheim vergisst das nicht.
- *Erlenhof beliefert:*
  > **Dorfälteste:** Saatgut von einer Leibeigenen. Das hat uns noch kein König geschickt.

#### Schritt 4 – Der Befehl (Taran läuft über)

- *Auslöser:* die erste Lieferung – spätestens fünf Minuten nach dem Herold. Kamera auf Tarans Lager vor Moorbrook.
- *Dialog:*
  > **Herold:** Hauptmann Taran! Befehl des Statthalters: Brennt die Höfe von Moorbrook nieder. Wer anderen Korn gibt
  > als Malvor, soll hungern.
  >
  > **Taran:** … Nein. Ich habe ein Dorf verhungern sehen. Meine Schwester war sieben. Ich zünde kein Korn an.
  >
  > **Taran:** Wer mit mir geht, kommt mit. Die Leibeigene weiß wenigstens, was Hunger ist.
  >
  > **Nelia:** Taran!
  >
  > **Taran:** Holzfällerstochter. Ich habe Malvor gesagt, wer du bist. Das war meine Pflicht. Höfe anzünden ist keine.
  >
  > **Nelia:** Dann hilf uns, die Höfe von Moorbrook zu halten. Malvors Leute sind schon unterwegs.
  >
  > **Orrin:** Ein Hauptmann, der Nein sagt. Seltener als jede Prinzessin.
- Taran wechselt mit zwei Trupps auf Nelias Seite; die übrigen Getreuen marschieren auf Moorbrook.
- *Ziele:* „Schütze die Höfe von Moorbrook“ · „Vertreibe Malvors restliche Truppen“
  > **Erzählerin:** Brennt der letzte Hof von Moorbrook, ist die Mission verloren.
  >
  > **Erzählerin:** Wähle Taran allein: „Schildstoß“ trifft alle Feinde rundum, „Einschüchtern“ lässt sie eine Weile
  > fliehen.

#### Verstärkung

- *Auslöser:* fünfeinhalb Minuten nach dem Befehl. Zwei weitere Trupps Schwertkämpfer marschieren auf Moorbrook.
  > **Herold:** Verstärkung für die Getreuen! Morvale wird gehorchen!
  >
  > **Taran:** Das sind meine alten Leute. Ich kenne jeden von ihnen. Lasst mich vorn stehen.

#### Schritt 5 – Erlenhof

- *Auslöser:* Alle drei Dörfer sind wieder verbündet, und Malvors Truppen sind vertrieben. Die Dorfälteste von
  Erlenhof bekommt ein Ausrufezeichen.
- *Dialog:*
  > **Dorfälteste:** Komm nach Erlenhof, Nelia. Der Herold wollte etwas von uns. Ich gebe es lieber dir.
- *Ziel:* „Schick Nelia zur Dorfältesten von Erlenhof“
- *Gespräch (nur Nelia; ein anderer Held hört: „Nelia soll selbst kommen.“):*
  > **Dorfälteste:** Du hast geliefert, als dir keiner mehr etwas schuldete. Und du hast unsere Höfe gehalten.
  >
  > **Dorfälteste:** Das vierte Kronstück. Es lag bei uns, keiner weiß, seit wann. Nimm es.
  >
  > **Nelia:** Ich bin eine Leibeigene.
  >
  > **Dorfälteste:** Wir folgen dir – nicht deinem Blut.

### 4. Nebenziel: Eigene Höfe

- *Erfüllt (400 Taler):*
  > **Dorfbewohnerin:** Wer selbst Korn anbaut, will uns unseres nicht wegnehmen.

### 5. Niederlage

- *Burg gefallen:* „Euer Lager ist gefallen. Morvale gehorcht Malvor – aus Hunger.“
- *Höfe von Moorbrook verbrannt:* „Die Höfe von Moorbrook sind niedergebrannt. Wer jetzt essen will, muss zu Malvor.
  Die Dörfer werden Nelia nie wieder folgen.“

### 6. Abschluss (normale Szene)

- *Auslöser:* Das vierte Kronstück ist in Nelias Hand. Nacht, Kamera auf das Lagerfeuer, an dem Taran allein sitzt.
- *Dialog:*
  > **Orrin:** Knopf?
  >
  > **Taran:** Nein.
  >
  > **Orrin:** Jeder braucht einen. Ich habe blaue, rote und einen, den ich nie verkaufen werde.
  >
  > **Taran:** … Gib her.
  >
  > **Orrin:** Du hast ihn genommen. Warum eigentlich?
  >
  > **Taran:** Ich weiß es nicht.
- *Ein Bote kommt ins Lager, ein Schreiben mit Malvors Siegel für Nelia:*
  > **Bote:** Für die Holzfällerstochter, vom Statthalter.
  >
  > **Nelia:** *(liest)* „Vier hast du. Das fünfte trage ich. Komm und hol es dir – der See ist tief.“
  >
  > **Nelia:** Taran, du kennst sein Schloss.
  >
  > **Taran:** Mitten im Thronsee. Keine Brücke, kein Boot. Im Winter trägt der See. Aber Winter gibt es nicht mehr.
  >
  > **Orrin:** *(zieht Papiere aus der Tasche)* Noch nicht.


---

## Mission 6 – Der Thronsee

### 1. Dramatische Frage und Funktion im Gesamtbogen

**Kann Nelia Malvor das fünfte Kronstück nehmen, ohne so zu werden wie er?** Im Gesamtbogen das **Finale**: Plan
(ein eigenes Wetterkraftwerk), Ausführung (der See friert), Überraschung (Malvor taut mit seinem eigenen Kraftwerk,
Orrin bricht ein), Weitermachen ohne den Mentor, Sturm aufs Schloss. Danach das **Final Image**: Krönung, Orrins Tod,
das Ende der Leibeigenschaft, Rauch über Lindgrund.

### 2. Einleitungstext (liest die Erzählerin vor)

> Vier von fünf Kronstücken hat Nelia – aus Lindgrund, Beaucroix, Eisenhain und Morvale. Die Dörfer folgen ihr, obwohl
> sie wissen, dass sie keine Prinzessin ist, und Hauptmann Taran ist mit seinen Leuten zu ihr übergelaufen.
>
> Das fünfte Kronstück, das von Hagenfurt, trägt Malvor an einer Kette um den Hals. Er hat sich im Inselschloss
> verschanzt, mitten im Thronsee, wo einst König Edrian lebte. Nelia hat die Baupläne aus dem Wetterwerk und den
> Schwefel aus Eisenhain. Doch Malvor kennt dieselbe Kunst.

**Startvorrat:** 1500 Taler, 600 Schwefel, reichlich Baustoffe und Eisen; 16 Leibeigene. Ufersiedlung mit Burg,
Wohnhaus, Hof, Hochschule, Kaserne und Alchimistenhütte. Helden: Nelia, Orrin, Taran. Alle Gebäude sind
freigeschaltet. Malvors Schloss steht auf der großen Insel, davor auf einer kleinen Insel sein Wetterkraftwerk – voll
geladen. Es ist Sommer.

### 3. Ablauf

#### Start – Am Thronsee

- *Auslöser:* Missionsbeginn. Kamera auf Nelias Ufersiedlung, dann über den See zum Inselschloss und zur kleinen
  Insel mit Malvors Kraftwerk.
- *Dialog:*
  > **Malvor:** Nelia aus Lindgrund. Eine Leibeigene mit einem Händler und einem Verräter.
  >
  > **Malvor:** Vier Kronstücke hast du gesammelt. Das fünfte trage ich. Komm und hol es dir – aber der See ist tief,
  > Mädchen.
  >
  > **Taran:** Er hat recht. Keine Brücke, kein Boot. Aber im Winter trägt der See.
  >
  > **Orrin:** Und Winter kann man machen. Dafür haben wir die Pläne aus dem Wetterwerk geholt.
  >
  > **Nelia:** Dann bauen wir ein Wetterkraftwerk, lassen den See zufrieren und gehen übers Eis zu ihm.
  >
  > **Taran:** Nur: Malvor hat selbst eins, dort auf der kleinen Insel vor dem Schloss. Ist es geladen, taut er den See,
  > sobald einer von uns aufs Eis tritt.
  >
  > **Taran:** Wer dann auf dem Eis steht, ertrinkt. Aber vom Ufer aus treffen Bogenschützen sein Kraftwerk.
- *Ziele:* „Erobere das Inselschloss“ · „Baue ein Wetterkraftwerk“
  > **Erzählerin:** In dieser Mission sind alle Gebäude freigeschaltet.

#### Schritt 1 – Wetterkunde: forschen oder kaufen

- *Auslöser:* direkt nach dem Start. Ein Angebot erscheint.
- *Dialog:*
  > **Orrin:** Für ein Wetterkraftwerk müssen wir erst verstehen, wie Wetter funktioniert. Das dauert.
  >
  > **Orrin:** Oder wir kaufen das Wissen. Ich kenne Gelehrte in Beaucroix. Achtzehnhundert Taler und vierhundert
  > Schwefel – und wir können sofort bauen.
  >
  > **Nelia:** So viel haben wir noch nicht. Fangen wir selbst an. Reicht das Geld später, kaufen wir den Rest.
  >
  > **Erzählerin:** Zum Forschen wähle die Alchimistenhütte und erforsche „Wettervorhersage“.
  >
  > **Erzählerin:** Das Wissen der Gelehrten findest du unter „Angebote“.
- *„Wettervorhersage“ erforscht:*
  > **Orrin:** Wettervorhersage! Jetzt wissen wir, was kommt. Als Nächstes müssen wir es machen können.
  >
  > **Erzählerin:** Für „Meteorologie“ baue die Alchimistenhütte aus.
- *Wissen gekauft:*
  > **Gelehrte:** Die Zeichnungen aus dem Wetterwerk sind wirr, aber vollständig. Ihr könnt euer Wetterkraftwerk
  > sofort bauen.
  >
  > **Orrin:** Teuer, ja. Aber Zeit ist das Einzige, was man nicht nachkaufen kann.

#### Hagenfurts Garde

- *Auslöser:* „Wettervorhersage“ erforscht oder gekauft – spätestens nach zehn Minuten; danach alle fünf Minuten.
  Truppen kommen über Land von Norden.
  > **Malvor:** Hagenfurts Garde! Zeigt dieser Bauernmagd, was Ordnung heißt.
  >
  > **Taran:** Sie kommen über Land, von Norden. Ich kenne Malvors Garde – sie greift immer an derselben Stelle an.

#### Schritt 2 – Das Wetterkraftwerk

- *Auslöser:* „Meteorologie“ erforscht oder gekauft.
- *Dialog:*
  > **Orrin:** Röhren, Kessel, Zahnräder. Genau wie auf den Plänen. Nur diesmal gehört es uns.
  >
  > **Nelia:** Und diesmal hungert keiner dafür.
- *Ziel (wird jetzt baubar):* „Baue ein Wetterkraftwerk“
  > **Erzählerin:** Im Wetterkraftwerk sammeln drei Wettertechniker Energie – mit Bett und Essen schneller.

#### Schritt 3 – Winter

- *Auslöser:* Wetterkraftwerk fertig.
- *Dialog:*
  > **Taran:** Das Kraftwerk läuft. Wie lange hält so ein Winter?
  >
  > **Orrin:** Drei Minuten. Dann taut es, und das Kraftwerk muss neu laden.
  >
  > **Nelia:** Und wer dann auf dem Eis steht, ertrinkt. Ich weiß. Ich war im Tal.
- *Ziel:* „Lass den Thronsee zufrieren“
  > **Erzählerin:** Ist der Ladebalken des Kraftwerks voll, drücke „Wetter herbeiführen“ und wähle Winter.
- *Der See ist zugefroren:*
  > **Taran:** Der See trägt.
  >
  > **Nelia:** Dann schießen wir sein Kraftwerk vom Ufer aus zusammen. Oder wir warten, bis er es leer getaut hat,
  > und frieren sofort wieder ein.

#### Malvor taut den See

- *Auslöser:* Jemand von uns steht auf dem gefrorenen See, und Malvors Kraftwerk ist geladen und bereit.
  > **Malvor:** Tauwetter!
- *Beim ersten Mal:*
  > **Orrin:** Sein Kraftwerk ist leer. Jetzt muss er laden und warten – wie wir.
  >
  > **Taran:** Dann frieren wir den See zu, sobald unseres wieder geladen ist.
- *Eigene Leute sind ertrunken:*
  > **Nelia:** Sie sind ertrunken. Für einen Schritt aufs Eis.
  >
  > **Taran:** So rechnet Malvor. Menschen sind für ihn nur ein Preis.
  >
  > **Nelia:** Ich will nicht so rechnen.
- *Malvors Kraftwerk zerstört:*
  > **Malvor:** Mein Kraftwerk! Ihr wisst nicht, was ihr zerstört!
  >
  > **Nelia:** Doch. Den letzten Winter, den du machen konntest.

#### Schritt 4 – Orrin bricht ein

- *Auslöser:* Winter, und unsere Truppen erreichen die Schlossinsel.
- *Dialog:*
  > **Orrin:** Nelia! Das Eis … es bricht …
  >
  > **Taran:** Der Händler ist eingebrochen! Ich habe ihn – er lebt, aber er ist schwer verwundet.
  >
  > **Orrin:** Nicht umkehren. Ich habe schon angezahlt. Mit einem Bein.
  >
  > **Nelia:** Bringt ihn ans Ufer. Ich führe es zu Ende.
  >
  > **Taran:** Dann geh vorn und mach ihnen Mut. Im Schloss wartet Malvor mit dem fünften Kronstück.
- Orrin verlässt das Spiel.

#### Schritt 5 – Das Inselschloss

- *Malvor stellt zum ersten Mal ein Geschütz auf oder legt eine Falle:*
  > **Taran:** Ein Feldgeschütz! Erst das Geschütz, dann ihn.
  >
  > **Taran:** Und seht, wohin ihr tretet. Er legt Fußangeln.
- *Schloss unter halber Kraft:*
  > **Malvor:** Ich habe dieses Land vor dem Chaos bewahrt. Unter Edrian verhungerten sie. Unter mir gehorchen sie und
  > essen.
  >
  > **Nelia:** Du hast es hungern lassen, damit es gehorcht.
  >
  > **Malvor:** Und dir? Wer folgt einer Leibeigenen, die sich als Prinzessin ausgegeben hat?
  >
  > **Nelia:** Die, die ich satt gemacht habe.
  >
  > **Nelia:** Und König Edrian? Ein Sturm mitten im Sommer, kurz bevor dein Wetterwerk wieder lief?
  >
  > **Malvor:** Stürme kommen, Mädchen. Man muss nur bereit sein.
- *Das Schloss fällt:*
  > **Malvor:** Ohne mich … wer gibt ihnen dann Korn?
  >
  > **Nelia:** Sie selbst. Das hätten sie immer gekonnt.

### 4. Nebenziele

- *Ziel:* „Optional: Zerstöre Malvors Wetterkraftwerk“ (der Balken zeigt seine Ladung)
- *Ziel:* „Optional: Zerstöre Malvors Turm am Ufer der Schlossinsel“
- *Ziel:* „Optional: Stelle ein Heer aus 8 Truppen auf“
- *8 Truppen erreicht (500 Taler):*
  > **Taran:** Gute Leute. Sie wissen, wofür sie kämpfen. Das wussten meine nie.

### 5. Niederlage

- *Burg gefallen:* „Die Ufersiedlung ist gefallen. Malvor trägt bald alle fünf Kronstücke, und niemand wird ihm je
  wieder widersprechen.“

### 6. Abschluss (normale Szenen, nacheinander)

#### Auf der Schlosstreppe

- *Auslöser:* Das Schloss ist gefallen. Kamera auf Malvor und Nelia auf der Treppe.
- *Dialog:*
  > **Nelia:** Sag es mir. Der Sturm auf dem Thronsee, Edrians Tod. Warst du das?
  >
  > **Malvor:** Ordnung, Mädchen. Ich habe dem Land … Ordnung gebracht.
  >
  > **Taran:** Er hat bis zuletzt gekämpft. Mit einer Garde, die ihm gehorchte, bis keiner mehr stand.
  >
  > **Nelia:** Fünf von fünf Kronstücken. Ob er schuld war, hat er mitgenommen.

#### Die Krönung

- *Auslöser:* Ortswechsel an das Ufer des Thronsees. Vertreter der fünf Provinzen vor Nelia.
- *Dialog:*
  > **Dorfälteste:** Lindgrund krönt dich.
  >
  > **Kaufmann:** Beaucroix krönt dich.
  >
  > **Bergmeister:** Eisenhain krönt dich.
  >
  > **Dorfälteste von Erlenhof:** Morvale krönt dich. Keiner von uns sagt „Prinzessin“. Wir sagen: Königin.
  >
  > **Taran:** Hagenfurt krönt dich. Ich spreche für sie. Von Malvors Leuten ist keiner übrig, der es besser könnte.

#### Orrins Abschied

- *Auslöser:* Nacht, Nelias Zelt. Orrin liegt auf einer Trage.
- *Dialog:*
  > **Orrin:** Das Brot aus Lindgrund. Ich hab's nie verbucht. Jetzt sind wir quitt.
  >
  > **Nelia:** Orrin …
  >
  > **Orrin:** Einmal habe ich eine Prinzessin verkauft, die ich nicht hatte. Jetzt habe ich eine Königin. Bestes
  > Geschäft meines Lebens.
  >
  > **Nelia:** Du hast mir zugehört, als keiner sonst es tat.
  >
  > **Orrin:** Ach was. Ich habe nur gerechnet. *(leise)* Gute Nacht, Nelia.

#### Das erste Gesetz

- *Auslöser:* Am nächsten Tag vor Malvors Kornlager. Nelia, Taran, Volk.
- *Dialog:*
  > **Nelia:** Mein erstes Gesetz: Im Kronland kauft keiner mehr einen Menschen.
  >
  > **Taran:** Öffnet Malvors Kornlager! Volle Speicher – für alle.

#### Lindgrund im Frühling

- *Auslöser:* Ortswechsel nach Lindgrund. Aus jedem Schornstein steigt Rauch, ein Hund bellt. Nelia am alten Baum.
- *Dialog:*
  > **Nelia:** Ein Hund.
  >
  > **Dorfbewohnerin:** Seit dem Winter. Er gehört keinem, aber er bleibt. Dein Vater ist zurück. Er sitzt drüben und
  > spaltet Holz.
  >
  > **Nelia:** Ich wollte ihn fragen, wie das Kronstück unter seinen Baum kam.
  >
  > **Dorfbewohnerin:** Und?
  >
  > **Nelia:** Es spielt keine Rolle mehr.

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
