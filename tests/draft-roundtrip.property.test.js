// tests/draft-roundtrip.property.test.js
//
// Property-based test for draft serialization round-tripping (Task 2.5).
//
// Feature: gift-registry, Property 5: Draft serialization round-trips within the freshness window
//
// Validates: Requirements 10.1, 10.2
import { describe, it, expect } from 'vitest';
import * as GiftRegistryModule from '../js/gift-registry.js';
import fc from 'fast-check';

// UMD-style module: the API may arrive as the default export (CJS interop) or
// as the namespace itself.
const api = GiftRegistryModule.default ?? GiftRegistryModule;
const { serializeDraft, deserializeDraft, DRAFT_MAX_AGE_MS } = api;

// A draft input is the collected Contribution_Form values. We generate
// JSON-safe values (strings and arrays of strings) so that the
// JSON.stringify -> JSON.parse round trip preserves deep equality, isolating
// the property under test from JSON's own lossy cases (undefined, NaN, etc.).
const draftDataArb = fc.record({
  name: fc.string(),
  email: fc.string(),
  selectedExperiences: fc.array(fc.string()),
  amountOrNote: fc.string(),
  message: fc.string()
});

describe('Property 5: Draft serialization round-trips within the freshness window', () => {
  it('deserializing the serialization of an input (savedAt within 30 days) yields equal draft data', () => {
    fc.assert(
      fc.property(
        draftDataArb,
        // A reference "now" timestamp (kept positive and realistic).
        fc.integer({ min: DRAFT_MAX_AGE_MS, max: 4_102_444_800_000 }),
        // How long ago the draft was saved, constrained to the freshness window.
        fc.integer({ min: 0, max: DRAFT_MAX_AGE_MS }),
        (input, nowMs, ageMs) => {
          const savedAt = nowMs - ageMs; // within the last 30 days of nowMs

          const json = serializeDraft(input, savedAt);
          const result = deserializeDraft(json, nowMs);

          // A fresh draft must be accepted (req 10.2)...
          expect(result.ok).toBe(true);
          // ...and the round-tripped data must equal the original input (req 10.1).
          expect(result.draft).toEqual(input);
        }
      ),
      { numRuns: 100 }
    );
  });
});
