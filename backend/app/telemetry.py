"""Traces, metrics and structured logs for the API.

Privacy comes first (docs/observability.md). Nothing here records request or response bodies, meal
text, photos, keys, or e-mail addresses. Spans carry the route template and the status code, never
the raw URL. Logs carry a fixed message and a reason code, and a filter drops any field that could
hold user text.
"""

import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Span

SERVICE = "journal-api"
# Health probes are polled constantly and would drown out real requests.
EXCLUDED_URLS = "health,health/ready"

# Log fields that could carry user text or secrets. They are dropped before a line is written.
SENSITIVE_FIELDS = frozenset(
    {"text", "name", "photo", "token", "key", "email", "password", "authorization", "body"}
)


log = logging.getLogger("journal")


def estimate_outcome(outcome: str, provider: str) -> None:
    """Count one estimate result, and log it with the same two low-cardinality fields."""
    _estimate_counter().add(1, {"provider": provider, "outcome": outcome})
    log.info("estimate finished", extra={"fields": {"provider": provider, "outcome": outcome}})


_counter: Any = None


def _estimate_counter() -> Any:
    global _counter
    if _counter is None:
        _counter = metrics.get_meter(SERVICE).create_counter(
            "journal.estimate.outcome",
            description="Estimate results by provider and outcome",
        )
    return _counter


class JsonFormatter(logging.Formatter):
    """One JSON object per line, with the trace ID when a span is active."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        span: Span = trace.get_current_span()
        context = span.get_span_context()
        if context.is_valid:
            entry["trace_id"] = format(context.trace_id, "032x")
            entry["span_id"] = format(context.span_id, "016x")
        for key, value in getattr(record, "fields", {}).items():
            if key.lower() not in SENSITIVE_FIELDS:
                entry[key] = value
        return json.dumps(entry, default=str)


def configure_logging() -> None:
    """Send the API's own log lines to stdout as JSON. Uvicorn's access log is left alone."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("journal")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False


def instrument(
    app: FastAPI, endpoint: str | None, *, tracer_provider: TracerProvider | None = None
) -> None:
    """Attach tracing and metrics. With no endpoint and no provider, nothing is exported."""
    resource = Resource.create({"service.name": SERVICE})
    if tracer_provider is None and endpoint:
        tracer_provider = TracerProvider(resource=resource)
        tracer_provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces"))
        )
        meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[
                PeriodicExportingMetricReader(
                    OTLPMetricExporter(endpoint=f"{endpoint}/v1/metrics"),
                    export_interval_millis=30_000,
                )
            ],
        )
        metrics.set_meter_provider(meter_provider)
    if tracer_provider is not None:
        FastAPIInstrumentor.instrument_app(
            app, tracer_provider=tracer_provider, excluded_urls=EXCLUDED_URLS
        )
