# Missionen schreiben – Leitfaden

Wie eine Mission der Kampagne (oder eine neue Mission) inhaltlich entsteht. Erarbeitet im Oktober 2026 an der
Kampagne „Krone aus Eis“, nachdem die erste Fassung unverständlich war (Schritte ohne Grund, Begriffe wie „Zacke“,
Gespräche ohne Zusammenhang). Technik der Missionen: [Missionen](../MISSIONEN.md), [Skripte](../SKRIPTE.md).

## Ablauf

1. **Weltbeschreibung** ([WELT.md](WELT.md)) lesen bzw. ergänzen: Spielmechanik im Überblick, Wirtschaft, Gebäude,
   Militär, Wetter, Provinzen, Gegenstände, Figuren, Vorgeschichte. Jedes Missionsziel ist eine Handlung in dieser Welt;
   die Welt liefert den Grund dafür.
2. **Drehbuch** schreiben ([DREHBUCH.md](DREHBUCH.md)): nur Inhalt – Einleitung, Schritte, Gespräche, Erzählerin,
   Niederlage, Abschluss. Kein Code.
3. **Kaltleser-Test:** Ein anderes Modell (z. B. GPT über OpenRouter) bekommt nur die Sätze eines Gesprächs, ohne
   jeden Zusammenhang, und muss beantworten: Wo sind wir? Was ist das Ziel? Warum? Was ist als Nächstes zu tun?
   Kann es eine Frage nicht beantworten, wird das Gespräch neu geschrieben.
4. **Machbarkeit** gegen die Missions-Technik prüfen ([PRUEFUNG.md](PRUEFUNG.md)): Was geht mit vorhandenen
   Funktionen, was braucht eine Erweiterung, was nicht.
5. **Abnahme** durch den Projektinhaber – als Artefakt zum Lesen, Entscheidungen verständlich vorgelegt (siehe unten).
6. **Umsetzen** in `src/sim/missions/levels/<id>/` (Python), danach vertonen.

## Regeln für die Geschichte

Vom Projektinhaber:
- Save the Cat und bekannte Handlungsmaximen für interaktive Geschichten.
- Jeder Schritt ist motiviert: Der Spieler weiß, warum er etwas tut.
- Begriffe sind verständlich, auch nach einer Woche Pause.
- Was der Spieler zum ersten Mal braucht, wird erklärt (Mission 1 erklärt die Steuerung vollständig).
- Die Kampagne ist **linear**: kein Gedächtnis über Missionsgrenzen, keine zusätzlichen Wahlen. Erlaubt sind nur die
  Wahlen aus der Vorgabe („kaufen oder kämpfen“: freikaufen oder stürmen, Tor oder Schlucht, Söldner oder
  Flüchtlinge, forschen oder Wissen kaufen). Je Mission ein Abschlusstext, höchstens zwei.

Von Claude vorgeschlagen, vom Projektinhaber bestätigt:
- Jede Mission beginnt mit einer Erinnerung: wo wir sind, wie viele Kronstücke Nelia hat, was Malvor gerade tut.
- „Kronstück“ steht immer mit Zahl („das zweite Kronstück“, „zwei von fünf Kronstücken“).
- Jede Mission hat eine dramatische Frage, die am Ende beantwortet ist.
- Malvor ist in jeder Mission spürbar (Bote, Befehl, Soldaten) und will dort etwas Konkretes.
- Tonrollen: Humor von Orrin, Ernst von Taran, Wärme von Nelia, Kälte von Malvor.
- Grund vor Handgriff: erst warum, dann wie.

Gestrichen, weil sie geschadet haben: Längengrenzen für Sätze oder Gespräche (eine eigene Annahme von Claude, nie
vorgegeben) und „keine Erklärbär-Sätze“. Ein Gespräch ist so lang, wie es braucht.

## Gespräche

- **Erst die Zielvorgabe, dann das Gespräch:** Vor jedem Gespräch festlegen, was der Spieler danach weiß (Ort, Ziel,
  Grund, nächster Schritt).
- Der erste Satz einer Mission nennt Ort und Ziel. Ein Tipp ist die Antwort auf etwas, das gerade gesagt wurde – nie
  ein Satz aus dem Nichts.
- Was im Einleitungstext steht, darf und soll im ersten Gespräch wiederholt werden; den Text überfliegen viele.
- Die Figuren reden **nur miteinander** und sprechen den Spieler nie an.

## Die Erzählerin

Eine eigene Stimme, die nur zum Spieler spricht (Entscheidung Oktober 2026).
- **Wer:** ältere Frau, gute Erzählstimme; Favorit „Hörbuchsprecherin“, im Test auch „fahrende Erzählerin“ und
  „Lehrerin“ (Hörproben, Wahl offen).
- **Was sie spricht:**
  - den **Einleitungstext** jeder Mission (vorgelesen),
  - jedes **neue Ziel** in ein, zwei Sätzen: was und warum,
  - **Bedienung**, die neu ist (welcher Knopf, welcher Klick),
  - nach Sieg und Niederlage ein allgemeiner Satz, mit mehreren Varianten, die zufällig wechseln.
- **Ton:** duzt den Spieler; bei Bedienung ruhig und klar, bei Zielen und Einleitungen erzählerisch. Kommentiert nie,
  was Figuren fühlen, macht keine Witze.
- **Reihenfolge:** Sie spricht erst, wenn die Figuren fertig sind – nie durcheinander.

## Entscheidungen vorlegen

- So erklären, dass jemand ohne Kenntnis von Code und Gedankengang entscheiden kann: was der Spieler merkt, ein
  Beispiel aus dem Spiel, was ohne die Änderung passiert, Aufwand. Keine internen Kürzel ohne Erklärung.
- Zahlen mit Einheit und Abgrenzung („347 gesprochene Sätze, davon 31 Bedienhinweise“).
- Eigene Annahmen als solche kennzeichnen und bestätigen lassen, bevor sie an Agenten gehen.
- Längere Dokumente zusätzlich als Artefakt bereitstellen.

## Stand „Krone aus Eis“ (Oktober 2026)

| Thema | Entscheidung |
|---|---|
| Welt | [WELT.md](WELT.md); fünf Provinzen mit je einem Kronstück, das von Hagenfurt trägt Malvor |
| König und Krone | Edrian ertrank unter rätselhaften Umständen, Malvor steht unbewiesen im Verdacht; die Krone zerbrach, die Kronstücke sind verstreut (Legende) |
| Erstes Kronstück | unter dem Baum, wo Nelias Vater die Familiensachen versteckte; wie es dorthin kam, bleibt offen |
| Leibeigene | werden wie im Spiel gekauft; Nelia äußert Unbehagen, schafft am Ende die Leibeigenschaft ab |
| Malvor | fällt in der letzten Schlacht um sein Schloss |
| Mission 1 | Startlehm 1000 (statt 1400), damit die Lehmgrube auch für Lehm gebraucht wird |
| Stil | Claudes Fassung von Mission 3 (mit Erzählerin) ist der Maßstab; Vergleich mit GPT: Claude kompakter und besser zu folgen |
| Erweiterungen der Technik | nur „Ertrinken melden“ (das Missionsskript erfährt, wer beim Tauwetter ertrinkt) und „Zeiger auf alle Steuerknöpfe“; alle anderen gestrichen |
| Älteste von Moorbrook | gleiche Stimme wie die Älteste von Erlenhof |
| Offen | Stimme der Erzählerin (Hörproben); ob Bedienhinweise vertont werden; ob Nelias Vater als Figur auftritt; Übungsmission (spricht Orrin dort weiter direkt zum Spieler?) |
