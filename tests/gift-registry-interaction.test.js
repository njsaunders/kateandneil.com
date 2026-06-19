// tests/gift-registry-interaction.test.js
//
// Unit / example tests for the impure DOM-wiring layer of js/gift-registry.js
// (Task 5.2). These cover the submit interaction states and the draft
// lifecycle, driving the real module against the real gift-registry.html body
// in jsdom with a mocked global `fetch` and (where relevant) a mocked
// `localStorage`.
//
// Validates: Requirements 4.7, 8.1, 8.4, 8.5, 8.6, 8.7, 10.4, 10.5
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as GiftRegistryModule from '../js/gift-registry.js';

// UMD interop: the API may arrive as the default export (CJS interop) or as the
// namespace itself (matches the smoke test convention).
const GiftRegistry = GiftRegistryModule.default ?? GiftRegistryModule;

const HTML_PATH = resolve(process.cwd(), 'gift-registry.html');
const FULL_HTML = readFileSync(HTML_PATH, 'utf8');

// Snapshot the placeholder experiences so tests that mutate the shared array
// (the empty-grid case) can restore it afterwards.
const ORIGINAL_EXPERIENCES = GiftRegistry.experiences.slice();

// ----- helpers ---------------------------------------------------------

// Resolve all pending microtasks (e.g. the awaited fetch + response.json
// chain inside handleSubmit) by waiting one macrotask.
const flush = () => new Promise((r) => setTimeout(r, 0));

function loadBody() {
  const parsed = new DOMParser().parseFromString(FULL_HTML, 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
}

function okResponse(body = { ok: true, id: 'generated-id' }) {
  return { ok: true, status: 200, json: async () => body };
}

function errorResponse(status = 500, body = { ok: false, error: 'Server says no' }) {
  return { ok: false, status, json: async () => body };
}

function fillValid() {
  document.getElementById('name').value = 'Jane Guest';
  document.getElementById('email').value = 'jane@example.com';
  const choice = document.querySelector('.experience-choice');
  choice.checked = true;
  return choice.value;
}

function submitForm() {
  const form = document.getElementById('giftForm');
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

function formErrorVisible() {
  const el = document.getElementById('formError');
  return el && !el.classList.contains('d-none');
}

beforeAll(() => {
  // Confirm the test target exposes the wiring entry point + constants we rely
  // on; gives a clearer failure than a later undefined access.
  expect(typeof GiftRegistry.init).toBe('function');
  expect(typeof GiftRegistry.SUBMIT_ENDPOINT).toBe('string');
  expect(typeof GiftRegistry.DRAFT_KEY).toBe('string');
});

beforeEach(() => {
  loadBody();
  try {
    window.localStorage.clear();
  } catch (e) {
    /* ignore */
  }
  // Default fetch stub; individual tests override as needed.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse())));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Restore the shared experiences array in case a test emptied it.
  GiftRegistry.experiences.splice(
    0,
    GiftRegistry.experiences.length,
    ...ORIGINAL_EXPERIENCES
  );
  try {
    window.localStorage.clear();
  } catch (e) {
    /* ignore */
  }
});

describe('valid submit POSTs exactly one Contribution_Payload (Req 8.1)', () => {
  it('sends a single JSON POST to the submit endpoint with the captured fields', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal('fetch', fetchMock);

    GiftRegistry.init(document);
    const selectedId = fillValid();
    submitForm();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(GiftRegistry.SUBMIT_ENDPOINT);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const payload = JSON.parse(options.body);
    expect(payload.type).toBe('gift-registry-contribution');
    expect(payload.name).toBe('Jane Guest');
    expect(payload.email).toBe('jane@example.com');
    expect(payload.selectedExperiences).toEqual([selectedId]);
  });

  it('does not submit (no POST) when validation fails, retaining entered values (Req 8.1)', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal('fetch', fetchMock);

    GiftRegistry.init(document);
    // Name + email present but no experience selected => invalid.
    document.getElementById('name').value = 'Jane Guest';
    document.getElementById('email').value = 'jane@example.com';
    submitForm();
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(formErrorVisible()).toBe(true);
    expect(document.getElementById('name').value).toBe('Jane Guest');
    expect(document.getElementById('email').value).toBe('jane@example.com');
  });
});

describe('in-flight guard ignores repeat submits (Req 8.4)', () => {
  it('only fires one request while a submission is pending', async () => {
    let resolveFetch;
    const pending = new Promise((res) => {
      resolveFetch = res;
    });
    const fetchMock = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetchMock);

    GiftRegistry.init(document);
    fillValid();

    // Two rapid submits while the first request is still in flight.
    submitForm();
    submitForm();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Resolve so the 30s abort timer is cleared and the promise settles.
    resolveFetch(okResponse());
    await flush();
  });
});

describe('successful submit confirms and clears the draft (Req 8.5, 10.4)', () => {
  it('shows a thank-you message and removes the stored draft', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse())));

    GiftRegistry.init(document);
    fillValid();

    // Seed a stored draft so we can assert it is removed on success (10.4).
    window.localStorage.setItem(
      GiftRegistry.DRAFT_KEY,
      GiftRegistry.serializeDraft({ name: 'Jane Guest' })
    );
    expect(window.localStorage.getItem(GiftRegistry.DRAFT_KEY)).not.toBeNull();

    submitForm();
    await flush();

    // Confirmation message replaces the form contents (8.5).
    const form = document.getElementById('giftForm');
    expect(form.textContent.toLowerCase()).toMatch(/thank you/);
    expect(form.querySelector('.alert-success')).toBeTruthy();

    // Draft removed on success (10.4).
    expect(window.localStorage.getItem(GiftRegistry.DRAFT_KEY)).toBeNull();
  });
});

describe('non-OK response restores the editable state (Req 8.6)', () => {
  it('shows an error, re-enables submit, and retains entered values', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(errorResponse(500))));

    GiftRegistry.init(document);
    fillValid();
    submitForm();
    await flush();

    // Form is still editable (not replaced with the thank-you message).
    const form = document.getElementById('giftForm');
    expect(document.getElementById('name')).toBeTruthy();
    expect(form.textContent.toLowerCase()).not.toMatch(/thank you/);

    // Submit control re-enabled.
    const submitBtn = form.querySelector('button[type="submit"]');
    expect(submitBtn.disabled).toBe(false);

    // Entered values retained.
    expect(document.getElementById('name').value).toBe('Jane Guest');
    expect(document.getElementById('email').value).toBe('jane@example.com');

    // Error surfaced, using the server-provided message when present.
    expect(formErrorVisible()).toBe(true);
    expect(document.getElementById('formError').textContent).toMatch(/Server says no/);
  });
});

describe('network error / timeout restores the editable state (Req 8.7)', () => {
  it('handles a rejected fetch (network error) by showing an error and retaining values', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network down'))));

    GiftRegistry.init(document);
    fillValid();
    submitForm();
    await flush();

    const form = document.getElementById('giftForm');
    expect(document.getElementById('name')).toBeTruthy();
    expect(form.textContent.toLowerCase()).not.toMatch(/thank you/);
    expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
    expect(document.getElementById('name').value).toBe('Jane Guest');
    expect(formErrorVisible()).toBe(true);
    expect(document.getElementById('formError').textContent).toMatch(/something went wrong/i);
  });

  it('aborts and recovers when no response arrives within the timeout window', async () => {
    vi.useFakeTimers();
    // Resolve/reject only when the request is aborted (simulates a hung request
    // that the 30s AbortController timeout cancels).
    const fetchMock = vi.fn(
      (url, opts) =>
        new Promise((_, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    GiftRegistry.init(document);
    fillValid();
    submitForm();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the timeout so the AbortController fires; this also flushes
    // the microtasks for the catch/finally path.
    await vi.advanceTimersByTimeAsync(GiftRegistry.SUBMIT_TIMEOUT_MS);

    const form = document.getElementById('giftForm');
    expect(document.getElementById('name')).toBeTruthy();
    expect(form.textContent.toLowerCase()).not.toMatch(/thank you/);
    expect(form.querySelector('button[type="submit"]').disabled).toBe(false);
    expect(document.getElementById('name').value).toBe('Jane Guest');
    expect(formErrorVisible()).toBe(true);

    vi.useRealTimers();
  });
});

describe('empty experience list shows the empty message (Req 4.7)', () => {
  it('hides the grid and reveals the empty-state message', () => {
    // Empty the shared experiences array before wiring the page.
    GiftRegistry.experiences.splice(0, GiftRegistry.experiences.length);

    GiftRegistry.init(document);

    const grid = document.getElementById('experienceGrid');
    const empty = document.getElementById('experienceEmpty');
    expect(grid.classList.contains('d-none')).toBe(true);
    expect(empty.classList.contains('d-none')).toBe(false);
  });
});

describe('localStorage throwing is a silent no-op (Req 10.5)', () => {
  it('still accepts input and allows submission when storage throws', async () => {
    const throwingStorage = {
      getItem() {
        throw new Error('storage unavailable');
      },
      setItem() {
        throw new Error('storage unavailable');
      },
      removeItem() {
        throw new Error('storage unavailable');
      },
      clear() {},
    };
    vi.stubGlobal('localStorage', throwingStorage);
    const fetchMock = vi.fn(() => Promise.resolve(okResponse()));
    vi.stubGlobal('fetch', fetchMock);

    // init runs restoreDraft -> getItem throws; must be swallowed.
    expect(() => GiftRegistry.init(document)).not.toThrow();

    fillValid();

    // Trigger the debounced autosave so setItem (which throws) runs and is
    // swallowed; fake timers fire the debounce window.
    vi.useFakeTimers();
    document.getElementById('name').dispatchEvent(new Event('input', { bubbles: true }));
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    vi.useRealTimers();

    // Submission still works end-to-end.
    submitForm();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const form = document.getElementById('giftForm');
    expect(form.textContent.toLowerCase()).toMatch(/thank you/);
  });
});
