import random
# Händler haben auf dem Feldweg Taler verloren – eine Reihe direkt vor Nelia, jedes Mal anders lang (7 bis 12)
length = random.randint(7, 12)
for i in range(length):
    add_item("coin", 4 + i, 6)
# Etwas Wald weiter weg, damit die Wiese nicht so leer ist
for x, y in [(2, 1), (3, 1), (9, 1), (10, 2), (20, 1), (21, 2), (2, 10), (12, 10), (13, 11), (22, 10)]:
    add_tree(x, y)
