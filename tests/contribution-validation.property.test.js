// tests/contribution-validation.property.test.js
//
// Property-based tests for `validateContribution` from js/gift-registry.js.
//
// Feature: gift-registry, Property 2: Contribution validation flags exactly the failing fields and gates submission
//
// Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.2, 7.4, 7.5, 7.6, 7.7
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as GiftRegistryModule from '../js/gift-registry.js';

// UMD-style guard: the API may arrive as the default export (CJS interop) or as
// the namespace itself.
const api = GiftRegistryModule.default ?? GiftRegistryModule;
const { validateContribution } = api;

// ---------------------------------------------------------------------------
// Independent oracle
//
// This re-derives the expected set of failing field keys directly from the
// acceptance-criteria rules, without reusing the implementation's logic, so the
// test does not merely echo the code under test.
//
//   - name:        trimmed length in [1, 100]                  (req 6.1, 7.1)
//   - email:       present (non-whitespace) AND well-formed    (req 6.2, 7.2, 7.3)
//                  well-formed = non-empty local part, exactly one "@",
//                  non-empty domain containing at least one "."
//   - experiences: array with at least one selection           (req 6.3, 7.4)
// ---------------------------------------------------------------------------
function oracleEmailWellFormed(trimmed) {
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length === 0) return false;
  if (domain.length === 0) return false;
  if (domain.indexOf('.') === -1) return false;
  return true;
}

function expectedFailingFields(input) {
  const failing = [];

  const name = typeof input.name === 'string' ? input.name : '';
  const trimmedName = name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    failing.push('name');
  }

  const email = typeof input.email === 'string' ? input.email : '';
  const trimmedEmail = email.trim();
  if (trimmedEmail.length === 0 || !oracleEmailWellFormed(trimmedEmail)) {
    failing.push('email');
  }

  const selected = Array.isArray(input.selectedExperiences)
    ? input.selectedExperiences
    : [];
  if (selected.length < 1) {
    failing.push('experiences');
  }

  return failing.sort();
}

function errorFieldSet(result) {
  return result.errors.map((e) => e.field).sort();
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// A non-whitespace character (so trimmed length is preserved).
const nonWhitespaceChar = fc
  .char()
  .filter((c) => c.trim().length === 1);

// Valid name: 1–100 chars with at least one non-whitespace character so the
// trimmed length lands in [1, 100].
const validName = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => {
    const t = s.trim();
    return t.length >= 1 && t.length <= 100;
  });

// Invalid name: empty or whitespace-only (trims to empty).
const emptyOrWhitespaceName = fc.stringOf(
  fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
  { minLength: 0, maxLength: 10 }
);

// Invalid name: too long (trimmed length > 100). Build from non-whitespace
// characters so trimming cannot shrink it back under the limit.
const tooLongName = fc
  .array(nonWhitespaceChar, { minLength: 101, maxLength: 160 })
  .map((chars) => chars.join(''));

const nameArb = fc.oneof(
  validName,
  emptyOrWhitespaceName,
  tooLongName,
  // Occasionally provide a non-string to exercise defensive handling.
  fc.constantFrom(undefined, null, 42)
);

// Valid email: built so it always satisfies the well-formed rule.
const validEmail = fc
  .tuple(
    fc.stringOf(nonWhitespaceChar.filter((c) => c !== '@' && c !== '.'), {
      minLength: 1,
      maxLength: 12,
    }),
    fc.stringOf(nonWhitespaceChar.filter((c) => c !== '@' && c !== '.'), {
      minLength: 1,
      maxLength: 8,
    }),
    fc.constantFrom('com', 'co.uk', 'org', 'dev', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// Malformed / empty emails covering the failure modes of the rule.
const malformedEmail = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('plainaddress'),
  fc.constant('@nodomain.com'),
  fc.constant('local@'),
  fc.constant('local@nodot'),
  fc.constant('two@@example.com'),
  fc.constant('a@b@c.com'),
  fc.constant('local@.'),
  fc.string({ maxLength: 20 }), // arbitrary text, usually invalid
);

const emailArb = fc.oneof(
  validEmail,
  malformedEmail,
  fc.constantFrom(undefined, null, 7),
);

// Selected experiences: empty (invalid) or non-empty (valid).
const selectedExperiencesArb = fc.oneof(
  fc.constant([]),
  fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
    minLength: 1,
    maxLength: 6,
  }),
  // Non-array values should be treated as "nothing selected".
  fc.constantFrom(undefined, null, 'not-an-array'),
);

const contributionArb = fc.record({
  name: nameArb,
  email: emailArb,
  selectedExperiences: selectedExperiencesArb,
  amountOrNote: fc.string({ maxLength: 50 }),
  message: fc.string({ maxLength: 50 }),
});

// Helpers to produce a guaranteed-valid value for a given field, used by the
// "correcting one field" sub-property.
const validValueForField = {
  name: validName,
  email: validEmail,
  experiences: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
    minLength: 1,
    maxLength: 6,
  }),
};

const fieldToInputKey = {
  name: 'name',
  email: 'email',
  experiences: 'selectedExperiences',
};

// ---------------------------------------------------------------------------
// Property 2
// ---------------------------------------------------------------------------

describe('Property 2: contribution validation flags exactly the failing fields', () => {
  it('error set is empty iff all rules pass, and contains exactly the failing fields otherwise', () => {
    fc.assert(
      fc.property(contributionArb, (input) => {
        const result = validateContribution(input);
        const expected = expectedFailingFields(input);
        const actual = errorFieldSet(result);

        // The returned error set is exactly the set of failing fields — no
        // more, no fewer.
        expect(actual).toEqual(expected);

        // `valid` is true iff the error set is empty.
        expect(result.valid).toBe(expected.length === 0);

        // No duplicate field entries.
        expect(new Set(actual).size).toBe(actual.length);

        // Every error has a non-empty message (req 7.x feedback).
        for (const err of result.errors) {
          expect(typeof err.message).toBe('string');
          expect(err.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('does not mutate the collected input values (submission gated without altering values)', () => {
    fc.assert(
      fc.property(contributionArb, (input) => {
        const snapshot = JSON.stringify(input);
        validateContribution(input);
        // The pure validator must not change the caller's values (req 7.5).
        expect(JSON.stringify(input)).toBe(snapshot);
      }),
      { numRuns: 100 }
    );
  });

  it('correcting one failing field to a valid value removes exactly that field from the error set (req 7.7)', () => {
    fc.assert(
      fc.property(
        contributionArb,
        // Pre-generate a valid replacement for each field; we apply the one
        // matching the chosen failing field.
        validValueForField.name,
        validValueForField.email,
        validValueForField.experiences,
        (input, validNameValue, validEmailValue, validExperiencesValue) => {
          const before = expectedFailingFields(input);

          // Only meaningful when there is at least one failing field to fix.
          fc.pre(before.length > 0);

          // Pick a field that is actually failing and correct it.
          const fieldToFix = before[0];
          const validValues = {
            name: validNameValue,
            email: validEmailValue,
            experiences: validExperiencesValue,
          };

          const corrected = {
            ...input,
            [fieldToInputKey[fieldToFix]]: validValues[fieldToFix],
          };

          const afterSet = new Set(
            errorFieldSet(validateContribution(corrected))
          );

          // The corrected field is now gone from the error set.
          expect(afterSet.has(fieldToFix)).toBe(false);

          // Exactly that field was removed: every other previously-failing
          // field is still failing, and no new fields appeared.
          const expectedAfter = new Set(
            before.filter((f) => f !== fieldToFix)
          );
          expect(afterSet).toEqual(expectedAfter);
        }
      ),
      { numRuns: 100 }
    );
  });
});
