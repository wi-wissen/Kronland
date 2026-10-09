# Drei Abschnitte einer Karte, getrennt durch Felsbänder (Reihen 10–11 und 21–22): dreimal Unterholz,
# jedes Mal anders gewachsen. # Baum, . Pfad, S Start (Blick nach Osten), E Ausgang, N wartende Figur
THICKETS = [
    [
        "########################",
        "#S...................###",
        "####################.###",
        "###..........E######.###",
        "###.################.###",
        "###.################.###",
        "###.################.###",
        "###..................###",
        "########################",
    ],
    [
        "########################",
        "#S.....#######.....#####",
        "######.#######.###.#####",
        "######.........###.....#",
        "######.###.#######.###.#",
        "######.###.#######.###.#",
        "##.....###.....###.###.#",
        "##.#######.###.###...#E#",
        "########################",
    ],
    [
        "########################",
        "#S..#######......#######",
        "###.#.....#.####.#####N#",
        "###.#.###.#.####......E#",
        "###...###...####.#####.#",
        "#######.#######..#####.#",
        "#######.#######.##.....#",
        "#######.........##.#####",
        "########################",
    ],
]

for x in range(world.width):
    for y in (10, 11, 21, 22):
        world.set_height(x, y, world.height_at(x, y) + 2400)
        world.set_cliff(x, y)

for i in range(len(THICKETS)):
    top = 1 + i * 11   # der Kartenrand trägt keine Bäume: eine Kachel Abstand
    rows = THICKETS[i]
    for y in range(len(rows)):
        for x in range(len(rows[y])):
            c = rows[y][x]
            if c == "#":
                add_tree(1 + x, top + y)
            elif c == "S":
                make_place("start" + str(i + 1), 1 + x, top + y, 0)
            elif c == "E":
                make_place("exit" + str(i + 1), 1 + x, top + y, 0)
            elif c == "N":
                make_place("square", 1 + x, top + y, 0)
    make_place("view" + str(i + 1), 13, top + 4, 4)
make_place("exit", place("exit1").x, place("exit1").y, 0)
