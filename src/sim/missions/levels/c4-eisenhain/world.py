# Eisenhain: the besieged mining town towards the map centre, two siege camps in front of it (one on our side,
# one behind it), Captain Taran at the front camp. Our camp gets a barracks and shafts for iron and sulphur.
# Never fixed coordinates: everything is searched from the castle.

home = hq()
middle = map_center()
base = (home.x, home.y)


def site(near, avoid=None):
    """Free spot reachable from the castle near `near`: first close with much room, then further with less."""
    for max_r, clear in [(10, 3), (16, 3), (16, 2), (24, 2), (30, 1)]:
        spot = find_open(near, max_r=max_r, clear=clear, reachable_from=home, avoid=avoid)
        if spot:
            return spot
    return None


place_building(HUMAN, "barracks", (home.x + 4, home.y + 8), min_r=3, radius=24)
add_shaft("iron", home, max_dist=22)
add_shaft("sulfur", home, max_dist=24)

siege_guards = []    # every guard of both siege camps
taran_foe = None     # Captain Taran with the besiegers

# The mining town towards the map centre
town = site(toward(home, middle, 30), avoid=[(home.x, home.y, 18)])
if town:
    miners = player("eisenhain")
    clear_area(town, 4)
    for kind, dx, dy in [("smithy", 0, 0), ("residence", 4, 1), ("farm", -4, 1), ("residence", 1, 4)]:
        place_building(miners, kind, (town.x + dx, town.y + dy), radius=5)
    make_place("town", town.x, town.y, 5)
    # Besiegers: two camps in front of the town, one on our side, one behind it
    front_guards = camp("siegeA", toward(town, home, 9), [("sword1", 2, 4), ("bow1", 1, 4)], max_r=6, reachable_from=home)
    back_guards = camp("siegeB", toward(town, home, -9), [("spear1", 2, 4), ("bow1", 1, 4)], max_r=8, reachable_from=home)
    siege_guards = front_guards + back_guards
    # Taran stands at the front camp
    if "siegeA" in places():
        taran_foe = add_hero(BANDITS, "taran", (place("siegeA").x, place("siegeA").y + 2))
