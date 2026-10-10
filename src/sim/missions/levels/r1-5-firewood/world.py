# Ein Weg durch den Winterwald, keine Wände: Ostwärts liegen erst Taler, dann Taler und Christrosen bis zu einem Baum.
# Dort ist eine Wegkreuzung: nach Süden führt der Pfad zum zugefrorenen Bach, nach Norden liegt eine lange Talerreihe.
# Die Etappen sind Abschnitte derselben Reise – das Ende der einen ist der Anfang der nächsten.
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird – der Normalfall und zwei Randfälle.
STAGES = ["predict", "roses", "brook", "six"]

# Je Welt: Taler vor Nelia (Etappe 1), Taler und Christrosen bis zum Baum (2), Schritte bis zum Eis (3), Taler in der
# langen Reihe (4), Startkachel von Nelia. „Ganz nah“: ein einziger Taler, der Baum direkt dahinter, das Eis direkt
# am Pfad, genau sechs Taler. „Weit weg“: lange Reihen, der Bach weit im Süden.
ROW = {"normal": 7, "near": 1, "far": 8}[world.id]
MIXED = {
    "normal": ["flower", "coin", "coin", "flower", "coin", "flower", "coin", "coin", "flower", "coin"],
    "near": [],
    "far": ["flower", "coin", "coin", "flower", "flower", "coin", "coin", "coin", "flower", "coin", "coin", "flower"],
}[world.id]
BROOK = {"normal": 9, "near": 0, "far": 12}[world.id]
SIX_ROW = {"normal": 10, "near": 6, "far": 13}[world.id]
SX = {"normal": 3, "near": 12, "far": 2}[world.id]
Y0 = 15

MIX_FROM = SX + ROW + 1          # erste Kachel mit Taler/Christrose
JX = SX + ROW + len(MIXED)       # Wegkreuzung: letzte Kachel vor dem Baum
COINS = len([k for k in MIXED if k == "coin"])
FLOWERS = len(MIXED) - COINS

# Der Bach im Süden, zugefroren: zwei Reihen über die ganze Karte, BROOK Schritte unterhalb der Kreuzung
BROOK_Y = Y0 + BROOK + 1
for x in range(world.width):
    for y in (BROOK_Y, BROOK_Y + 1):
        world.set_water(x, y)

# Taler, Christrosen und die Reihe im Norden
for x in range(SX + 1, SX + ROW + 1):
    add_item("coin", x, Y0)
for i in range(len(MIXED)):
    add_item(MIXED[i], MIX_FROM + i, Y0)
for y in range(Y0 - SIX_ROW, Y0):
    add_item("coin", JX, y)

# Der Baum am Ende der Reihe und am Ende des Nordpfads
add_tree(JX + 1, Y0)
add_tree(JX, Y0 - SIX_ROW - 1)

# Wald ringsum: nur die Reihe nach Osten, der Pfad nach Norden und nach Süden bleiben frei (je drei Kacheln breit)
for x in range(1, world.width - 1):
    for y in range(1, world.height - 1):
        if SX - 2 <= x <= JX + 1 and Y0 - 1 <= y <= Y0 + 1:
            continue
        if JX - 1 <= x <= JX + 1 and Y0 - SIX_ROW - 1 <= y <= BROOK_Y:
            continue
        if x <= SX + 2 and Y0 - 3 <= y <= Y0 - 2:
            continue
        if world.noise(x, y, 2, 29) < 250:
            add_tree(x, y)

make_place("start", SX, Y0, 0)
make_place("junction", JX, Y0, 0)
make_place("view", world.width // 2, Y0, 6)

# Karten-Start einer Etappe (world.stage): die Welt so, wie sie am Anfang der Etappe ist – ohne das, was frühere
# Etappen aufgehoben haben, und mit Nelia an ihrem Platz. Das geschieht vor dem ersten Takt: nichts springt.
first = STAGES.index(world.stage) if world.stage in STAGES else 0
nelia.teleport((SX, Y0))
if first >= 1:
    for x in range(SX + 1, SX + ROW + 1):
        remove_item(x, Y0)
    nelia.teleport((SX + ROW, Y0))
    give(HUMAN, gold=ROW)
if first >= 2:
    for i in range(len(MIXED)):
        remove_item(MIX_FROM + i, Y0)
    nelia.teleport((JX, Y0))
    give(HUMAN, gold=COINS)
