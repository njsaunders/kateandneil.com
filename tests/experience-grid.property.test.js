// tests/experience-grid.property.test.js
//
// Property-based tests for `renderExperiences` from js/gift-registry.js.
//
// Feature: gift-registry, Property 1: Experience grid renders one complete card per experience
//
// Validates: Requirements 4.1, 4.2, 4.3, 4.6
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as GiftRegistryModule from '../js/gift-registry.js';

// UMD-style guard: the API may arrive as the default export (CJS interop) or as
// the namespace itself.
const api = GiftRegistryModule.default ?? GiftRegistryModule;
const { renderExperiences, PLACEHOLDER_IMAGE } = api;

// ---------------------------------------------------------------------------
// Generators
//
// An experience is { id, title, description, image } where title and
// description are non-empty strings, and image is sometimes a usable string,
// sometimes missing/empty/whitespace/undefined so the placeholder branch
// (req 4.3) is exercised.
// ---------------------------------------------------------------------------

// Non-empty, non-whitespace-only text so the rendered textContent is
// meaningful and stable under comparison.
const nonEmptyText = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter((s) => s.trim().length > 0);

// A usable image source: a non-whitespace string (the implementation keeps it
// verbatim as the `src`).
const usableImage = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0);

// Image sources that should fall back to the placeholder image.
const missingImage = fc.constantFrom(undefined, null, '', '   ', '\t', '\n', 0, 42);

const imageArb = fc.oneof(
  { weight: 2, arbitrary: usableImage },
  { weight: 1, arbitrary: missingImage }
);

const experienceArb = fc.record({
  id: fc.oneof(fc.string({ minLength: 1, maxLength: 8 }), fc.integer({ min: 0, max: 9999 })),
  title: nonEmptyText,
  description: nonEmptyText,
  image: imageArb,
});

const experienceListArb = fc.array(experienceArb, { minLength: 0, maxLength: 8 });

// Mirror the implementation's fallback rule without reusing its code: a usable
// image source is a string with non-whitespace content; everything else falls
// back to the placeholder.
function expectedSrc(image) {
  return typeof image === 'string' && image.trim().length > 0
    ? image
    : PLACEHOLDER_IMAGE;
}

// ---------------------------------------------------------------------------
// Property 1
// ---------------------------------------------------------------------------

describe('Property 1: experience grid renders one complete card per experience', () => {
  it('renders exactly one complete card per experience with title, alt-including image, and description', () => {
    fc.assert(
      fc.property(experienceListArb, (experiences) => {
        const container = document.createElement('div');

        const result = renderExperiences(container, experiences);

        // The container is returned for chaining.
        expect(result).toBe(container);

        const cards = container.querySelectorAll('.experience-card');

        // Exactly one card per experience (req 4.1, 4.2).
        expect(cards.length).toBe(experiences.length);

        experiences.forEach((exp, index) => {
          const card = cards[index];
          expect(card).toBeTruthy();

          const titleEl = card.querySelector('.experience-title');
          const descEl = card.querySelector('.experience-description');
          const imgEls = card.querySelectorAll('img');

          // Title and description text are present (req 4.2).
          expect(titleEl).toBeTruthy();
          expect(titleEl.textContent).toBe(exp.title);

          expect(descEl).toBeTruthy();
          expect(descEl.textContent).toBe(exp.description);

          // Exactly one image per card whose alt includes the title (req 4.6).
          expect(imgEls.length).toBe(1);
          const img = imgEls[0];
          expect(img.getAttribute('alt')).toContain(exp.title);

          // Missing/empty image sources fall back to the placeholder (req 4.3).
          expect(img.getAttribute('src')).toBe(expectedSrc(exp.image));
        });
      }),
      { numRuns: 100 }
    );
  });

  it('is idempotent: re-rendering replaces rather than appends cards', () => {
    fc.assert(
      fc.property(experienceListArb, experienceListArb, (first, second) => {
        const container = document.createElement('div');

        renderExperiences(container, first);
        renderExperiences(container, second);

        // After the second render only the second list's cards remain.
        const cards = container.querySelectorAll('.experience-card');
        expect(cards.length).toBe(second.length);
      }),
      { numRuns: 100 }
    );
  });
});
