"""Génère les tables de référence Python utilisées par les tests de la bibliothèque d'exécution.

Usage : python3 tests/python/generer.py > tests/python/reference.json
Les tables sont versionnées : la CI n'a pas besoin de Python pour les tests unitaires.
"""

import json
import math
import random
import sys


def ou_erreur(f):
    try:
        return f()
    except (ValueError, OverflowError, ZeroDivisionError, TypeError) as e:
        return {"erreur": type(e).__name__}


def entier(n):
    return {"entier": str(n)}


def valeur(v):
    """Encode une valeur Python en JSON sans perte."""
    if isinstance(v, dict):
        return v
    if isinstance(v, bool):
        return {"booleen": v}
    if isinstance(v, int):
        return entier(v)
    if isinstance(v, float):
        return {"reel": repr(v)}
    if isinstance(v, str):
        return {"chaine": v}
    if isinstance(v, complex):
        return {"erreur": "complex"}
    raise TypeError(v)


REELS = [
    0.0, -0.0, 1.0, -1.0, 0.1, 0.2, 0.1 + 0.2, 1 / 3, 2 / 3, 2.5, 3.0, 100.0, 1e-4, 1e-5, 1.5e-7,
    123456789.123, 1e15, 1e16, 1.5e16, 12345678901234567.0, 1e22, 1e100, 5e-324,
    1.7976931348623157e308, math.pi, math.e, 1 / 7, 0.5, 1234.5678, 9.999999999999999e15,
    float("inf"), float("-inf"), float("nan"), 2.0 ** 53, 2.0 ** 63, 0.000123, 1e-7,
]

ENTIERS = [0, 1, -1, 7, -7, 2, -2, 3, 10, -10, 2 ** 64 + 3, -(2 ** 70)]

random.seed(2026)
REELS += [random.uniform(-1e6, 1e6) for _ in range(30)] + [random.random() for _ in range(30)]

ref = {}

ref["repr"] = [[repr(x), repr(x)] for x in REELS]

ref["div_mod_entiers"] = [
    [str(a), str(b), valeur(ou_erreur(lambda: a // b)), valeur(ou_erreur(lambda: a % b))]
    for a in ENTIERS for b in ENTIERS
]

PAIRES_REELS = [-7.5, 7.5, 2.0, -2.0, 0.0, -0.0, 3.0, 0.1, 1e300, -1e-300, 5.0]
ref["div_mod_reels"] = [
    [repr(a), repr(b), valeur(ou_erreur(lambda: a // b)), valeur(ou_erreur(lambda: a % b))]
    for a in PAIRES_REELS for b in PAIRES_REELS
]

ref["division"] = [
    [str(a), str(b), valeur(ou_erreur(lambda: a / b))] for a in ENTIERS for b in ENTIERS
]

ARRONDIS = [0.5, 1.5, 2.5, -0.5, -1.5, -2.5, 0.125, 0.375, 2.675, 1.005, 3.14159, -3.14159, 1234.5678,
            1e20, 0.1, 5e-324, 123.456, 1.25, 1.35, -1.25, 0.285, 1e300, 2.5e-5]
ref["round"] = [[repr(x), valeur(ou_erreur(lambda: round(x)))] for x in ARRONDIS] + [
    ["inf", valeur(ou_erreur(lambda: round(float("inf"))))],
    ["nan", valeur(ou_erreur(lambda: round(float("nan"))))],
]
ref["round_n"] = [
    [repr(x), n, valeur(ou_erreur(lambda: round(x, n)))]
    for x in ARRONDIS for n in [0, 1, 2, 3, -1, -2, 400, -400]
]
ref["round_entier_n"] = [[str(a), n, valeur(round(a, n))] for a in [1234, -1250, 1350, 15, 25, 2 ** 70 + 5] for n in [0, 2, -1, -2, -3]]

PUISSANCES = [(2.0, 0.5), (-8.0, 1 / 3), (2.0, -1.0), (0.0, -1.0), (10.0, 400.0), (-2.0, 3.0), (1.5, 2.0),
              (-1.0, 0.5), (2.0, 1000.0), (0.0, 0.0), (9.0, 0.5), (1.1, 10.0), (-0.0, -3.0)]
ref["puissance_reels"] = [[repr(a), repr(b), valeur(ou_erreur(lambda: a ** b))] for a, b in PUISSANCES]
ref["puissance_entiers"] = [[str(a), str(b), valeur(ou_erreur(lambda: a ** b))]
                            for a, b in [(2, 100), (-3, 3), (0, 0), (2, -1), (0, -1), (-2, -3), (10, 20), (7, 0)]]

SOMMES = [[0.1] * 10, [1e100, 1.0, -1e100], [0.1, 0.2, 0.3], [1, 2.5, 3], [1, 2, 3], [], [2 ** 60, 0.5],
          [1e16, 1.0, 1.0], [0.1, -0.1, 1e-20]]
ref["sum"] = [[[valeur(x) for x in L], valeur(sum(L))] for L in SOMMES]

CHAINES_INT = ["42", " 42 ", "+5", "-0", "1_000", "1__0", "_1", "1_", "", "abc", "2.5", "0x10", "٣", "007", "\t12\n"]
ref["int_chaine"] = [[s, valeur(ou_erreur(lambda: int(s)))] for s in CHAINES_INT]
CHAINES_FLOAT = ["2.5", " 2.5 ", "1e5", "-1E-3", ".5", "5.", "inf", "-Infinity", "nan", "1_0.5", "2,5", "",
                 "abc", "1e", "+.5e+2", "1_000.000_1", "0x10", "1e400"]
ref["float_chaine"] = [[s, valeur(ou_erreur(lambda: float(s)))] for s in CHAINES_FLOAT]
ref["int_reel"] = [[repr(x), valeur(ou_erreur(lambda: int(x)))] for x in [2.7, -2.7, 1e20, -0.5, float("inf"), float("nan")]]
ref["floor_ceil"] = [[repr(x), valeur(ou_erreur(lambda: math.floor(x))), valeur(ou_erreur(lambda: math.ceil(x)))]
                     for x in [2.5, -2.5, 3.0, -0.0, 1e20, float("inf"), float("nan")]]

COMPARAISONS = [(2 ** 53 + 1, 2.0 ** 53), (2 ** 53, 2.0 ** 53), (3, 2.5), (-3, -2.5), (10 ** 400, float("inf")),
                (5, float("nan")), (1, 1.0), (0, -0.0), (2 ** 64, 1.8446744073709552e19)]
ref["comparaisons"] = [[str(a), repr(b), a == b, a < b, a > b] for a, b in COMPARAISONS]

ref["repr_chaines"] = [[s, repr(s)] for s in ["a", "l'arbre", 'il dit "oui"', "l'a \"dit\"", "a\nb\tc\\", "é😀", "\x01\x7f", ""]]

ref["entier_vers_reel"] = [[str(n), valeur(ou_erreur(lambda: float(n)))] for n in [2 ** 53 + 1, 2 ** 53 + 3, 10 ** 308, 10 ** 309, -(2 ** 1024)]]

GRAINES = [0, 1, 42, 2026, 2 ** 40 + 5, -7, 123456789012345678901234567890]
alea = []
for g in GRAINES:
    random.seed(g)
    reels = [repr(random.random()) for _ in range(5)]
    des = [random.randint(1, 6) for _ in range(10)]
    grand = str(random.randint(0, 2 ** 70))
    negatif = random.randint(-100, -50)
    choix = random.choice(["a", "b", "c", "d", "e", "f", "g"])
    alea.append({"graine": str(g), "reels": reels, "des": des, "grand": grand, "negatif": negatif, "choix": choix})
ref["aleatoire"] = alea

MATHS = [0.5, 1.0, 2.0, 10.0, 0.1, 100.0, 1e-10, 3.0]
ref["math"] = [
    [nom, repr(x), valeur(ou_erreur(lambda: getattr(math, nom)(x)))]
    for nom in ["sqrt", "exp", "log", "log10", "cos", "sin", "tan", "atan"]
    for x in MATHS + [-1.0, 0.0, 800.0, float("inf")]
]
ref["log_entiers"] = [[str(n), valeur(math.log(n)), valeur(math.log10(n))] for n in [2 ** 2000, 10 ** 400, 7]]

json.dump(ref, sys.stdout, ensure_ascii=False, indent=0)
print()
