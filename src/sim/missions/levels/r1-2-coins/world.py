# Eine offene Landschaft je Welt, keine Wände: Schnee und Weg nach Osten, ein Hang durchs Dickicht nach Nordosten,
# oben das Lagerfeuer. Die Etappen sind Abschnitte derselben Reise – das Ende der einen ist der Anfang der nächsten.
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird. Eine Zählschleife kennt nur ihre feste Zahl –
# je Welt ändern sich Weglänge, Hang und Holzstoß, und mit ihnen die Zahl in range().
STAGES = ["predict", "path", "slope", "fire"]

# Je Welt: Taler, die das Programm legt (= Taler im Beutel), Kacheln bis zu den Bäumen, Stufen des Hangs, Kacheln je
# Seite des Rechtecks um den Holzstoß, Startkachel von Nelia (Weg in der Mitte der Karte)
LAID = {"normal": 5, "near": 5, "far": 3}[world.id]
PATH = {"normal": 18, "near": 6, "far": 20}[world.id]
ZIGZAG = {"normal": 5, "near": 2, "far": 6}[world.id]
SIDE = {"normal": 2, "near": 2, "far": 3}[world.id]
SX = {"normal": 2, "near": 12, "far": 2}[world.id]
Y0 = {"normal": 13, "near": 12, "far": 13}[world.id]

PE = SX + LAID         # hier endet das Programm der Magd
XE = PE + PATH         # Ende des Wegs: davor der letzte freie Schritt, dahinter beginnt das Dickicht
HX = XE + ZIGZAG       # oben am Hang
HY = Y0 - ZIGZAG

# Der Hang: Das Land steigt nach Norden und hinter dem Ende des Wegs nach Osten, sanft und ohne Felswand
for x in range(world.width):
    for y in range(world.height):
        q = max(0, x - XE) + max(0, Y0 - y)
        world.set_height(x, y, min(90 * q, 1300))

# Zickzackpfad durch das Dickicht: ein Schritt nach Osten, einer nach Norden
zigzag = []
for n in range(ZIGZAG + 1):
    zigzag.append((XE + n, Y0 - n))
    if n < ZIGZAG:
        zigzag.append((XE + 1 + n, Y0 - n))

# Das Rechteck aus Talern um den Holzstoß (Start: die Ecke oben am Hang) und der Holzstoß in seiner Mitte
RING = []
for i in range(SIDE):
    RING.append((HX + 1 + i, HY))
    RING.append((HX + SIDE, HY - 1 - i))
    RING.append((HX + SIDE - 1 - i, HY - SIDE))
    RING.append((HX, HY - SIDE + 1 + i))
woodpile = []
for x in range(HX + 1, HX + SIDE):
    for y in range(HY - SIDE + 1, HY):
        woodpile.append((x, y))
PURSE_AT = (HX - 1, HY)    # der vergessene Beutel neben dem Ziel

# Das Dickicht: dicht bewachsen bis auf Zickzackpfad, Lagerplatz und Beutel
for x in range(XE, HX + SIDE + 2):
    for y in range(HY - SIDE - 1, Y0 + 2):
        t = (x, y)
        if t not in zigzag and t not in RING and t not in woodpile and t != PURSE_AT:
            add_tree(x, y)

# Wald und Gestrüpp ringsum: nur der Weg (fünf Reihen breit) und der Platz um das Lager bleiben frei
for x in range(1, world.width - 1):
    for y in range(1, world.height - 1):
        if XE <= x <= HX + SIDE + 1 and HY - SIDE - 1 <= y <= Y0 + 1:
            continue
        if x <= XE + 1 and Y0 - 2 <= y <= Y0 + 2:
            continue
        if x >= HX - 1 and x <= HX + SIDE + 2 and y >= HY - SIDE - 2 and y <= HY + 1:
            continue
        if world.noise(x, y, 2, 11) < 240:
            add_tree(x, y)

make_place("b_end", XE, Y0, 0)
make_place("c_goal", HX, HY, 0)
make_place("view", world.width // 2, Y0 - 2, 6)

# Karten-Start einer Etappe (world.stage): die Welt so, wie sie am Anfang der Etappe ist – inklusive der Veränderungen
# früherer Etappen und Nelias Platz. Das geschieht vor dem ersten Takt, also ohne dass man etwas springen sieht.
first = STAGES.index(world.stage) if world.stage in STAGES else 0
nelia.teleport((SX, Y0))
give(HUMAN, gold=-stock("gold") + LAID)       # Beutel der Magd
if first >= 1:
    for x in range(SX, PE):
        add_item("coin", x, Y0)
    nelia.teleport((PE, Y0))
    give(HUMAN, gold=-stock("gold") + PATH // 2)
if first >= 2:
    for i in range(PATH // 2):
        add_item("coin", PE + 1 + 2 * i, Y0)
    nelia.teleport((XE, Y0))
    give(HUMAN, gold=-stock("gold"))
purse = add_pile("gold", PURSE_AT[0], PURSE_AT[1], 60)
if first >= 3:
    remove(purse)
    nelia.teleport((HX, HY))
    give(HUMAN, gold=-stock("gold") + len(RING))
