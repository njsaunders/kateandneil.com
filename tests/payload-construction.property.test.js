// tests/payload-construction.property.test.js
//
// Property-based test for buildPayload (gift-registry pure functions).
//
// Feature: gift-registry, Property 4: Built payload always identifies the type and preserves all captured fields
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as GiftRegistryModule from '../js/gift-registry.js';

// UMD-style import: API may arrive as the default export (CJS interop) or the namespace.
const api = GiftRegistryModule.default ?? GiftRegistryModule;
const { buildPayload, GIFT_REGISTRY_TYPE } = api;

describe('buildPayload (Property 4)', () => {
  // Feature: gift-registry, Property 4: Built payload always identifies the type and preserves all captured fields
  it('always sets type to "gift-registry-contribution" and preserves every captured field', () => {
    const inputArb = fc.record({
      name: fc.string(),
      email: fc.string(),
      selectedExperiences: fc.array(fc.string()),
      amountOrNote: fc.string(),
      message: fc.string()
    });

    fc.assert(
      fc.property(inputArb, (input) => {
        const payload = buildPayload(input);

        // type is the fixed discriminator (req 8.1, 8.2).
        expect(payload.type).toBe('gift-registry-contribution');
        expect(payload.type).toBe(GIFT_REGISTRY_TYPE);

        // every captured field is preserved exactly (req 8.3).
        expect(payload.name).toStrictEqual(input.name);
        expect(payload.email).toStrictEqual(input.email);
        expect(payload.selectedExperiences).toStrictEqual(input.selectedExperiences);
        expect(payload.amountOrNote).toStrictEqual(input.amountOrNote);
        expect(payload.message).toStrictEqual(input.message);
      }),
      { numRuns: 100 }
    );
  });
});
