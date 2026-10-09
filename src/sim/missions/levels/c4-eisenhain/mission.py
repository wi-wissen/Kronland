# Flow: break the siege of the mining town and open up iron and sulphur. Via Orrin either mercenaries (ready for
# battle at once) or runaway serfs (strengthen the economy) – one of the two. Nelia meets Captain Taran at the front
# camp; once he falls he withdraws. After the siege the mine master hands over the third shard.

shard = False     # the mine master has handed over the shard
recruited = 0     # own troops trained since the start
miner = None      # the mine master in the town (after the siege)
met_taran = False


def gone(units):
    """How many of these troops are no longer against us (fallen or switched to our side)?"""
    n = 0
    for unit in units:
        if not unit.alive or unit.owner == HUMAN:
            n += 1
    return n


# ---------- Objectives (in the order of the objectives panel) ----------

objective("siege", lambda: (gone(siege_guards), len(siege_guards)),
          de="Brich die Belagerung von Eisenhain",
          en="Break the siege of Eisenhain")
objective("iron", lambda: (count("ironMine"), 1),
          de="Baue eine Eisengrube",
          en="Build an iron pit")
hint("iron", ui=["build-ironMine", "quick-all"], ui_until=lambda: count("ironMine", placed=True) >= 1)
objective("sulfur", lambda: (count("sulfurMine"), 1),
          de="Baue eine Schwefelgrube",
          en="Build a sulphur pit")
hint("sulfur", ui=["build-sulfurMine", "quick-all"], ui_until=lambda: count("sulfurMine", placed=True) >= 1)
objective("shard", lambda: shard, hidden=True,
          de="Sprich mit dem Bergmeister in Eisenhain",
          en="Talk to the mine master in Eisenhain")
objective("bows", lambda: researched("standingArmy"), primary=False, hidden=True,
          de="Optional: Erforsche „Stehendes Heer“ an einer Hochschule – dann bildet der Schießplatz Bogenschützen aus",
          en="Optional: Research “Standing Army” at a university – then the archery range trains archers")
hint("bows", ui=["build-university", "quick-all"], ui_until=lambda: count("university", placed=True) >= 1)
objective("army", lambda: (recruited, 4), primary=False,
          de="Optional: Bilde 4 eigene Truppen aus",
          en="Optional: Train 4 troops of your own")

# Two ways to troops, only one of them (a group)
offer("mercs", {"gold": 1400}, group="help",
      de="Söldner anheuern: 4 kampfbereite Truppen",
      en="Hire mercenaries: 4 battle-ready troops")
offer("refugees", {"gold": 400}, group="help",
      de="Geflohene Leibeigene aufnehmen: 8 Leibeigene und Vorräte",
      en="Take in runaway serfs: 8 serfs and supplies")
if "town" in places():
    reveal(place("town"), seconds=40)
    camera.jump_to(place("town"))


@on_start
def arrival():
    say("orrin", de="Eisenhain. Eisen, Schwefel – und eine Armee davor. Ich hätte Beaucroix nie verlassen sollen.",
                 en="Eisenhain. Iron, sulphur – and an army at the gates. I should never have left Beaucroix.")
    say("nelia", de="Eine ganze Armee gegen ein paar Bergleute? Nur wegen Eisen?",
                 en="A whole army against a few miners? Just for iron?")
    say("orrin", de="Man sagt, sie hüten eine Zacke in ihrem tiefsten Stollen. Darum lässt Malvor sie belagern.",
                 en="They say they’re guarding a shard in their deepest gallery. That’s why Malvor has them besieged.")
    say("nelia", de="Die Bergleute halten nicht mehr lange durch. Wir brauchen Truppen, Orrin.",
                 en="The miners won’t hold out much longer. We need troops, Orrin.")
    say("orrin", de="Truppen! Ich kenne zwei Wege. Söldner kosten viel, kämpfen aber sofort. Geflohene Leibeigene kosten wenig, bringen Vorräte – aber du musst sie erst ausbilden.",
                 en="Troops! I know two ways. Mercenaries cost a lot but fight at once. Runaway serfs cost little and bring supplies – but you’ll have to train them first.")


# ---------- Mercenaries or runaway serfs ----------

@on_event("tribute", id="mercs")
def mercenaries(id):
    spawn(HUMAN, [("sword1", 2, 4), ("bow1", 2, 4)], base)
    say("orrin", de="Bezahlt und bereit. Sie fragen nicht, wofür sie kämpfen. Das ist bei Söldnern so.",
                 en="Paid and ready. They don’t ask what they’re fighting for. That’s how mercenaries are.")


@on_event("tribute", id="refugees")
def refugees(id):
    spawn_serfs(HUMAN, 8)
    give(HUMAN, wood=600, stone=400, clay=400, iron=400)
    say("villager", de="Malvor hat uns hungern lassen. Für die Prinzessin arbeiten wir gern.",
                    en="Malvor let us starve. We’ll gladly work for the princess.")
    say("nelia", de="Ihr arbeitet für euch selbst. Ich bin keine Prinzessin.",
                 en="You work for yourselves. I am no princess.")


@on_recruited
def trained(troop):
    global recruited
    recruited += 1


@on_objective("army", "done")
def army(id, status):
    give(HUMAN, iron=300)
    say("miner", de="Gute Leute! Nehmt Eisen für ihre Klingen.",
                 en="Good people! Take iron for their blades.")


# The iron pit stands: Orrin introduces research (archers)
@on_objective("iron", "done")
def research(id, status):
    show_objective("bows")
    say("orrin", de="Schwerter allein brechen keine Belagerung. In einer Hochschule erforschen Gelehrte „Stehendes Heer“ – dann bildet ein Schießplatz Bogenschützen aus.",
                 en="Swords alone won’t break a siege. In a university, scholars research “Standing Army” – then an archery range trains archers.")


# ---------- Captain Taran ----------

if "siegeA" in places():
    @on_enter(place("siegeA"), who="nelia")
    def meet_taran(who):
        global met_taran
        if met_taran:
            return
        met_taran = True
        say("taran", de="Du bist also die Prinzessin. Geh nach Hause, Mädchen. Hier wird gekämpft.",
                     en="So you’re the princess. Go home, girl. There’s fighting here.")
        say("taran", de="Die Bergleute sollen herausgeben, was sie im Stollen verstecken. Dann ziehen wir ab.",
                     en="The miners are to hand over what they’re hiding in the gallery. Then we’ll leave.")
        say("nelia", de="Warum dient ihr Malvor? Er lässt die Dörfer hungern.",
                     en="Why do you serve Malvor? He lets the villages starve.")
        say("taran", de="Unter dem milden König sind auch Kinder verhungert. Malvor bringt Ordnung. Volle Speicher.",
                     en="Children starved under the gentle king, too. Malvor brings order. Full granaries.")


@on_start
def taran_falls():
    wait_until(lambda: taran_foe is not None and not taran_foe.alive)
    remove(taran_foe)
    say("taran", de="Genug! Rückzug! … Wir sehen uns wieder, Prinzessin.",
                 en="Enough! Fall back! … We’ll meet again, princess.")


# Milestone: our first troop (hired or trained) – at the latest after 10 minutes. Two minutes later Taran strikes,
# then every five minutes, three times at most, as long as the siege holds.
@on_start
def sorties():
    wait_until(lambda: count("troop") > 0 or time() >= 600)
    first = time() + 120
    for i in range(3):
        wait_until(lambda: time() >= first + 300 * i)
        if done_siege() or "siegeB" not in places():
            return
        wave = spawn(BANDITS, "sword1", place("siegeB"), count=2, soldiers=3)
        attack(wave, base)
        say("taran", de="Schlagt das Lager dieser Prinzessin, bevor es wächst!",
                     en="Hit this princess’s camp before it grows!")


def done_siege():
    return len(siege_guards) > 0 and gone(siege_guards) == len(siege_guards)


# ---------- After the siege: the mine master ----------

@on_objective("siege", "done")
def siege_broken(id, status):
    global miner
    show_objective("shard")
    if "town" in places():
        miner = npc("miner", look="worker.miner", at=place("town"), speaker="miner", owner=player("eisenhain"))
    say("miner", de="Sie ziehen ab! Kommt in die Stadt, Prinzessin – ich habe etwas für euch.",
                 en="They’re leaving! Come into town, princess – I have something for you.")


@on_talk("miner")
def miner_talk(visitor):
    global shard
    if visitor.name != "nelia":
        say("miner", de="Die Prinzessin soll selbst kommen.",
                     en="The princess should come herself.")
        return
    miner.stop_talking()
    shard = True
    say("miner", de="Das ist es, was Malvor wollte. Ganz unten im Berg lag es versteckt. Nehmt es, es gehört zu euch.",
                 en="This is what Malvor wanted. It lay hidden deep down in the mountain. Take it, it belongs with you.")
    say("nelia", de="Die dritte Zacke … Danke. Wir hätten euch auch ohne sie geholfen.",
                 en="The third shard … Thank you. We would have helped you without it, too.")
