# Drei Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9 und 18–19).
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird – der Normalfall und zwei Randfälle.
for x in range(world.width):
    for y in (8, 9, 18, 19):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Wo der Wald beginnt (Abschnitt 1) und wo der Taler liegt (Abschnitt 2), je Welt
FOREST = {"normal": 12, "near": 3, "far": 17}[world.id]
COIN = {"normal": 9, "near": 2, "far": 14}[world.id]

# Abschnitt 1: der Waldrand im Osten – in der Welt „Alles ganz nah“ steht er direkt vor Nelia
for y in range(0, 8):
    for x in range(FOREST, FOREST + 3):
        add_tree(x, y)
for x, y in [(17, 1), (18, 4), (16, 6), (1, 0), (5, 7)]:
    if x < FOREST or x >= FOREST + 3:
        add_tree(x, y)

# Abschnitt 2: ein Taler im Schnee, dahinter wieder Wald – „ganz nah“ liegt er unter Nelia, „weit weg“ kurz vor dem Wald
add_item("coin", COIN, 13)
for y in range(10, 18):
    for x in range(15, 18):
        add_tree(x, y)
for x, y in [(1, 10), (4, 17), (11, 16), (19, 12)]:
    add_tree(x, y)

# Abschnitt 3: die Spur der Geflohenen bis zu ihrer Hütte – in jeder Welt mit anderen Kurven und anderswo
if world.id == "near":
    HUT = (10, 25)
    trail = [(x, 23) for x in range(3, 6)] + [(5, 24)] + [(x, 25) for x in range(5, 11)]
elif world.id == "far":
    HUT = (17, 24)
    trail = [(3, 23), (4, 23), (4, 22)] + [(x, 21) for x in range(4, 9)] + [(8, y) for y in range(22, 27)]
    trail += [(x, 26) for x in range(9, 13)] + [(12, 25), (12, 24)] + [(x, 23) for x in range(12, 16)]
    trail += [(15, 24), (16, 24), (17, 24)]
else:
    HUT = (16, 25)
    trail = [(x, 23) for x in range(3, 8)] + [(7, 22), (7, 21)] + [(x, 21) for x in range(8, 12)]
    trail += [(11, y) for y in range(22, 26)] + [(x, 25) for x in range(12, 17)]
make_place("hut", HUT[0], HUT[1], 0)
for x, y in trail:
    world.set_track(x, y)
for x, y in [(4, 26), (5, 27), (14, 21), (18, 22), (18, 27), (1, 27), (9, 27), (14, 27)]:
    add_tree(x, y)
