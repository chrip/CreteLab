import pytest


def test_describe_returns_answers_candidates_and_model(client):
    res = client.post("/api/describe", json={"text": "Fundament 3x2 m, 20 cm dick"})
    assert res.status_code == 200
    body = res.json()
    assert body["model"] == "fake-laya"
    assert body["candidates"] == ["3x2 m", "20 cm"]
    assert body["answers"]["frost"] == {"noul": 0.9, "choice": None, "score": None, "confidence": 0.9}
    assert body["ms"] >= 0


def test_describe_asks_the_fixed_questions_and_one_role_question_per_measurement(client, predictor):
    body = client.post("/api/describe", json={"text": "Sitzwürfel 90 cm, Wandstärke 2 cm"}).json()
    _, questions = predictor.calls[-1]
    assert {"approach", "shape", "open_sides", "role:90 cm", "role:2 cm"} <= set(questions)
    assert '"90 cm"' in questions["role:90 cm"]["instructions"]
    assert set(body["answers"]) == set(questions)


def test_dimension_groups_get_no_role_question(client, predictor):
    client.post("/api/describe", json={"text": "Blumenkübel 40x40x40 cm"})
    _, questions = predictor.calls[-1]
    assert not [q for q in questions if q.startswith("role:")]


def test_describe_strips_whitespace(client, predictor):
    client.post("/api/describe", json={"text": "  Kellerwand  "})
    assert predictor.calls[-1][0] == "Kellerwand"


def test_describe_drops_internal_answer_fields(client):
    answer = client.post("/api/describe", json={"text": "Garten"}).json()["answers"]["traffic"]
    assert set(answer) == {"noul", "choice", "score", "confidence"}
    assert answer["score"] == 1.0


@pytest.mark.parametrize("text", ["", "   ", "x" * 2001])
def test_describe_rejects_empty_or_too_long_text(client, text):
    assert client.post("/api/describe", json={"text": text}).status_code == 422


def test_describe_rejects_missing_field(client):
    assert client.post("/api/describe", json={}).status_code == 422


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True, "model": "fake-laya", "version": "2.0.0"}


def test_openapi_documents_the_endpoint(client):
    assert "/api/describe" in client.get("/openapi.json").json()["paths"]


def test_model_dir_comes_from_the_environment(monkeypatch, tmp_path):
    from cretelab_api.app import model_dir

    monkeypatch.setenv("LAYA_MODEL_DIR", str(tmp_path))
    assert model_dir() == tmp_path
    monkeypatch.delenv("LAYA_MODEL_DIR")
    assert model_dir().parts[-2:] == ("models", "laya-crete")
