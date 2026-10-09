# Flow: farms, a market (a storehouse upgraded) and the first trade. The trade brings Malvor's herald – and with him
# the robbers' shard: buy it through Orrin (cheaper once the merchant has his clay) or storm the camp. Until then the
# gang raids the camp. The epilogue follows the way taken (ending("stormed")).

base = (home.x, home.y)  # where the raids march to
traded = False           # first trade at the market
offered_at = None        # time of the herald's offer (seconds)
shard = False            # the second shard is ours
clay_delivered = False   # Orrin's clay debt is paid
merchant = None          # the merchant at the market of Beaucroix (after the herald)


# ---------- Objectives (in the order of the objectives panel) ----------

objective("farms", lambda: (count("farm"), 3),
          de="Sichere Nahrung: Baue 3 Bauernhöfe",
          en="Secure food: build 3 farms")
hint("farms", ui=["build-farm", "quick-all"], ui_until=lambda: count("farm", placed=True) >= 3)
objective("market", lambda: (count("storehouse", level=1), 1),
          de="Errichte einen Marktplatz (baue ein Lager und baue es aus)",
          en="Set up a marketplace (build a storehouse and upgrade it)")
hint("market", ui=["build-storehouse", "quick-all"], ui_until=lambda: count("storehouse", placed=True) >= 1)
objective("trade", lambda: traded,
          de="Tausche Waren am Markt",
          en="Trade goods at the market")
# Pointer at the newly unlocked barracks for a while (the way with swords), ring at the camp
objective("shard", lambda: shard, hidden=True,
          de="Hol die zweite Zacke: über Orrin freikaufen oder das Räuberlager stürmen",
          en="Get the second shard: buy it through Orrin or storm the robbers’ camp")
hint("shard", area="robbers", ui=["build-barracks", "quick-all"],
     ui_until=lambda: count("barracks", placed=True) >= 1 or time() >= offered_at + 90)
objective("clay", lambda: clay_delivered, primary=False, hidden=True,
          de="Optional: Liefere dem Kaufmann den Lehm, den Orrin verkauft hat",
          en="Optional: Deliver the clay Orrin sold to the merchant")


@on_start
def arrival():
    say("orrin", de="Beaucroix! Hier riecht sogar der Schnee nach Geld. Wir brauchen einen eigenen Markt, Nelia.",
                 en="Beaucroix! Even the snow smells of money here. We need a market of our own, Nelia.")
    say("nelia", de="Wir brauchen Brot für unsere Leute. Wenn der Markt das bringt, bauen wir ihn.",
                 en="We need bread for our people. If a market brings that, we’ll build one.")
    say("orrin", de="Bau erst ein Lager und dann den Marktplatz daraus. Dort tauschen Händler, was du übrig hast, gegen Taler.",
                 en="First build a storehouse, then turn it into a marketplace. There, traders swap whatever you have spare for thalers.")
    say("nelia", de="Und die anderen Zacken? Wenn Malvor sie sucht, sind seine Leute vielleicht schon hier.",
                 en="And the other shards? If Malvor is looking for them, his people may be here already.")
    say("orrin", de="Darum hören wir uns um. Auf dem Markt erfährt man alles – man muss nur etwas zu tauschen haben.",
                 en="That’s why we listen. At the market you learn everything – you just need something to trade.")


# ---------- Milestone: the first trade. Only now does Malvor's herald come – and with him the robbers' shard ----------

@on_event("trade")
def first_trade(give, take, amount):
    global traded, offered_at, merchant
    if traded:
        return
    traded = True
    offered_at = time()
    unlock("barracks")
    show_objective("shard")
    offer("buyShard", {"gold": 1200}, group="shard",
          de="Zacke freikaufen (Orrin verhandelt mit den Räubern)",
          en="Buy the shard free (Orrin bargains with the robbers)")
    reveal(place("robbers"), seconds=30)
    if "townArea" in places():
        merchant = npc("merchant", look="worker", at=place("townArea"), speaker="merchant", owner=player("beaucroix"))
    say("orrin", de="Hörst du das? Das ist der schönste Klang der Welt: Taler, die klimpern.",
                 en="Hear that? The most beautiful sound in the world: thalers clinking.")
    say("herald", de="Hört, Leute von Beaucroix! Statthalter Malvor zahlt für jedes Stück der alten Krone tausend Taler!",
                  en="Hear, people of Beaucroix! Governor Malvor pays a thousand thalers for every piece of the old crown!")
    say("orrin", de="Tausend! Die Räuber im Flusswald haben so ein Stück, das weiß hier jeder. Ich biete mehr – oder du holst es dir.",
                 en="A thousand! The robbers in the river woods have such a piece, everyone here knows it. I’ll bid more – or you go and take it.")
    say("nelia", de="Verkaufen sie an Malvor, ist die Zacke verloren. Wenn wir sie holen müssen, brauchen wir Schwertkämpfer – eine Kaserne bildet sie aus.",
                 en="If they sell to Malvor, the shard is lost. If we have to take it, we need swordsmen – a barracks trains them.")


# ---------- The merchant: Orrin sold him clay he never had ----------

@on_talk("merchant")
def merchant_talk(visitor):
    if visitor.name != "orrin":
        say("merchant", de="Ich warte auf Orrin. Er schuldet mir etwas.",
                        en="I’m waiting for Orrin. He owes me something.")
        return
    merchant.stop_talking()
    show_objective("clay")
    offer("clay", {"clay": 800},
          de="Den versprochenen Lehm an den Kaufmann liefern",
          en="Deliver the promised clay to the merchant")
    say("merchant", de="Orrin! Du hast mir vor einem Monat achthundert Lehm verkauft. Wo ist er?",
                    en="Orrin! A month ago you sold me eight hundred clay. Where is it?")
    say("orrin", de="Unterwegs! Sozusagen. Er … wächst noch. Nelia, wir sollten ihn liefern. Dann gibt’s Rabatt.",
                 en="On its way! So to speak. It’s … still growing. Nelia, we should deliver it. Then there’s a discount.")
    say("nelia", de="Du hast etwas verkauft, das du nicht hast?",
                 en="You sold something you don’t have?")


@on_event("tribute", id="clay")
def clay_paid(id):
    global clay_delivered
    clay_delivered = True
    withdraw("buyShard")
    offer("buyShardCheap", {"gold": 800}, group="shard",
          de="Zacke freikaufen – mit Rabatt des Kaufmanns",
          en="Buy the shard free – with the merchant’s discount")
    say("merchant", de="Der Lehm ist da – und sogar trocken! Für so ehrliche Leute rede ich mit den Räubern.",
                    en="The clay is here – and dry, too! For such honest people I’ll talk to the robbers.")
    say("orrin", de="Ehrlichkeit ist mein zweiter Vorname. Gleich nach Gewinn.",
                 en="Honesty is my middle name. Right after profit.")


# ---------- The second shard: bought or stormed ----------

def got_shard():
    """The shard is ours: the open offers for it go."""
    global shard
    shard = True
    for offer_id in ["buyShard", "buyShardCheap", "clay"]:
        withdraw(offer_id)


@on_event("tribute", id="buyShard")
def bought(id):
    got_shard()
    say("bandit", de="Taler sind Taler. Nimm dein Blechstück, Händler.",
                  en="Thalers are thalers. Take your bit of tin, merchant.")


@on_event("tribute", id="buyShardCheap")
def bought_cheap(id):
    got_shard()
    say("bandit", de="Der Kaufmann bürgt für dich? Dann sei’s drum. Nimm dein Blechstück.",
                  en="The merchant vouches for you? Fine then. Take your bit of tin.")


@on_start
def stormed():
    wait_until(lambda: len(robber_guards) > 0 and alive(robber_guards) == 0)
    ending("stormed")
    got_shard()
    say("prisoner", de="Gnade! Hier, nehmt das verfluchte Ding. Es hat uns nur Unglück gebracht.",
                    en="Mercy! Here, take the cursed thing. It has brought us nothing but bad luck.")


# Armed with Malvor's money the gang raids the camp as long as it has the shard – first five minutes after the herald
@on_start
def raids():
    wait_until(lambda: offered_at is not None)
    for i in range(3):
        wait_until(lambda: time() >= offered_at + 300 * (i + 1))
        if shard:
            return
        wave = spawn(BANDITS, "sword1", place("robbers"), count=2, soldiers=3)
        attack(wave, base)
        say("bandit", de="Holt euch, was die Prinzessin hortet!",
                      en="Grab what the princess is hoarding!")
