"""Sensor: there is no developer-funded AI key, anywhere.

Estimates run with the user's own stored key only (docs/spec/00-review-and-handoff.md section 5).
These tests fail the gate if Settings grows a provider key, or the estimator reads one from the
environment, or a provider call stops requiring an explicit key argument.
"""

import inspect
import re

import app.ai.estimate as estimate
import app.ai.providers as providers
from app.config import Settings


def test_settings_has_no_provider_api_key() -> None:
    suspicious = [
        name
        for name in Settings.model_fields
        if re.search(r"api_key|(openai|anthropic|gemini|google)[a-z_]*(key|token|secret)", name)
        and name not in {"google_client_secret"}
    ]
    assert suspicious == [], suspicious


def test_estimator_reads_no_key_from_environment() -> None:
    source = inspect.getsource(estimate) + inspect.getsource(providers)
    assert "os.environ" not in source
    assert "getenv" not in source


def test_provider_call_requires_the_users_key() -> None:
    parameters = inspect.signature(estimate.ask_provider).parameters
    assert "api_key" in parameters
    assert parameters["api_key"].default is inspect.Parameter.empty
