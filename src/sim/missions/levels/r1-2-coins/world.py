# Vier Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 8–9, 18–19 und 28–29).
# Drei Welten (scenario.json "worlds"): world.id sagt, welche gebaut wird. Eine Zählschleife kennt nur ihre feste
# Zahl – je Welt ändern sich Weglänge, Hang und Holzstoß, und mit ihnen die Zahl in range().
for x in range(world.width):
    for y in (8, 9, 18, 19, 28, 29):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

# Je Welt: Taler, die der Zettel legt (Abschnitt 1), Kacheln bis zu den Bäumen (2), Stufen des Hangs (3),
# Kacheln je Seite des Rechtecks um den Holzstoß (4)
LAID = {"normal": 5, "near": 2, "far": 3}[world.id]
PATH = {"normal": 18, "near": 6, "far": 20}[world.id]
ZIGZAG = {"normal": 5, "near": 2, "far": 6}[world.id]
SIDE = {"normal": 2, "near": 2, "far": 3}[world.id]

# Abschnitt 1: freier Schnee nach Osten, Bäume am Rand – „ganz nah“ steht nach zwei Talern ein Baum im Weg
for x, y in [(1, 0), (6, 0), (11, 1), (17, 0), (21, 1), (0, 7), (8, 7), (14, 6), (20, 7), (22, 4)]:
    add_tree(x, y)
if world.id == "near":
    add_tree(5, 3)

# Abschnitt 2: PATH Kacheln bis zu den Bäumen am Ende des Wegs
for y in range(11, 16):
    add_tree(PATH + 3, y)
make_place("b_end", PATH + 2, 13, 0)
for x, y in [(1, 10), (5, 11), (9, 10), (14, 11), (18, 10), (3, 16), (8, 17), (13, 16), (17, 17)]:
    if x < PATH + 3:
        add_tree(x, y)

# Abschnitt 3: ein Hang voller Dickicht, durch den nur ein Zickzack-Pfad nach oben führt
path = []
for n in range(ZIGZAG + 1):
    path.append((2 + n, 26 - n))
    if n < ZIGZAG:
        path.append((3 + n, 26 - n))
for x in range(0, ZIGZAG + 6):
    for y in range(20, 28):
        if (x, y) not in path:
            add_tree(x, y)
make_place("c_goal", 2 + ZIGZAG, 26 - ZIGZAG, 0)
add_pile("gold", 3 + ZIGZAG, 26 - ZIGZAG, 60)
for x, y in [(14, 21), (19, 24), (16, 27), (22, 20)]:
    add_tree(x, y)

# Abschnitt 4: der Holzstoß fürs Lagerfeuer – „weit weg“ ist er doppelt so groß, das Rechteck hat Seiten aus drei Kacheln
for x in range(5, 4 + SIDE):
    for y in range(35 - SIDE, 34):
        add_pile("wood", x, y, 40)
RING = []
for i in range(SIDE):
    RING.append((5 + i, 34))
    RING.append((4 + SIDE, 33 - i))
    RING.append((3 + SIDE - i, 34 - SIDE))
    RING.append((4, 35 - SIDE + i))
for x, y in [(1, 30), (10, 31), (15, 30), (20, 32), (2, 37), (12, 36), (18, 37), (22, 35)]:
    add_tree(x, y)
