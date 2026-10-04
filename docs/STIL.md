# Figurenstil und Prompts

Die verbindliche Beschreibung des Figurenstils steht in [STILREFERENZ.md](STILREFERENZ.md) (Proportionen,
Gesicht, Kleidung, Farbwelt, Turnarounds). Diese Seite ergänzt, was die Figuren-Pipeline braucht: Teamfarbe,
zwei Konzepte je Figur (Nah- und Spielmodell) und die Prompt-Bausteine. Maßstab sind die Stilvorlagen des
Leibeigenen und der Leibeigenen (`assets-src/characters/serf/sheet-v1.webp`, `assets-src/characters/serf_f/sheet-v1.webp`).
Jede neue Figur wird gegen diese beiden Bögen geprüft.

## Stilregeln

- **Konzeptbogen:** genau vier Ganzkörper-Ansichten nebeneinander (vorn, rechts, hinten, links), A-Pose
  (Arme ~40° abgespreizt, Hände offen), Füße flach. Heller, einfarbiger Hintergrund, keine Bodenschatten,
  kein Text, keine Werkzeuge in den Händen (die kommen als eigene Teile dazu, siehe MODELLE.md).
- **Look:** stilisiertes 3D-Rendering, warm, weich, handgemalte Texturen.
- **Proportionen:** gedrungen, etwa 4 Köpfe hoch, große Hände und Köpfe, kurze Beine. Die Umrisse müssen
  aus der hohen, steilen Spielkamera lesbar sein. Beim Standardzoom ist eine Figur nur ~25 px hoch (Handy ~16 px).
- **Teamfarbe:** alle Teamflächen in **Magenta (#FF00FF)**, sonst nirgends Magenta; nur Stoff (nie Haut, Haare,
  Leder, Metall – siehe Stilreferenz). Die Fläche muss **von oben** sichtbar sein: Kopfbedeckung aus Stoff
  (Mütze, Haarband, Helmbusch) plus Halstuch/Kragen; bei Soldaten auch Wappenrock oder Umhang. Die Fläche behält Struktur und Schattierung (Strickmuster, Falten). Flach gemalt wird sie im
  3D-Modell glatt und rund, wie die erste Mütze des Leibeigenen.
- **Flache Farben im Spiel:** Das Spielmodell wird auf ~12 flache Farbflächen vereinfacht (siehe MODELLE.md).
  Wichtig sind deshalb **große, klar unterscheidbare Farbflächen** mit deutlichen Helligkeitsstufen (helles
  Hemd gegen dunkle Weste). Kleine Muster und erdige Ton-in-Ton-Flächen verschwimmen mit dem Boden.
- **Kein Grün in der Kleidung:** Grün tarnt auf Gras und ist eine Spielerfarbe (Blau, Rot, Grün, Ocker).
  Kleidung in Leinen-, Braun- und Grautönen; die Pipeline dreht verbliebenes Grün/Oliv zu Braun (`spec.greenToBrown`).
- **Paare:** Jede Rolle außer den Helden gibt es männlich und weiblich. Die weibliche Fassung entsteht per
  Bildbearbeitung aus der männlichen: gleiche Kleidung, gleiche Teamflächen, gleicher Stil.
- **Eigenständig:** keine Namen, Wappen, Kleidung oder Figuren aus Siedler oder anderen Spielen, keine Logos.

## Zwei Konzepte je Figur (alter Weg)

Seit Meshy 7.1 genügt **ein** Konzept: Das Spielmodell ist das per Remesh reduzierte Nahmodell (siehe
MODELLE.md, Checkliste). Für den älteren Weg mit flachen Farben bekam jede Figur zwei Konzeptbögen:

1. **Detailkonzept** fürs Nahmodell (rangezoomt): so wie die Stilvorlagen.
2. **Fernkonzept** fürs Spielmodell (normale Spielhöhe, Figur unter ~80 px), per `concept.mjs far` aus dem
   Detailkonzept: Haare als **ein** fester Block (kein loses Gekräusel), wenige große Farbflächen mit klarem
   Hell-Dunkel, keine Taschen, Schnallen, Riemen, Flicken, Nähte oder Falten, Hände als einfache Fäustlinge,
   Stiefel als Blöcke, ein einfaches Gesicht (zwei Augen, Brauen, Nase, Mund). Teamflächen groß, von oben sichtbar.

Die Farben des Fernkonzepts sollten zum Detailkonzept passen (gleiche Hauptfarben), sonst „springt“ die Figur
beim Heranzoomen. Bart und Haare in derselben Farbe (beim Leibeigenen nachträglich angeglichen, `spec.beard`).

## Prompt-Vorlagen

Die Bausteine stehen in `scripts/asset-gen/style.mjs` (`STYLE`, `FEMALE`, `FAR`). Sie sind englisch, weil die
Bildmodelle damit am zuverlässigsten arbeiten. `concept.mjs` hängt sie automatisch an.

**Neue Figur (männlich)**, Stilvorlagen als Referenzbilder:

```bash
node scripts/asset-gen/concept.mjs new woodcutter --ref serf,serf_f \
  "a stocky woodcutter in a leather apron over a linen shirt, magenta knitted cap and magenta neckerchief"
```

**Weibliche Variante** aus dem männlichen Bogen:

```bash
node scripts/asset-gen/concept.mjs female woodcutter_f --from woodcutter
```

**Fernkonzept** (vereinfacht, fürs Spielmodell):

```bash
node scripts/asset-gen/concept.mjs far woodcutter_far --from woodcutter
```

**Bogen nachbessern** (nur die genannte Änderung, alles andere bleibt):

```bash
node scripts/asset-gen/concept.mjs edit serf "Make the knitted beanie magenta (#FF00FF) but keep its knit pattern and shading"
```

Jeder Aufruf sichert den vorherigen Bogen als `sheet-vN.*` und protokolliert Modell, Prompt und Kosten in
`concept.json`. Vor dem 3D-Schritt prüft der Nutzer die Konzeptbögen (Freigabe).

## Werkzeug- und Bewegungsstil

- Werkzeuge sind einfache, kräftige Formen (Holzstiel, grauer Kopf). Sie werden erst im Modell an die Hand
  gehängt und nur in passenden Clips gezeigt.
- Arbeitsbewegungen sollen groß und rhythmisch sein. Kleine Bewegungen gehen aus Spielhöhe verloren.
  Text-Bewegungen deshalb mit „big clear arm movements, feet stay planted“ beschreiben.
