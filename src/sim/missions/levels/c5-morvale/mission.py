# Flow: the villages follow Nelia as the lost princess – until Malvor's herald reveals the lie (after 2.5 minutes).
# The villages turn neutral, their spearmen go home; deliveries (offers) win them back. With the first delivery
# (five minutes after the herald at the latest) Malvor orders Taran to burn Moorbrook's farms: Taran refuses and
# defects with two squads, the rest attacks Moorbrook. Once the villages are won back and Malvor's troops are gone,
# the elder of Alderfarm hands over the fourth shard.

shard = False         # the elder has handed over the shard
herald_at = None      # time of the herald's proclamation (seconds)
delivered = False     # a first delivery reached a village
loyalists = []        # Malvor's troops that stay loyal (after Taran's defection)
regained = False      # objective "regain" met
driven = False        # objective "drive" met
elder = None          # the elder of Alderfarm (at the end)


def allies():
    """Number of villages that are allied again."""
    n = 0
    for name in VILLAGES:
        if diplomacy(HUMAN, player(name)) == "allied":
            n += 1
    return n


def gone(units):
    """How many of these troops are no longer against us (fallen or switched to our side)?"""
    n = 0
    for unit in units:
        if not unit.alive or unit.owner == HUMAN:
            n += 1
    return n


# ---------- Objectives (in the order of the objectives panel) ----------

objective("granaries", lambda: len(granaries) == 0 or alive(granaries) > 0, hold=True, hidden=True,
          de="Schütze die Höfe von Moorbrook",
          en="Protect the farms of Moorbrook")
objective("regain", lambda: (allies(), len(VILLAGES)), hidden=True,
          de="Gewinne die Dörfer durch Lieferungen zurück",
          en="Win back the villages with deliveries")
objective("drive", lambda: (gone(loyalists), len(loyalists)), hidden=True,
          de="Vertreibe Malvors restliche Truppen",
          en="Drive off Malvor’s remaining troops")
objective("shard", lambda: shard, hidden=True,
          de="Sprich mit der Dorfältesten von Erlenhof",
          en="Talk to the elder of Alderfarm")
objective("farms", lambda: (count("farm"), 4), primary=False,
          de="Optional: Baue 4 eigene Bauernhöfe",
          en="Optional: Build 4 farms of your own")


@on_start
def arrival():
    say("elder", de="Prinzessin! Morvale steht zu dir. Unsere Speerträger halten Wache an deinem Lager.",
                 en="Princess! Morvale stands with you. Our spearmen are guarding your camp.")
    say("orrin", de="Seht ihr? Königsblut öffnet Türen. Und Speicher.",
                 en="You see? Royal blood opens doors. And granaries.")
    say("nelia", de="Orrin. Hör auf damit.",
                 en="Orrin. Stop it.")


@on_objective("farms", "done")
def own_farms(id, status):
    give(HUMAN, gold=400)
    say("villager", de="Wer selbst Korn anbaut, will es uns nicht wegnehmen.",
                    en="Someone who grows grain himself won’t take ours.")


# ---------- The herald: the princess is a lie ----------

@on_start
def herald():
    global herald_at
    wait_until(lambda: time() >= 150)
    herald_at = time()
    for name in VILLAGES:
        set_diplomacy(HUMAN, player(name), "neutral")
    remove(helpers)
    show_objective("regain")
    offer("supplyMoorbrook", {"wood": 500, "clay": 300},
          de="Moorbrook: Holz und Lehm für neue Dächer liefern",
          en="Moorbrook: deliver wood and clay for new roofs")
    offer("supplyReedham", {"stone": 400, "iron": 200},
          de="Schilfheim: Stein und Eisen für den Deich liefern",
          en="Reedham: deliver stone and iron for the dyke")
    offer("supplyAlderfarm", {"gold": 300, "clay": 500},
          de="Erlenhof: Taler für Saatgut und Lehm für die Scheune schicken",
          en="Alderfarm: send thalers for seed and clay for the barn")
    say("herald", de="Hört, Leute von Morvale! Statthalter Malvor lässt verkünden: Die „Prinzessin“ ist die Tochter eines Leibeigenen aus Lindgrund!",
                  en="Hear, people of Morvale! Governor Malvor proclaims: the “princess” is the daughter of a serf from Lindgrund!")
    say("herald", de="Ein Händler hat die Lüge erfunden, um Geld zu machen. Wer ihr folgt, folgt einem Märchen.",
                  en="A merchant invented the lie to make money. Whoever follows her follows a fairy tale.")
    say("herald", de="Und die Zacke, die man in Erlenhof verwahrt, gehört dem Statthalter. Gebt sie heraus!",
                  en="And the shard kept in Alderfarm belongs to the governor. Hand it over!")
    say("nelia", de="Es stimmt. Ich bin keine Prinzessin. Ich habe es von Anfang an gesagt.",
                 en="It’s true. I am no princess. I said so from the start.")
    say("orrin", de="Nelia … nein. Sag so etwas nicht.",
                 en="Nelia … no. Don’t say that.")
    say("elder", de="Unsere Speerträger gehen nach Hause. Wir wissen nicht mehr, wem wir glauben sollen.",
                 en="Our spearmen are going home. We no longer know whom to believe.")


# ---------- Deliveries win the villages back ----------

@on_event("tribute", id="supplyMoorbrook")
def moorbrook_supplied(id):
    global delivered
    delivered = True
    set_diplomacy(HUMAN, player("moorbrook"), "allied")
    say("villager", de="Ihr habt geliefert, ohne etwas zu verlangen. Moorbrook steht zu euch.",
                    en="You delivered without asking anything in return. Moorbrook stands with you.")


@on_event("tribute", id="supplyReedham")
def reedham_supplied(id):
    global delivered
    delivered = True
    set_diplomacy(HUMAN, player("reedham"), "allied")
    say("villager", de="Der Deich hält wieder. Schilfheim vergisst das nicht.",
                    en="The dyke holds again. Reedham won’t forget that.")


@on_event("tribute", id="supplyAlderfarm")
def alderfarm_supplied(id):
    global delivered
    delivered = True
    set_diplomacy(HUMAN, player("alderfarm"), "allied")
    say("elder", de="Saatgut von einer Leibeigenen. Das hat uns noch kein König geschickt.",
                 en="Seed from a serf. No king ever sent us that.")


# ---------- Malvor's order: Taran refuses and defects ----------

def taran_defects():
    """Taran switches sides: as a hero with the player, two squads of his camp come along, the rest attacks Moorbrook."""
    global loyalists
    at = (taran_foe.x, taran_foe.y) if taran_foe is not None else (place("taranCamp").x, place("taranCamp").y)
    if taran_foe is not None:
        remove(taran_foe)
    add_hero(HUMAN, "taran", at)
    guards = [g for g in camp_guards if g.alive]
    convert(guards[:2], HUMAN)
    loyalists = guards[2:]
    if loyalists and "moorbrookArea" in places():
        attack(loyalists, place("moorbrookArea"))


@on_start
def the_order():
    wait_until(lambda: delivered or (herald_at is not None and time() >= herald_at + 300))
    order_at = time()
    taran_defects()
    show_objective("granaries")
    show_objective("drive")
    if "moorbrookArea" in places():
        camera.jump_to(place("moorbrookArea"))
    say("herald", de="Hauptmann Taran! Befehl des Statthalters: Brennt die Höfe von Moorbrook nieder. Wer nicht gehorcht, soll hungern.",
                  en="Captain Taran! The governor’s order: burn Moorbrook’s farms. Whoever disobeys shall starve.")
    say("taran", de="… Nein. Ich habe ein Dorf verhungern sehen. Meine Schwester war sieben. Ich zünde kein Korn an.",
                 en="… No. I watched a village starve. My sister was seven. I will not burn grain.")
    say("taran", de="Wer mit mir geht, kommt mit. Die Leibeigene weiß wenigstens, was Hunger ist.",
                 en="Whoever goes with me, come along. The serf at least knows what hunger is.")
    say("nelia", de="Taran! Hilf uns, die Höfe zu halten!",
                 en="Taran! Help us hold the farms!")
    # Five and a half minutes later Malvor sends reinforcements to his loyal troops
    wait_until(lambda: time() >= order_at + 330)
    reinforce()


def reinforce():
    global loyalists
    if "taranCamp" not in places():
        return
    wave = spawn(BANDITS, "sword1", place("taranCamp"), count=2, soldiers=4)
    loyalists = loyalists + wave
    if "moorbrookArea" in places():
        attack(wave, place("moorbrookArea"))
    say("herald", de="Verstärkung für die Getreuen! Morvale wird gehorchen!",
                  en="Reinforcements for the loyal! Morvale will obey!")


# ---------- The fourth shard ----------

@on_objective("regain", "done")
def villages_back(id, status):
    global regained
    regained = True
    elder_ready()


@on_objective("drive", "done")
def troops_gone(id, status):
    global driven
    driven = True
    elder_ready()


def elder_ready():
    global elder
    if not (regained and driven) or elder is not None or "alderfarmArea" not in places():
        return
    show_objective("shard")
    elder = npc("elder", look="serf", at=place("alderfarmArea"), speaker="elder", owner=player("alderfarm"))
    say("elder", de="Komm nach Erlenhof, Nelia. Der Herold wollte etwas von uns – ich gebe es lieber dir.",
                 en="Come to Alderfarm, Nelia. The herald wanted something from us – I’d rather give it to you.")


@on_talk("elder")
def elder_talk(visitor):
    global shard
    if visitor.name != "nelia":
        say("elder", de="Nelia soll selbst kommen.",
                     en="Nelia should come herself.")
        return
    elder.stop_talking()
    shard = True
    say("elder", de="Du hast nicht gelogen, als es dir geschadet hätte. Und du hast unsere Höfe geschützt.",
                 en="You didn’t lie when it would have hurt you. And you protected our farms.")
    say("elder", de="Nimm die Zacke. Wir folgen dir – nicht deinem Blut.",
                 en="Take the shard. We follow you – not your blood.")
