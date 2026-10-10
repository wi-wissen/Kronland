# Ein Wald je Welt (scenario.json "worlds"): dieselbe Aufgabe in drei Wäldern. Jeder Wald hat zwei Teile hintereinander:
# 1. ein gewundener Pfad (nur Rechtskurven) von S bis zur Lichtung J (Etappe „path“),
# 2. dahinter Abzweigungen und Sackgassen bis zum Ausgang E, wo der Fremde N wartet (Etappe „thicket“).
# Plan: # Baum, . Pfad, S Start (Blick nach Osten), J Lichtung, E Ausgang, N wartende Figur.
# Normalfall: eine Spirale und ein Kamm von Abzweigungen. „Ganz nah“: gleich vor Nelia steht ein Baum, die Lichtung und
# der Ausgang sind nah. „Weit weg“: lange Gänge, ein weiter Kamm mit Sackgassen.
FORESTS = {
    "normal": [
        "############################",
        "#################.##########",
        "#################.######.EN#",
        "###.........J........###.###",
        "###.##########.#####.###.###",
        "###.##########.#####.###...#",
        "###.#S...###########.#.#.###",
        "###.####.###########.#.#.###",
        "###......###########.....###",
        "############################",
        "############################",
    ],
    "near": [
        "############################",
        "############################",
        "###.########################",
        "###.##S#####################",
        "###.##.#####################",
        "###J...#####################",
        "###.########################",
        "###.########################",
        "###....EN###################",
        "############################",
        "############################",
    ],
    "far": [
        "############################",
        "############################",
        "#............J.........#####",
        "#.#############.##.#########",
        "#.#S....#######.##.#####.EN#",
        "#.#####.#######.##.#####.###",
        "#.#####.##########.#.#.#.###",
        "#.#####.##########.#.#.#.###",
        "#.......##########.#.#.#.###",
        "##################.......###",
        "############################",
    ],
}
# Blickrichtung, in der Nelia die Lichtung erreicht (Ende von Etappe 1; so beginnt Etappe 2)
CLEARING_FACE = {"normal": "east", "near": "west", "far": "east"}[world.id]

rows = FORESTS[world.id]
for y in range(len(rows)):
    for x in range(len(rows[y])):
        c = rows[y][x]
        # der Kartenrand trägt keine Bäume: eine Kachel Abstand
        if c == "#":
            add_tree(1 + x, 1 + y)
        elif c == "S":
            make_place("start", 1 + x, 1 + y, 0)
        elif c == "J":
            make_place("clearing", 1 + x, 1 + y, 0)
        elif c == "E":
            make_place("exit", 1 + x, 1 + y, 0)
        elif c == "N":
            make_place("square", 1 + x, 1 + y, 0)
make_place("view", 15, 7, 4)

# Spielstart: Nelia steht auf S (Blick nach Osten) bzw. bei Etappe 2 schon auf der Lichtung, wo Etappe 1 endet – im
# Weltaufbau gesetzt, also vor dem ersten Takt und ohne Weg (die Blickrichtung setzt mission.py beim Start)
if world.stage == "thicket":
    nelia.teleport(place("clearing"))
else:
    nelia.teleport(place("start"))
