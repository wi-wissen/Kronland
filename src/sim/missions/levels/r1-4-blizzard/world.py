# Ein Schneefeld, drei Wegstücke einer Reise: von Nelias Start nach Osten bis zum Waldrand (Etappe „predict“), am Waldrand
# nach Süden bis zum Taler im Schnee (Etappe „coin“), vom Taler der Spur durch alle Kurven bis zur Hütte (Etappe „hut“).
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird – der Normalfall und zwei Randfälle.
# Normalfall: Wald nach 9 Schritten, Taler 5 Schritte weiter südlich, vier Kurven der Spur. „Ganz nah“: der Wald steht
# direkt vor Nelia, der Taler liegt unter ihr, die Hütte ist gleich da. „Weit weg“: langer Weg bis zum Wald und zum
# Taler (kurz vor dem Kartenrand), die Spur windet sich in sechs Kurven.

# Waldrand (erster Baum in Nelias Reihe), letzte Reihe des Waldstreifens, Reihe des Talers
FOREST = {"normal": 12, "near": 3, "far": 17}[world.id]
BAND = {"normal": 8, "near": 6, "far": 19}[world.id]
COIN_Y = {"normal": 8, "near": 3, "far": 19}[world.id]
CORNER = FOREST - 1   # hier endet das Stück nach Osten: die letzte freie Kachel vor dem Wald

# Die Spur: Eckpunkte, vom Taler aus; die Hütte steht an ihrem Ende
if world.id == "near":
    CORNERS = [(2, 3), (2, 7), (5, 7), (5, 10)]
elif world.id == "far":
    CORNERS = [(16, 19), (10, 19), (10, 15), (5, 15), (5, 12), (3, 12), (3, 8)]
else:
    CORNERS = [(11, 8), (7, 8), (7, 12), (4, 12), (4, 16), (12, 16)]
HUT = CORNERS[len(CORNERS) - 1]

trail = {}
for i in range(1, len(CORNERS)):
    ax = CORNERS[i - 1][0]
    ay = CORNERS[i - 1][1]
    bx = CORNERS[i][0]
    by = CORNERS[i][1]
    dx = 0
    dy = 0
    if bx > ax:
        dx = 1
    if bx < ax:
        dx = -1
    if by > ay:
        dy = 1
    if by < ay:
        dy = -1
    x = ax
    y = ay
    while x != bx or y != by:
        x = x + dx
        y = y + dy
        trail[str(x) + "," + str(y)] = (x, y)
        world.set_track(x, y)

make_place("start", 2, 3, 0)
make_place("coin", CORNER, COIN_Y, 0)
make_place("hut", HUT[0], HUT[1], 0)
make_place("view", 11, 11, 6)

# Der Waldrand: ein Streifen Wald im Osten, drei Bäume breit
for y in range(0, BAND + 1):
    for x in range(FOREST, FOREST + 3):
        add_tree(x, y)

# Der Taler im Schnee, am Waldrand nach Süden (bei Etappe „hut“ ist er schon aufgehoben)
if world.stage != "hut":
    add_item("coin", CORNER, COIN_Y)

# Einzelne Bäume im Schnee – nie auf dem Weg: Reihe 3 bis zum Waldrand, die Spalte am Waldrand, die Spur
for x, y in [(1, 0), (5, 7), (8, 1), (2, 10), (9, 13), (15, 6), (21, 8), (14, 12), (20, 14), (13, 21), (6, 20), (21, 21),
             (18, 22), (1, 18), (8, 22), (15, 17), (22, 3), (9, 5), (1, 14), (12, 14), (20, 19), (6, 9), (8, 10), (3, 19)]:
    free = True
    if y == 3 and x <= CORNER:
        free = False
    if x == CORNER and y >= 3:
        free = False
    if str(x) + "," + str(y) in trail:
        free = False
    if x >= FOREST and x < FOREST + 3 and y <= BAND:
        free = False
    if (x, y) == (2, 3) or (x, y) == (1, 2) or (x, y) == HUT or (x, y) == (HUT[0] + 1, HUT[1]):
        free = False
    if free:
        add_tree(x, y)

# Spielstart: Nelia steht auf der Startkachel; bei einer späteren Etappe schon dort, wo die frühere endet – im
# Weltaufbau gesetzt, also vor dem ersten Takt und ohne Weg (die Blickrichtung setzt mission.py)
if world.stage == "coin":
    nelia.teleport((CORNER, 3))
if world.stage == "hut":
    nelia.teleport(place("coin"))
    give(HUMAN, gold=1)
