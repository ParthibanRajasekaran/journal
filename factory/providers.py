"""Provider eligibility for FACTORY DEVELOPMENT execution. One module decides every route.

Two systems are kept separate:
1. Factory development (this module): only routes verified as subscription or free-tier are eligible.
2. Journal runtime AI (backend): users' stored API keys for meal estimation. The factory never reads
   them, and a stored key is never evidence of a free route or a subscription.

Policy: no additional spend. A route is eligible only when every check passes. Unknown, unverified,
disabled or API-billed routes are refused. Nothing falls back to another route, a paid API or
purchased credits. Quota is always reported as unknown: the CLI does not expose remaining quota.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

from factory.common import now, read_json, write_json

CLAUDE = "claude-code"
CODEX = "codex"
GEMINI = "gemini"
KNOWN_PROVIDERS = (CLAUDE, CODEX, GEMINI)

# Presence of any of these would make the Claude CLI bill API usage instead of the subscription.
# Only the variable names are ever reported, never values.
API_BILLING_ENV = (
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
)
SUBSCRIPTION_AUTH_METHODS = {"claude.ai"}
QUOTA_PATTERN = re.compile(r"usage limit|rate limit|quota|limit reached|too many requests|\b429\b", re.IGNORECASE)


@dataclass(frozen=True)
class Eligibility:
    provider: str
    eligible: bool
    route: str
    reason: str
    quota: str = "unknown"
    facts: dict = field(default_factory=dict)


def refuse(provider: str, reason: str, route: str = "none") -> Eligibility:
    return Eligibility(provider=provider, eligible=False, route=route, reason=reason)


def classify_claude_result(payload: dict | None) -> str:
    """Returns "ok", "quota" (waiting for the quota to return) or "failed". Budget stops are failures."""
    if not payload:
        return "failed"
    if payload.get("subtype") == "success" and not payload.get("is_error", False):
        return "ok"
    text = " ".join(
        [str(payload.get("subtype", "")), " ".join(payload.get("errors") or []), str(payload.get("result", ""))]
    )
    if QUOTA_PATTERN.search(text):
        return "quota"
    return "failed"


def quota_status(provider: str) -> dict:
    """Quota is never guessed. The routes here do not report remaining allowance."""
    return {
        "provider": provider,
        "state": "unknown",
        "detail": "the CLI does not report remaining quota; the factory will not estimate it",
    }


class ProviderPolicy:
    """Reads owner toggles and attestations from the untracked local state directory, and verifies
    sign-in by asking the CLI. It never writes billing, account or global settings."""

    def __init__(self, state_dir: Path, config: dict, claude_binary: str, env: Mapping[str, str] | None = None, runner=subprocess.run):
        self.state_dir = Path(state_dir)
        self.config = config
        self.claude_binary = claude_binary
        self.env = dict(os.environ if env is None else env)
        self._run = runner

    # Owner-controlled local state ---------------------------------------------------------------

    @property
    def toggles_path(self) -> Path:
        return self.state_dir / "provider-toggles.json"

    @property
    def attestations_path(self) -> Path:
        return self.state_dir / "owner-attestations.json"

    def toggles(self) -> dict:
        defaults = dict(self.config.get("providers", {}).get("default_enabled", {}))
        for name in KNOWN_PROVIDERS:
            defaults.setdefault(name, False)
        if self.toggles_path.exists():
            defaults.update(read_json(self.toggles_path))
        return defaults

    def set_toggle(self, provider: str, enabled: bool) -> None:
        if provider not in KNOWN_PROVIDERS:
            raise ValueError(f"unknown provider {provider}; known: {', '.join(KNOWN_PROVIDERS)}")
        current = self.toggles()
        current[provider] = bool(enabled)
        write_json(self.toggles_path, {k: current[k] for k in KNOWN_PROVIDERS})

    def attestations(self) -> dict:
        return read_json(self.attestations_path) if self.attestations_path.exists() else {}

    def attest(self, provider: str, key: str) -> None:
        if provider != CLAUDE or key != "extra-usage-disabled":
            raise ValueError("supported attestation: claude-code extra-usage-disabled")
        data = self.attestations()
        data.setdefault(CLAUDE, {})["extra_usage_disabled"] = True
        data[CLAUDE]["attested_at"] = now()
        write_json(self.attestations_path, data)

    # Eligibility -------------------------------------------------------------------------------

    def evaluate(self, provider: str) -> Eligibility:
        if provider not in KNOWN_PROVIDERS:
            return refuse(provider, "unknown provider; refused")
        if not self.toggles().get(provider, False):
            return refuse(provider, "disabled by owner toggle (python3 -m factory provider-toggle {} on)".format(provider))
        if provider != CLAUDE:
            return refuse(provider, "no verified factory adapter and no verified billing route in this checkout")

        binary = self.claude_binary
        if shutil.which(binary) is None and not Path(binary).exists():
            return refuse(provider, f"{binary} CLI not found")
        present = [name for name in API_BILLING_ENV if self.env.get(name)]
        if present:
            names = ", ".join(present)
            return refuse(provider, f"API billing variables are set ({names}); unset them for factory runs")
        try:
            proc = self._run([binary, "auth", "status", "--json"], capture_output=True, text=True, timeout=30)
            auth = json.loads(proc.stdout or "{}")
        except (OSError, ValueError, subprocess.TimeoutExpired):
            return refuse(provider, "could not verify sign-in with the CLI; refused")
        facts = {
            "auth_method": auth.get("authMethod"),
            "api_provider": auth.get("apiProvider"),
            "subscription_type": auth.get("subscriptionType"),
        }
        if not auth.get("loggedIn"):
            return refuse(provider, "not signed in to Claude Code")
        if auth.get("authMethod") not in SUBSCRIPTION_AUTH_METHODS or auth.get("apiProvider") != "firstParty":
            return refuse(provider, f"sign-in is '{auth.get('authMethod')}' via '{auth.get('apiProvider')}', not a first-party subscription sign-in")
        if not self.attestations().get(CLAUDE, {}).get("extra_usage_disabled"):
            return refuse(
                provider,
                "owner has not confirmed that extra usage is off; run: python3 -m factory attest claude-code extra-usage-disabled",
            )
        return Eligibility(
            provider=provider,
            eligible=True,
            route="claude-subscription",
            reason=f"subscription sign-in ({auth.get('subscriptionType') or 'type not reported'}); extra usage confirmed off by owner",
            quota="unknown",
            facts=facts,
        )
