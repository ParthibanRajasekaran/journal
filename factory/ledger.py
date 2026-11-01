"""Durable run state and cumulative budget ledger, kept in SQLite outside the Journal database.

Every budget decision happens inside a BEGIN IMMEDIATE transaction, so concurrent children cannot
both reserve the last affordable amount. A reservation counts against its lineage until it is
settled (with reported or conservatively assumed spend) or released (never dispatched). A lineage
is the ticket's cumulative budget; a new run or resumed session joins the same lineage.
"""

from __future__ import annotations

import contextlib
import sqlite3
import uuid
from pathlib import Path

from factory.common import now

SCHEMA = """
create table if not exists lineages (
  id text primary key,
  ticket_id text not null,
  cap_usd real not null,
  created_at real not null
);
create table if not exists runs (
  id text primary key,
  lineage_id text not null references lineages(id),
  ticket_id text not null,
  state text not null,
  base_sha text not null,
  candidate_sha text,
  config_hash text not null,
  stop_reason text,
  repairs integer not null default 0,
  pause_requested integer not null default 0,
  resume_state text,
  mode text not null,
  updated_at real not null
);
create table if not exists reservations (
  id integer primary key autoincrement,
  lineage_id text not null references lineages(id),
  run_id text not null references runs(id),
  role text not null,
  stage text not null,
  reserved_usd real not null,
  spent_usd real,
  spend_basis text,
  status text not null check (status in ('reserved', 'settled', 'released', 'orphaned')),
  created_at real not null
);
create table if not exists dispatches (
  id integer primary key autoincrement,
  run_id text not null references runs(id),
  stage text not null,
  attempt integer not null,
  status text not null check (status in ('started', 'finished', 'failed', 'unknown')),
  reservation_id integer references reservations(id),
  created_at real not null,
  finished_at real,
  unique (run_id, stage, attempt)
);
create table if not exists handoffs (
  id integer primary key autoincrement,
  run_id text not null references runs(id),
  stage text not null,
  provider text not null,
  reason text not null,
  candidate_sha text,
  status text not null check (status in ('open', 'consumed')),
  created_at real not null,
  consumed_at real
);
create table if not exists events (
  id integer primary key autoincrement,
  run_id text not null,
  kind text not null,
  detail text not null,
  ts real not null
);
"""


class BudgetExceeded(Exception):
    pass


class DuplicateDispatch(Exception):
    pass


class Ledger:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        # isolation_level=None: transactions are opened explicitly with BEGIN IMMEDIATE.
        self._conn = sqlite3.connect(self.path, timeout=30, isolation_level=None)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("pragma foreign_keys = on")
        self._conn.execute("pragma journal_mode = wal")
        self._conn.executescript(SCHEMA)

    def close(self) -> None:
        self._conn.close()

    @contextlib.contextmanager
    def _tx(self):
        self._conn.execute("begin immediate")
        try:
            yield self._conn
        except BaseException:
            self._conn.execute("rollback")
            raise
        else:
            self._conn.execute("commit")

    # Lineages (cumulative budgets) -------------------------------------------------------------

    def lineage_for(self, ticket_id: str, cap_usd: float) -> str:
        with self._tx() as c:
            row = c.execute("select id, cap_usd from lineages where ticket_id = ? order by created_at limit 1", (ticket_id,)).fetchone()
            if row:
                return row["id"]
            lineage_id = f"lin-{uuid.uuid4().hex[:12]}"
            c.execute(
                "insert into lineages (id, ticket_id, cap_usd, created_at) values (?, ?, ?, ?)",
                (lineage_id, ticket_id, cap_usd, now()),
            )
            return lineage_id

    def cap(self, lineage_id: str) -> float:
        row = self._conn.execute("select cap_usd from lineages where id = ?", (lineage_id,)).fetchone()
        return float(row["cap_usd"])

    @staticmethod
    def _committed(c: sqlite3.Connection, lineage_id: str) -> float:
        row = c.execute(
            """
            select coalesce(sum(case
                when status = 'settled' then coalesce(spent_usd, reserved_usd)
                when status in ('reserved', 'orphaned') then reserved_usd
                else 0 end), 0) as total
            from reservations where lineage_id = ?
            """,
            (lineage_id,),
        ).fetchone()
        return float(row["total"])

    def committed(self, lineage_id: str) -> float:
        return self._committed(self._conn, lineage_id)

    # Reservations ------------------------------------------------------------------------------

    def reserve(self, lineage_id: str, run_id: str, role: str, stage: str, amount: float, contingency: float) -> int:
        """Admit a dispatch only if worst-case spend plus contingency fits the lineage cap."""
        with self._tx() as c:
            cap = float(c.execute("select cap_usd from lineages where id = ?", (lineage_id,)).fetchone()["cap_usd"])
            committed = self._committed(c, lineage_id)
            if committed + amount + contingency > cap + 1e-9:
                raise BudgetExceeded(
                    f"reserving ${amount:.2f} (+${contingency:.2f} contingency) would exceed the ticket budget: "
                    f"${committed:.2f} already committed of ${cap:.2f}"
                )
            cur = c.execute(
                "insert into reservations (lineage_id, run_id, role, stage, reserved_usd, status, created_at) "
                "values (?, ?, ?, ?, ?, 'reserved', ?)",
                (lineage_id, run_id, role, stage, amount, now()),
            )
            return int(cur.lastrowid)

    def settle(self, reservation_id: int, spent_usd: float | None, basis: str) -> None:
        """Record actual spend. Unknown spend keeps the worst-case reservation and says so."""
        with self._tx() as c:
            row = c.execute("select reserved_usd from reservations where id = ?", (reservation_id,)).fetchone()
            if spent_usd is None:
                spent, label = float(row["reserved_usd"]), "unknown: worst-case reservation kept"
            else:
                spent, label = float(spent_usd), basis
            c.execute(
                "update reservations set status = 'settled', spent_usd = ?, spend_basis = ? where id = ?",
                (spent, label, reservation_id),
            )

    def release(self, reservation_id: int) -> None:
        with self._tx() as c:
            c.execute(
                "update reservations set status = 'released', spent_usd = 0, spend_basis = 'not dispatched' "
                "where id = ? and status = 'reserved'",
                (reservation_id,),
            )

    def orphan_open_reservations(self, run_id: str) -> int:
        """After a crash, open reservations stay counted (conservatively) and are labelled."""
        with self._tx() as c:
            cur = c.execute(
                "update reservations set status = 'orphaned' where run_id = ? and status = 'reserved'",
                (run_id,),
            )
            return cur.rowcount

    def usage(self, lineage_id: str) -> dict:
        rows = self._conn.execute(
            "select status, spend_basis, reserved_usd, spent_usd from reservations where lineage_id = ?",
            (lineage_id,),
        ).fetchall()
        unknown = sum(1 for r in rows if r["spend_basis"] and r["spend_basis"].startswith("unknown"))
        return {
            "cap_usd": self.cap(lineage_id),
            "committed_usd": round(self.committed(lineage_id), 6),
            "reservations": len(rows),
            "unknown_spend_entries": unknown,
            "open_or_orphaned": sum(1 for r in rows if r["status"] in ("reserved", "orphaned")),
        }

    # Dispatches --------------------------------------------------------------------------------

    def next_attempt(self, run_id: str) -> int:
        row = self._conn.execute("select count(*) as n from dispatches where run_id = ?", (run_id,)).fetchone()
        return int(row["n"])

    def start_dispatch(self, run_id: str, stage: str, attempt: int, reservation_id: int) -> None:
        try:
            with self._tx() as c:
                c.execute(
                    "insert into dispatches (run_id, stage, attempt, status, reservation_id, created_at) "
                    "values (?, ?, ?, 'started', ?, ?)",
                    (run_id, stage, attempt, reservation_id, now()),
                )
        except sqlite3.IntegrityError as exc:
            raise DuplicateDispatch(f"{stage} attempt {attempt} was already dispatched for run {run_id}") from exc

    def finish_dispatch(self, run_id: str, stage: str, attempt: int, status: str) -> None:
        with self._tx() as c:
            c.execute(
                "update dispatches set status = ?, finished_at = ? where run_id = ? and stage = ? and attempt = ?",
                (status, now(), run_id, stage, attempt),
            )

    def started_without_outcome(self, run_id: str) -> list[dict]:
        rows = self._conn.execute(
            "select stage, attempt from dispatches where run_id = ? and status = 'started'", (run_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    # Runs --------------------------------------------------------------------------------------

    def create_run(self, run_id: str, lineage_id: str, ticket_id: str, base_sha: str, config_hash: str, mode: str) -> None:
        with self._tx() as c:
            c.execute(
                "insert into runs (id, lineage_id, ticket_id, state, base_sha, config_hash, mode, updated_at) "
                "values (?, ?, ?, 'created', ?, ?, ?, ?)",
                (run_id, lineage_id, ticket_id, base_sha, config_hash, mode, now()),
            )

    def get_run(self, run_id: str) -> dict:
        row = self._conn.execute("select * from runs where id = ?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return dict(row)

    def update_run(self, run_id: str, **fields) -> None:
        if not fields:
            return
        assignments = ", ".join(f"{name} = ?" for name in fields)
        with self._tx() as c:
            c.execute(
                f"update runs set {assignments}, updated_at = ? where id = ?",
                (*fields.values(), now(), run_id),
            )

    def event(self, run_id: str, kind: str, detail: str) -> None:
        with self._tx() as c:
            c.execute("insert into events (run_id, kind, detail, ts) values (?, ?, ?, ?)", (run_id, kind, detail, now()))

    # Handoffs: written before a run pauses for a provider, closed once work resumes ----------

    def write_handoff(self, run_id: str, stage: str, provider: str, reason: str, candidate_sha: str | None) -> int:
        with self._tx() as c:
            cur = c.execute(
                "insert into handoffs (run_id, stage, provider, reason, candidate_sha, status, created_at) "
                "values (?, ?, ?, ?, ?, 'open', ?)",
                (run_id, stage, provider, reason, candidate_sha, now()),
            )
            return int(cur.lastrowid)

    def open_handoffs(self, run_id: str) -> list[dict]:
        rows = self._conn.execute(
            "select * from handoffs where run_id = ? and status = 'open' order by id", (run_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def consume_handoffs(self, run_id: str) -> int:
        with self._tx() as c:
            cur = c.execute(
                "update handoffs set status = 'consumed', consumed_at = ? where run_id = ? and status = 'open'",
                (now(), run_id),
            )
            return cur.rowcount

    def events(self, run_id: str) -> list[dict]:
        rows = self._conn.execute("select kind, detail, ts from events where run_id = ? order by id", (run_id,)).fetchall()
        return [dict(r) for r in rows]

    def reservations(self, run_id: str) -> list[dict]:
        rows = self._conn.execute("select * from reservations where run_id = ? order by id", (run_id,)).fetchall()
        return [dict(r) for r in rows]
