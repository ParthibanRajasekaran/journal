"""Telemetry must never carry user text, and log lines must be structured and redacted."""

import json
import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app import telemetry
from app.config import Settings
from app.main import create_app
from tests.dbsupport import migrate_to_head, run, truncate_all
from tests.test_auth import FakeKeys
from tests.test_days_and_profile import _sign_in_as
from tests.test_meals import _create, _meal_body

PRIVATE_NAME = "Grandmother's recipe with a private note"


@pytest.fixture(autouse=True)
def _schema_and_clean_db() -> None:
    migrate_to_head()
    run(truncate_all)


@pytest.fixture
def traced(settings: Settings) -> Iterator[tuple[TestClient, InMemorySpanExporter]]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    application = create_app(settings)
    application.state.jwks = FakeKeys()
    telemetry.instrument(application, None, tracer_provider=provider)
    with TestClient(application, follow_redirects=False) as client:
        yield client, exporter


def test_a_saved_meal_never_appears_in_any_span(
    traced: tuple[TestClient, InMemorySpanExporter], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, exporter = traced
    _sign_in_as(client, monkeypatch, "telemetry-user")
    exporter.clear()
    assert _create(client, _meal_body(name=PRIVATE_NAME)).status_code == 201

    spans = exporter.get_finished_spans()
    assert any(
        span.attributes and span.attributes.get("http.route") == "/api/v1/meals" for span in spans
    )
    for span in spans:
        for value in (span.attributes or {}).values():
            assert PRIVATE_NAME not in str(value)
        assert PRIVATE_NAME not in span.name


def test_health_probes_are_not_traced(
    traced: tuple[TestClient, InMemorySpanExporter],
) -> None:
    client, exporter = traced
    exporter.clear()
    client.get("/api/v1/health/ready")
    assert not [s for s in exporter.get_finished_spans() if "health" in (s.name or "")]


def test_log_lines_are_json_and_drop_fields_that_could_hold_user_text() -> None:
    record = logging.LogRecord("journal", logging.INFO, __file__, 1, "estimate refused", None, None)
    record.fields = {
        "reason": "no_key",
        "text": PRIVATE_NAME,
        "email": "a@example.com",
        "key": "sk-x",
    }
    line = json.loads(telemetry.JsonFormatter().format(record))
    assert line["message"] == "estimate refused"
    assert line["reason"] == "no_key"
    assert line["level"] == "INFO"
    for field in ("text", "email", "key"):
        assert field not in line
    assert PRIVATE_NAME not in json.dumps(line)
