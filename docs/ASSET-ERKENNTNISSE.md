# Erkenntnisse aus der Asset-Erzeugung (Figuren, Gebäude)

Protokoll der Versuche mit Bildmodellen und Meshy, Stand Oktober 2026. Was funktioniert hat, was nicht und warum.
Offene Punkte: [ASSETS-OFFEN.md](ASSETS-OFFEN.md). Abläufe und Befehle: [MODELLE.md](MODELLE.md), Stil: [STIL.md](STIL.md), [STILREFERENZ.md](STILREFERENZ.md).
Alle Konzeptbilder samt Vorgängerfassungen liegen in `assets-src/characters/<id>/` und `assets-src/buildings/<id>/`.

## Zusammenarbeit

- Der Nutzer nimmt neue Figuren (Konzept und Ergebnis) per Bild im Chat ab. **Gebäude laufen ohne Freigabe**, bis er
  das widerruft; Ergebnisse trotzdem zeigen.
- Ergebnisse immer in Spielgröße zeigen (Spielfotos je Zoomstufe, `ingame.mjs`), keine Vorher/Nachher-Bögen.
- Budget in `assets-src/credits.json` (aktuell 1500 Credits). 1500 Meshy-Credits kosten etwa 20 $.

## Bildmodelle (OpenRouter)

| Modell | Preis je Bild | Ergebnis |
|---|---|---|
| `openai/gpt-5.4-image-2` | 0,24 $ (fast nur Bildausgabe, kein Qualitätsregler) | beste Figurenbögen, gleicher Stil wie die ChatGPT-Vorlagen; Standard für Figuren (`concept.mjs`) |
| `openai/gpt-5-image-mini` | 0,04 $ | brauchbar, glatter |
| `google/gemini-3-pro-image` | 0,14 $ | gut, aber neigt zu Knete-Look; wurde früher für Bogen-Bearbeitungen genutzt |
| `bytedance-seed/seedream-5-0-flash` | 0,02 $ | **Standard für Gebäude** (`building.mjs`), sehr gut mit Referenzbildern |
| Qwen Image 3 / 3 Pro, Seedream 5.0 Pro / Lite | 0,03–0,045 $ | in der Cloud-Umgebung nicht nutzbar: Antworten brechen nach 30 s ab („upstream request failed“); Flash ist schneller |

- Reine Bildmodelle laufen über `POST /api/v1/images` mit `input_references: [{ type: 'image_url', image_url: { url } }]`
  (`generateImage` in `scripts/asset-gen/lib.mjs`), Chat-Bildmodelle über Chat-Completions.
- **Stil kommt aus Referenzbildern, nicht aus Worten.** Gebäude: Atlas-Symbol (Entwurf) + `assets-src/buildings/style-house.webp`
  (vom Nutzer in ChatGPT erzeugt, Spielgrafik-Look). Figuren: die Figurenbögen der Leibeigenen.
- Eigene Zwischenergebnisse **nicht** als Stilvorlage weitergeben – Fehler (Knete-Look, Pastell) vererben sich.
- Kein deutscher Gebäudename im Prompt – das Modell malt ihn sonst als Schrift ins Bild.
- Zahlen (Höhe 1,5 × Breite) ignoriert das Bildmodell; anschauliche Beschreibung wirkt („drei Fensterreihen übereinander“).
- Feste Regeln für 3D-Vorlagen: freigestellt, kein Boden/keine Bodenplatte, kein Rauch (würde Geometrie), nur eine Tür,
  keine Schrift, Teamfarbe in reinem Magenta.
- **Gebäude: alle Ausbaustufen in einem Bild** (`building.mjs set a,b,c`, Idee des Nutzers) – gleiche Bauweise und
  gleicher Maßstab; Vorlagen Symbol, Stilhaus, fertiges Wohnhaus. Stufen nach Lage benennen („left/middle/right
  building“); „Level 1“ malt das Modell als Beschriftung ins Bild.
- **Einheitlich statt Einzelfall:** gleiche Terrakotta-Dächer für alle Gebäude (Blau aus den Symbolen wird beim Bauen
  umgefärbt – Blau ist Spielerfarbe), je Stufe ein Geschoss mehr und wertigeres Material (Holz/Putz → Steinsockel →
  behauener Stein mit goldenen Spitzen). Nicht je Gebäude neu verhandeln.
- Gruben/Löcher: Seedream zeichnet gern einen ausgeschnittenen Erdwürfel (Seitenwände wirken wie Mauern) und das
  Hof-Muster legt eine Grundstücksmauer an. Hilft: kein `layout: "yard"`, „thin flat irregular patch of ground like a
  rug, NOT a cube, no cut-away sides“ und eine gelungene Geschwistergrube als Vorlage (`refs`).
- **Zwei Ansichten** (`building.mjs back <id>` erzeugt die Rückansicht, ~0,02 $): Meshy bekommt dann vorn und hinten
  (multi-image, gleicher Preis) und erfindet die Rückseite nicht mehr (vorher oft glatte Wände). Achtung: Modelle aus
  zwei Ansichten liegen um 90° gedreht – `build` gleicht das automatisch aus.
- Lange Gebäude (Grundfläche 3×4) brauchen auch ein langes Modell – das Spiel passt die breitere Modellseite auf die
  schmale Grundstücksseite ein (alte Kathedrale wirkte deshalb klein).
- Eingang prüfen, bevor man dreht: `render.mjs <raw.glb>` – Ansicht 1 ist vorn. Meshy legte den Eingang bei allen
  Stufen nach vorn; eine „Korrektur“ nach Augenmaß im Spielbild war falsch.

## Figurenbögen (Stand: alle Rollen neu)

- Ablauf: `concept.mjs new <id> --ref serf_m,serf_f --guide --model google/gemini-3-pro-image --aspect 21:9 --size 2K "…"`,
  weibliche Fassung mit `female <id>_f --from <id>` (gleiche Optionen), dann `views.mjs` – genau vier Ansichten.
- `serf_f_c` hat keinen eigenen Bogen (Konzept wie `serf_f`); als Vorlage `serf_f` angeben. Fehlende Vorlagen bricht
  `concept.mjs` jetzt ab statt sie still wegzulassen.
- `female` ließ oft das gehaltene Werkzeug (und Stolen) weg; der Prompt verlangt es jetzt ausdrücklich.
- Gemini liefert manchmal Himbeer- oder Weinrot statt Magenta – Farbe prüfen, ggf. neu erzeugen.
- Gemini rutscht gern in grauen Knete- oder flachen Gemälde-Look; hilft: Prompt beginnen mit „rendered in EXACTLY the
  same warm, soft, hand-painted stylized 3D look as the reference villagers (warm cream background), not a grey clay
  sculpt“. Waffen erscheinen teils doppelt (in beiden Händen): „exactly ONE …, the SAME … in the SAME right hand in all
  four views“.
- **Held aus einer Vorlage bearbeiten statt neu erzeugen** (Nelia, Fassung 2): `new … --ref serf,serf_f` lieferte
  eine klobige Heldin (breit, kurze Beine), obwohl die Vorlage zierlich ist. `edit nelia --from ../serf_f/sheet.png`
  mit Gemini (21:9, 2K) behält Statur, Kopfgröße und Haltung der Leibeigenen exakt; geändert nur Haare (blonder Zopf),
  Umhang in Magenta, Hose braun. Die Rückansicht vergaß den Umhang – zweiter `edit` nur für diese Ansicht.
  Gemini malte den Umhang himbeerrot (Farbton ~322°): lokal per Farbtondrehung auf 300° nachgefärbt (Schattierung
  bleibt, Schritt `recolor` in `concept.json`), statt neu zu erzeugen. Meshy übernahm den Umhang als Teil des Körpers
  (schwingt mit dem Rig), verschob das Magenta aber Richtung **Violett** (285–300°) – der Shader ließ Teile lila.
  `spec.markerHueMin: 275` dreht solche Bildpunkte beim Nachbearbeiten auf 305° (`violetToMarker`). Kosten: 0,28 $ Bild, 58 Credits.
- Räuber haben keine Teamfarbe; `female` malt trotzdem Magenta (Stilbaustein) – danach per `edit` rotbraun färben.

## Meshy

- **Meshy 7.1 mit PBR** (`aiModel: "meshy-7.1"`, `enablePbr: true`) liefert glatte Gesichter und Normal-Map; das ältere
  Modell zeigte Polygone. Direkt bei der Erzeugung reduzieren (~11 000 Dreiecke) ist so gut wie erst groß erzeugen und
  danach reduzieren – und billiger. Modell ~4 min, 30 Credits; Rig 5; je Clip 3.
- Spielmodell (Ferne) = dasselbe Modell per Remesh auf ~2 000 Dreiecke (`remeshOf`, 5 Credits). Ein eigenes
  vereinfachtes Fernkonzept brachte in Spielgröße nichts.
- Meshy normiert die Höhe; das Spiel skaliert Gebäude auf ihre Grundfläche. Höhenunterschiede zwischen Ausbaustufen
  müssen deshalb aus den Proportionen des Konzepts kommen.
- Meshys Texturen bestehen aus Hunderten kleiner UV-Inseln. Ungefüllte Lücken ergeben beim Verkleinern helle Linien –
  Lücken vollständig mit der Inselfarbe füllen (`fillGutters`).
- Ruheanimation: Bibliothek 0 („Idle“) steht gebückt; **338** („Short_Breathe_and_Look_Around“) aufrecht.
- Animationsbibliothek per `GET /openapi/v1/animations/library` (Felder `action_id`, `name`, `category`). Es gibt
  Bewegungen, die eine Waffe in der Hand erwarten: Sword Slash 219, Shield Push 220, Charged Axe Chop, Heavy Hammer
  Swing 128, Spear Walk, Bogen- und Gewehrbewegungen.

- Meshy liefert zu jedem Clip das komplette Modell samt Textur (4–8 MB). `strip-anims.mjs` kürzt auf die
  Bewegungsspuren (~50 KB); `model.mjs animate` kürzt neue Dateien sofort. Das Ergebnis von postprocess bleibt bitgleich.

## Darstellung im Spiel

- Farben wie von Meshy übernehmen (`spec.keepColors`). Flache Eckfarben, Sättigen, Grün→Braun waren Umwege
  (aus Oliv wurde „Malkastengrün“); der Nutzer findet Meshys Farben gut.
- Teamfarbe: Magenta in der Textur, der Shader färbt beim Zeichnen um (Manifest `teamMarker`, `charMarker`).
- Kein Randlicht (wirkte als helle Kanten).
- Nahmodell ab 80 px Figurenhöhe (auch Handy bei Zoom „nah“), darunter Spielmodell, 0,35 s Dither-Überblendung.
- Eigene Gebäude stehen ohne den grauen Steinsockel des Spiels (`OWN_BUILDING_MODELS`).
- Im Spielzoom (~25 px) sind Mann und Frau nur an Frisur/Bart unterscheidbar; die Frau braucht ein von oben sichtbares
  Merkmal (Dutt, Zopf).

## Werkzeuge und Waffen – das ungelöste Problem

1. **Werkzeuge als starre Teile an der Hand**, je Bild ausgerichtet (Leibeigene, `aim.mjs`): sieht laut Nutzer
   „miserabel“ aus – generierte Bewegungen kennen kein Werkzeug, Hände sind offen, das Werkzeug schwebt.
2. **Waffe im Konzept, Arm nah am Körper** (Schwertkämpfer v1): Meshy verschmilzt das Schwert mit dem Bein (ein
   einziges Netzteil, dem Oberschenkel zugeordnet), der Schild landet auf dem Rücken. Nicht zu retten.
3. **Waffe fest im Modell, vom Körper weg** (Schwertkämpfer v2/v3): Konzept mit Schwert in der Faust, Klinge schräg
   nach vorn-außen, Schild am Unterarm.
   - v2: `pose_mode: "a-pose"` – Meshy stellt die Figur neu in A-Haltung und **lässt Gehaltenes einfach weg**
     (kein Schwert, kein Schild). Für Figuren mit Waffe `spec.pose: ""` (Haltung des Konzepts behalten).
   - Ansichten: Ragt eine Klinge in die Spalte der Nachbaransicht, zerlegte der Spaltenschnitt falsch; `views.mjs`
     schneidet jetzt nach zusammenhängenden Flächen.
   - Nur Vorderansicht (Vergleich `soldier_sword_front`): Schild ging verloren – vier Ansichten sind besser.
   - v3 hat Schwert und Schild; Meshy verteilt die Klinge aber auf Hand, Unterarm und Knie → sie biegt sich in
     Bewegungen. **Lösung:** `spec.rigid` (`rigid.mjs`) bindet alle Eckpunkte im Zylinder Hand → Klingenspitze zu
     100 % an den Handknochen; die Klinge bleibt gerade und folgt der Hand. Spitze einmal aus `rigged.glb` ablesen.
   - Bibliotheksbewegungen mit Waffe (Sword Slash 219) passen zur Faust, sind aber teils akrobatisch.
   Für Leibeigene hieße das: eigene Modellvariante je Werkzeug, die das Spiel während der Arbeit zeigt.

## Werkzeuge der Pipeline

- `render.mjs` (Einzelbilder je Clip, `--hide`, `--zoom head`), `lineup.mjs` (Spielgröße auf Gras/Erde),
  `ingame.mjs` (Spielfotos je Zoomstufe; `--build <typ> --levels 3` für Gebäude), `views.mjs` (Bogen → Ansichten;
  Fehler behoben: sharp skaliert vor dem Zusammensetzen, Figur war winzig).
- Die Cloud-Umgebung bricht Netzantworten nach 30 s ab; Hintergrundjobs mit `nohup … &` starten und Logs prüfen.
- Ohne echte GPU zeigt das Spiel prozedurale Figuren – Prüfungen mit `?quality=high`. Das Spiel liegt unter `play/`.
