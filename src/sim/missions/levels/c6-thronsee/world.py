# The Throne Lake: Malvor's castle on an island in the lake, his own weather power plant on a small works island in
# front of it (unreachable in summer, but within shooting range from the bank). Malvor's troops from Hagenfurt come
# over land from the point furthest from our settlement. Never fixed coordinates: everything is searched from the
# two castles.

me = hq()
castle = hq(ENEMY)
base = (me.x, me.y)

# Our lakeshore settlement and Malvor's island town
for kind, dx, dy in [("residence", 0, 8), ("farm", 6, 7), ("university", 8, 0), ("barracks", 3, 12), ("alchemist", -7, 6)]:
    place_building(HUMAN, kind, (me.x + dx, me.y + dy), min_r=2, radius=24)
for kind, dx, dy in [("residence", -5, -5), ("farm", 5, -5), ("barracks", 0, 6)]:
    place_building(ENEMY, kind, (castle.x + dx, castle.y + dy), min_r=1, radius=4)
tower = place_building(ENEMY, "tower", toward(castle, me, 6), min_r=1, radius=3, level=1)

# The lake: as close as possible around the castle, without flooding buildings
isle = None
for inner in range(11, 19):
    isle = world.moat(castle, me, inner=inner, width=4)
    if isle:
        break
if isle:
    make_place("isle", isle.x, isle.y, isle.r)
else:
    make_place("isle", castle.x, castle.y, 11)
isle = place("isle")

# Malvor's weather plant on the works island in front of the castle: unreachable in summer (also for his serfs –
# nobody repairs it), but within shooting range from the bank. Fully charged. The bank in front of the castle and
# the land behind it stay reachable.
gap = int(distance(me, castle)) - isle.r - 5
keep = []
for spot in [toward(castle, me, isle.r + 8), toward(castle, me, -20)]:
    ground = world.nearest_walkable(spot, max_r=8)
    if ground and world.reachable(me, ground, frozen=False):
        keep.append(ground)
works = None
for d in [14, 18, 22, 10]:
    if works is None:
        works = world.island(me, castle, inner=4, width=2, min_dist=max(12, gap - d), keep=keep)
malvor_plant = None
if works:
    malvor_plant = place_building(ENEMY, "weatherPlant", works, radius=2, margin=0, fixed=True)
    make_place("worksIsle", works.x, works.y, works.r)
else:
    make_place("worksIsle", castle.x, castle.y, 3)
give(ENEMY, energy=1000)
shore = toward(castle, me, isle.r + 8)
make_place("shore", shore.x, shore.y, 3)

# Malvor's troops from Hagenfurt come over land: behind the lake, otherwise beside it or at the lake shore – the
# reachable spot that is furthest from our castle
gate = None
for along, side in [(-20, 0), (-14, 0), (-10, 24), (-10, -24), (0, 30), (0, -30), (10, 34), (10, -34), (isle.r + 9, 14), (isle.r + 9, -14)]:
    spot = find_open(world.axis_point(castle, me, along, side), max_r=10, reachable_from=me)
    if spot and (gate is None or int(distance(spot, me)) > int(distance(gate, me)) + 8):
        gate = spot
if gate is None:
    gate = toward(me, castle, 50)
make_place("northGate", gate.x, gate.y, 3)
for d in [8, 10]:
    spawn(ENEMY, "sword1", toward(castle, me, d), soldiers=4, spread=False)
