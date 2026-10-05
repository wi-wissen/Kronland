# Modelle, Figuren und Detailstufen

Wie Modelle ins Spiel kommen, welches Format eigene Figuren (z. B. aus Tripo) haben müssen und wie die
Detailstufen (LOD) funktionieren.

## Überblick

| Was | Wo | Wie gezeichnet |
|---|---|---|
| Gebäude | `public/models/buildings/*.glb` (+ `.lod1.glb`, `.lod2.glb`) | eigenes Objekt je Gebäude, Stufe nach Abstand |
| Bäume, Deko | prozedural (`src/render/nature.js`) + KayKit-Felsen | instanziert in Chunks (8×8 bzw. 6×6 Kacheln), Stufe je Chunk |
| Figuren | `public/models/characters/*.glb` + `manifest.json` | instanziert, GPU-Skinning aus gebackener Knochen-Textur |
| Rückfall | `src/render/models.js` (prozedurale Figuren) | dieselbe Instanzierung, Körperteile als „Knochen“ |

## Detailstufen (LOD)

Code: `src/render/lod.js`. Gebäude und Deko bekommen einen *effektiven Abstand*: echter Abstand zur
Kamera, korrigiert um das Sichtfeld (Handy hochkant = weiteres Sichtfeld = Objekte kleiner) und die Grafikstufe
(`niedrig` vereinfacht früher). **Figuren und Bäume** richten sich nach ihrer **Bildschirmhöhe** in CSS-Pixeln
(`screenHeightPx`, wie Unitys „Screen Relative Transition Height“): Gleich groß auf dem Bildschirm heißt gleiche
Stufe, auf Handy wie Desktop. Eine Hysterese von ±10–12 % verhindert Flackern an den Grenzen.

| Gruppe | Grenzen (Kacheln, Stufe „hoch“) | Stufen |
|---|---|---|
| Gebäude | 38 / 72 | Original → lod1 (~50–70 %) → lod2 (~25–35 %) |
| Bäume | Bildschirmhöhe 80 / 40 px (2 Kacheln hoher Baum am Desktop: ~30 / 62) | detailliert → einfach → Fernform (≈20–40 Dreiecke, ohne Schattenwurf). Auf „niedrig“ fehlt die detaillierte Stufe: einfach bis 40 px, dann Fernform |
| Figuren | Bildschirmhöhe 80 / 28 / 12 px (unter 3 px weg) | **Nahmodell**, flüssig → **Spielmodell** (lod1), 24 Bilder/s ohne Mischung → Spielmodell, 8 Bilder/s → starr. Wechsel Nah ↔ Spiel mit 0,35 s Dither-Überblendung |
| Felsen, Büsche | 62 | mit Schatten → ohne Schattenwurf (gleiche Geometrie) |
| Kleine Deko (Gras, Blumen, Kiesel) | ab 66 weg | schrumpft vorher im Shader in den Boden (kein Aufploppen); ein Chunk fällt weg, sobald er ganz hinter dem Ende des Schrumpfens liegt |

Faktor je Grafikstufe: hoch 1, mittel 0,8, niedrig 0,55 (Figuren, Bäume, Felsen und Büsche mindestens 0,8).
Werte stehen in `LOD_PROFILES` und `LOD_TIERS`. Hat eine Gruppe weniger Geometrien als Stufen, fallen die
feinsten weg (`[einfach, fern]` = Stufe 1 und 2).

Gelände und Wasser sind in Kacheln geteilt (`splitGridMesh`), damit die Sichtprüfung ganze Bereiche verwirft.
Bäume und Deko liegen je Chunk zusammen; sichtbare Chunks werden nur bei Kamerabewegung neu eingesammelt
und in ein InstancedMesh je Stufe kopiert (wenige Zeichenaufrufe, egal wie viele Chunks).

**Messen:** `?debug=1` zeigt Bilder/s, Zeichenaufrufe, Dreiecke und die Anzahl je Gruppe und Stufe.
Im Code: `window.__kronland.renderer.lodStats()`.

## Detailstufen erzeugen

```bash
node scripts/build-lods.mjs                                  # alle Gebäude und Figuren
node scripts/build-lods.mjs public/models/characters/Neu.glb # nur eine Datei
node scripts/build-lods.mjs --ratios 0.5,0.2 --errors 0.01,0.04 datei.glb
```

Vereinfacht wird mit meshoptimizer (`simplifyWithAttributes`, Normalen und UV gewichtet, damit Farben der
Paletten-Textur nicht verrutschen). Skinning bleibt erhalten. Die LOD-Dateien enthalten keine Animationen
und keine Texturbilder – das Spiel nimmt Material und Clips vom Original. `scripts/build-assets.sh` ruft das
Skript am Ende automatisch auf. Optionen: `--keep-textures` (Stufe behält eine eigene Textur),
`--strict-seams` (UV-Nähte nicht verschieben, sonst Farbstreifen über Inselgrenzen), `--out pfad/x.lod{n}.glb`.

## Figuren: das Manifest

`public/models/characters/manifest.json` ordnet **Rollen** einem **Modell** zu. Fehlt ein Modell oder kann es
nicht geladen werden, nimmt das Spiel die prozedurale Figur (`procedural`), ebenfalls instanziert.

```jsonc
{
  "fps": 24,                         // Abtastrate beim Backen der Animationen
  "models": {
    "Farmer": {
      "file": "Farmer.glb",           // optional, Standard: <Name>.glb
      "lods": 1,                     // Anzahl Farmer.lod1.glb … (Pipeline-Figuren: 1 = Spielmodell)
      "height": 0.95,                // Zielhöhe in Kacheln (1 Kachel ≈ 1 m im Spiel); oder "scale"
      "yaw": 0,                      // Drehung, falls das Modell nicht nach +Z schaut (Bogenmaß)
      "uvGrid": [8, 4],              // Raster für uvCells (KayKit: 8×4 Farbfelder)
      "clips": {                     // Spiel-Schlüssel → Clip-Name in der GLB
        "idle": "Idle", "walk": "Walk", "run": "Run",
        "chop": "Chop", "mine": "Pickaxe", "hammer": "Hammer", "build": "Build", "carry": "Carry",
        "attack": "Attack", "shoot": "Shoot", "die": "Death", "sit": "Sit", "ride": "Ride", "cheer": "Cheer"
      },
      "include": ["Axe"],            // starre Teile (Waffen, Hüte), die sichtbar sein sollen; "Modell:Teil" leiht von anderen Modellen
      "team": { "materials": ["Team"] },          // Spielerfarbe: Material-Name, Teilnamen ("parts"), "uvCells" oder "uvRects"
      "tint": { "uvCells": [[0, 1]], "color": "#b08452" }, // zweite Färbung (Berufskittel, Räuber); Farbe pro Instanz überschreibbar
      "mask": ["Farmer.mask.png", null], // Masken-Textur je Stufe (R = Spielerfarbe, G = Tönung); ein Name gilt für alle
      "rim": 0,                      // optional: Randlicht an den Kanten (Standard aus – wirkte als helle Linien)
      "props": { "Axe": ["chop"], "Hammer": ["hammer", "build"] } // Werkzeuge: nur in diesen Clips sichtbar
    }
  },
  "roles": {
    "serf":                 { "variants": [{ "model": "Farmer", "weight": 1 }, { "model": "FarmerF", "weight": 1 }],
                              "procedural": "serf" },
    "soldier.sword.leader": { "fallback": "soldier.sword", "scale": 1.08 },
    "soldier.heavyCav":     { "model": "Ritter", "seat": 0.86, "clipAlias": { "walk": "ride", "idle": "ride" },
                              "attach": [{ "role": "mount.horse", "offset": [0, 0, 0.06], "scale": 1.75 }] }
  }
}
```

**Varianten:** Eine Rolle mit `variants` wählt je Einheit eine Variante, gewichtet und über einen Hash
der Einheiten-ID. Das wirkt zufällig, bleibt aber über Laden und Wiederholung gleich. Es betrifft nur die
Darstellung, die Simulation kennt keine Varianten. Jeder Eintrag darf Rollenfelder überschreiben (`include`,
`tint`, `clips` …). Fehlt das Modell einer Variante, wird die nächste verfügbare genommen. Helden sind
feste Rollen (`hero.nelia` …); bis die eigenen Heldenfiguren fertig sind, stehen dort Platzhalter aus dem
KayKit-Paket (Konzeptbögen in `assets-src/characters/<hero>/`, siehe [STIL.md](STIL.md)).

**Masken-Textur:** Statt Zellen oder Rechtecken kann eine Bilddatei die Spielerfarbe (Rotkanal) und die
Tönung (Grünkanal) festlegen. Der Shader liest sie je Bildpunkt (`uMaskMap`). Die Pipeline erzeugt sie aus
der Markerfarbe Magenta. Als Liste gilt je Detailstufe eine eigene Datei (Lücken erben die Stufe davor).

**Eigene Darstellung je Stufe:** Bringt eine LOD-Datei eine eigene Textur mit, nutzt das Spiel für diese Stufe
ein eigenes Material (Textur + Maske der Stufe). So kann das Spielmodell flach gefärbt sein, während das
Nahmodell die Detailtextur trägt. Skelett und Animationen teilen sich alle Stufen.

**Werkzeuge mit Clip-Sichtbarkeit (`props`):** Starre Teile (Kind der Hand), die nur in bestimmten Clips
erscheinen. Beim Backen bekommt jedes Werkzeug einen eigenen „Knochen“: die Lage des Werkzeug-Knotens
(darf eigene Animation haben, z. B. zwischen beiden Händen ausgerichtet). In anderen Clips wird er auf
einen Punkt zusammengezogen. Kein Shader-Zweig, keine zusätzlichen Zeichenaufrufe.

**Rollen**, die das Spiel verwendet (Schlüssel werden von hinten gekürzt, bis einer passt:
`soldier.bow.leader` → `soldier.bow` → `soldier`):

| Rolle | Wer |
|---|---|
| `serf` | Leibeigener |
| `worker` | Arbeiter (Kittelfarbe je Beruf über `tint`) |
| `soldier.<line>` / `soldier.<line>.leader` | `sword`, `spear`, `bow`, `lightCav`, `heavyCav`, `cannon` |
| `hero.<id>` | `nelia`, `orrin`, `taran`, `malvor` (Platzhalter) |
| Gesprächsfigur | Rolle aus `look` der Mission (`serf`, `worker` …) |
| `bandit`, `bandit.bow` | Räuber (neutraler Missionsspieler) |
| `mount.horse`, `crew` | Reittier, Kanonenmannschaft (über `attach`) |

**Animations-Schlüssel** und Rückfälle (fehlt einer, wird der nächste genommen):
`mine → chop → attack → idle`, `build → hammer → chop`, `run → walk → idle`, `carry → walk`,
`shoot → attack`, `cheer/sit → idle`. `die` wird einmal abgespielt und bleibt auf dem letzten Bild.

## Format für eigene Figuren (Tripo u. a.)

| Punkt | Vorgabe |
|---|---|
| Dateiformat | glTF 2.0 binär (`.glb`), eine Figur je Datei, ein Skelett (`skin`) |
| Achsen | Y nach oben, Figur schaut nach **+Z**, steht mit den Füßen auf y = 0 (Ursprung zwischen den Füßen) |
| Einheiten | Meter; die Größe wird über `height` im Manifest angepasst (Leibeigener ≈ 0,9–1,0 Kachel) |
| Skelett | ≤ 64 Knochen (Humanoid, z. B. Mixamo-/Tripo-Rig), max. 4 Gewichte je Ecke; alle Teile am **selben** Skelett |
| Waffen, Hüte | als eigene Netze an Knochen gehängt (Kind eines Hand-/Kopf-Knochens) oder mitgeskinnt; Namen eindeutig, im Manifest unter `include` |
| Animationen | in derselben GLB, Namen frei (Zuordnung im Manifest). Schleifen (Idle, Walk, Run, Arbeit) nahtlos, 0,6–2 s; Death einmalig |
| Material | ein Material mit Basisfarb-Textur (PNG/JPG, ≤ 2048²; die niedrige Grafikstufe verkleinert beim Laden auf 1024, `characterTexture`), unbeleuchtet wirkende Bemalung ist ok (Licht kommt vom Spiel) |
| Spielerfarbe | **eines** davon: eigenes Material `Team` (empfohlen), eigene Teile (Umhang, Wappen) unter `team.parts`, oder Texturbereiche (`uvRects`). Die Fläche sollte in der Textur mittelhell und wenig gesättigt sein (wird umgefärbt, Helligkeit bleibt) |
| Zweitfarbe | optional wie oben unter `tint` (Kittel je Beruf, Räuberkleidung) |
| Polygone (LOD0) | Leibeigener/Arbeiter ≈ 10 000 Dreiecke, Soldat ≤ 12 000, Held/Reiter ≤ 15 000 (Nahansicht; weiter weg greifen die Detailstufen) |
| Detailstufen | Pipeline-Figuren: lod1 = eigenes Spielmodell (≈ 1 500–2 000 Dreiecke, siehe unten). Sonst per `build-lods.mjs`: lod1 ≈ 35 %, lod2 ≈ 15 %, lod3 ≈ 6 % |
| Texturen in LODs | optional eigene (Spielmodell flach gefärbt); ohne eigene Textur gilt die des Originals (UV müssen dann gleich bleiben – das Skript sorgt dafür) |

Tripo-Ausgabe ist oft hochaufgelöst (20–50 k Dreiecke). Vorher auf das LOD0-Budget reduzieren:

```bash
npx gltf-transform simplify roh.glb mittel.glb --ratio 0.25 --error 0.002
npx gltf-transform optimize mittel.glb public/models/characters/Farmer.glb --compress meshopt --texture-compress false --simplify false
```

## Eigene Figuren erzeugen (Pipeline `scripts/asset-gen/`)

Ablauf: Konzeptbogen → Ansichten → Meshy (Mehransichten → 3D, Auto-Rig, Animationen) → Nachbearbeitung →
Manifest. Alles je Figur unter `assets-src/characters/<id>/`. Stimmen der Figuren entstehen nach demselben
Muster (Ausgangsquelle unter `assets-src/voices/<rolle>/`), siehe [AUDIO.md](AUDIO.md#stimmen):

| Datei | Inhalt |
|---|---|
| `sheet.png` (+ `sheet-vN.*`) | Konzeptbogen, vier Ansichten (Stil: [STIL.md](STIL.md)); ältere Fassungen bleiben |
| `concept.json` | Bildmodell, Prompts, Kosten der Bildschritte |
| `spec.json` | Modellname, Rolle, Polygonzahl, Texturgröße, Höhe, Animations-Satz, Werkzeuge |
| `job.json` | Meshy-Task-IDs (Modell, Rig, je Clip), damit jeder Schritt wiederholbar ist |
| `previews/` | Vorschauen und Spiel-Ausschnitte (WebP) – die Bildersammlung zur Figur |
| `*.glb`, `view-*.png` | Zwischenstände, nicht in Git (aus `job.json` bzw. `sheet.png` wieder erzeugbar) |

Animations-Sätze (Spiel-Schlüssel → Meshy-Bibliothek oder Text → Bewegung) stehen in
`assets-src/characters/animations.json`, das Credit-Budget in `assets-src/credits.json`
(`limit`, oder `ASSET_CREDIT_LIMIT`). Jeder kostenpflichtige Schritt wird vorher gebucht und bricht über der
Grenze ab. Schlüssel: `MESHY_API_KEY`, `OPENROUTER_API_KEY` (oder ein Proxy, der sie ergänzt).

```bash
node scripts/asset-gen/concept.mjs edit|new|female <id> …      # Konzeptbogen (OpenRouter-Bildmodell)
node scripts/asset-gen/views.mjs <id>                          # Bogen → view-1…4.png
node scripts/asset-gen/model.mjs all <id>                      # Meshy: Modell, Rig, Bewegungen, Clips
node scripts/asset-gen/postprocess.mjs <id>                    # → public/models/characters/<Modell>.glb (+ Maske, LODs)
node scripts/asset-gen/render.mjs out.png <glb> [--clip chop --ts 0,0.25,0.5 --team 2f6fd6 --hide Axe]
node scripts/asset-gen/lineup.mjs out.png a.glb b.glb [--px 40]       # nur die Figuren, Spielgröße auf Gras und Erde
node scripts/asset-gen/ingame.mjs [ordner]                     # Spiel-Screenshots Desktop + Handy
```

### Zwei Darstellungen je Figur

Jede Figur hat ein **Nahmodell** und ein **Spielmodell** – mit eigenem Netz und eigenem Aussehen, aber demselben
Skelett und denselben Animationen:

| | Nahmodell (Stufe 0) | Spielmodell (Stufe 1, darunter nur gedrosselt) |
|---|---|---|
| wann | Figur über ~80 px hoch (Zoom „nah“, auch am Handy) | mittlerer Zoom und weiter (Standardzoom: ~25 px) |
| Netz | Meshy 7.1 mit PBR, ~11 000 Dreiecke | dasselbe Modell per Meshy-Remesh auf ~2 000 Dreiecke, ohne eigenes Rig (Gewichte vom Nahmodell) |
| Aussehen | Textur 2048 + Normal-Map, Farben wie von Meshy | Textur 1024 + Normal-Map, gleiche Farben |
| Datei | `<Modell>.glb` | `<Modell>.lod1.glb` |

Teamfläche: Magenta in der Textur (Manifest `teamMarker: true`), der Shader färbt sie beim Zeichnen in die
Spielerfarbe (`charMarker`, gleiche Regel wie `markerWeight`). Die Lücken zwischen den UV-Inseln sind vollständig
gefüllt, damit beim Verkleinern über Mipmaps keine fremden Farben in die Kanten laufen.

Älterer Weg (ohne `keepColors`, noch im Code): eigenes vereinfachtes Fernmodell aus einem Fernkonzept mit flachen
Eckfarben je Dreieck und Masken-Datei `<Modell>.mask.png`. Für Meshy-7.1-Modelle nicht mehr nötig: Das reduzierte
Nahmodell liest sich in Spielgröße genauso gut und springt beim Umschalten nicht.

**Alter Weg – Kleidung ohne Grün** (`spec.greenToBrown: { hue: 62, maxChroma: 38 }`): Das Konzept bleibt
maßgeblich – Helligkeit, Schattierung und gedämpfte Farben werden übernommen, nichts wird verstärkt. Nur grüne und
olivfarbene Kleidung dreht `postprocess.mjs` im Farbton (Lab) zu Braun, in Nah- und Spielmodell gleich. Grün tarnt
auf Gras und ist eine Spielerfarbe (Blau, Rot, Grün, Ocker); kräftige Farbe gehört nur in die Teamfläche. Kopf und
Haut bleiben unberührt. `postprocess.mjs <id> --game-only --out-dir review/x --spec '{…}'` erzeugt schnell
Varianten des Spielmodells, `lineup.mjs` zeigt Figuren in Spielgröße auf Gras und Erde.

`postprocess.mjs` übernimmt die Clips (nur Drehungen + Hüfte), hält Schleifen auf der Stelle, blendet die
Naht weich und glättet die Normalen (Meshy liefert facettiert). Für das Spielmodell setzt es das Fernmodell
auf die Ruhelage des Nahmodells (gleiche Höhe und Mitte) und überträgt die Skin-Gewichte von den nächsten Ecken
des Nahmodells (`farmesh.mjs`).

**Texturen aus den Dreiecken** (`texraster.mjs`): Jedes Dreieck wird in die Textur gerastert, jeder Bildpunkt weiß
also, zu welchem Dreieck er gehört. Daraus:
- **Teamfarben-Maske:** Dreiecke mit reiner Markerfarbe sind der Keim; angrenzende Dreiecke mit der von Meshy
  abgedunkelten Markerfarbe (Karmin, Weinrot) wachsen dazu (`growMarker`). Rote Flächen ohne Verbindung zur
  Teamfläche bleiben unberührt; Magenta-Sprenkel in anderen Dreiecken werden mit deren Grundfarbe übermalt.
  Inselränder füllen sich aus der eigenen Insel – keine Farbe läuft in fremde Bereiche.
- **Teamfläche des Spielmodells** je Dreieck (als Eckattribut `_TEAM`).
- **Bereiche** (`regions.mjs`): Kopf über die Skin-Gewichte, Gesicht (vorn, unter dem Haaransatz), Haare
  (hinten), Bart (vorn unten, dunkel). `spec.beard = "hair"` gleicht den Bart per Lab-Verschiebung an die
  Haarfarbe an.

Werkzeuge: Zweihändige (`aim` in `spec.props`) werden je Bild ausgerichtet: Stiel von der Brust durch die Hände,
Klinge in Schlagrichtung; einhändige (`aim` = eigene Hand, `hands: 0`) zeigen von der Brust durch die Hand.
Generierte Bewegungen kennen kein Werkzeug, eine feste Lage in der Hand sähe falsch aus.

`spec.json` (Auszug): `model`, `polycount`, `textureSize`, `height`, `animations`, `props`, `far` (Ordner des
Fernmodells), `beard`, `greenToBrown`, `flat` (Palette des Spielmodells). Das Fernmodell hat ein eigenes `spec.json` mit `"rig": false`.

### Checkliste: erfolgreicher Durchlauf (Stand: Meshy 7.1)

Der schlanke Weg, mit dem die Leibeigenen jetzt entstehen (`spec.keepColors`). Billig vor teuer prüfen:
Konzept → Vorschau (`render.mjs`, `lineup.mjs`) → Spiel (`ingame.mjs`). Nach jedem Konzeptschritt gibt der Nutzer frei.

1. **Vorbereitung:** `npm install`; Schlüssel `MESHY_API_KEY`, `OPENROUTER_API_KEY` (oder ein Proxy, der sie
   ergänzt). Budget in `assets-src/credits.json` (`limit`); eine Figur kostet rund 65 Credits.
2. **Konzept** (`concept.mjs new <id> --ref serf,serf_f "…"`, weiblich: `female`): vier Ansichten in A-Pose,
   Magenta nur auf Stoff an **Kopfbedeckung** (Mütze, Haarband – von oben sichtbar) und Halstuch, nicht am Gürtel;
   keine Werkzeuge. Fernkonzept entfällt. Freigabe. Danach `views.mjs <id>`.
3. **`spec.json`** nach Vorlage `assets-src/characters/serf_m/spec.json`: `aiModel: "meshy-7.1"`, `enablePbr: true`,
   `polycount` 11000, `keepColors: true`, `height`, `animations`, `props`, `far: "<id>_far"`, `farTextureSize` 1024.
   Fernmodell: `assets-src/characters/<id>_far/spec.json` = `{ "remeshOf": "<id>", "polycount": 2000, "rig": false }`.
4. **Meshy:** `model.mjs all <id>` (Modell 30, Rig 5, je Clip 3 Credits; Text-Bewegungen hält Meshy nur 3 Tage),
   dann `model.mjs remesh <id>_far` (5 Credits). Jeder Schritt steht in `job.json` und wird fortgesetzt statt neu bezahlt.
   Dauer: Modell ~4 min, Rig ~1 min, Clips je ~1 min.
5. **Nachbearbeitung** (`postprocess.mjs <id>`): Farben und Normal-Map bleiben wie von Meshy; Lücken zwischen den
   UV-Inseln werden vollständig gefüllt (keine hellen Linien beim Verkleinern), Werkzeuge kommen an die Hände.
   Schreibt `<Modell>.glb` und `<Modell>.lod1.glb` und gibt den Manifest-Eintrag aus (`teamMarker: true`: das Spiel
   färbt Magenta beim Zeichnen in die Spielerfarbe, keine Masken-Datei).
6. **Manifest:** Eintrag unter `models`, Rolle unter `roles` – Paare als `variants` (wie `serf`).
7. **Prüfen:** `render.mjs out.png <glb> --clip chop --ts 0,0.3,0.55,0.8 --hide Hammer,Pickaxe` (Werkzeug in der
   Hand?), `render.mjs … --zoom head` (Gesicht), `ingame.mjs <ordner>` (Spielfotos je Zoomstufe, Desktop und Handy).
8. **Tests und Ablage:** `npm test`, `npm run build`, `e2e/figures.spec.js` (mit `PW_CHROMIUM=/opt/pw-browsers/chromium`).
   Vorschauen als WebP nach `assets-src/characters/<id>/previews/`, Herkunft in CREDITS.md.

**Warum so (Vergleich Oktober 2026, gleiche Ansichten):** Meshy 7.1 mit PBR liefert glatte Gesichter und eine
Normal-Map; das ältere Modell ohne PBR zeigte sichtbare Polygone. Ob Meshy direkt reduziert oder erst in voller
Auflösung erzeugt und danach reduziert, macht keinen sichtbaren Unterschied – der direkte Weg ist billiger. Ein eigenes
vereinfachtes Fernkonzept brachte in Spielgröße nichts gegenüber dem reduzierten Nahmodell (die Details stecken in der
Textur). Flache Eckfarben, Grün → Braun und Bart-Angleichung (alter Weg, ohne `keepColors`) gibt es weiter, werden aber
für neue Figuren nicht mehr gebraucht.

**Stolperfallen:**
- Meshy verschiebt Magenta Richtung Karmin – die Maske wächst aus reinen Magenta-Keimen (`growMarker`); mit
  `render.mjs --team` prüfen, ob die ganze Fläche umfärbt.
- Kleine Text-Bewegungen (Hämmern) wirken aus Spielhöhe nicht – dann eine Bibliotheks-Aktion nehmen.
  Generierte Bewegungen kennen kein Werkzeug, deshalb richtet `aim` es je Bild aus: zweihändig läuft der Stiel durch
  beide Handflächen (Handgelenk + 35 % der Unterarmlänge, `palm`), einhändig von der Brust durch die Hand.
- Ruheclip: Bibliothek 0 („Idle“) steht gebückt, 338 („Short_Breathe_and_Look_Around“) aufrecht.
- Meshys Texturen bestehen aus Hunderten kleiner UV-Inseln; ungefüllte Lücken ergeben beim Verkleinern helle Linien.
- Spielmodell **nie mit Textur** (Mipmaps lassen Farbinseln ineinanderlaufen: helle Linien) und **nicht sättigen**
  (aus Oliv wird grelles Grün) – die gedämpften Konzeptfarben übernehmen, nur Grün → Braun.
- Kein Randlicht auf Figuren (wirkte als helle Kanten).
- Ohne echte GPU zeigt das Spiel prozedurale Figuren – Prüfungen mit `?quality=high`. Das Spiel liegt unter `play/`.
- Figuren nur in Spielgröße beurteilen (Lineup, Spielfotos); in der Großansicht fällt Rauschen nicht auf.

Kosten (Stand Leibeigene): Modell 30, Rig 5, je Clip 3, je Text-Bewegung 10 Credits (einmal je Satz, 3 Tage
nutzbar), Fernmodell 30. Eine Figur mit 9 Clips und Fernmodell kostet rund 95 Credits, ein Paar rund 190.
Arbeitsbewegungen: Holzhacken und Spitzhacke als Text-Bewegung, Hämmern aus der Meshy-Bibliothek
(„Heavy_Hammer_Swing“) – Text-Bewegungen fürs Hämmern blieben zu klein, um aus Spielhöhe zu wirken.

## Neue Figur einbauen

1. GLB nach `public/models/characters/` legen (Format siehe oben).
2. Im Manifest unter `models` eintragen (Clips, Größe, Teamfarbe) und die Rolle(n) unter `roles` darauf zeigen lassen.
3. `node scripts/trim-animations.mjs public/models/characters/Farmer.glb` – entfernt Clips, die das Manifest nicht nennt.
4. `node scripts/build-lods.mjs public/models/characters/Farmer.glb` – erzeugt `Bauer.lod1…3.glb`; `"lods": 3` im Manifest.
5. Prüfen: `npx vitest run tests/render` (Manifest gültig?), Spiel mit `?debug=1&quality=high` öffnen.

## Technik der Figuren

- Beim ersten Auftreten einer Rolle werden alle benötigten Clips mit 24 Bildern/s abgetastet und als
  Matrizen in eine Float-Textur geschrieben (Breite = Knochen × 4, Höhe = Bilder). Das kostet einmalig
  wenige Millisekunden je Modell.
- Teile und Detailstufen werden zu **einem** Netz mit Knochen-Index/-Gewicht je Ecke zusammengeführt
  (starre Teile hängen mit Gewicht 1 an ihrem Knochen).
- Pro Bild schreibt die CPU je Figur nur Matrix, Animationsbild A/B + Mischung und zwei Farben in ein
  InstancedMesh je (Rolle, Stufe). Der Vertex-Shader liest die Knochen per `texelFetch` (WebGL 2).
- Sichtprüfung je Figur (Kugel gegen Frustum), Stufe nach Bildschirmhöhe mit Hysterese,
  Animation ab Stufe 1 ohne Bildmischung, ab Stufe 2 mit 8 Bildern/s, Stufe 3 starr.
- Wechselt eine Figur das Netz (Nah- ↔ Spielmodell), zeichnet das Spiel 0,35 s lang beide: Die kommende Stufe
  zeigt die Bildpunkte unter dem Überblendwert eines 4×4-Bayer-Musters, die gehende die übrigen (`aFade`).
  Ohne Transparenz und ohne Sortierung, kein sichtbares Umschalten.
- Schatten wirft nur Stufe 0; auf der niedrigen Grafikstufe gibt es stattdessen weiche Blob-Schatten.
- Ohne echte GPU (Software-Rasterizer) nutzt das Spiel die prozeduralen Figuren (wenige Dreiecke).
