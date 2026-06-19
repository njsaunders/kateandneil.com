// tests/email-format.property.test.js
//
// Feature: gift-registry, Property 3: Email format acceptance matches the specified rule
//
// Property 3 (design.md): For any string, `isValidEmail` returns true if and
// only if the string has a non-empty local part, exactly one "@" separator,
// and a non-empty domain part containing at least one "." separator.
//
// Validates: Requirements 7.3
//
// Note: `isValidEmail` does NOT trim its input, so the expected boolean is
// re-derived below from the literal rule applied to the raw string.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as GiftRegistryModule from '../js/gift-registry.js';

const api = GiftRegistryModule.default ?? GiftRegistryModule;
const { isValidEmail } = api;

/**
 * Independent re-derivation of the Property 3 rule, written directly from the
 * specification text rather than from the implementation:
 *   - exactly one "@" separator (so splitting on "@" yields exactly two parts)
 *   - a non-empty local part (text before the "@")
 *   - a non-empty domain part (text after the "@") that contains at least one "."
 * No trimming is performed, matching the documented behaviour of isValidEmail.
 */
function expectedValid(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false; // exactly one "@"
  const [local, domain] = parts;
  if (local.length === 0) return false; // non-empty local part
  if (domain.length === 0) return false; // non-empty domain part
  if (!domain.includes('.')) return false; // at least one "."
  return true;
}

// --- Generators --------------------------------------------------------

// Characters that never include "@", so generated parts don't accidentally
// introduce extra separators.
const noAtString = fc.string().filter((s) => !s.includes('@'));
const nonEmptyNoAtString = noAtString.filter((s) => s.length > 0);

// A well-formed email: non-empty local, "@", non-empty domain containing a dot.
const validEmail = fc
  .tuple(
    nonEmptyNoAtString, // local
    nonEmptyNoAtString, // domain label before dot
    nonEmptyNoAtString // domain label after dot
  )
  .map(([local, a, b]) => `${local}@${a}.${b}`);

// Malformed variants exercising each failure mode of the rule.
const noAt = noAtString; // zero "@"
const multipleAt = fc
  .tuple(nonEmptyNoAtString, nonEmptyNoAtString, nonEmptyNoAtString)
  .map(([a, b, c]) => `${a}@${b}@${c}`); // two "@"
const emptyLocal = nonEmptyNoAtString.map((domain) => `@${domain}.com`); // no local part
const emptyDomain = nonEmptyNoAtString.map((local) => `${local}@`); // no domain part
const domainNoDot = fc
  .tuple(nonEmptyNoAtString, nonEmptyNoAtString.filter((s) => !s.includes('.')))
  .map(([local, domain]) => `${local}@${domain}`); // domain without "."

// A grab-bag generator that mixes valid emails, each malformed shape, and fully
// arbitrary strings (which may or may not contain "@" and ".").
const mixedEmail = fc.oneof(
  validEmail,
  noAt,
  multipleAt,
  emptyLocal,
  emptyDomain,
  domainNoDot,
  fc.string() // arbitrary, includes empty string and odd characters
);

// --- Property ----------------------------------------------------------

describe('Property 3: isValidEmail matches the specified format rule', () => {
  it('returns true iff non-empty local, exactly one "@", non-empty domain with a "."', () => {
    fc.assert(
      fc.property(mixedEmail, (value) => {
        expect(isValidEmail(value)).toBe(expectedValid(value));
      }),
      { numRuns: 100 }
    );
  });

  // Sanity anchors for the two halves of the iff, so a trivially-constant
  // implementation can't pass the property by accident.
  it('accepts clearly valid emails', () => {
    fc.assert(
      fc.property(validEmail, (value) => {
        expect(isValidEmail(value)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects each malformed shape', () => {
    fc.assert(
      fc.property(
        fc.oneof(noAt, multipleAt, emptyLocal, emptyDomain, domainNoDot),
        (value) => {
          expect(isValidEmail(value)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
