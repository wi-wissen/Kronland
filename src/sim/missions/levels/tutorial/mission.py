# Tutorial "Erste Schritte": Orrin guides step by step. Every step() shows its card and waits until its action is
# done, "Weiter" is pressed (reading steps, next=True) or the step is skipped. Nothing can be lost here.

# Events of the tutorial: how often each happened (a step waits for the next one from its start on)
happened = {"serf_bought": 0, "research_started": 0, "upgrade_started": 0, "recruited": 0, "ability": 0}


def after(name):
    """Condition for step(): the event `name` happens from now on."""
    start = happened[name]
    return lambda: happened[name] > start


@on_event("serf_bought")
def bought(serf):
    happened["serf_bought"] += 1


@on_event("research_started")
def research(tech):
    happened["research_started"] += 1


@on_event("upgrade_started")
def upgrade(building):
    happened["upgrade_started"] += 1


@on_recruited
def recruited(troop):
    happened["recruited"] += 1


@on_event("ability")
def ability(hero, name):
    happened["ability"] += 1


def gathering(*kinds):
    """Does a serf cut or dig one of these resources right now?"""
    for serf in serfs():
        if serf.res in kinds:
            return True
    return False


def first(kind):
    """The first own building of a kind (or None)."""
    found = buildings(kind)
    return found[0] if found else None

step("welcome",
     title={"de": "Willkommen", "en": "Welcome"},
     de="Orrin mein Name, Händler und Kenner aller Preise. Oben siehst du deine Rohstoffe. Lass uns ein Dorf gründen!",
     en="Orrin is the name, merchant and connoisseur of every price. Your resources are shown at the top. Let us found a village!",
     hint={"ui": "topbar"})

step("camera",
     ui="camera",
     next=True,
     title={"de": "Umsehen", "en": "Look around"},
     de="Bewege die Kamera: WASD oder mittlere Maustaste ziehen, Q/E dreht, das Mausrad zoomt.",
     en="Move the camera: WASD or drag with the middle mouse button, Q/E rotates, the mouse wheel zooms.",
     touch={"de": "Ziehe mit einem Finger, um die Karte zu verschieben. Mit zwei Fingern drehst und zoomst du.", "en": "Drag with one finger to move the map. Use two fingers to rotate and zoom."})

step("select",
     ui="selectSerfs",
     title={"de": "Leibeigene", "en": "Serfs"},
     de="Leibeigene sind deine Arbeitskräfte. Ziehe einen Rahmen um sie oder klicke auf „Alle“.",
     en="Serfs are your labourers. Drag a box around them or click “All”.",
     touch={"de": "Leibeigene sind deine Arbeitskräfte. Tippe auf „Alle“.", "en": "Serfs are your labourers. Tap “All”."},
     hint={"ui": "quick-all"})

if tree:
    camera.jump_to(tree)
step("wood",
     until=lambda: gathering("wood"),
     title={"de": "Holz schlagen", "en": "Chop wood"},
     de="Holz brauchst du für fast alles. Rechtsklicke mit ausgewählten Leibeigenen auf einen Baum.",
     en="You need wood for almost everything. Right-click a tree while serfs are selected.",
     touch={"de": "Holz brauchst du für fast alles. Tippe mit ausgewählten Leibeigenen auf einen Baum.", "en": "You need wood for almost everything. With serfs selected, tap a tree."},
     hint={"entity": tree})

if pile:
    camera.jump_to(pile)
step("pile",
     until=lambda: gathering("clay", "stone", "iron", "sulfur"),
     title={"de": "Lehm abbauen", "en": "Dig clay"},
     de="Rohstoffhaufen liefern Lehm, Stein, Eisen oder Schwefel. Schicke einen Leibeigenen zum Lehmhaufen.",
     en="Resource piles yield clay, stone, iron or sulfur. Send a serf to the clay pile.",
     hint={"entity": pile})

step("residence",
     until=lambda: count("residence", placed=True) >= 1,
     title={"de": "Wohnhaus", "en": "Residence"},
     de="Arbeiter wollen schlafen. Wähle Leibeigene, dann im Baumenü „Wohnhaus“ und klicke auf freien Boden.",
     en="Workers need a bed. Select serfs, pick “Residence” in the build menu and click on open ground.",
     touch={"de": "Arbeiter wollen schlafen. Wähle Leibeigene, tippe „Bauen …“, dann „Wohnhaus“ und den Bauplatz.", "en": "Workers need a bed. Select serfs, tap “Build …”, then “Residence” and the spot."},
     hint={"ui": ["build-residence", "quick-all"]})

step("farm",
     until=lambda: count("farm", placed=True) >= 1,
     title={"de": "Bauernhof", "en": "Farm"},
     de="Und sie wollen essen. Baue einen Bauernhof – am besten nah am Wohnhaus.",
     en="And they want to eat. Build a farm – ideally close to the residence.",
     hint={"ui": ["build-farm", "quick-all"]})

farm = first("farm")
step("workers",
     until=lambda: count("worker") >= 1,
     next=True,
     title={"de": "Arbeiter ziehen ein", "en": "Workers arrive"},
     de="Arbeiter kommen von selbst aus dem Dorfzentrum, sobald eine Werkstatt frei ist. Ohne Bett und Essen arbeiten sie langsam und werden unzufrieden. Warte, bis der Hof fertig ist.",
     en="Workers come from the village centre by themselves once a workplace is free. Without bed and food they work slowly and grow unhappy. Wait until the farm is finished.",
     hint={"entity": farm})

camera.jump_to(place("shaft"))
step("mine",
     until=lambda: count("clayMine", placed=True) >= 1,
     title={"de": "Lehmgrube", "en": "Clay pit"},
     de="Haufen sind bald leer. Schächte nicht: Baue eine Lehmgrube auf dem markierten Schacht. Dort arbeiten Bergleute.",
     en="Piles run dry, shafts do not: build a clay pit on the marked shaft. Miners will work there.",
     hint={"ui": ["build-clayMine", "quick-all"], "area": "shaft"})

give_tech(HUMAN, "construction")
step("refiner",
     until=lambda: count("brickworks", placed=True) >= 1,
     title={"de": "Ziegelhütte", "en": "Brickworks"},
     de="Rohware wird veredelt. Die Baupläne der Ziegelhütte sind eingetroffen – baue sie. Ziegelbrenner machen aus Lehm doppelt so viel Baustoff.",
     en="Raw goods get refined. The brickworks plans have arrived – build one. Brickmakers turn clay into twice as much material.",
     hint={"ui": ["build-brickworks", "quick-all"]})

step("serfs",
     until=after("serf_bought"),
     title={"de": "Mehr Hände", "en": "More hands"},
     de="Mehr Leibeigene bauen schneller. Wähle die Burg und kaufe einen Leibeigenen für 50 Taler.",
     en="More serfs build faster. Select the castle and buy a serf for 50 thalers.",
     hint={"ui": ["quick-hq", "buy-serf"], "entity": home})

college = place_building(HUMAN, "university", home, min_r=6)
camera.jump_to(college)
step("research",
     until=after("research_started"),
     title={"de": "Hochschule", "en": "College"},
     de="Die Gelehrten haben dir eine Hochschule gebaut. Wähle sie und erforsche „Bildung“.",
     en="The scholars have built you a college. Select it and research “Education”.",
     hint={"ui": "tech-education", "entity": college})

step("taxes",
     title={"de": "Zahltag", "en": "Payday"},
     de="Alle zwei Minuten ist Zahltag: Arbeiter zahlen Steuern, Hauptleute wollen Sold. Mit „Bildung“ stellst du in der Burg die Steuern ein – hohe Steuern drücken die Motivation.",
     en="Every two minutes is payday: workers pay taxes, captains want wages. With “Education” you set taxes in the castle – high taxes lower motivation.",
     hint={"ui": "payday"})

house = first("residence")
step("upgrade",
     until=after("upgrade_started"),
     next=True,
     title={"de": "Ausbauen", "en": "Upgrade"},
     de="Gebäude lassen sich ausbauen. Wähle dein fertiges Wohnhaus und baue es aus – mehr Betten! Der Ausbau läuft von selbst, ohne Leibeigene.",
     en="Buildings can be upgraded. Select your finished residence and upgrade it – more beds! The upgrade runs on its own, no serfs needed.",
     hint={"ui": "upgrade", "entity": house})

give_tech(HUMAN, "conscription")
give(HUMAN, gold=400, iron=300)
barracks = place_building(HUMAN, "barracks", home, min_r=6)
camera.jump_to(barracks)
step("recruit",
     until=after("recruited"),
     title={"de": "Soldaten", "en": "Soldiers"},
     de="Räuber wurden gesichtet! Eine Kaserne steht bereit. Wähle sie und hebe eine volle Einheit Schwertkämpfer aus.",
     en="Bandits have been sighted! A barracks is ready. Select it and recruit a full unit of swordsmen.",
     hint={"ui": "recruit-full-sword", "entity": barracks})

bandits = spawn(BANDITS, "sword1", place("banditSpot"), soldiers=2)
say("bandit", de="He, Bauer! Dein Holz gehört jetzt uns!",
              en="Hey, farmer! Your timber belongs to us now!", wait=False)
leader = bandits[0] if bandits else None
if leader:
    reveal(leader)
    camera.jump_to(leader)
step("fight",
     until=lambda: alive(bandits) == 0,
     title={"de": "Erstes Gefecht", "en": "First skirmish"},
     de="Da sind sie! Wähle deine Truppe und Nelia und rechtsklicke auf die Räuber.",
     en="There they are! Select your troop and Nelia, then right-click the bandits.",
     touch={"de": "Da sind sie! Wähle deine Truppe und Nelia und tippe auf die Räuber.", "en": "There they are! Select your troop and Nelia, then tap the bandits."},
     hint={"entity": leader})

step("ability",
     until=after("ability"),
     title={"de": "Heldenkraft", "en": "Hero power"},
     de="Helden haben besondere Fähigkeiten. Wähle Nelia und nutze „Mut machen“: Truppen in ihrer Nähe kämpfen eine Weile doppelt so stark.",
     en="Heroes have special abilities. Select Nelia and use “Rally”: troops near her fight twice as hard for a while.",
     hint={"ui": "ability-courage", "entity": nelia})

say("orrin", de="Na bitte! Ich sage es ja immer: Mit dem richtigen Lehrer wird aus jedem Holzklotz ein Fürst.",
             en="There you go! I always say: with the right teacher, every blockhead becomes a lord.", wait=False)
step("end",
     title={"de": "Geschafft", "en": "Well done"},
     de="Hervorragend! Du kennst jetzt die Grundlagen. Die Kampagne wartet – und mit ihr ein langer Winter.",
     en="Excellent! You know the basics now. The campaign awaits – and with it a long winter.")

victory("tutorial")
