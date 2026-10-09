# Flow: research up to the weather plant (or buy the knowledge through Orrin), freeze the Throne Lake, storm the
# island castle over the ice. Malvor's own weather plant follows the same rules as ours: it charges like three weather
# technicians, and with a full charge he thaws the lake as soon as our people stand on the ice – afterwards he has to
# recharge and wait. From the bank archers and cannons hit it. In the assault on the island Orrin falls through the
# ice and is badly wounded (a fixed scene).

MALVOR_CHARGE = 30    # energy per 5 seconds: three weather technicians
frozen = False        # the lake has frozen once
recruited = 0         # own troops trained since the start
orrin_wounded = False
thawed_once = False   # Malvor has thawed the lake once


def plant_up():
    """Does Malvor's weather plant still stand?"""
    return malvor_plant is not None and malvor_plant.alive


def on_ice():
    """Do our people (troops, heroes, serfs) stand on the frozen lake around the castle or around the works island?"""
    if weather() != "winter":
        return False
    near = figures_near(isle, radius=isle.r + 7, side="own") + figures_near(place("worksIsle"), radius=place("worksIsle").r + 6, side="own")
    for figure in near:
        if figure.kind != "worker" and world.is_water(figure.x, figure.y):
            return True
    return False


# ---------- Objectives (in the order of the objectives panel) ----------

objective("plant", lambda: (count("weatherPlant"), 1),
          de="Baue den Wetterturm (Wetterkraftwerk; Forschung: Wettervorhersage, Meteorologie)",
          en="Build the weather tower (weather plant; research: Weather Forecast, Meteorology)")
objective("freeze", lambda: frozen,
          de="Lass den Thronsee zufrieren",
          en="Make the Throne Lake freeze")
objective("castle", lambda: hq(ENEMY) is None,
          de="Erobere das Inselschloss",
          en="Take the island castle")
# The bar shows Malvor's charge as long as his plant stands
objective("malvorPlant", lambda: (stock("energy", ENEMY), 1000, False) if plant_up() else (1, 1, True), primary=False,
          de="Optional: Zerstöre Malvors Wetterkraftwerk (Balken: seine Ladung)",
          en="Optional: Destroy Malvor’s weather plant (bar: its charge)")
objective("tower", lambda: tower is not None and not tower.alive, primary=False,
          de="Optional: Zerstöre Malvors Turm am Ufer der Insel",
          en="Optional: Destroy Malvor’s tower on the island shore")
objective("army", lambda: (recruited, 8), primary=False,
          de="Optional: Stelle ein Heer aus 8 Truppen auf",
          en="Optional: Raise an army of 8 troops")

# Buying the scholars' knowledge is possible, but costs the economy of a while (own research stays cheaper)
offer("scholars", {"gold": 1800, "sulfur": 400},
      de="Wissen der Gelehrten kaufen: Wettervorhersage und Meteorologie",
      en="Buy the scholars’ knowledge: Weather Forecast and Meteorology")
reveal(isle, seconds=40)
camera.jump_to(isle)


@on_start
def arrival():
    say("malvor", de="Eine Leibeigene mit einem Händler und einem Verräter. Vier Zacken hast du gesammelt, die fünfte trage ich. Komm und hol sie dir, Nelia – der See ist tief.",
                  en="A serf with a merchant and a traitor. You have gathered four shards; the fifth I wear. Come and take it, Nelia – the lake is deep.")
    say("taran", de="Er hat recht, der See ist tief. Aber im Winter trägt er.",
                 en="He’s right, the lake is deep. But in winter it holds.")
    say("orrin", de="Hrimgars Pläne! Ein Wetterturm, Nelia. Dafür brauchen wir eine Alchimistenhütte, Wissen – oder Geld. Ich kenne Gelehrte in Beaucroix …",
                 en="Hrimgar’s plans! A weather tower, Nelia. For that we need an alchemist’s hut, knowledge – or money. I know scholars in Beaucroix …")
    say("taran", de="Malvor hat sein eigenes Kraftwerk, dort auf der kleinen Insel vor dem Schloss. Ist es geladen, taut er den See, sobald wir aufs Eis gehen. Aber vom Ufer aus treffen es Bogenschützen und Kanonen.",
                 en="Malvor has his own weather plant, there on the small island in front of the castle. Once it is charged, he thaws the lake as soon as we step onto the ice. But archers and cannons can hit it from the shore.")


@on_event("tribute", id="scholars")
def scholars(id):
    give_tech(HUMAN, "weatherForecast", "meteorology")
    say("scholar", de="Hrimgars Zeichnungen sind wirr, aber vollständig. Ihr könnt sofort bauen.",
                   en="Hrimgar’s drawings are confused, but complete. You can build at once.")
    say("orrin", de="Teuer, ja. Aber Zeit ist das Einzige, was man nicht nachkaufen kann.",
                 en="Expensive, yes. But time is the one thing you can’t buy more of.")


@on_recruited
def trained(troop):
    global recruited
    recruited += 1


@on_objective("army", "done")
def army(id, status):
    give(HUMAN, gold=500)
    say("taran", de="Gute Leute. Sie wissen, wofür sie kämpfen.",
                 en="Good people. They know what they fight for.")


# ---------- Winter on the lake ----------

@on_start
def lake_frozen():
    global frozen
    wait_until(lambda: weather() == "winter")
    frozen = True
    say("taran", de="Der See trägt. Aber seht auf Malvors Kraftwerk: Solange es geladen ist, taut er, sobald wir auf dem Eis stehen.",
                 en="The lake holds. But watch Malvor’s plant: as long as it is charged, he will thaw as soon as we stand on the ice.")
    say("nelia", de="Dann locken wir ihn – oder wir schießen sein Kraftwerk vom Ufer aus zusammen.",
                 en="Then we lure him – or we shoot his plant to pieces from the shore.")


# Fixed scene: Orrin is hit in the assault on the island – carried off the ice wounded, out of the game
@on_start
def orrin_falls():
    global orrin_wounded
    wait_until(lambda: weather() == "winter" and len(units_in(isle, who="army")) > 0)
    if orrin is not None:
        remove(orrin)
    orrin_wounded = True
    say("orrin", de="Nelia! Das Eis … es bricht …",
                 en="Nelia! The ice … it’s breaking …")
    say("taran", de="Der Händler ist eingebrochen! Ich hab ihn – er lebt, aber er ist schwer verwundet.",
                 en="The merchant fell through! I’ve got him – he’s alive, but badly wounded.")
    say("nelia", de="Das war mein Befehl … Bringt ihn ans Ufer. Wir dürfen jetzt nicht umkehren.",
                 en="That was my order … Get him to the shore. We can’t turn back now.")


# ---------- Malvor's weather plant: the same rules as ours ----------

@every(5)
def malvor_charges():
    if plant_up():
        give(ENEMY, energy=MALVOR_CHARGE)


# If our people stand on the ice and he is ready (charge, waiting time), he thaws the lake – the same command as ours.
# Checked every tick: whoever steps onto the ice is seen at once.
@every(0.1)
def malvor_thaws():
    global thawed_once
    if not plant_up() or not on_ice() or not malvor_plant.can_change_weather("summer"):
        return
    malvor_plant.change_weather("summer")
    first = not thawed_once
    thawed_once = True
    say("malvor", de="Tauwetter!",
                  en="Thaw!")
    if first:
        say("orrin", de="Sein Kraftwerk ist leer – er muss jetzt nachladen und warten wie wir. Frieren wir den See wieder ein, sobald unseres bereit ist, kann er nichts tun.",
                     en="His plant is empty – now he has to recharge and wait, just like us. If we freeze the lake again as soon as ours is ready, he can do nothing.")


@on_objective("malvorPlant", "done")
def plant_destroyed(id, status):
    say("malvor", de="Mein Kraftwerk! Ihr wisst nicht, was ihr zerstört!",
                  en="My weather plant! You don’t know what you are destroying!")
    say("nelia", de="Doch. Jetzt gehört der Winter uns.",
                 en="We do. Now the winter is ours.")


# ---------- Malvor's guard from Hagenfurt ----------

# Milestone: weather research started to pay off (or bought) – at the latest after 10 minutes; then every 5 minutes
@on_start
def raids():
    wait_until(lambda: researched("weatherForecast") or time() >= 600)
    first = time()
    n = 0
    while True:
        wait_until(lambda: time() >= first + 300 * n)
        n += 1
        attack(spawn(ENEMY, [("sword1", 2, 4), ("bow1", 1, 4)], place("northGate")), base)
        say("malvor", de="Hagenfurts Garde! Zeigt dieser Bauernmagd, was Ordnung heißt.",
                      en="Guard of Hagenfurt! Show this peasant girl what order means.")


@on_start
def castle_hurt():
    wait_until(lambda: castle.alive and castle.hp * 2 < castle.max_hp)
    say("malvor", de="Ich habe dieses Land vor dem Chaos bewahrt! Ohne mich hungert ihr alle!",
                  en="I saved this land from chaos! Without me, you’ll all starve!")
    say("nelia", de="Wir haben gehungert. Wegen dir.",
                 en="We did starve. Because of you.")
