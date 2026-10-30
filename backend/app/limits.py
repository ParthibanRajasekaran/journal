"""Per-user write limiter: a token bucket held in memory of the single API process.

It resets when the process restarts, which is acceptable for one instance. Move the
buckets to PostgreSQL or Redis before running more than one instance.
"""

import time
from dataclasses import dataclass


@dataclass
class _Bucket:
    tokens: float
    updated: float


class WriteLimiter:
    MAX_TRACKED = 10_000

    def __init__(self, per_minute: int) -> None:
        self._capacity = float(per_minute)
        self._refill_per_second = per_minute / 60.0
        self._buckets: dict[str, _Bucket] = {}

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        bucket = self._buckets.get(key)
        if bucket is None:
            if len(self._buckets) >= self.MAX_TRACKED:
                self._buckets.clear()  # bounded memory; a reset only loosens limits briefly
            bucket = _Bucket(tokens=self._capacity, updated=now)
            self._buckets[key] = bucket
        elapsed = now - bucket.updated
        bucket.tokens = min(self._capacity, bucket.tokens + elapsed * self._refill_per_second)
        bucket.updated = now
        if bucket.tokens < 1.0:
            return False
        bucket.tokens -= 1.0
        return True
