# Vier Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9, 18–19 und 28–29)
for x in range(world.width):
    for y in (8, 9, 18, 19, 28, 29):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Abschnitt 1: freier Schnee nach Osten, Bäume am Rand
for x, y in [(1, 0), (6, 0), (11, 1), (17, 0), (21, 1), (0, 7), (8, 7), (14, 6), (20, 7), (22, 4)]:
    add_tree(x, y)

# Abschnitt 2: 18 Kacheln bis zu den Bäumen am Ende des Wegs
for y in range(11, 16):
    add_tree(21, y)
for x, y in [(1, 10), (5, 11), (9, 10), (14, 11), (18, 10), (3, 16), (8, 17), (13, 16), (17, 17)]:
    add_tree(x, y)

# Abschnitt 3: ein Hang voller Dickicht, durch den nur ein Zickzack-Pfad nach oben führt
path = []
for n in range(6):
    path.append((2 + n, 26 - n))
    if n < 5:
        path.append((3 + n, 26 - n))
for x in range(0, 11):
    for y in range(20, 28):
        if (x, y) not in path:
            add_tree(x, y)
add_pile("gold", 8, 21, 60)
for x, y in [(14, 21), (19, 24), (16, 27), (22, 20)]:
    add_tree(x, y)

# Abschnitt 4: der Holzstoß fürs Lagerfeuer
add_pile("wood", 5, 33, 40)
for x, y in [(1, 30), (10, 31), (15, 30), (20, 32), (2, 37), (12, 36), (18, 37), (22, 35)]:
    add_tree(x, y)
