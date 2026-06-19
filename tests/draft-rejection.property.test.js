// tests/draft-rejection.property.test.js
//
// Feature: gift-registry, Property 6: Stale or invalid drafts are rejected
//
// For any draft whose `savedAt` timestamp is older than 30 days, and for any
// string that is not parseable as a valid draft, `deserializeDraft` returns a
// not-ok result (signalling the caller to discard the stored draft and load
// empty fields).
//
// Validates: Requirements 10.3
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as GiftRegistryModule from '../js/gift-registry.js';

const api = GiftRegistryModule.default ?? GiftRegistryModule;
const { serializeDraft, deserializeDraft, DRAFT_MAX_AGE_MS } = api;

const NUM_RUNS = { numRuns: 100 };

// A generator for the arbitrary "data" payload captured in a draft.
const draftDataArb = fc.record({
  name: fc.string(),
  email: fc.string(),
  selectedExperiences: fc.array(fc.string()),
  amountOrNote: fc.string(),
  message: fc.string()
});

describe('Property 6: stale or invalid drafts are rejected', () => {
  // (1) Valid serialized drafts whose savedAt is older than 30 days relative to
  //     the supplied "now" must be rejected.
  it('rejects drafts with a savedAt older than 30 days', () => {
    fc.assert(
      fc.property(
        // A realistic "now" (kept well above the 30-day window so savedAt stays
        // a sensible non-negative epoch-ms value).
        fc.integer({ min: DRAFT_MAX_AGE_MS, max: 4_000_000_000_000 }),
        // How far beyond the freshness window the draft was saved (> 30 days).
        fc.integer({ min: 1, max: 10_000_000_000 }),
        draftDataArb,
        (nowMs, staleOffset, data) => {
          const savedAt = nowMs - DRAFT_MAX_AGE_MS - staleOffset;
          const serialized = serializeDraft(data, savedAt);
          const result = deserializeDraft(serialized, nowMs);
          expect(result.ok).toBe(false);
        }
      ),
      NUM_RUNS
    );
  });

  // (2a) Arbitrary strings that are not parseable as JSON must be rejected.
  it('rejects arbitrary non-JSON strings', () => {
    const nonJsonString = fc.string().filter((s) => {
      try {
        JSON.parse(s);
        return false; // keep only strings that fail to parse
      } catch (e) {
        return true;
      }
    });

    fc.assert(
      fc.property(nonJsonString, fc.integer({ min: 0, max: 4_000_000_000_000 }), (s, nowMs) => {
        const result = deserializeDraft(s, nowMs);
        expect(result.ok).toBe(false);
      }),
      NUM_RUNS
    );
  });

  // (2b) Strings that parse as JSON but do not have a valid draft shape must be
  //      rejected. Each constructor below is guaranteed to violate at least one
  //      draft rule, so none can accidentally produce a valid fresh draft.
  it('rejects JSON that is not a valid draft shape', () => {
    const freshSavedAt = fc.integer({ min: 0, max: 4_000_000_000_000 });

    const invalidShape = fc.oneof(
      // Missing savedAt entirely.
      draftDataArb.map((data) => JSON.stringify({ data })),
      // savedAt present but not a number.
      fc.tuple(fc.string(), draftDataArb).map(([savedAt, data]) =>
        JSON.stringify({ savedAt, data })
      ),
      // Fresh, numeric savedAt but no data object.
      freshSavedAt.map((savedAt) => JSON.stringify({ savedAt })),
      // Fresh, numeric savedAt but data is an array, not an object.
      fc.tuple(freshSavedAt, fc.array(fc.string())).map(([savedAt, data]) =>
        JSON.stringify({ savedAt, data })
      ),
      // Top-level JSON array.
      fc.array(fc.string()).map((arr) => JSON.stringify(arr)),
      // Top-level JSON primitives.
      fc.integer().map((n) => JSON.stringify(n)),
      fc.string().map((s) => JSON.stringify(s)),
      fc.boolean().map((b) => JSON.stringify(b)),
      fc.constant('null')
    );

    fc.assert(
      fc.property(invalidShape, fc.integer({ min: 0, max: 4_000_000_000_000 }), (s, nowMs) => {
        const result = deserializeDraft(s, nowMs);
        expect(result.ok).toBe(false);
      }),
      NUM_RUNS
    );
  });
});
