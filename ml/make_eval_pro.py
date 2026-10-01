"""Write eval_pro.jsonl: structural and site elements, labelled by hand (Opus 5.5, 2026-10-01).

None of these descriptions is in the training data. Labels follow the questions in
services/api questions.json; None marks what the text leaves genuinely open (exposure of a
beam inside a wall, the element type of a mortar bed), so evaluation skips it.

    python make_eval_pro.py      # checks every role against the API's candidates
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api" / "src"))
from cretelab_api.measurements import role_candidates  # noqa: E402

HERE = Path(__file__).parent
N = None  # genuinely open

BASE = dict(deicing_salt=False, watertight=False, traffic=0, fine_cast=False, approach="scratch",
            add_cement=False, add_plasticizer=False, open_sides="solid")
INSIDE = dict(indoor_dry=True, rain=False, ground=False, frost=False, horizontal=False)
IN_WALL = dict(indoor_dry=N, rain=N, ground=False, frost=N, horizontal=N)  # a beam inside masonry
OUTSIDE = dict(indoor_dry=False, rain=True, frost=True)
IN_SOIL = dict(indoor_dry=False, ground=True, frost=True)
BEAM = dict(reinforced=True, element="wall", shape="block")

ROWS = [
    # ── ring beams ──
    ("Ringanker 24x25cm ca. 50 Meter\n0-16 Sand/Kies vorhanden\nC25/30",
     {**IN_WALL, **BEAM}, {"50 m": "length"}),
    ("Ringanker auf 36,5er Poroton, 18 lfm, Bügel und 4 Ø12, Transportbeton kommt",
     {**IN_WALL, **BEAM}, {"18 m": "length"}),
    ("ring beam on top of the block walls of my garage, 20x20 cm, 26 m total, C20/25",
     {**IN_WALL, **BEAM}, {"26 m": "length"}),
    ("Ringbalken über Garagentor, Sackware reicht? 3,2 m, 20 x 24",
     {**IN_WALL, **BEAM, "approach": "bagged"}, {"3,2 m": "length"}),
    # ── lintels ──
    ("Fenstersturz 1,51 m lang, 17,5 x 24 cm, selber schalen und mit Freifallmischer mischen",
     {**IN_WALL, **BEAM}, {"1,51 m": "length"}),
    ("Türsturz innen, Öffnung 1,01 m, Kalksandstein 17,5",
     {**INSIDE, **BEAM}, {"1,01 m": "length"}),
    ("lintel over a garage door, 2.6 m span, precast or cast in place? outside",
     {**IN_WALL, **BEAM, "indoor_dry": False}, {"2.6 m": "length"}),
    # ── downstand beams ──
    ("Unterzug 30/50 cm, 5,20 m Spannweite, im Wohnzimmer, laut Statik C30/37",
     {**INSIDE, **BEAM}, {"5,20 m": "length", "50 cm": "height"}),
    ("downstand beam in the basement, 25 x 40 cm, 4.8 m long, ready-mix",
     {**INSIDE, **BEAM, "indoor_dry": N}, {"4.8 m": "length"}),
    ("Unterzug Garage 24 x 50, 6 m, mischen wir selbst",
     {**IN_WALL, **BEAM, "rain": False}, {"6 m": "length"}),
    # ── columns ──
    ("Stahlbetonstütze 25x25 cm, 2,75 m hoch, Carport, steht draußen",
     {**OUTSIDE, "ground": False, "horizontal": False, "deicing_salt": N, **BEAM}, {"2,75 m": "height"}),
    ("4 Betonstützen für die Garage 30x30, je 3 m, innen",
     {"indoor_dry": N, "rain": False, "ground": False, "frost": N, "horizontal": False, **BEAM}, {"3 m": "height"}),
    # ── floor slabs ──
    ("Filigrandecke 18 cm gesamt, Aufbeton 13 cm, 62 m², C25/30 XC1, Pumpe bestellt",
     {**INSIDE, "horizontal": True, "reinforced": True, "element": "slab", "shape": "slab", "traffic": 1},
     {"13 cm": "thickness", "62 m²": "area"}),
    ("Geschossdecke 20 cm, 9 x 11 m, Transportbeton C25/30",
     {**INSIDE, "horizontal": True, "reinforced": True, "element": "slab", "shape": "slab", "traffic": 1},
     {"20 cm": "thickness"}),
    ("ceiling slab for the extension, 16 cm thick, 24 m², with Q188 mesh top and bottom",
     {**INSIDE, "horizontal": True, "reinforced": True, "element": "slab", "shape": "slab", "traffic": 1},
     {"16 cm": "thickness", "24 m²": "area"}),
    # ── stairs ──
    ("Treppenlauf mit Podest im EFH, 13 Steigungen, Breite 1 m, Ortbeton",
     {**INSIDE, "horizontal": True, "reinforced": True, "element": "wall", "shape": N, "traffic": 1},
     {"1 m": "width"}),
    ("Kellertreppe betonieren, 1,10 breit, 2,40 hoch, Schalung steht",
     {**INSIDE, "horizontal": True, "reinforced": True, "element": "wall", "shape": N, "traffic": 1}, {}),
    ("Treppe außen zum Garten, 6 Stufen, Ortbeton bewehrt, wird im Winter gestreut",
     {**OUTSIDE, "ground": True, "horizontal": True, "deicing_salt": True, "reinforced": True,
      "element": "wall", "shape": N, "traffic": 1}, {"6 stufen": "count"}),
    ("Blockstufen setzen vor der Haustür, 5 Stück 100x35x15 cm, Betonbett erdfeucht",
     {**OUTSIDE, "ground": True, "horizontal": True, "deicing_salt": N, "reinforced": False,
      "element": N, "shape": N, "traffic": 1}, {"5 stück": "count"}),
    ("precast concrete steps for the garden, 3 steps on a lean concrete bed, frost",
     {**OUTSIDE, "ground": True, "horizontal": True, "reinforced": False, "element": N, "shape": N, "traffic": 1}, {"3 steps": "count"}),
    # ── basements, watertight ──
    ("Kelleraußenwand WU, 25 cm, Grundwasser bis 1 m unter Gelände, C30/37, Fahrmischer",
     {"indoor_dry": False, "rain": N, "ground": True, "frost": N, "horizontal": False, "reinforced": True,
      "watertight": True, "element": "wall", "shape": "block"}, {"25 cm": "thickness", "1 m": "other"}),
    ("basement walls in watertight concrete, white tank, 30 cm, groundwater",
     {"indoor_dry": False, "rain": N, "ground": True, "frost": N, "horizontal": False, "reinforced": True,
      "watertight": True, "element": "wall", "shape": "block"}, {"30 cm": "thickness"}),
    ("Aufzugsunterfahrt 2,0 x 2,2 m, 1,4 m tief, WU, Grundwasser",
     {"indoor_dry": False, "rain": False, "ground": True, "frost": False, "horizontal": N, "reinforced": True,
      "watertight": True, "element": N, "shape": "hollow", "open_sides": "one"}, {"1,4 m": "height"}),
    ("Pumpensumpf im Keller 60x60x80 cm, wasserdicht",
     {"indoor_dry": N, "rain": False, "ground": True, "frost": False, "horizontal": N, "reinforced": N,
      "watertight": True, "element": N, "shape": "hollow", "open_sides": "one"}, {}),
    # ── ground slabs and frost aprons ──
    ("Bodenplatte EFH 10 x 12 m, 25 cm, mit Frostschürze 80 cm tief rundum, Matten Q257 oben und unten",
     {"indoor_dry": N, "rain": N, "ground": True, "frost": N, "horizontal": True, "reinforced": True,
      "element": "slab", "shape": "slab", "traffic": 1}, {"25 cm": "thickness", "80 cm": "other"}),
    ("Bodenplatte Garage 6x3 m, 20 cm, Matte Q188, Beton selbst mischen mit Kies 0-32",
     {"indoor_dry": False, "rain": False, "ground": True, "frost": True, "deicing_salt": True, "horizontal": True,
      "reinforced": True, "element": "slab", "shape": "slab", "traffic": 2}, {"20 cm": "thickness"}),
    ("Frostschürze für Gartenhaus-Bodenplatte, 30 cm breit, 80 cm tief, 22 lfm, unbewehrt reicht?",
     {**IN_SOIL, "rain": False, "horizontal": False, "reinforced": N, "element": "foundation", "shape": "block"},
     {"30 cm": "width", "80 cm": "height", "22 m": "length"}),
    # ── socket foundations ──
    ("Köcherfundament für Fertigteilstütze, 1,2 x 1,2 x 1 m, Köcher 50 x 50",
     {**IN_SOIL, "rain": False, "horizontal": N, "reinforced": True, "element": "foundation", "shape": "block"}, {}),
    ("pocket foundations for precast columns, 4 pieces, 1 x 1 x 0.9 m each",
     {**IN_SOIL, "rain": False, "horizontal": N, "reinforced": True, "element": "foundation", "shape": "block"},
     {"4 pieces": "count"}),
    # ── parapets ──
    ("Attika auf Flachdach betonieren, 30 cm hoch, 20 cm breit, 38 lfm, Frost und Regen",
     {**OUTSIDE, "ground": False, "horizontal": True, **BEAM},
     {"30 cm": "height", "20 cm": "width", "38 m": "length"}),
    ("Balkonbrüstung aus Beton 1 m hoch, 15 cm, 6 m lang, Sichtbeton",
     {**OUTSIDE, "ground": False, "horizontal": N, **BEAM},
     {"1 m": "height", "15 cm": "thickness", "6 m": "length"}),
    # ── blinding ──
    ("Sauberkeitsschicht 5 cm unter der Bodenplatte, 120 m², C8/10",
     {"indoor_dry": False, "rain": N, "ground": True, "frost": N, "horizontal": N, "reinforced": False,
      "element": N, "shape": "slab", "traffic": N}, {"5 cm": "thickness", "120 m²": "area"}),
    ("lean concrete blinding under strip footings, 5 cm, 40 m of trench 60 cm wide",
     {"indoor_dry": False, "rain": N, "ground": True, "frost": N, "horizontal": N, "reinforced": False,
      "element": "foundation", "shape": "slab", "traffic": N}, {"5 cm": "thickness", "40 m": "length", "60 cm": "width"}),
    # ── paving in a mortar bed ──
    ("Gehwegplatten 40x40 im Mörtelbett verlegen, 25 m², Terrasse, Frost",
     {**OUTSIDE, "ground": True, "horizontal": True, "reinforced": False, "element": "paving", "shape": "slab",
      "traffic": 1, "approach": N}, {"25 m²": "area"}),
    ("laying patio slabs on a mortar bed, 3 cm bed, 18 m², bagged mortar ok?",
     {**OUTSIDE, "ground": True, "horizontal": True, "reinforced": False, "element": "paving", "shape": "slab",
      "traffic": 1, "approach": "bagged"}, {"3 cm": "thickness", "18 m²": "area"}),
    # ── curbs and edging ──
    ("Bordsteine setzen mit Rückenstütze, 35 lfm, Hofeinfahrt, wird gestreut",
     {**OUTSIDE, "ground": True, "horizontal": N, "deicing_salt": True, "reinforced": False, "element": N,
      "shape": N, "traffic": N}, {"35 m": "length"}),
    ("Rasenkantensteine einbetonieren, 20 m, erdfeucht, mit dem Mischer",
     {**OUTSIDE, "ground": True, "horizontal": N, "reinforced": False, "element": N, "shape": N}, {"20 m": "length"}),
    # ── grass pavers ──
    ("Rasengittersteine für 6 Stellplätze, 90 m², Beton für die Einfassung",
     {**OUTSIDE, "ground": True, "horizontal": True, "deicing_salt": N, "reinforced": False, "element": "paving",
      "shape": N, "traffic": 2}, {"90 m²": "area"}),
    ("grass pavers for the fire lane, cast them myself 60x40x10 cm, 200 pieces",
     {**OUTSIDE, "ground": True, "horizontal": True, "deicing_salt": N, "reinforced": False, "element": "paving",
      "shape": "block", "traffic": 3}, {"200 pieces": "count"}),
    # ── L-shaped retaining elements ──
    ("L-Steine 80 cm hoch setzen, Fundament 40 cm breit 30 cm hoch, 12 m",
     {**IN_SOIL, "rain": False, "horizontal": False, "reinforced": N, "element": "foundation", "shape": "block"},
     {"80 cm": "other", "40 cm": "width", "30 cm": "height", "12 m": "length"}),
    ("Winkelstützen für Hangsicherung, Streifenfundament C25/30, 15 lfm, 50 x 30",
     {**IN_SOIL, "rain": False, "horizontal": False, "reinforced": N, "element": "foundation", "shape": "block"},
     {"15 m": "length"}),
    # ── wall capping ──
    ("Mauerkrone auf Gartenmauer betonieren, 24 cm breit, 8 cm dick, 14 m, frost und regen",
     {**OUTSIDE, "ground": False, "horizontal": True, "reinforced": N, "element": "wall", "shape": N},
     {"24 cm": "width", "8 cm": "thickness", "14 m": "length"}),
    ("wall coping cast on site on a brick wall, 30 cm wide, 6 cm, 9 m, salt from the road",
     {**OUTSIDE, "ground": False, "horizontal": True, "deicing_salt": True, "reinforced": N, "element": "wall",
      "shape": N}, {"30 cm": "width", "6 cm": "thickness", "9 m": "length"}),
    # ── heat pump plinths ──
    ("Wärmepumpen-Podest 120x60 cm, 30 cm hoch über Gelände, frostfrei gegründet",
     {**OUTSIDE, "ground": True, "horizontal": True, "reinforced": N, "element": "foundation", "shape": "block"},
     {"30 cm": "height"}),
    ("Sockel für Klimagerät Außeneinheit, 2 Punktfundamente 40x40x80 cm",
     {**OUTSIDE, "ground": True, "horizontal": N, "reinforced": N, "element": "foundation", "shape": "block"},
     {"2 punktfundamente": "count"}),
    ("heat pump pad 1.4 x 0.8 m, 20 cm, on gravel, with mesh",
     {**OUTSIDE, "ground": True, "horizontal": True, "reinforced": True, "element": N, "shape": "slab"},
     {"20 cm": "thickness"}),
    # ── hollow formwork blocks ──
    ("Schalsteine 24er verfüllen, 30 m², 1,25 m hoch, Beton fließfähig, Eisen rein",
     {"indoor_dry": False, "rain": N, "ground": N, "frost": N, "horizontal": N, "reinforced": True,
      "element": "wall", "shape": N, "add_plasticizer": True}, {"30 m²": "area", "1,25 m": "height"}),
    ("filling hollow formwork blocks 17.5 for a garden wall, 12 m long 1 m high, rebar every block",
     {**OUTSIDE, "ground": False, "horizontal": N, "reinforced": True, "element": "wall", "shape": N},
     {"12 m": "length", "1 m": "height"}),
]


def main():
    rows = []
    for text, labels, roles in ROWS:
        cands = role_candidates(text)
        missing = [r for r in roles if r not in cands]
        assert not missing, f"{text!r}: roles {missing} not among the API's candidates {cands}"
        full = {**BASE, **labels, **{f"role:{c}": r for c, r in roles.items()}}
        rows.append({"text": text, "labels": full})
    with (HERE / "eval_pro.jsonl").open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{len(rows)} descriptions written to eval_pro.jsonl")
    for text, _, roles in ROWS:
        left = [c for c in role_candidates(text) if c not in roles]
        if left:
            print("  no role label (skipped):", left, "←", text.replace("\n", " ")[:60])


if __name__ == "__main__":
    main()
