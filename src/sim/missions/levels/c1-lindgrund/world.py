# Lindgrund: the abandoned village. The village centre has decayed (only its foundations are left on the
# square), two houses lie in ruins with their beams next to them, Orrin sits on the square, the old tree stands
# at the edge of the forest, the neighbouring village lies off to the side.
# Never fixed coordinates: everything is searched from the castle, so the mission works on every map.

home = hq()
middle = map_center()


def site(near, avoid=None):
    """Free spot reachable from the castle near `near`: first close with much room, then further with less."""
    for max_r, clear in [(10, 3), (16, 3), (16, 2), (24, 2), (30, 1)]:
        spot = find_open(near, max_r=max_r, clear=clear, reachable_from=home, avoid=avoid)
        if spot:
            return spot
    return None


# Clay must be within reach (the only shafts of this mission)
shaft = add_shaft("clay", home, max_dist=20)
if shaft:
    make_place("clayShaft", shaft.x, shaft.y, 2)

# The village centre has decayed: its foundations stay on the square
centres = buildings("villageCenter")
if centres:
    old = centres[0]
    square_x = old.x - old.w // 2
    square_y = old.y - old.h // 2
    remove(old)
else:
    spot = find_open((home.x + 6, home.y + 6), max_r=10, clear=3)
    square_x = spot.x
    square_y = spot.y
make_place("vcRuin", square_x, square_y, 0)
make_place("square", square_x + 2, square_y + 2, 4)

# Orrin waits next to the foundations
seat = find_open((square_x + 5, square_y + 2), max_r=6, reachable_from=home)
if seat:
    make_place("orrinSeat", seat.x, seat.y, 1)
else:
    make_place("orrinSeat", square_x, square_y, 1)
stranger = npc("stranger", look="hero.orrin", at=place("orrinSeat"), speaker="orrin")

# Collapsed houses; their beams lie next to them as wood piles (serfs carry them off)
ruins_at = toward(home, place("square"), -7)
ruins = []
for dx, dy in [(0, 0), (5, 3)]:
    ruin = add_ruin("residence", (ruins_at.x + dx, ruins_at.y + dy), radius=12)
    if not ruin:
        continue
    ruins.append(ruin)
    for bx, by in [(ruin.x + 4, ruin.y + 1), (ruin.x + 1, ruin.y + 4)]:
        beams = find_open((bx, by), max_r=10)
        if beams:
            add_pile("wood", beams.x, beams.y, amount=600)
if ruins:
    make_place("ruins", ruins[0].x + 2, ruins[0].y + 2, 5)

# The old tree at the forest edge (where the prong lies), between village and map centre
root = site(toward(home, middle, 11))
if root:
    plant_trees(root, 6, radius=3)
    clear_area(root, 1)
    add_tree(root.x, root.y)
    make_place("oldRoot", root.x, root.y, 2)

# Neighbouring village: a few houses off to the side, the village elder stands in front later
neighbours = player("neighbors")
edge = world.height - 4 if home.y < middle.y else 4
village = site(toward(home, (middle.x, edge), 20), avoid=[(home.x, home.y, 10)])
if village:
    place_building(neighbours, "residence", village, min_r=1, radius=6)
    place_building(neighbours, "farm", (village.x + 4, village.y), min_r=1, radius=6)
    make_place("villageArea", village.x, village.y, 4)

# From there Malvor's collectors come
gate = find_open(toward(home, middle, 28), max_r=8, reachable_from=home)
if gate:
    make_place("collectorFrom", gate.x, gate.y, 3)
else:
    make_place("collectorFrom", middle.x, middle.y, 3)
