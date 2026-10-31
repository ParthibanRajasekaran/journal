"""Tests for the native attempt model (proposal). Run with:
   python3 -m unittest discover -s docs/factory/proposals/native-auth -p "test_*.py"
Concurrency uses SQLite, which proves single-winner UPDATE semantics only. It does not prove Postgres behaviour."""

import os
import tempfile
import threading
import unittest

from attempt_store import AttemptStore, Claims, Refused


class Clock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


class AttemptTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.clock = Clock()
        self.store = AttemptStore(os.path.join(self.dir, "a.sqlite"), clock=self.clock)

    def tearDown(self):
        self.store._conn.close()

    def token(self, nonce, subject="usr_a"):
        return Claims(nonce=nonce, subject=subject)

    def test_a_token_from_attempt_a_cannot_complete_attempt_b(self):
        a = self.store.create()
        b = self.store.create()
        with self.assertRaisesRegex(Refused, "does not belong"):
            self.store.complete(b["attempt_secret"], self.token(a["nonce"]))
        self.assertEqual(self.store.state_of(b["attempt_secret"]), "pending")  # a mismatch does not burn B

    def test_the_matching_token_completes_its_own_attempt(self):
        a = self.store.create()
        self.assertEqual(self.store.complete(a["attempt_secret"], self.token(a["nonce"])), "usr_a")

    def test_missing_nonce_is_refused(self):
        a = self.store.create()
        with self.assertRaisesRegex(Refused, "no nonce"):
            self.store.complete(a["attempt_secret"], Claims(nonce=None, subject="usr_a"))

    def test_incorrect_attempt_secret_is_refused(self):
        a = self.store.create()
        with self.assertRaisesRegex(Refused, "unknown attempt"):
            self.store.complete("not-a-real-secret", self.token(a["nonce"]))

    def test_an_expired_attempt_is_refused(self):
        a = self.store.create()
        self.clock.now += 301
        with self.assertRaisesRegex(Refused, "expired"):
            self.store.complete(a["attempt_secret"], self.token(a["nonce"]))

    def test_a_consumed_attempt_cannot_be_completed_again(self):
        a = self.store.create()
        self.store.complete(a["attempt_secret"], self.token(a["nonce"]))
        with self.assertRaisesRegex(Refused, "attempt is consumed"):
            self.store.complete(a["attempt_secret"], self.token(a["nonce"]))

    def test_concurrent_completions_consume_the_attempt_exactly_once(self):
        a = self.store.create()
        results = []
        lock = threading.Lock()
        barrier = threading.Barrier(12)

        def attempt():
            store = AttemptStore(os.path.join(self.dir, "a.sqlite"), clock=self.clock)
            barrier.wait()
            try:
                store.complete(a["attempt_secret"], self.token(a["nonce"]))
                outcome = "ok"
            except Refused:
                outcome = "refused"
            finally:
                store._conn.close()
            with lock:
                results.append(outcome)

        threads = [threading.Thread(target=attempt) for _ in range(12)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(results.count("ok"), 1, results)
        self.assertEqual(results.count("refused"), 11, results)

    def test_a_cancelled_attempt_is_refused_and_a_fresh_login_works(self):
        a = self.store.create()
        self.store.cancel(a["attempt_secret"])
        with self.assertRaisesRegex(Refused, "attempt is cancelled"):
            self.store.complete(a["attempt_secret"], self.token(a["nonce"]))
        fresh = self.store.create()
        self.assertEqual(self.store.complete(fresh["attempt_secret"], self.token(fresh["nonce"])), "usr_a")

    def test_a_failed_attempt_is_retried_with_a_new_attempt(self):
        a = self.store.create()
        with self.assertRaises(Refused):
            self.store.complete(a["attempt_secret"], self.token("wrong-nonce"))
        fresh = self.store.create()
        self.assertEqual(self.store.complete(fresh["attempt_secret"], self.token(fresh["nonce"])), "usr_a")

    def test_cancel_after_completion_changes_nothing(self):
        a = self.store.create()
        self.store.complete(a["attempt_secret"], self.token(a["nonce"]))
        self.store.cancel(a["attempt_secret"])
        self.assertEqual(self.store.state_of(a["attempt_secret"]), "consumed")

    def test_a_restored_token_from_a_past_attempt_cannot_bypass_the_current_nonce(self):
        old = self.store.create()
        self.store.complete(old["attempt_secret"], self.token(old["nonce"]))
        current = self.store.create()
        # The SDK restored the earlier sign-in and presents its token, whose nonce is the old one.
        with self.assertRaisesRegex(Refused, "does not belong"):
            self.store.complete(current["attempt_secret"], self.token(old["nonce"]))


if __name__ == "__main__":
    unittest.main()
