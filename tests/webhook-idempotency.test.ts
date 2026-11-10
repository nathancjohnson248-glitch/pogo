// Contract tests for the webhook processing flow against a simulated
// PostgREST layer. They encode the invariants the Photon route depends on:
// duplicate events are ignored, the claim is exclusive, stale leases are
// reclaimable, and duplicate provider message ids never throw.
import { test } from "node:test";
import assert from "node:assert/strict";

type EventRow = {
  provider: string;
  provider_event_id: string;
  processed_at: string | null;
  processing_started_at: string | null;
  attempts: number;
};

class FakeEventsTable {
  rows: EventRow[] = [];

  // POST ... on_conflict=provider,provider_event_id + ignore-duplicates
  insertIgnoreDuplicates(provider: string, id: string): EventRow[] {
    if (this.rows.some((r) => r.provider === provider && r.provider_event_id === id)) return [];
    const row: EventRow = { provider, provider_event_id: id, processed_at: null, processing_started_at: null, attempts: 0 };
    this.rows.push(row);
    return [row];
  }

  // PATCH ... processed_at=is.null & (lease null or expired) — atomic claim
  claim(provider: string, id: string, leaseCutoffMs: number, nowMs: number): EventRow[] {
    const row = this.rows.find((r) => r.provider === provider && r.provider_event_id === id);
    if (!row || row.processed_at !== null) return [];
    const started = row.processing_started_at ? Date.parse(row.processing_started_at) : null;
    if (started !== null && started >= leaseCutoffMs) return [];
    row.processing_started_at = new Date(nowMs).toISOString();
    return [row];
  }

  markProcessed(provider: string, id: string, nowMs: number) {
    const row = this.rows.find((r) => r.provider === provider && r.provider_event_id === id);
    if (row) row.processed_at = new Date(nowMs).toISOString();
  }

  release(provider: string, id: string, error: string) {
    const row = this.rows.find((r) => r.provider === provider && r.provider_event_id === id);
    if (row) {
      row.processing_started_at = null;
      row.attempts += 1;
    }
  }
}

class FakeMessagesTable {
  rows = new Map<string, { direction: string }>();

  // POST ... on_conflict=provider_message_id + ignore-duplicates
  insertIgnoreDuplicates(providerMessageId: string, direction: string): boolean {
    if (this.rows.has(providerMessageId)) return false;
    this.rows.set(providerMessageId, { direction });
    return true;
  }
}

const NOW = 1_762_750_000_000;
const LEASE_MS = 5 * 60 * 1000;

test("a replayed event insert is ignored, not an error", () => {
  const events = new FakeEventsTable();
  assert.equal(events.insertIgnoreDuplicates("photon", "evt_1").length, 1);
  assert.equal(events.insertIgnoreDuplicates("photon", "evt_1").length, 0);
  assert.equal(events.rows.length, 1);
});

test("only one of two concurrent deliveries wins the claim", () => {
  const events = new FakeEventsTable();
  events.insertIgnoreDuplicates("photon", "evt_1");
  const a = events.claim("photon", "evt_1", NOW - LEASE_MS, NOW);
  const b = events.claim("photon", "evt_1", NOW - LEASE_MS, NOW);
  assert.equal(a.length, 1);
  assert.equal(b.length, 0);
});

test("a processed event can never be claimed again", () => {
  const events = new FakeEventsTable();
  events.insertIgnoreDuplicates("photon", "evt_1");
  events.claim("photon", "evt_1", NOW - LEASE_MS, NOW);
  events.markProcessed("photon", "evt_1", NOW);
  const later = NOW + 2 * LEASE_MS;
  assert.equal(events.claim("photon", "evt_1", later - LEASE_MS, later).length, 0);
});

test("a crashed attempt's stale lease is reclaimable after expiry", () => {
  const events = new FakeEventsTable();
  events.insertIgnoreDuplicates("photon", "evt_1");
  events.claim("photon", "evt_1", NOW - LEASE_MS, NOW);
  // Crash: lease never released, processed_at never set.
  const tooSoon = NOW + 60_000;
  assert.equal(events.claim("photon", "evt_1", tooSoon - LEASE_MS, tooSoon).length, 0);
  const afterExpiry = NOW + LEASE_MS + 1_000;
  assert.equal(events.claim("photon", "evt_1", afterExpiry - LEASE_MS, afterExpiry).length, 1);
});

test("an explicitly released failure is immediately retryable and counted", () => {
  const events = new FakeEventsTable();
  events.insertIgnoreDuplicates("photon", "evt_1");
  events.claim("photon", "evt_1", NOW - LEASE_MS, NOW);
  events.release("photon", "evt_1", "composio 400");
  const retryAt = NOW + 1_000;
  assert.equal(events.claim("photon", "evt_1", retryAt - LEASE_MS, retryAt).length, 1);
  assert.equal(events.rows[0].attempts, 1);
});

test("replaying an inbound message id is a no-op, and the reply guard holds", () => {
  const messages = new FakeMessagesTable();
  assert.equal(messages.insertIgnoreDuplicates("pho_msg_1", "inbound"), true);
  // Retry after a mid-flight failure: same message id arrives again.
  assert.equal(messages.insertIgnoreDuplicates("pho_msg_1", "inbound"), false);
  // First attempt sent the reply but crashed before marking the event done.
  assert.equal(messages.insertIgnoreDuplicates("pogo-reply-pho_msg_1", "outbound"), true);
  // The retry sees the reply exists and must not send a second one.
  assert.equal(messages.rows.has("pogo-reply-pho_msg_1"), true);
  assert.equal(messages.insertIgnoreDuplicates("pogo-reply-pho_msg_1", "outbound"), false);
});
