# The weatherworks: no castle, a valley behind a mountain ridge. The landscape lies along an axis from the start
# spot to the opposite corner: in front the ridge with two ways through – the guarded gate (a pass) and the gorge
# with the frozen river –, behind it the valley with the lake, the weatherworks on its island, a prison camp and
# Hrimgar's ruins; at the very back the mountains. Every map gets the same landscape, shaped around its start.

start = start_spot()
far = (world.width - 1 - start.x, world.height - 1 - start.y)

world.soften(sites=True)
front = world.ridge(start, far, 20, 7)
world.ridge(start, far, 72, 200, wobble=3)
gate = world.ridge_gap(front, 24, width=4)
gorge = world.ridge_gap(front, -22, width=3, water=True)
# The river comes from the map edge, runs through the gorge and flows into the lake
lake = world.axis_point(start, far, 50)
isle = world.lake_island(lake, inner=6, width=4)
world.channel(world.axis_point(start, far, -30, -22), gorge["near"])
world.channel(gorge["far"], toward(lake, gorge["far"], 8))
make_place("isle", isle.x, isle.y, isle.r)
make_place("gate", gate["center"].x, gate["center"].y, 3)
make_place("gorge", gorge["center"].x, gorge["center"].y, 3)
make_place("gorgeNear", gorge["near"].x, gorge["near"].y, 2)
make_place("gorgeFar", gorge["far"].x, gorge["far"].y, 2)

# The volunteers
squad = []
for kind, dx in [("sword1", -2), ("sword1", 2), ("bow1", 0)]:
    squad += spawn(HUMAN, kind, (start.x + dx, start.y + 3), soldiers=3, spread=False)
heroes = [nelia, orrin]

# The weatherworks on the island, its guard next to it
clear_area(isle, isle.r + 1)
works = place_building(BANDITS, "weatherPlant", isle, radius=3, margin=0)
if works:
    camp("worksCamp", isle, [("sword1", 2, 4), ("bow1", 1, 4)], anchor=works, r=8)
# The gate: strong guard and a ballista tower behind the pass
camp("gateCamp", toward(gate["far"], lake, 3), [("sword1", 2, 4), ("spear1", 2, 4), ("bow1", 1, 4)], r=8)
place_building(BANDITS, "tower", gate["far"], min_r=2, radius=6, level=1)
# The outpost at the gorge: small, but a fight costs people; it guards the frozen river itself (on the ice)
along, side = world.axis_coords(start, far, gorge["far"])
ford_guards = camp("ford", world.axis_point(start, far, along + 2, -22 + 5),
                   [("spear1", 1, 3), ("bow1", 1, 4)], r=6, max_r=6, on_ice=True)
# Prisoners in a camp at the valley edge; whoever comes this close sees them (then the side objective appears)
prison_guards = camp("prison", world.axis_point(start, far, 54, 28), [("sword1", 1, 3), ("spear1", 1, 3)], r=6)
if "prison" in places():
    make_place("prisonSight", place("prison").x, place("prison").y, 14)
# Hrimgar's ruins on the other valley edge: blueprint fragments
ruins = find_open(world.axis_point(start, far, 62, -24), max_r=6, clear=2) or world.axis_point(start, far, 62, -24)
make_place("ruinsArea", ruins.x, ruins.y, 3)
# Firm bank on the way to the ruins (goal of the escape from the thaw)
landing = toward(isle, ruins, isle.r + 11)
landing = find_open(landing, max_r=4) or landing
make_place("landing", landing.x, landing.y, 3)
for kind, d in [("tower", 4), ("residence", 6), ("chapel", 7)]:
    add_ruin(kind, toward(ruins, lake, -d), radius=5)
plant_trees(toward(ruins, start, -6), 14, radius=5)
valley = world.axis_point(start, far, 46, 14)
make_place("valley", valley.x, valley.y, 4)
