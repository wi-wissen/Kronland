# Drei Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9 und 18–19)
for x in range(world.width):
    for y in (8, 9, 18, 19):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Abschnitt 1: der Waldrand im Osten
for y in range(0, 8):
    for x in range(12, 15):
        add_tree(x, y)
for x, y in [(17, 1), (18, 4), (16, 6), (1, 0), (5, 7)]:
    add_tree(x, y)

# Abschnitt 2: ein Taler im Schnee, dahinter wieder Wald
add_item("coin", 9, 13)
for y in range(10, 18):
    for x in range(15, 18):
        add_tree(x, y)
for x, y in [(1, 10), (4, 17), (11, 16), (19, 12)]:
    add_tree(x, y)

# Abschnitt 3: die Spur der Geflohenen bis zur Hütte, durch alle Kurven
trail = [(x, 23) for x in range(3, 8)] + [(7, 22), (7, 21)] + [(x, 21) for x in range(8, 12)]
trail += [(11, y) for y in range(22, 26)] + [(x, 25) for x in range(12, 17)]
for x, y in trail:
    world.set_track(x, y)
for x, y in [(4, 26), (5, 27), (14, 21), (18, 22), (18, 27), (1, 27), (9, 27), (14, 27)]:
    add_tree(x, y)
