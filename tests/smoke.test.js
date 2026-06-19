// tests/smoke.test.js
//
// Smoke test for the front-end test harness (Vitest + jsdom + fast-check).
// It confirms the tooling is wired up correctly and that the (initially empty)
// gift-registry module can be imported by tests. Functional behaviour is
// covered by later tasks.
import { describe, it, expect } from 'vitest';
import * as GiftRegistryModule from '../js/gift-registry.js';

describe('test harness smoke test', () => {
  it('imports the gift-registry module exports', () => {
    // The module uses a UMD-style guard, so its API may arrive as the default
    // export (CJS interop) or as the namespace itself.
    const api = GiftRegistryModule.default ?? GiftRegistryModule;
    expect(api).toBeTypeOf('object');
    expect(api).not.toBeNull();
  });

  it('runs in a jsdom (DOM) environment', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
    const el = document.createElement('div');
    el.textContent = 'hello';
    expect(el.textContent).toBe('hello');
  });

  it('has fast-check available for property-based tests', async () => {
    const fc = await import('fast-check');
    expect(typeof fc.assert).toBe('function');
    expect(typeof fc.property).toBe('function');
  });
});
