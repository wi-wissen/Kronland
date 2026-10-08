import random
# Eine Baumreihe am Feldrand – jedes Mal anders lang (7 bis 12 Bäume)
length = random.randint(7, 12)
for i in range(length):
    add_tree(5 + i, 6)
# Etwas Wald weiter weg, damit die Wiese nicht so leer ist
for x, y in [(2, 1), (3, 1), (9, 1), (10, 2), (20, 1), (21, 2), (2, 10), (12, 10), (13, 11), (22, 10)]:
    add_tree(x, y)
