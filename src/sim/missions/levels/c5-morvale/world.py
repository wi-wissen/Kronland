# Morvale: three moor villages in a semicircle around the map centre, two squads of village spearmen guard our camp,
# Captain Taran's camp lies behind Moorbrook. Never fixed coordinates: everything is searched from the castle.

home = hq()
middle = map_center()
base = (home.x, home.y)
VILLAGES = ["moorbrook", "reedham", "alderfarm"]


def site(near, avoid=None):
    """Free spot reachable from the castle near `near`: first close with much room, then further with less."""
    for max_r, clear in [(10, 3), (16, 3), (16, 2), (24, 2), (30, 1)]:
        spot = find_open(near, max_r=max_r, clear=clear, reachable_from=home, avoid=avoid)
        if spot:
            return spot
    return None


place_building(HUMAN, "barracks", (home.x + 4, home.y + 8), min_r=3, radius=24)

# The three villages: towards the centre, along our edge and across
corners = [toward(home, middle, 24), toward(home, (world.width - home.x, home.y), 26), toward(home, (home.x, world.height - home.y), 26)]
granaries = []    # the farms of Moorbrook – Malvor wants them burnt
keep_free = [(home.x, home.y, 14)]
for i in range(len(VILLAGES)):
    name = VILLAGES[i]
    spot = site(corners[i], avoid=keep_free)
    if not spot:
        continue
    for kind, dx, dy in [("farm", 0, 0), ("residence", 4, 0), ("farm", 0, 4)]:
        b = place_building(name, kind, (spot.x + dx, spot.y + dy), radius=5)
        if b and kind == "farm" and name == "moorbrook":
            granaries.append(b)
    make_place(name + "Area", spot.x, spot.y, 5)
    keep_free.append((spot.x, spot.y, 9))

# Spearmen of the villages guard our camp (they go home after the revelation)
helpers = []
for dx in [-3, 3]:
    helpers += spawn(HUMAN, "spear1", (home.x + dx, home.y + 7), soldiers=3, spread=False)

# Taran's camp behind Moorbrook, the captain himself in front of it
moor = place("moorbrookArea") if "moorbrookArea" in places() else middle
camp_guards = camp("taranCamp", toward(home, moor, int(distance(home, moor)) + 12),
                   [("sword1", 3, 4), ("bow1", 2, 4)], max_r=8, reachable_from=home, avoid=[(home.x, home.y, 20)])
taran_foe = None
if "taranCamp" in places():
    taran_foe = add_hero(BANDITS, "taran", (place("taranCamp").x, place("taranCamp").y + 2))
