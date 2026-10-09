# Prüfbericht: Drehbuch „Krone aus Eis“ gegen die Python-Missionstechnik

Geprüft: [DREHBUCH.md](DREHBUCH.md) (Stand Commit dc1dcaa – Malvor fällt, Startlehm 1000) gegen die neue
Missionstechnik: [SKRIPTE.md](../SKRIPTE.md), [MISSIONEN.md](../MISSIONEN.md), `src/sim/scripting/api.js`
(Missions-API, Ereignisse), `host.js` (Ereignis-Zuordnung, Gespräche, Ziele), `src/sim/missions/runtime.js` (Ende,
Zeiger, Nachgeschichte), die Level-Ordner `src/sim/missions/levels/c1-…c6-*/` (`mission.py`, `world.py`,
`scenario.json`) und `tutorial/`, `speakers.js`, `Engine.js` (Zeigerwahl), `UiPointer.vue`, `ObjectivePanel.vue`,
`TutorialCoach.vue`, die `data-testid`/`data-hint-for`-Werte in `src/ui`, `progress.js`, `CampaignMenu.vue` und
`tests/audio/voices.test.js`. Am Drehbuch und am Code ist nichts geändert. Der frühere Bericht prüfte gegen die alte
deklarative Engine (Ziele/Auslöser/Aktionen als JS-Objekte); er ist hiermit ersetzt.

**Bewertung:** ✅ mit vorhandener API umsetzbar (Funktionen genannt) · 🟡 kleine Erweiterung nötig (E-Nummer) oder
Ersatzlösung mit Abstrichen · ❌ nicht umsetzbar. „E1 …“ verweist auf [die Erweiterungsliste](#nötige-erweiterungen-der-technik).

**Bereits entschieden (nicht mehr offen):** Malvor fällt in der letzten Schlacht · Orrin spricht nie direkt mit dem
Spieler · Startlehm Mission 1 = 1000. Alle drei stehen schon im Drehbuch (Commit dc1dcaa); Folgen siehe unten.

---

## Zusammenfassung

| | ✅ | 🟡 | ❌ | Schritte |
|---|---|---|---|---|
| M1 Lindgrund | 30 | 11 | 0 | 41 |
| M2 Beaucroix | 24 | 8 | 0 | 32 |
| M3 Wetterwerk | 17 | 4 | 0 | 21 |
| M4 Eisenhain | 19 | 0 | 0 | 19 |
| M5 Morvale | 22 | 4 | 0 | 26 |
| M6 Thronsee | 24 | 2 | 0 | 26 |
| **Summe** | **136** | **29** | **0** | **165** |

**Ergebnis:** Der Umbau auf Python hilft dem Drehbuch stark. Alles, was im alten Bericht an der Ablaufsteuerung hing,
ist jetzt gewöhnlicher Code: Wahlen als `if`, Merker als Variablen (im Spielstand und im State-Hash), Gesprächsfolgen,
die sich nicht überlagern, Pausen nach dem Ende eines Gesprächs, Zeiger-Phasen durch erneutes `hint()`, „nur ein
Held“ an Gesprächsfiguren, Uhr-Ziele, Leibeigene an beliebigem Ort, eigene Sprecher. **Sieben der zwölf alten
Erweiterungen sind erledigt.** Kein Schritt ist unmöglich. Die 29 🟡 hängen an neun kleinen Erweiterungen (eine
mittlere: Kampagnen-Merker); ohne sie gibt es für jede Stelle eine spielbare Ersatzfassung.

**Die wichtigsten Probleme**

1. **Kampagnen-Zustand zwischen Missionen fehlt weiterhin (K1, E1).** `progress.js` speichert nur Bestzeit und
   Nebenziele, `createMissionSim(id, { seed })` bekommt nichts aus der Vormission, die Python-API hat keinen Zugriff.
   Betroffen: Einleitung M3, Start/Dark Night/Erlenhof M5, Abschluss M6. Neutrale Fassungen funktionieren.
2. **Zieltexte haben keine Handy-Fassung (E2).** `step()` (Tutorial) kennt `touch`, `objective()` nicht. Betroffen:
   alle „Ziel (Maus)/Ziel (Handy)“ (M1 ×5, M3 ×2, M5 ×1).
3. **Für Python unsichtbare Dinge.** Die Simulation erzeugt die Ereignisse `campLit`, `workerLeft`, `tradeStarted`,
   aber `host.js` reicht sie nicht an Skripte weiter; Steuerstufe und Miliz kann ein Skript nicht abfragen (E13,
   E14). Betroffen: M1 Lagerfeuer und Miliz-Hilfen, M2 Handels-Hilfe, Steuer-Wahl, „Arbeiter geht“. Reine
   Oberflächenhandlungen (Kamera, Auswahl, Ziele-Liste, Steuergruppen) sieht ein Missionsskript weiterhin nicht –
   nur `step(ui="camera"|"selectSerfs")` im Tutorial. Die Drehbuch-Regel „[Hilfe, kommt immer]“ bleibt also richtig.
4. **Ein Zeiger zur Zeit, Hauptziele zuerst** (`Engine.js`: erstes offenes Ziel mit `hint.ui`, Hauptziele vorn).
   Phasen gehen jetzt in Python; Zeiger von Nebenzielen und aus Auslösern (Leibeigene kaufen, Nachbardorf, Lehmschuld,
   Wundsalbe) bleiben aber verdeckt, solange ein Hauptziel zeigt (E4).
5. **Zieltexte lassen sich nicht nachträglich ändern** (E15). Zusätze wie „(Orrin allein wählen → ‚Bestechen‘)“ oder
   der Sturm-Zusatz in M2 brauchen das, sonst ein eigenes Hinweis-Nebenziel.
6. **Nachgeschichte nur als ganzer Text je Grund** (`ending(reason)` → `debriefs[reason]`). Abschlüsse aus
   kombinierten Absätzen (M2: Weg × Steuern = 6, M6: Kauf × Köder × K1 = bis 8) brauchen E16 oder fertige Kombinationen
   in `scenario.json`.
7. **Vertonungstest blockiert neue Zeilen.** `tests/audio/voices.test.js` verlangt für jede `say()`-Zeile aller
   Kapitel eine Aufnahme (DE+EN). ~340 neue Zeilen machen `npm test` rot, bis sie vertont sind – und vertont wird nur
   lokal beim Maintainer (`assets-src/`, nicht in Git). Ohne Plan ist kein Umbau-PR grün (siehe Querschnitt).
8. **Drehbuch spricht noch die alte Bausteinsprache** (`event …`, Anker + `delay`, `onPaid`, `onVictory`,
   `npcTalked.hero`, `ensureShaft`, `custom`/`survive`-Ziele, `campaign/c1-….js`). Inhaltlich passt alles, die Notation
   sollte auf die Python-API umgestellt werden (Zuordnungstabelle unten).
9. **Übungsmission widerspricht der Entscheidung „Orrin spricht nie direkt mit dem Spieler“.** Im Tutorial spricht
   Orrin den Spieler auf den Coach-Karten an (Orrin-Porträt in `TutorialCoach.vue`, „Lass uns ein Dorf gründen!“), und
   der Drehbuch-Hinweis empfiehlt „Orrin zeigt dir …“ – beides passt nicht mehr.

**Geschätzter Aufwand** (ohne Vertonung): Erweiterungen E1, E2, E4, E11, E13–E16 ~2,5 Tage (davon E1 ~1 Tag) ·
sechs `mission.py` neu schreiben (DE+EN, ~340 Zeilen, `scenario.json`-Texte, kleine `world.py`-Änderungen) ~4–5 Tage ·
Test-Bot-Strategien, Kampagnenmatrix, Vitest je Mission und Weg, E2E-Fotos ~2 Tage. **Summe ~8–9 Personentage**
(früher 9–10; Python spart vor allem bei den Wahlen und Zeitpunkten). Vertonung zusätzlich (~680 Aufnahmen).

---

## Querschnitt: Antworten auf die Prüffragen

### Welche Ereignisse sieht ein Missionsskript?

| Python | Sim-Ereignis | Im Drehbuch genutzt für |
|---|---|---|
| `@on_start` | Takt 1 | Startdialoge, Meilensteine mit `wait_until` |
| `@every(s)` | – | Ladung Malvors Kraftwerk, Prüfungen je Takt |
| `@on_building_placed(kind)` | `buildingPlaced` | „Baustelle steht“ (M1 Dorfzentrum-Block, Hilfen) |
| `@on_building_done(kind)` | `buildingDone` | Lager fertig (M2), Lehmgrube fertig (M1 Eintreiber) |
| `@on_destroyed`, `@on_killed(owner)` | `buildingDestroyed`, `killed` | Werk/Kraftwerk/Turm zerstört; `killed` ohne Ertrinken-Kennung |
| `@on_recruited` | `recruited` | erster Trupp (M2), Zähler (M4, M6) |
| `@on_research(tech)` | `researchDone` | Wettervorhersage fertig (M6), auch Werkstattforschung |
| `@on_event("research_started")` | `researchStarted` | Hilfe Forschungsweg (M6), Hochschule (M4) |
| `@on_event("upgrade_started")` | `upgradeStarted` | Hilfe Ausbau (M2, M6) |
| `@on_event("trade")` | `tradeDone` | erster Handel abgeschlossen (M2) |
| `@on_event("payday")` | `payday` | Zahltag (M1), Steuer-Wahl (M2) |
| `@on_event("serf_bought")` | `serfBought` | Nebenziel „2 Leibeigene kaufen“ (M1) |
| `@on_event("ability", ability=…, player=…)` | `ability` | Mut machen, Weitblick, Bestechen, Wundsalbe, Schildstoß, Einschüchtern; Malvors Feldgeschütz/Fußangeln mit `player=ENEMY` |
| `@on_event("tribute", id=…)` | `tributePaid` | alle Angebote/Lieferungen/Wahlen |
| `@on_talk(id)` | Ankunft an Gesprächsfigur | Orrin, Älteste, Kaufmann, Bergmeister (mit `visitor.name`) |
| `@on_enter(place, who=…)` | Abfrage alle 5 Takte | Tor/Schlucht/Tal (M3), Taran trifft Nelia (M4); `who` auch `"nelia"`, `"orrin"`, `"army"` |
| `@on_objective(id, status)` | `objective` | Folgen eines erfüllten/gescheiterten Ziels |
| `@on_weather(state)` | `weather` | Regen/Spätfrost (M4), Winter (M6) |

**Nicht sichtbar** (Sim erzeugt sie, `host.js` reicht sie nicht weiter): `campLit` (Lagerfeuer), `workerLeft`
(Arbeiter geht, mit Grund), `tradeStarted` (Handel begonnen), `bribed`, `heroRevived`, `converted`, `diplomacy` →
die drei ersten braucht das Drehbuch (E13). **Ertrinken beim Tauwetter** meldet `Sim.setWeather` gar nicht (nur
Brückeneinsturz schickt `killed` mit `drowned`), siehe unten. **Nicht abfragbar:** Steuerstufe (`taxLevel`),
Miliz (`e.militia`), „läuft gerade ein Gespräch?“ (E14).

**Abfragen, die es gibt:** `count(kind, placed=, level=)` (auch `"worker"`, `"serf"`, `"troop"`), `researched()`,
`stock()` (auch `"energy"`), `serfs()` mit `serf.res`/`serf.job`/`serf.idle`, `troops()`, `buildings()` mit `hp`,
`max_hp`, `level`, `done`, Helden unter ihrem Namen mit `x`, `y`, `down`, `alive`, `distance_to()`, `figures_near()`,
`units_in()`, `diplomacy()`, `weather()`, `world.is_water()`, `time()`.

### „[Hilfe, entfällt wenn …]“

Muster in Python, in derselben Funktion wie der Block davor:

```python
say("orrin", de="…", en="…")              # Block – say() wartet, bis die Zeile vorbei ist
wait(20)                                    # Pause nach dem Gespräch
if count("villageCenter", placed=True) == 0:
    say("orrin", de="Lass die drei das Dorfzentrum …", en="…")
```

Alle Hilfe-Bedingungen des Drehbuchs sind so prüfbar – außer Lagerfeuer, Handel begonnen, Miliz (E13/E14) und
den reinen Oberflächenhandlungen, die das Drehbuch schon richtig als „kommt immer“ führt. Restrisiko: Wartet die
Hilfe-Zeile hinter einem anderen Gespräch auf ihren Platz, wird die Bedingung danach nicht noch einmal geprüft – die
Zeile kann veraltet kommen. Abhilfe: `talking()`-Abfrage (E14), dann `wait_until(lambda: not talking())` vor der
Prüfung.

### Pausen und „Gespräch zu Ende“

**Erledigt durch den Umbau (alte E6).** `say()` hält die Funktion an, bis die Zeile gesprochen ist (Dauer fest aus der
Länge des deutschen Texts, 3–15 s; „✕“/„Gespräch überspringen“ beenden sofort). Die `say()`-Zeilen einer Funktion sind
ein Gespräch; ein zweites Ereignis wartet, bis es vorbei ist – nichts stapelt sich. Ende eines Blocks = Rückkehr des
letzten `say()`. Damit bedeuten die Drehbuch-Angaben „nach dem Block: + 25 s“ jetzt **Pause nach dem Ende**, nicht
mehr Lesezeit ab dem Anker; sie können kürzer werden (Folgeblöcke 3–10 s, Hilfen 20–25 s Handlungszeit). Was gleichzeitig
mit einer Zeile geschehen soll (Welle, Freischaltung), steht *vor* den Zeilen; Wiederholungen rechnen von festen
Zeitpunkten (`wait_until(lambda: time() >= first + 300 * i)`). Der Sieg wartet bis 60 s auf ein laufendes Gespräch –
Zeilen nach dem letzten Ziel (Malvors letzte Worte) gehen nicht verloren.

### Zeiger

- `hint(id, ui=[…], area=…, entity=…, ui_until=…)` je Ziel; `ui` ist eine Liste, **der erste sichtbare Knopf
  leuchtet**; `data-hint-for` lässt am Handy den aufklappenden Knopf leuchten (`minimap-toggle` für
  `quick-hq/idle/all/army`, `serf-build` und Baumenü-Reiter für `build-*`). Alle Kennungen des Drehbuchs existieren
  (`quick-hero-*`, `objective-go-*`, `build-*`, `tribute-pay-*`, `tech-*`, `btech-*`, `ability-*`, `weather-*`,
  `tax-0…4`, `place-confirm`, `militia`, `militia-off`, `tributes-toggle`, `upgrade`, `trade-go`, `repair`,
  `weather-energy`, `objectives-toggle`, `minimap-toggle`, `buy-serf`, `payday`, `res-bar`). **Fehlt:** `tax-row`
  (E11).
- **Phasen (alte E3) – erledigt:** `hint()` darf jederzeit erneut aufgerufen werden und schaltet den Zeiger wieder
  ein. Phase 2 folgt also mit `wait_until(…)` + neuem `hint(id, ui=[…], ui_until=…)`.
- **Ein Zeiger zur Zeit:** `Engine.missionUi` nimmt das erste offene Ziel mit `ui`, Hauptziele zuerst. Zeiger aus
  Nebenzielen/Auslösern bleiben verdeckt, solange ein Hauptziel zeigt (E4). Ersatz ohne E4: den Zeiger des Hauptziels
  kurz mit `hint(id, area=…)` (ohne `ui`) abschalten und danach wieder setzen – umständlich, aber möglich.
- **Ringe:** ein Ring zur Zeit (erstes offenes Ziel mit Ort, Hauptziele zuerst); jedes Ziel mit Ort hat seinen
  „Ziel zeigen“-Knopf. Zwei Wegweiser (M3) gehen als zwei Nebenziele.

### Zieltexte mit Handy-Fassung

Nicht vorhanden. `objective()` hat nur `de`/`en`; `ObjectivePanel.vue` kennt kein `touch`. Das Tutorial zeigt den
Weg (`step(…, touch=…)`, `TutorialCoach.vue` wählt nach `Engine.touch`). → **E2**. Ohne E2: Maus-Fassung mit
angehängtem „· Handy: …“.

### Ertrinken beim Tauwetter

`Sim.setWeather` löscht Figuren auf dem Eis ohne Ereignis (Helden setzt es an die Burg). In Python trotzdem lösbar,
wo das **Skript selbst** tauen lässt: in M3 `set_weather("summer")` in `thaw()`, in M6 `malvor_plant.change_weather("summer")`
in `malvor_thaws()` – beide Male sofort wirksam, also eigene Truppen vorher/nachher zählen (`count("troop")`,
`count("serf")`). Nicht abgedeckt: das Ende des **eigenen** Winters in M6 (läuft über den Wetterzyklus). Ersatz: alle
Sekunde merken, wer auf Wasser steht (`figures_near` + `world.is_water`), bei `@on_weather("summer")` vergleichen.
→ E5 nur noch Komfort.

### Merker über Missionsgrenzen (K1)

Nicht vorhanden – weder in `progress.js` noch in `Engine`/`CampaignMenu` noch in der API. → **E1**. Merker innerhalb
einer Mission sind globale Python-Variablen und stecken über den VM-Zustand im Spielstand und im State-Hash (alte
E10 erledigt).

### Helden-Wahl an Gesprächsfiguren („nur einer“)

**Erledigt (alte E7).** `@on_talk(id)` bekommt den ankommenden Helden; die Mission entscheidet. „Nur wenn genau einer
da ist“: `len(figures_near(elder, radius=5, kind="hero", side="own")) > 1` → „Einer von euch soll reden.“, `return`
(Figur bleibt ansprechbar). Hinweis: Ein Gespräch startet nur, wenn der Spieler den Helden ausdrücklich zur Figur
schickt – bloßes Vorbeilaufen löst nichts aus.

### Steuerstufe, Forschung begonnen, Fähigkeit benutzt

- Steuerstufe: **nicht abfragbar** (`players[p].taxLevel` 0–4 existiert in der Sim) → E14.
- Forschung begonnen: ✅ `@on_event("research_started", tech=…)` – auch für Werkstattforschung (Alchimistenhütte).
- Fähigkeit benutzt: ✅ `@on_event("ability", ability="courage")`; gegnerische Helden mit `player=ENEMY`.
- Endstand beim Sieg: Es gibt kein `on_victory`; das Skript führt `ending(…)` laufend nach (z. B. `@every(2)`), dann
  gilt der Stand beim Sieg.

### Nachgeschichte je Weg

`ending(reason)` wählt `victoryTexts[reason]` und `debriefs[reason]` aus `scenario.json`; `victory(de=…)` ersetzt nur
den Siegestext. Ein Absatz-Baukasten fehlt → E16. Ohne E16: jede Kombination als eigener `debriefs`-Eintrag.

### Sprecher

**Erledigt (alte E12).** Eigene Sprecher stehen in `scenario.json` unter `speakers` (Name, Farbe, Porträt), z. B.
`"elderMoor": { "name": { "de": "Älteste von Moorbrook", … } }`; `npc(…, speaker="elderMoor")`. Für eine eigene
Stimme braucht die Vertonung eine Rolle in `assets-src/voices/cast.json` (lokal beim Maintainer). Alle übrigen
Sprecher des Drehbuchs gibt es in `speakers.js`.

### Vertonung und Tests

`tests/audio/voices.test.js` prüft, dass **jede** `say()`-Zeile der Kapitel und des Tutorials in DE und EN vertont
ist (Ausnahmen nur die Zeilen für den falschen Helden, Liste `UNVOICED`). Neue Zeilen lassen den Test fehlschlagen,
bis die Aufnahmen da sind; vertonen kann nur der Maintainer (Rohdateien in `assets-src/`). Vorschlag: Umbau in zwei
Schritten – (1) PR mit Text und Logik, der Test führt fehlende Aufnahmen für eine Übergangszeit als Warnung (oder eine
Liste „noch nicht vertont“), Sprachausgabe des Browsers liest sie; (2) Vertonung beim Maintainer, Liste leeren. Neue
Zeilen für falsche Helden („Einer von euch soll reden …“, „Ich warte auf Orrin …“) in `UNVOICED` aufnehmen.
Regieanweisungen im Text (*(leise)*, *(5 s danach)*, *(15 s vor Schluss)*) gehören nicht in den `say()`-Text.

### Zuordnung: alte Bausteine im Drehbuch → Python-API

| Drehbuch schreibt | Python heute |
|---|---|
| Auslöser `time N` | `wait_until(lambda: time() >= N)` |
| Anker-Auslöser + `delay` | Zeilen nacheinander in einer Funktion, dann `wait(s)` |
| `all: […]` / `any: […]` / `not …` | `and` / `or` / `not` in `wait_until` bzw. `if` |
| Funktionsbedingung / -aktion | gewöhnlicher Python-Code |
| Merker `flag x` | globale Variable (`global confessed`) |
| `event payday` / `tradeDone` / `upgradeStarted` / `researchStarted` / `serfBought` | `@on_event("payday")` / `("trade")` / `("upgrade_started")` / `("research_started")` / `("serf_bought")` |
| `event ability` (`farsight`) | `@on_event("ability", ability="farsight")` |
| `event recruited` | `@on_recruited` |
| `event tradeStarted` / `campLit` / `workerLeft` | – (E13) |
| `workers N` | `count("worker") >= N` |
| `built X placed` | `count("X", placed=True)`, `@on_building_placed("X")` |
| `job wood` | `serf.res == "wood"` |
| `area … who …` | `@on_enter(place(…), who="army")`, `figures_near(…)` |
| `heroDown taran` | `not taran_foe.alive` |
| `npc` mit Heldenliste, `npcTalked.hero`, `wrongHero` | `npc()` + `@on_talk(id)` mit `visitor.name` |
| `tribute`, `onPaid`, `closeTribute` | `offer(…, group=…)`, `@on_event("tribute", id=…)`, `withdraw()` |
| `complete`, `fail`, verstecktes Ziel zeigen | `complete()`, `fail()`, `show_objective()` |
| `survive`-Ziel, Uhr (E8) | `objective(…, clock=True)` |
| `custom`-Ziel „1/3“ | `objective(id, lambda: (n, 3))` |
| Schutzziel | `objective(…, hold=True)` |
| `hint.ui` mit `uiWhile`, Phasen (E3) | `hint(id, ui=[…], ui_until=…)`, erneut aufrufen |
| `give serfs` mit `at` (E9) | `spawn_serfs(HUMAN, 3)` + `serf.teleport(ort)` |
| `ensureShaft` | `add_shaft("iron", hq())` |
| `diplomacy`, `remove`, `move`, `reveal`, `unlock`, Kamera | `set_diplomacy()`, `remove()`, `move()`, `reveal()`, `unlock()`, `camera.jump_to/fly_to` |
| Bedingung `weather` | `@on_weather("rain")`, `weather()` |
| `debrief(st)`, `onVictory` | `ending(reason)` + `debriefs` in `scenario.json` (E16) |
| Pfad `src/sim/missions/campaign/c1-….js` | `src/sim/missions/levels/c1-lindgrund/` usw. |

---

## Mission 1 – Lindgrund

| Schritt | Bewertung | Python-Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` in `scenario.json` | – |
| Start „Kein Rauch“, Fremder mit Ausrufezeichen | ✅ | `@on_start` + `say()`; `npc("stranger", speaker="orrin")` (vorhanden) | – |
| Schritt 1 Ziel (Maus/Handy) | 🟡 | `objective()` ohne Handy-Text | E2; ohne: „· Handy: …“ anhängen |
| Schritt 1 Zeiger Nelias Bild, Ring am Fremden | ✅ | `hint("meet", entity=stranger, ui=["quick-hero-nelia"], ui_until=lambda: nelia.distance_to(start) > 2)` | Startpunkt in `world.py` merken |
| Schritt 1 Hilfe (25 s, entfällt wenn Nelia sich bewegt) | ✅ | in `arrival()` nach den Zeilen `wait(25)` + `distance_to` | – |
| Schritt 2 Gespräch Block 1, Orrin schließt sich an | ✅ | `@on_talk("stranger")`, `remove(stranger)`, `add_hero(HUMAN, "orrin", …)`, globale Variable | – |
| Schritt 2 Block 2 („+ 30 s“) | ✅ | `wait(…)` in derselben Funktion | Pause nach dem Block: 3–5 s genügen |
| Ziel „alter Baum“ erst jetzt, Baum aufdecken | ✅ | `show_objective("root")`, `reveal()` | – |
| Schritt 3 Ziel (Maus/Handy) | 🟡 | wie Schritt 1 | E2 |
| Schritt 3 Zeiger „Ziel zeigen“ (Handy: „Ziele“) | ✅ | `hint("root", area="oldRoot", ui=["objective-go-root", "objectives-toggle"], ui_until=…)` | Klick selbst nicht prüfbar; `ui_until` = Nelia läuft Richtung Baum |
| Schritt 3 Hilfe (entfällt, wenn Nelia nah ist) | ✅ | `wait(25)` + `nelia.distance_to(place("oldRoot"))` | – |
| Fund Block 1 | ✅ | `@on_objective("root", "done")` | – |
| Drei Leibeigene treten aus dem Wald | ✅ | `spawn_serfs(HUMAN, 3)` + `s.teleport(…)` an den Baum (alte E9 erledigt) | – |
| Fund Block 2, Ziel „Holz“ | ✅ | `say()`, `show_objective("wood")` | – |
| Schritt 4 Ziel (Maus/Handy) | 🟡 | wie Schritt 1 | E2 |
| Schritt 4 Zeiger „Alle“ (Handy Kartenknopf), Ring Balken | ✅ | `hint("wood", area="ruins", ui=["quick-all"])`; Handy über `data-hint-for` | – |
| Schritt 4 Hilfe (entfällt, wenn Holz abgebaut wird) | ✅ | `hauling()` (`serf.res == "wood"`, vorhanden) | – |
| Schritt 5 Ziel (Maus/Handy) | 🟡 | wie Schritt 1 | E2 |
| Schritt 5 Zeiger-Liste, Ring Grundmauern | ✅ | `hint("center", area="square", ui=["place-confirm", "build-villageCenter", "quick-all"], ui_until=…)` | – |
| Schritt 5 Dialog + Hilfe (entfällt bei Baustelle) | ✅ | `count("villageCenter", placed=True)` | – |
| Während des Baus Block 1 (Baustelle + 15 s) | ✅ | `@on_building_placed("villageCenter")` + `wait(15)` | – |
| Block 2 nur, solange nicht fertig, sonst nach Schritt 6 | ✅ | `if count("villageCenter") == 0:` sonst im Handler von Schritt 6 | – |
| Schritt 6 Wohnhäuser, Zeiger | ✅ | `objective("homes", lambda: (count("residence"), 2))`, `hint(… "build-residence" …)` | – |
| Schritt 7 Höfe, „Erster Arbeiter“ | ✅ | `count("farm")`; `wait_until(lambda: count("worker") >= 1)` | – |
| Schritt 8 Lehmgrube / 6 Arbeiter, Zeiger, Ring, Hilfe | ✅ | `count("worker")`, `hint(area="clayShaft", ui=["build-clayMine", …])`; Startlehm 1000 in `scenario.json` | 1000 Lehm = 950 Bedarf + 50: stimmt |
| „Erstes Lagerfeuer“ | 🟡 | `campLit` erreicht Python nicht | E13; ohne: Ersatzbedingung `count("worker") > 6 * count("residence") or count("worker") > 8 * count("farm")` |
| „Zahltag“ | ✅ | `@on_event("payday")` + `count("worker") >= 1` (vorhanden) | – |
| Schritt 9 Auslöser (Lehmgrube fertig, spätestens 25 min) | ✅ | `@on_building_done("clayMine")` / `wait_until(time() >= 1500)` | – |
| Schritt 9 Ziel (Maus/Handy) | 🟡 | wie Schritt 1 | E2 |
| Schritt 9 Zeiger-Phasen Burg → Mut machen → Entwarnung | 🟡 | Phasen mit erneutem `hint()` ✅; Wechsel „sobald Miliz steht“ braucht Miliz-Abfrage | E14; ohne: Phase 2 nach 30 s oder bei `ability`-Ereignis |
| Schritt 9 Block 1, Kamera zu den Eintreibern | ✅ | `spawn()`, `attack()`, `camera.jump_to()` (vorhanden) | – |
| Hilfe „Zu den Waffen!“ (entfällt bei Miliz); Block „sobald Miliz steht oder 30 s“ | 🟡 | Miliz nicht abfragbar | E14; ohne: nur „30 s nach Block 1“, Hilfe kommt immer |
| Hilfe „Mut machen“ (entfällt, wenn benutzt) | ✅ | `@on_event("ability", ability="courage")` | – |
| Sieg + Hilfe „Entwarnung“ (entfällt ohne Miliz) | 🟡 | Miliz nicht abfragbar | E14; ohne: Zeile kommt immer |
| Nebenziel „2 Leibeigene kaufen“ | ✅ | `@on_event("serf_bought")` zählt, `objective(…, lambda: (n, 2), primary=False)` | – |
| Zeiger `buy-serf`/`quick-hq` des Nebenziels | 🟡 | vom Hauptziel-Zeiger verdeckt | E4 |
| Nachbardorf: nur einer, Orrin oder Nelia | ✅ | `@on_talk("elder")` mit `visitor.name`, `figures_near(…, kind="hero")` > 1 → Hinweis (alte E7 erledigt) | – |
| Zeiger `quick-hero-orrin` | 🟡 | vom Hauptziel-Zeiger verdeckt | E4 |
| Wahl A/B: Bündnis, Leibeigene, Holz, Merker | ✅ | `set_diplomacy()`, `spawn_serfs()`, `give()`, globale Variable | – |
| Niederlage | ✅ | `defeatTexts.hq` | – |
| Abschluss in drei Fassungen + gemeinsamer Teil | ✅ | `ending("lie"/"truth"/"none")` + drei `debriefs` (gemeinsamer Teil je Eintrag wiederholt) | mit E16 ohne Wiederholung |

## Mission 2 – Beaucroix

| Schritt | Bewertung | Python-Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start, Kaufmann mit Ausrufezeichen ab Start | ✅ | `npc("merchant", …)` in `@on_start` (heute erst beim Herold) | – |
| Schritt 1 Höfe, Zeiger | ✅ | vorhanden | – |
| Schritt 2 Ruf: Orrin nah **oder** nach 3 min | ✅ | `@on_enter(place("townArea"), who="orrin")` / `wait_until(time() >= 180 and not talked)` | – |
| Nur Orrin; andere hören „Ich warte auf Orrin“ | ✅ | `visitor.name` (vorhanden) | Zeile in `UNVOICED` |
| Gespräch, Lehm-Angebot, Nebenziel | ✅ | `offer("clay", {"clay": 800})`, `show_objective()` | – |
| Zeiger `tribute-pay-clay`/`tributes-toggle` (Nebenziel) | 🟡 | vom Hauptziel-Zeiger verdeckt | E4 |
| Hilfe (entfällt, wenn geliefert) | ✅ | globale Variable aus `@on_event("tribute", id="clay")` | – |
| Bezahlt; Rabatt in jeder Reihenfolge | ✅ | Python-`if`: Herold öffnet `buyShardCheap` oder `buyShard`; Lieferung ersetzt per `withdraw()` + `offer()` | heute öffnet die Lieferung den Rabatt schon vor dem Herold – beim Umbau korrigieren |
| Schritt 3 Lager, Zeiger | ✅ | `count("storehouse", placed=True)` | – |
| Schritt 4 Ausbau als Teilziel, Ring aufs eigene Lager, Zeiger `upgrade` | ✅ | `@on_building_done("storehouse")` liefert das Gebäude → `hint(…, entity=b, ui=["upgrade"])`; `count("storehouse", level=1)` | – |
| Schritt 4 Hilfe (entfällt bei Ausbaubeginn) | ✅ | `@on_event("upgrade_started")` | – |
| Schritt 5 Ziel, Zeiger `trade-go`, Ring Marktplatz | ✅ | `hint(…, entity=markt, ui=["trade-go"])` | Folge „Bezahlen mit → Kaufen“ nur im Text (Oberflächenzustand) |
| Schritt 5 Hilfe (entfällt, wenn ein Handel begonnen hat) | 🟡 | `tradeStarted` erreicht Python nicht | E13; ohne: an „Handel abgeschlossen“ knüpfen (kann während eines laufenden Handels noch kommen) |
| Erster Handel abgeschlossen | ✅ | `@on_event("trade")` (vorhanden) | – |
| Schritt 6 Herold, Lager aufdecken, Kaserne, Angebot | ✅ | `unlock("barracks")`, `reveal()`, `offer(…, group="shard")` (vorhanden) | – |
| Schritt 6 Block 2 + Hilfe (entfällt bei Kaserne-Baustelle) | ✅ | `wait()`, `count("barracks", placed=True)` | – |
| Zeiger „Angebote“ 90 s, dann Kaserne | ✅ | `hint()` zweimal (Phase nach `wait(90)`) | – |
| Wahl A Freikaufen, Merker | ✅ | `@on_event("tribute", id="buyShard")` | – |
| Wahl B: Ziel-Zusatz nach dem ersten Trupp | 🟡 | Zieltext nicht änderbar; Maus/Handy-Fassung | E15 + E2; ohne: optionales Hinweis-Ziel „Truppen wählen, Lager angreifen“ |
| Wahl B Hilfe (entfällt, wenn Truppen am Lager stehen) | ✅ | `@on_recruited` + `figures_near(place("robbers"), 12, kind="troop", side="own")` | – |
| Wachen besiegt, Merker, Angebote schließen | ✅ | `alive(robber_guards) == 0`, `withdraw()` (vorhanden) | – |
| Schritt 7 Auslöser „erster Zahltag nach dem Herold“ | ✅ | `@on_event("payday")` + `offered_at is not None` | – |
| Steuerstufe erkennen, Wahl A/B, Endstand beim Sieg | 🟡 | Steuerstufe nicht abfragbar | E14 (`tax_level()`); Endstand: `ending()` laufend nachführen |
| Zeiger auf die Steuerreihe | 🟡 | ein einzelner `tax-N` gäbe eine Wahl vor | E11; ohne: Zeiger nur `quick-hq` |
| „Da geht einer“ (Arbeiter geht wegen Stimmung) | 🟡 | `workerLeft` erreicht Python nicht | E13; ohne: Zeile streichen (sehr selten zu sehen) |
| Überfälle (5 min nach Herold, alle 5 min, max. 3) | ✅ | `@on_start` mit festen Zeitpunkten (vorhanden) | – |
| Erster Überfall, Hilfe „Wundsalbe“ (entfällt, wenn benutzt) | ✅ | `@on_event("ability", ability="salve")` | – |
| Zeiger `ability-salve` + Zieltext-Zusatz während des Überfalls | 🟡 | Zeiger aus Auslöser verdeckt; Text nicht änderbar | E4 + E15; ohne: nur gesprochen |
| „Es brennt“ (einmalig) | ✅ | `wait_until` über `buildings()` mit `b.done and b.hp * 2 < b.max_hp` (brennt unter 50 %, `DAMAGE.burnBelowPercent`) | – |
| Niederlage | ✅ | `defeatTexts.hq` | – |
| Abschluss: Weg × Steuern + gemeinsamer Teil | 🟡 | nur ein `debriefs`-Text je Grund | E16; ohne: sechs Kombinationen (`ending("bought_high")` …) |

## Mission 3 – Das Wetterwerk

| Schritt | Bewertung | Python-Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung mit K1-Satz (Räuberhauptmann/Gefangener) | 🟡 | `briefing` ist fest, K1 fehlt | E1; ohne: Satz entfällt (geschrieben) |
| Start: Tor aufdecken, Kamera, Block | ✅ | `reveal()`, `camera.jump_to()`, `@on_start` (vorhanden) | – |
| Schritt 1 Ziel (Maus/Handy) | 🟡 | – | E2 |
| Schritt 1 Weitblick: Ereignis, Zeiger, nach 60 s selbst erledigt | ✅ | `@on_event("ability", ability="farsight")`, `hint(ui=["ability-farsight", "quick-hero-nelia"])`, `wait(60)` + `complete()` | – |
| Erfüllt / selbst erledigt: Schlucht aufdecken, Kamera, Zeilen | ✅ | `reveal(place("gorge"))`, `camera.fly_to()` | – |
| Schritt 2 Ziel (Maus/Handy) | 🟡 | – | E2 |
| Zwei Wegweiser „Weg A/B“, erledigen sich mit dem Hauptziel | ✅ | zwei `objective(…, primary=False)` mit `hint(area=…)`; Ring nur am ersten | – |
| Wahl A Tor (beim Sichten) | ✅ | `@on_enter(place("gate"), who="army")` (vorhanden) | – |
| Wahl B Schlucht + Hilfe „Bestechen“ (entfällt, wenn benutzt) | ✅ | `@on_enter(place("gorge"))`, `@on_event("ability", ability="bribe")` | – |
| Zieltext-Zusatz „(Orrin allein wählen → ‚Bestechen‘)“ | 🟡 | Zieltext nicht änderbar | E15; ohne: gleich in den Zieltext von Schritt 2 |
| Merker `bribed` unabhängig vom Weg | ✅ | `@on_event("ability", ability="bribe")` | – |
| Schritt 3 Pläne erst im Tal | ✅ | `hidden=True` + `show_objective()` in `valley_seen` | – |
| Schritt 4 Werk-Dialog beim Sichten | ✅ | `@on_enter(place("valley"))` (vorhanden) | – |
| Alarm (Insel betreten) | ✅ | `@on_enter(place("isle"))` (vorhanden) | – |
| Werk zerstört | ✅ | `@on_objective("works", "done")` (vorhanden) | – |
| Schritt 5 Tauwetter: Uhr 60 s, Ring am Ufer, Zurufe (5 s / 15 s vor Schluss) | ✅ | `objective(…, clock=True)`, `hint(area="landing")`, mehrere Handler (vorhanden) | Regieanweisungen nicht in den Text |
| Sieg 5 s nach dem Tauen | ✅ | in `thaw()`: `set_weather()`, `wait(5)`, dann `thawed = True` | – |
| „Ertrinkt eine eigene Truppe“ | ✅ | in `thaw()` `count("troop")` vor und nach `set_weather()` | E5 nicht nötig |
| Nebenziel Gefangene | ✅ | vorhanden, Dialog tauschen | – |
| Niederlagen (Helden, Eis, Insel) | ✅ | `hold`-Ziel `heroes`, `defeat("ice"/"island")` (vorhanden) | – |
| Abschluss (bestochen / Tor ohne Bestechung) | ✅ | `ending("bribed"/"gate")` + `debriefs` | – |

## Mission 4 – Eisenhain

| Schritt | Bewertung | Python-Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start Block 1/2, Stadt aufdecken, zwei Angebote | ✅ | vorhanden | – |
| Zeiger „Angebote“ (Gruben-Zeiger erst danach) | ✅ | `hint("siege", ui=["tributes-toggle"], ui_until=lambda: gewählt)`; Gruben-Ziele erst danach zeigen | – |
| Wahl A Söldner / B Geflohene, Merker | ✅ | `@on_event("tribute", id=…)` (vorhanden) | – |
| Schritt 1 Eisen, Ring am Schacht, Hilfe | ✅ | `add_shaft("iron", hq())` → `hint(area=…)`; `count("ironMine", placed=True)` | – |
| Schritt 2 Schwefel | ✅ | vorhanden | – |
| Schritt 3 Stehendes Heer: Phasen Hochschule → Forschung → Schießplatz | ✅ | `hint()` dreimal nacheinander (`count("university", placed=True)`, `researched("standingArmy")`) | zeigt als Nebenziel erst, wenn kein Hauptziel zeigt – passt |
| Schritt 3 Hilfe (entfällt bei Hochschule-Baustelle) | ✅ | `count("university", placed=True)` | – |
| Schritt 4 Belagerung, Ringe an beiden Lagern | ✅ | `objective("siege", …)`; ein Ring zur Zeit → `hint()` auf das noch stehende Lager nachführen | Drehbuch: „Ring wandert“ |
| Truppenarten-Dialog (erste Truppe oder 3 min) | ✅ | `wait_until(lambda: count("troop") > 0 or time() >= 180)` | – |
| Taran erkennt Nelia am vorderen Lager | ✅ | `@on_enter(place("siegeA"), who="nelia")` (vorhanden) | – |
| Rückfall-Erkennung | ✅ | `wait_until(lambda: not taran_foe.alive or done_siege())` + `if not met_taran` | vor der Zeile „Rückzug“ |
| Taran bewusstlos, Abzug, Erklärung feindlicher Held | ✅ | `move([taran_foe], rand)`, `wait_until`, `remove()` | – |
| Schritt 5 Bergmeister (nur Nelia), Orrin redet dazwischen, 5 s später | ✅ | `@on_talk("miner")`, `visitor.name`, `wait(5)` | – |
| Ausfälle + Wachturm-Hilfe | ✅ | vorhanden; `count("tower", placed=True)` | – |
| Wetter: erster Regen, Spätfrost | ✅ | `@on_weather("rain")`, `@on_weather("winter")` | – |
| Nebenziel 4 Truppen | ✅ | vorhanden | – |
| Niederlage | ✅ | vorhanden | – |
| Abschluss Söldner/Geflohene | ✅ | `ending("mercs"/"refugees")` + `debriefs` | – |

## Mission 5 – Morvale

| Schritt | Bewertung | Python-Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | – |
| Start, „Älteste von Moorbrook“ als eigener Sprecher | ✅ | `speakers` in `scenario.json` + `npc(…, speaker="elderMoor")` (alte E12 erledigt) | Stimme: Rolle in `cast.json` |
| K1-Zeile aus M4 (Geflohene/Söldner) | 🟡 | – | E1; ohne: entfällt |
| Zwei Speertrupps je Dorf | ✅ | `helpers` in `world.py` als zwei Einträge | – |
| Optionales Ziel mit Frist bis zum Herold (Uhr) | ✅ | `objective(…, lambda: (int(time()), 150, talked), clock=True, primary=False)` (alte E8 erledigt) | – |
| Gesprächsfigur nur Nelia, Geständnis, Merker `confessed` | ✅ | `@on_talk("elderMoor")`, `visitor.name` | – |
| Beim Herold: Figur weg, Ziel scheitert still | ✅ | `remove(elder_moor)`, `fail(…)` (Nebenziel → keine Niederlage) | – |
| Herold Fassung A/B, Dörfer neutral, Speertrupps gehen | ✅ | `if confessed:`; `set_diplomacy()`, `remove(helpers[1])` bzw. beide | – |
| Hilfe „neutral“ (+30 s) | ✅ | `wait()` | – |
| Dark Night | ✅ | gleiche Funktion, `wait()` | – |
| Dark Night K1-Zeile (M1) | 🟡 | – | E1; ohne: entfällt |
| Schritt 2 Lieferungen (2 oder 3 Angebote), Fortschritt „1/3“ | ✅ | `offer()` je Dorf, `objective("regain", lambda: (allies(), 3))` (vorhanden) | – |
| Ring auf dem Eisenschacht | ✅ | `add_shaft("iron", hq())` in `world.py` (heute fehlt er) | – |
| Ring auf das nächste neutrale Dorf | ✅ | `hint("regain", area=…)` nach jeder Lieferung neu | – |
| Hilfe (entfällt, wenn geliefert) | ✅ | globale Variable `delivered` | – |
| Je Lieferung: Dorf verbündet, Zeile | ✅ | vorhanden | – |
| Schritt 3 Befehl, Taran läuft über, Block 2 | ✅ | `taran_defects()` (vorhanden) | – |
| Ziele + Zusatz Taran (Maus/Handy) | 🟡 | – | E2 |
| Zeiger `ability-shieldBash`/`quick-hero-taran`, Ring an den Höfen | ✅ | `hint("granaries", entity=…, ui=[…])` | – |
| Taran-Hilfen (entfallen, wenn Schildstoß/Einschüchtern benutzt) | ✅ | `@on_event("ability", ability="shieldBash"/"intimidate")` | – |
| Verstärkung | ✅ | vorhanden | – |
| Schritt 4 Erlenhof, nur Nelia | ✅ | vorhanden | – |
| Erlenhof K1-Steuerzeile (M2) | 🟡 | – | E1; ohne: entfällt |
| Nebenziel 4 Höfe nach der ersten Lieferung | ✅ | `show_objective("farms")` im Liefer-Handler | – |
| Niederlagen (Burg, Höfe) | ✅ | `hold`-Ziel `granaries` scheitert → Grund `granaries` (vorhanden) | – |
| Abschluss Wahl A/B | ✅ | `ending("confessed"/"herald")` + `debriefs` | – |

## Mission 6 – Der Thronsee

| Schritt | Bewertung | Python-Bausteine / Problem | Vorschlag |
|---|---|---|---|
| Einleitung | ✅ | `briefing` | „Wetterturm“ im heutigen Zieltext ist das falsche Gebäude – Drehbuch sagt richtig „Wetterkraftwerk“ |
| Start Block 1/2, Inseln aufdecken, Angebot | ✅ | vorhanden | – |
| Schritt 1 drei Ziele nacheinander; Kauf erledigt alle | ✅ | `researched("weatherForecast")`, `count("alchemist", level=1)`, `researched("meteorology")`; Kauf: `complete()` | – |
| Zeiger-Phasen Wettervorhersage → Ausbauen → Meteorologie | ✅ | `hint()` je Ziel bzw. neu gesetzt (`btech-weatherForecast`, `upgrade`, `btech-meteorology`) | – |
| Hilfe Forschungsweg (entfällt bei Forschungsbeginn/Kauf) | ✅ | `@on_event("research_started")` (gilt auch für Werkstattforschung) | – |
| „Wettervorhersage fertig“ + Hilfe Ausbau | ✅ | `@on_research("weatherForecast")`, `@on_event("upgrade_started")` | – |
| Wahl A Kauf, Merker `knowledgeBought` | ✅ | `@on_event("tribute", id="scholars")` | – |
| Malvors Garde (Meilenstein, dann alle 5 min) | ✅ | vorhanden | – |
| Schritt 2 Kraftwerk | ✅ | `count("weatherPlant")`, `hint(ui=["build-weatherPlant"])` | – |
| Schritt 3 Winter, Zeiger `weather-winter`/`weather-energy` | ✅ | `hint(…, ui=["weather-winter", "weather-energy"])` | – |
| Hilfe (entfällt, wenn Wetter gewechselt) | ✅ | `weather() == "winter"` / `@on_weather("winter")` | – |
| Winter-Dialog (Köder-Idee) | ✅ | vorhanden, Text tauschen | – |
| Schritt 4 Malvors Tauwetter | ✅ | `malvor_thaws()` (vorhanden, gleiche Regeln) | – |
| Köder: Merker `drowned` bei Malvors Tauwetter | ✅ | in `malvor_thaws()` `count("troop")`/`count("serf")` vor und nach `change_weather()` | – |
| Ertrunkene am Ende des **eigenen** Winters | 🟡 | Wetterzyklus taut ohne Ereignis | E5; ohne: `@every(1)` merkt eigene Figuren auf Wasser, `@on_weather("summer")` vergleicht |
| Erstes Tauwetter | ✅ | `thawed_once` (vorhanden) | – |
| Erste eigene Ertrunkene (Dialog) | ✅ | Merker aus der Zeile oben | – |
| Malvors Kraftwerk zerstört | ✅ | vorhanden | – |
| Schritt 5 Orrin bricht ein (Fassung Sturm) | ✅ | `orrin_falls()` (vorhanden) | – |
| Schritt 5 Fassung Tauwetter (⚠ 4) | ✅ | in `malvor_thaws()` vor dem Befehl `world.is_water(orrin.x, orrin.y)` → gleiche Szene, `orrin_wounded` sichert | – |
| Schritt 6 Schloss, Malvors Feldgeschütz/Fußangeln | ✅ | `@on_event("ability", ability="fieldGun", player=ENEMY)`, `"caltrops"` | – |
| Schloss unter halber Kraft | ✅ | `castle.hp * 2 < castle.max_hp` (vorhanden) | – |
| Schloss fällt: Malvors letzte Worte, dann Sieg | ✅ | `@on_objective("castle", "done")` + `say()`; der Sieg wartet bis 60 s auf das Gespräch. Malvors Figur verschwindet mit der Burg (`checkDefeat`), die Dialogkamera bleibt stehen | – |
| Nebenziele | ✅ | vorhanden | – |
| Niederlage | ✅ | vorhanden | – |
| Abschluss: Kauf, Köder, K1 Moorbrook | 🟡 | Absätze je Weg; `confessed` aus M5 | E16 + E1; ohne: vier Kombinationen in `debriefs`, K1-Satz entfällt |

---

## Nötige Erweiterungen der Technik

### Was aus E1–E12 geworden ist

| Nr. | Alte Erweiterung | Stand nach dem Umbau |
|---|---|---|
| E1 | Kampagnen-Merker (K1) | **weiterhin nötig** – neu beschrieben unten |
| E2 | Zieltext mit Handy-Fassung | **weiterhin nötig** – neu beschrieben unten |
| E3 | Zeiger-Phasen | **erledigt**: `hint()` erneut aufrufen |
| E4 | Zeiger aus Auslösern | **weiterhin nötig**, kleiner: nur noch Vorrang eines Zeigers |
| E5 | Tauwetter meldet Ertrunkene | **größtenteils erledigt** (Zählen im Skript, wo das Skript taut); nur noch Komfort für M6 |
| E6 | Dialogende schätzen | **erledigt**: `say()` wartet, eine Funktion = ein Gespräch |
| E7 | Gesprächsfigur „nur einer“ | **erledigt**: `@on_talk` + `figures_near()` |
| E8 | Uhr im eigenen Ziel | **erledigt**: `objective(…, clock=True)` |
| E9 | `give` mit `at` | **erledigt**: `spawn_serfs()` + `serf.teleport()` |
| E10 | Merker im State-Hash | **erledigt**: VM-Zustand steckt im Spielstand und im Hash |
| E11 | Kennung `tax-row` | **weiterhin nötig** (winzig) |
| E12 | Sprecher „Älteste von Moorbrook“ | **erledigt** (`speakers` in `scenario.json`); offen bleibt nur die Stimme |
| (opt.) | Oberflächen-Prüfungen außerhalb des Tutorials | **weiterhin optional** → E17 |

Neu hinzu kommen E13–E16 (Dinge, die die Python-API noch nicht zeigt). Keine Erweiterung verletzt den Determinismus:
alles sind Befehle, Ereignisse oder JSON-Zustand im Spielstand und im Hash.

### Die Erweiterungen einzeln

**E1 – Kampagnen-Merker** *(mittel, ~1 Tag)*
- **Was sie tut:** Eine Mission kann sich etwas für spätere Missionen merken (`remember("neighborsTruth")`), eine
  spätere fragt es ab (`remembered("neighborsTruth")` → `True`/`False`).
- **Wo:** `api.js` (zwei Funktionen), `runtime.js` (`state.carry` im Spielstand und im Hash), `progress.js`
  (`recordWin` speichert die Merker je Mission), `Engine.js` → `createMissionSim(id, { seed, carry })`,
  `CampaignMenu.vue` (Merker aller Vormissionen übergeben; optional Briefing-Zusatz `briefingIf` in
  `scenario.json`), Tests. Direktstart `?mission=c5` = keine Merker.
- **Wofür im Drehbuch:** Einleitung M3 („Der Räuberhauptmann hat es ihr verraten“), M5 Start (Geflohene/Söldner),
  M5 Dark Night (Lüge/Wahrheit beim Nachbardorf), M5 Erlenhof (Steuern in M2), M6 Abschluss (Geständnis in M5).
  Merker: `neighborsLie`, `neighborsTruth`, `taxedHard`, `taxedLight`, `shardBought`, `shardStormed`, `bribed`,
  `mercs`, `refugees`, `confessed`.
- **Ohne sie:** Diese sieben Zeilen entfallen; jede Mission läuft in der neutralen Fassung (so geschrieben).

**E2 – Zieltext mit Handy-Fassung** *(klein, ~2–3 h)*
- **Was sie tut:** Ein Ziel bekommt einen zweiten Text für Touch-Geräte (`objective(…, touch={"de": …, "en": …})`);
  Zielliste und Code-Panel zeigen ihn auf dem Handy, wie die Tutorial-Karten es mit `step(touch=…)` schon tun.
- **Wo:** `api.js` (`objective`), `host.addObjective`, `runtime.uiState`, `ObjectivePanel.vue`/`MissionHud.vue`.
- **Wofür im Drehbuch:** alle „Ziel (Maus)/Ziel (Handy)“: M1 Schritte 1, 3, 4, 5, 9; M3 Schritte 1, 2; M5 Schritt 3.
- **Ohne sie:** Maus-Fassung mit angehängtem „· Handy: …“ (längere Zieltexte, am Handy eng).

**E4 – Zeiger mit Vorrang** *(klein, ~1–2 h)*
- **Was sie tut:** Ein Zeiger kann sich für eine Weile vor den Zeiger des Hauptziels drängen, z. B.
  `hint("buySerfs", ui=["buy-serf", "quick-hq"], first=True, ui_until=…)` oder ein freier Zeiger
  `pointer(["ability-salve", "quick-hero-orrin"], seconds=30)`.
- **Wo:** `api.js`, `runtime.uiState` (Vorrang mitgeben), `Engine.missionUi` (Zeigerwahl).
- **Wofür im Drehbuch:** M1 „Leibeigene kaufen“ (`buy-serf`), M1 Nachbardorf (`quick-hero-orrin`), M2 Lehmschuld
  (`tribute-pay-clay`), M2 Wundsalbe beim Überfall (`ability-salve`).
- **Ohne sie:** Diese Knöpfe leuchten nicht, solange ein Hauptziel zeigt; Zieltext und Dialog erklären sie. Notlösung
  in Python: Zeiger des Hauptziels kurz ohne `ui` neu setzen und danach zurück.

**E5 – Ertrinken meldet sich** *(klein, ~1–2 h, optional)*
- **Was sie tut:** Wer beim Tauwetter ertrinkt, löst ein Ereignis aus (`@on_event("drowned", owner=HUMAN)`), wie beim
  Brückeneinsturz.
- **Wo:** `Sim.setWeather` (`sim.js`), `host.js`/`api.js` (Ereignis), Test.
- **Wofür im Drehbuch:** M6 „Sie sind ertrunken …“, wenn der **eigene** Winter endet, während Leute auf dem Eis
  stehen.
- **Ohne sie:** M3 und Malvors Tauwetter zählen im Skript vorher/nachher (geht); das Ende des eigenen Winters fängt
  ein `@every(1)`-Merker ab – etwas mehr Code, gleiche Wirkung.

**E11 – Kennung für die Steuerreihe** *(winzig, ~15 min)*
- **Was sie tut:** Die ganze Reihe der Steuerknöpfe bekommt `data-testid="tax-row"`, damit ein Zeiger auf alle fünf
  Stufen zeigt statt auf eine.
- **Wo:** `src/ui/hud/BuildingPanel.vue`.
- **Wofür im Drehbuch:** M2 Schritt 7 (Steuer-Wahl ohne Vorgabe).
- **Ohne sie:** Zeiger nur auf die Burg (`quick-hq`).

**E13 – Mehr Ereignisse für Skripte** *(klein, ~1–2 h)*
- **Was sie tut:** Drei Ereignisse, die die Simulation schon erzeugt, kommen auch im Python-Programm an:
  `@on_event("camp_lit")` (Lagerfeuer brennt), `@on_event("worker_left", reason=…)` (Arbeiter zieht weg),
  `@on_event("trade_started")` (Handel beginnt).
- **Wo:** `EVENT_HANDLERS` in `host.js`, `EVENTS`/`EVENT_ONLY` in `api.js`, Programmier-Referenz, Test.
- **Wofür im Drehbuch:** M1 „Erstes Lagerfeuer“, M2 Schritt 5 Hilfe „entfällt, wenn ein Handel begonnen hat“, M2
  „Da geht einer“.
- **Ohne sie:** Lagerfeuer über die Ersatzbedingung „mehr Arbeiter als Betten oder Plätze“; Handels-Hilfe an
  „Handel abgeschlossen“ (kann während eines laufenden Handels noch kommen); „Da geht einer“ streichen.

**E14 – Abfragen für Bedingungen** *(klein, ~1–2 h)*
- **Was sie tut:** `tax_level()` (0 = keine … 4 = sehr hoch), `serf.militia` (ist der Leibeigene gerade Miliz?) und
  `talking()` (läuft gerade ein Gespräch?).
- **Wo:** `api.js` (Funktion, Eigenschaft), Programmier-Referenz, Test.
- **Wofür im Drehbuch:** M2 Steuer-Wahl (Malvors Weg/Nelias Weg, Endstand, später K1); M1 Schritt 9 Miliz-Hilfen und
  Zeiger-Phase „Burg → Mut machen“; allgemein: Hilfe-Zeilen prüfen ihre Bedingung erst, wenn kein anderes Gespräch
  mehr läuft.
- **Ohne sie:** Die Steuer-Wahl hat keine Folgen (keine Reaktion, ein neutraler Abschluss, keine K1-Zeile in M5);
  Miliz-Hilfen kommen immer bzw. nach fester Zeit.

**E15 – Zieltext ändern** *(klein, ~1 h)*
- **Was sie tut:** `objective_text(id, de=…, en=…)` tauscht den Text eines bestehenden Ziels (mit E2 auch die
  Handy-Fassung).
- **Wo:** `api.js`, `host.js` (`extraObjectives[id].text`).
- **Wofür im Drehbuch:** M2 Sturm-Zusatz nach dem ersten Trupp, M2 Zusatz „Wundsalbe“ während des Überfalls, M3
  Zusatz „Bestechen“ an der Schlucht.
- **Ohne sie:** Zusatz von Anfang an im Zieltext (länger) oder als eigenes optionales Hinweis-Ziel.

**E16 – Nachgeschichte aus Absätzen** *(klein, ~2 h)*
- **Was sie tut:** Das Skript hängt Absätze an die Nachgeschichte (`epilogue(de=…, en=…)`), die Ergebnisseite zeigt
  `debriefs[reason]` plus diese Absätze.
- **Wo:** `api.js`, `runtime.js` (Zustand, Hash, `uiState().result.debrief`), `MissionResult.vue`.
- **Wofür im Drehbuch:** Abschlüsse aus Weg-Absatz + gemeinsamen Teil: M1 (3 Fassungen), M2 (Weg × Steuern), M3
  (bestochen/Tor), M4, M5, M6 (Kauf, Köder, K1).
- **Ohne sie:** Jede Kombination als ganzer Text in `scenario.json` (`ending("bought_high")` …): M2 sechs, M6 vier
  (mit K1 acht) Fassungen – gleiche Wirkung, mehr Text zu pflegen und zu übersetzen.

**E17 – Oberflächen-Prüfungen in Missionen** *(klein–mittel, ~0,5–1 Tag, optional)*
- **Was sie tut:** Die Engine meldet „Kamera bewegt“, „Leibeigene gewählt“, „Held gewählt“, „Ziele-Liste geöffnet“
  auch außerhalb von `step()` als Befehl; Skripte fragen `ui_done("camera")`.
- **Wo:** `Engine.missionUi`, `runtime.command`, `api.js`.
- **Wofür im Drehbuch:** nichts zwingend – nur, wenn „[Hilfe, kommt immer]“-Zeilen (Kamera, Auswahl, „Ziel zeigen“)
  doch entfallen sollen.
- **Ohne sie:** wie geschrieben – diese Hilfen kommen immer und sind so formuliert, dass sie Kundige nicht stören.

**Aufwand gesamt:** E1 ~1 Tag; E2, E4, E11, E13, E14, E15, E16 zusammen ~1,5 Tage; optional E5 ~2 h, E17 ~0,5–1 Tag.

---

## Empfohlene Änderungen am Drehbuch

1. **Bausteine auf Python umstellen:** Notation nach der Zuordnungstabelle oben ersetzen (`event …` →
   `@on_event(…)`, Anker + `delay` → Zeilen + `wait()`, `onPaid` → Tribut-Handler, `npcTalked.hero` → `visitor.name`,
   `ensureShaft` → `add_shaft`, `survive`/`custom` → `clock=True`/Paar); Pfad in Zeile 5 auf
   `src/sim/missions/levels/c1-lindgrund/ …` und Verweis „Bausteine aus MISSIONEN.md“ um SKRIPTE.md ergänzen.
2. **Zeit-Konvention neu fassen:** `say()` wartet; „nach dem Block: + X s“ ist die Pause **nach** dem Gespräch.
   Folgeblöcke 3–10 s, Hilfen 20–25 s. Den Hinweis auf E6 streichen.
3. **Erweiterungstabelle (Teil 3) ersetzen:** E3, E6–E10, E12 als erledigt streichen bzw. durch die Python-Bausteine
   ersetzen; E13–E16 aufnehmen. Alle Stellen „nur mit E3/E7/E9/E12“ (16× E3, 4× E7, 3× E9, 5× E12) entsprechend
   umschreiben.
4. **Hilfe-Bedingungen je Zeile in Python angeben** und die drei unsichtbaren kennzeichnen: Lagerfeuer (E13 oder
   Ersatzbedingung Betten/Plätze), Handel begonnen (E13 oder „abgeschlossen“), Miliz (E14 oder „kommt immer“).
5. **Zieltext-Zusätze** (M2 Sturm, M2 Wundsalbe, M3 Bestechen): ohne E15 als festen Teil des Zieltexts oder als
   eigenes optionales Hinweis-Ziel schreiben.
6. **Abschlüsse:** entscheiden, ob Absätze (E16) oder fertige Kombinationen; bei Kombinationen M2 (6) und M6 (4)
   ausschreiben.
7. **Steuer-Wahl M2** an E14 koppeln oder als reine Erzählung ohne Erkennung kennzeichnen.
8. **Regieanweisungen aus dem Sprechtext:** *(leise)*, *(5 s danach)*, *(15 s vor Schluss)* als Zeitpunkt bzw. Hinweis
   neben der Zeile, nicht im Text – sonst werden sie vorgelesen und vertont.
9. **Übungsmission:** Der Hinweis „Orrin zeigt dir, wie ein Dorf wächst“ widerspricht der Entscheidung „Orrin spricht
   nie direkt mit dem Spieler“. Vorschlag: Coach-Karten ohne Sprecher und ohne Orrin-Porträt (neutraler
   Anleitungstext „Erste Schritte“), Zusammenfassung ohne Nelia als Schülerin; die beiden Orrin-`say()`-Zeilen
   im Tutorial ebenfalls neutral fassen oder streichen.
10. **M1 Startlehm:** Die Begründung in Schritt 8 stimmt jetzt (950 Bedarf, 50 Rest); nur `scenario.json` von 1400 auf
    1000 setzen, wenn umgesetzt wird.
11. **M4 Ringe:** „Ring an beiden Lagern“ → „Ring am noch stehenden Lager“ (ein Ring zur Zeit).
12. **M6 Ertrinken:** Baustein „Zählen in `malvor_thaws()`“ nennen; E5 nur für das Ende des eigenen Winters.
13. **M6 Malvors Ende:** passt technisch – mit der Burg verschwinden seine Figuren, die letzten Worte laufen als
    Gespräch nach `@on_objective("castle", "done")`. Im Drehbuch festhalten, dass Malvor dabei nicht zu sehen ist
    (Dialogkamera bleibt stehen) oder dass die Zeilen schon bei „Schloss fast gefallen“ kommen, solange er noch steht.
14. **Vertonung einplanen:** offene Frage 2 (Hilfe-Zeilen vertonen?) vor dem Umbau entscheiden; Testregel für noch
    nicht vertonte Zeilen festlegen (siehe Querschnitt); neue Falscher-Held-Zeilen in `UNVOICED`.
15. **Doku angleichen** (nach Freigabe): MISSIONEN.md (Tabelle sagt noch „Zacke“, Liste nennt `build-toggle`, das es
    nicht mehr gibt), KAMPAGNE.md, Programmier-Referenz für E1/E2/E4/E13–E16.
