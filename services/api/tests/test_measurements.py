import pytest

from cretelab_api.measurements import (
    QUESTIONS,
    ROLE_TEMPLATE,
    extract,
    is_dims,
    questions_for,
    role_candidates,
    role_question,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("ein imperialer sitzwürfel cubisch, 90 cm Seitenlänge wandicke 2 cm, für den Garten", ["90 cm", "2 cm"]),
        ("Fundament für ein Gartenhaus 3x2 m, 20 cm dick", ["3x2 m", "20 cm"]),
        ("Einfahrt zur Garage, 25 m² und 15 cm stark", ["25 m²", "15 cm"]),
        ("12 Zaunpfosten, Löcher 30x30x80 cm", ["12 zaunpfosten", "30x30x80 cm"]),
        ("Tischplatte 1,20 x 0,8 m, 4 cm dick", ["1,20x0,8 m", "4 cm"]),
        ("40 cm lang, 40 cm breit und 40 cm hoch", ["40 cm", "40 cm #2", "40 cm #3"]),
        ("runder Pflanztopf Durchmesser 40 cm, 35 cm hoch, 2,5 cm Wand", ["40 cm", "35 cm", "2,5 cm"]),
        ("2 Säcke Fertigbeton à 40 kg", ["2 säcke"]),
        ("halber Kubik", []),
        ("3 Kubik Beton", ["3 kubik"]),
        ("Concrete letters, about 5 litres", ["5 litres"]),
        ("500 Liter Beton", ["500 liter"]),
        ("Blumenkübel 40x40x40", ["40x40x40 cm"]),  # no unit, values from 10 up are cm
        ("Platte 3x2, 15 cm", ["3x2 m", "15 cm"]),
        # Mixed units: each value keeps its own, the candidate is written in cm.
        ("Waschbecken 1m x 0.5m x 20 cm", ["100x50x20 cm"]),
        ("Platte 1,2 m x 80 cm, 4 cm dick", ["120x80 cm", "4 cm"]),
        ("Kübel 40 x 40 cm x 0,5 m", ["40x40x50 cm"]),
        ("Rahmen 2 m x 500 mm", ["200x50 cm"]),
        # Written-out units become the short form.
        ("Ringanker 24x25cm ca. 50 Meter\n0-16 Sand/Kies vorhanden\nC25/30", ["24x25 cm", "50 m"]),
        ("Mauer 12 Metern lang, 30 Zentimeter breit", ["12 m", "30 cm"]),
        ("Streifenfundament 18 lfm, 40 x 80 Zentimeter", ["18 m", "40x80 cm"]),
        ("Bodenplatte 20 Quadratmeter, 2 Kubikmeter Beton", ["20 m²", "2 m³"]),
        ("a wall 3 metres long, 200 millimetres thick", ["3 m", "200 mm"]),
        ("Platte 3 x 2 Meter", ["3x2 m"]),
    ],
)
def test_extract_finds_measurements_in_reading_order(text, expected):
    assert extract(text) == expected


def test_extract_keeps_at_most_six_candidates():
    text = ", ".join(f"{n} cm" for n in range(10, 20))
    assert len(extract(text)) == 6


def test_dimension_groups_are_not_role_candidates():
    assert is_dims("3x2 m") and not is_dims("20 cm")
    assert role_candidates("Fundament 3x2 m, 20 cm dick") == ["20 cm"]


def test_role_question_names_the_candidate_and_its_occurrence():
    q = role_question("40 cm #2")
    assert '"40 cm (occurrence 2)"' in q["instructions"]
    assert q["criteria"] == ROLE_TEMPLATE["criteria"]
    assert "{candidate}" in ROLE_TEMPLATE["instructions"]  # the template itself is untouched


def test_questions_for_adds_role_questions_to_the_fixed_ones():
    qs = questions_for("Sitzwürfel 90 cm, Wand 2 cm")
    assert set(QUESTIONS) < set(qs)
    assert {"role:90 cm", "role:2 cm"} == set(qs) - set(QUESTIONS)


def test_every_question_is_typed():
    for qid, q in QUESTIONS.items():
        assert q["type"] in {"noul", "choice", "score"}, qid
        assert q["instructions"].strip(), qid
        if q["type"] in {"choice", "score"}:
            assert q["criteria"], qid


def test_the_web_app_relies_on_these_choices():
    # packages/engine reads these options; renaming one breaks the plan without an error.
    assert set(QUESTIONS["approach"]["criteria"]) == {"scratch", "bagged", "fine_mortar"}
    assert set(QUESTIONS["element"]["criteria"]) == {"foundation", "slab", "wall", "paving", "small"}
    assert set(QUESTIONS["shape"]["criteria"]) >= {"slab", "block", "cube", "cylinder", "hollow", "ring", "bowl"}
    assert set(QUESTIONS["open_sides"]["criteria"]) >= {"one", "none", "both"}
    assert set(ROLE_TEMPLATE["criteria"]) == {
        "length",
        "width",
        "height",
        "diameter",
        "wall",
        "thickness",
        "area",
        "volume",
        "count",
        "other",
    }
