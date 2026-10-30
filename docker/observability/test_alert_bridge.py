"""Run with: python3 -m unittest test_alert_bridge"""

import unittest

from alert_bridge import build_messages


class BuildMessagesTest(unittest.TestCase):
    def test_firing_critical_alert_is_urgent_and_uses_the_summary(self) -> None:
        payload = {
            "alerts": [
                {
                    "status": "firing",
                    "labels": {"alertname": "TelemetryCollectorDown", "severity": "critical"},
                    "annotations": {"summary": "The collector is down."},
                }
            ]
        }
        self.assertEqual(
            build_messages(payload),
            [("Journal: TelemetryCollectorDown", "The collector is down.", "urgent")],
        )

    def test_resolved_alerts_are_not_sent(self) -> None:
        payload = {"alerts": [{"status": "resolved", "labels": {"alertname": "X"}}]}
        self.assertEqual(build_messages(payload), [])

    def test_only_fixed_text_is_forwarded(self) -> None:
        payload = {
            "alerts": [
                {
                    "status": "firing",
                    "labels": {"alertname": "EstimateErrorsHigh", "user": "someone@example.com"},
                    "annotations": {"summary": "Check the provider."},
                }
            ]
        }
        title, body, _ = build_messages(payload)[0]
        self.assertNotIn("someone@example.com", title + body)


if __name__ == "__main__":
    unittest.main()
