"""Forwards Alertmanager webhooks to the private ntfy topic that the disk alert already uses.

Only the alert name, its severity, its one-line summary and the status are sent. Labels and
annotations are fixed text written in alerts.yml, so no user data can reach the phone.
"""

import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
DRY_RUN = os.environ.get("DRY_RUN") == "1"
PORT = 8080


def build_messages(payload: dict) -> list[tuple[str, str, str]]:
    """Return (title, body, priority) for each firing alert in an Alertmanager webhook payload."""
    messages = []
    for alert in payload.get("alerts", []):
        if alert.get("status") != "firing":
            continue
        labels = alert.get("labels", {})
        annotations = alert.get("annotations", {})
        severity = labels.get("severity", "warning")
        priority = "urgent" if severity == "critical" else "default"
        title = f"Journal: {labels.get('alertname', 'alert')}"
        body = annotations.get("summary", "An alert fired. Check Grafana.")
        messages.append((title, body, priority))
    return messages


def send(title: str, body: str, priority: str) -> None:
    if DRY_RUN:
        print(f"DRY RUN {priority}: {title} - {body}", flush=True)
        return
    request = urllib.request.Request(
        f"https://ntfy.sh/{NTFY_TOPIC}",
        data=body.encode("utf-8"),
        headers={"Title": title, "Priority": priority},
        method="POST",
    )
    urllib.request.urlopen(request, timeout=10).close()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802 - name fixed by BaseHTTPRequestHandler
        if self.path != "/alert":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length) or b"{}")
        for title, body, priority in build_messages(payload):
            send(title, body, priority)
        self.send_response(204)
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:  # keep logs to fixed lines
        return


if __name__ == "__main__":
    if not NTFY_TOPIC and not DRY_RUN:
        raise SystemExit("NTFY_TOPIC is required")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
