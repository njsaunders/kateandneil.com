// js/gift-registry.js
//
// Gift registry page logic for kateandneil.com.
//
// This module separates pure, testable functions (validation, payload
// construction, draft serialization, experience rendering) from the impure DOM
// wiring layer (added in task 5.1). The pure functions are exported so they can
// be imported by the Vitest + fast-check property tests.
//
// Loading model (UMD-style): the same file works both as a non-module browser
// <script> (attaching the public API to `window.GiftRegistry`) and as a module
// imported by the Vitest test harness (via `module.exports`).
(function (root, factory) {
  'use strict';
  const api = factory();

  // Node / Vitest (CommonJS) consumers.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // Browser <script> consumers.
  if (root) {
    root.GiftRegistry = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ----- Constants -------------------------------------------------------

  // Fixed payload discriminator that lets the form-handler tell gift-registry
  // contributions apart from RSVP submissions (requirement 8.2).
  const GIFT_REGISTRY_TYPE = 'gift-registry-contribution';

  // Image substituted when an experience has no usable image source
  // (requirement 4.3).
  const PLACEHOLDER_IMAGE = 'images/placeholder.jpg';

  // Draft freshness window: drafts older than this are discarded (req 10.3).
  const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  // Field length bounds (requirements 6.1).
  const NAME_MIN = 1;
  const NAME_MAX = 100;

  // ----- Helpers ---------------------------------------------------------

  function asString(value) {
    return typeof value === 'string' ? value : '';
  }

  // ----- Pure functions --------------------------------------------------

  /**
   * Email format check mirroring requirement 7.3:
   * a non-empty local part, exactly one "@" separator, and a non-empty domain
   * part containing at least one "." separator.
   *
   * No trimming is performed here so the result reflects the literal rule;
   * callers that want to ignore surrounding whitespace should trim first.
   *
   * @param {string} value
   * @returns {boolean}
   */
  function isValidEmail(value) {
    if (typeof value !== 'string') return false;
    const parts = value.split('@');
    if (parts.length !== 2) return false; // exactly one "@"
    const local = parts[0];
    const domain = parts[1];
    if (local.length === 0) return false; // non-empty local part
    if (domain.length === 0) return false; // non-empty domain part
    if (domain.indexOf('.') === -1) return false; // at least one "."
    return true;
  }

  /**
   * Validate a collected contribution input without touching the DOM
   * (requirements 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.6).
   *
   * Produces exactly one error entry for every field that violates its rule and
   * no others. A field is valid when:
   *   - name: trimmed length is between 1 and 100 (non-whitespace)
   *   - email: present (non-whitespace) and well-formed per isValidEmail
   *   - experiences: at least one experience selected
   *
   * @param {{ name?: string, email?: string, selectedExperiences?: string[],
   *   amountOrNote?: string, message?: string }} input
   * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
   */
  function validateContribution(input) {
    const data = input || {};
    const errors = [];

    // Name (req 6.1, 7.1)
    const trimmedName = asString(data.name).trim();
    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      errors.push({
        field: 'name',
        message: 'Please enter your name (1–100 characters).'
      });
    }

    // Email (req 6.2, 7.2, 7.3) — a single entry whether missing or malformed.
    const trimmedEmail = asString(data.email).trim();
    if (trimmedEmail.length === 0) {
      errors.push({
        field: 'email',
        message: 'Please enter your email address.'
      });
    } else if (!isValidEmail(trimmedEmail)) {
      errors.push({
        field: 'email',
        message: 'Please enter a valid email address.'
      });
    }

    // Experience selection (req 6.3, 7.4)
    const selected = Array.isArray(data.selectedExperiences)
      ? data.selectedExperiences
      : [];
    if (selected.length < 1) {
      errors.push({
        field: 'experiences',
        message: 'Please select at least one experience.'
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Build the wire payload (Contribution_Payload) from collected form values
   * (requirements 8.1, 8.2, 8.3). The `type` is always the fixed discriminator;
   * every captured field is preserved as-is.
   *
   * @param {{ name?: string, email?: string, selectedExperiences?: string[],
   *   amountOrNote?: string, message?: string }} input
   * @returns {object}
   */
  function buildPayload(input) {
    const data = input || {};
    return {
      type: GIFT_REGISTRY_TYPE,
      name: data.name,
      email: data.email,
      selectedExperiences: data.selectedExperiences,
      amountOrNote: data.amountOrNote,
      message: data.message
    };
  }

  /**
   * Serialize a contribution input into a JSON draft string with a `savedAt`
   * epoch-ms timestamp (requirement 10.1).
   *
   * @param {object} input - collected form values
   * @param {number} [nowMs] - optional timestamp override (defaults to now)
   * @returns {string} JSON string of the shape { savedAt, data }
   */
  function serializeDraft(input, nowMs) {
    const savedAt = typeof nowMs === 'number' && isFinite(nowMs)
      ? nowMs
      : Date.now();
    return JSON.stringify({ savedAt: savedAt, data: input });
  }

  /**
   * Deserialize a stored draft string (requirements 10.2, 10.3).
   * Returns { ok: true, draft } only when the string parses to a draft object
   * with a numeric `savedAt` within the previous 30 days; otherwise
   * { ok: false } so the caller can discard the stored draft.
   *
   * @param {string} jsonString
   * @param {number} [nowMs] - optional "now" override (defaults to now)
   * @returns {{ ok: true, draft: object } | { ok: false }}
   */
  function deserializeDraft(jsonString, nowMs) {
    const now = typeof nowMs === 'number' && isFinite(nowMs) ? nowMs : Date.now();

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return { ok: false };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false };
    }

    const savedAt = parsed.savedAt;
    if (typeof savedAt !== 'number' || !isFinite(savedAt)) {
      return { ok: false };
    }

    // Reject drafts older than the freshness window (req 10.3).
    if (now - savedAt > DRAFT_MAX_AGE_MS) {
      return { ok: false };
    }

    const draft = parsed.data;
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return { ok: false };
    }

    return { ok: true, draft: draft };
  }

  /**
   * Render the experience grid into `container` (requirements 4.1, 4.2, 4.3,
   * 4.6). Produces exactly one card per experience, each containing the title,
   * an <img> whose alt text includes the title, and the description.
   * Experiences whose image source is missing or empty use the placeholder
   * image instead.
   *
   * Pure with respect to module state: it only reads the supplied experiences
   * and mutates the supplied container, so it can run against a jsdom container
   * in tests or a live DOM node in the browser.
   *
   * @param {Element} container
   * @param {Array<{ id?: string, title?: string, description?: string,
   *   image?: string }>} experiences
   * @returns {Element} the container
   */
  function renderExperiences(container, experiences) {
    if (!container) return container;
    const doc = container.ownerDocument
      || (typeof document !== 'undefined' ? document : null);
    if (!doc) return container;

    // Reset existing content so the render is idempotent.
    container.innerHTML = '';

    const list = Array.isArray(experiences) ? experiences : [];

    list.forEach(function (exp) {
      const experience = exp || {};
      const title = asString(experience.title);
      const description = asString(experience.description);
      const rawImage = experience.image;
      const imageSrc = (typeof rawImage === 'string' && rawImage.trim().length > 0)
        ? rawImage
        : PLACEHOLDER_IMAGE;

      const card = doc.createElement('div');
      card.className = 'col experience-card';
      if (experience.id != null) {
        card.setAttribute('data-experience-id', String(experience.id));
      }

      const inner = doc.createElement('div');
      inner.className = 'standout-card h-100';

      const img = doc.createElement('img');
      img.className = 'experience-img';
      img.setAttribute('src', imageSrc);
      // alt text always includes the experience title (req 4.6).
      img.setAttribute('alt', title);

      const titleEl = doc.createElement('h3');
      titleEl.className = 'experience-title';
      titleEl.textContent = title;

      const descEl = doc.createElement('p');
      descEl.className = 'experience-description';
      descEl.textContent = description;

      inner.appendChild(img);
      inner.appendChild(titleEl);
      inner.appendChild(descEl);
      card.appendChild(inner);
      container.appendChild(card);
    });

    return container;
  }

  // ----- DOM wiring (impure) ---------------------------------------------
  //
  // Everything below is the thin, side-effecting layer that connects the pure
  // functions above to the live page. It is intentionally inert when imported
  // into a DOM-less or form-less environment (Node / Vitest): `init` bails out
  // immediately unless a `#giftForm` element is present, so importing the
  // module for the property tests does not auto-execute side effects.

  // Submit target shared with the RSVP form (requirement 8.1).
  const SUBMIT_ENDPOINT =
    'https://bjr173uis4.execute-api.us-east-1.amazonaws.com/submit';

  // localStorage draft key, distinct from the RSVP key (requirement 10.1).
  const DRAFT_KEY = 'kn-gift-registry-draft-v1';

  // Abort the submission if no response arrives within this window (req 8.7).
  const SUBMIT_TIMEOUT_MS = 30 * 1000;

  // Debounce window for autosave; must be ≤ 1s (requirement 10.1).
  const AUTOSAVE_DELAY_MS = 500;

  // Placeholder honeymoon experiences (pending content P1). Real experiences
  // can be dropped in here without code changes; missing/empty `image` values
  // fall back to images/placeholder.jpg at render time (requirement 4.3).
  const experiences = [
    {
      id: 'new-forest-wander',
      title: 'A New Forest wander',
      description:
        'A slow morning among the ponies and ancient woodland — the part of ' +
        'home we never tire of, shared at an unhurried pace.',
      image: 'images/experiences/gift-1.png'
    },
    {
      id: 'a-proper-dinner',
      title: 'A proper dinner out',
      description:
        'A long, candlelit dinner somewhere lovely, with no plans for the ' +
        'rest of the evening other than each other.',
      image: 'images/experiences/gift-2.png'
    },
    {
      id: 'an-adventure-day',
      title: 'An adventure day',
      description:
        'A day trip to somewhere new — a map, good walking shoes, and ' +
        'absolutely no itinerary to keep to.',
      image: 'images/experiences/gift-3.png'
    },
    {
      id: 'a-cosy-night-in',
      title: 'A cosy night in',
      description:
        'A bottle of something nice, a good film, and the heating on — the ' +
        'simple pleasures we look forward to most.',
      image: 'images/experiences/gift-4.png'
    },
    {
      id: 'a-spa-afternoon',
      title: 'A spa afternoon',
      description:
        'A lazy few hours of steam, robes, and doing gloriously little. ' +
        'Married life, we are told, is exhausting.',
      image: 'images/experiences/gift-5.png'
    },
    {
      id: 'a-sunset-sail',
      title: 'A sunset sail',
      description:
        'An evening out on the water as the light goes golden — the sort of ' +
        'thing we would never quite get round to booking ourselves.',
      image: 'images/experiences/gift-6.png'
    },
    {
      id: 'a-countryside-picnic',
      title: 'A countryside picnic',
      description:
        'A proper hamper, a sunny field, and absolutely nowhere we need to ' +
        'be. Pork pie optional but encouraged.',
      image: 'images/experiences/gift-7.png'
    },
    {
      id: 'a-coastal-stroll',
      title: 'A coastal stroll',
      description:
        'A blustery walk along the cliffs followed by chips on the front — ' +
        'the very best of a British seaside day.',
      image: 'images/experiences/gift-8.png'
    },
    {
      id: 'a-lazy-brunch',
      title: 'A lazy brunch',
      description:
        'A long, unhurried breakfast with good coffee and no alarm — the ' +
        'perfect lazy start to a honeymoon morning.',
      image: 'images/experiences/gift-9.png'
    }
  ];

  // Payment configuration (requirement 5; account details confirmed in D2).
  // `paypalUrl` is nullable: when null the PayPal link is left as the page's
  // static placeholder until the couple provide a real handle (P2).
  const paymentConfig = {
    paypalUrl: null,
    bank: {
      accountName: 'Neil Saunders',
      sortCode: '40-44-06',
      accountNumber: '11311093'
    }
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#39;';
      }
    });
  }

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      const args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, delay);
    };
  }

  // Best-effort smooth scroll; a no-op where scrollIntoView is unavailable
  // (e.g. jsdom) so it never throws (requirement 7.8).
  function scrollIntoViewSafe(el) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      try { el.scrollIntoView(); } catch (e2) { /* no-op */ }
    }
  }

  /**
   * Attach the impure DOM behaviour to the gift-registry page. Safe to call in
   * any environment: it returns immediately unless the contribution form is
   * present, so importing the module in tests has no side effects.
   *
   * @param {Document} [doc] - document to wire (defaults to the global document)
   * @returns {boolean} true when wiring was attached, false otherwise
   */
  function init(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return false;

    const form = d.getElementById('giftForm');
    if (!form) return false; // not the registry page — stay inert.

    const formError = d.getElementById('formError');
    const experienceSelection = d.getElementById('experienceSelection');
    const experienceChoices = d.getElementById('experienceChoices');
    const experienceGrid = d.getElementById('experienceGrid');
    const experienceEmpty = d.getElementById('experienceEmpty');

    let isSubmitting = false;
    // Fields whose validation messages are currently surfaced; used so editing
    // a field clears exactly its own message once it passes (requirement 7.7).
    let activeErrorFields = [];

    // ----- small DOM helpers -------------------------------------------
    function field(sel) { return form.querySelector(sel); }
    function getValue(sel) {
      const el = field(sel);
      return el ? el.value : '';
    }
    function setValue(sel, value) {
      const el = field(sel);
      if (el && typeof value === 'string') el.value = value;
    }
    function choiceInputs() {
      return Array.prototype.slice.call(
        form.querySelectorAll('.experience-choice')
      );
    }

    // ----- experience rendering (req 4.1–4.7) --------------------------
    function renderGrid() {
      const hasExperiences = experiences.length > 0;

      if (experienceGrid) {
        if (hasExperiences) {
          experienceGrid.classList.remove('d-none');
          renderExperiences(experienceGrid, experiences);
          // Attach the runtime onerror fallback the pure renderer cannot
          // wire (requirement 4.3).
          Array.prototype.forEach.call(
            experienceGrid.querySelectorAll('img.experience-img'),
            function (img) {
              img.onerror = function () {
                if (img.getAttribute('src') !== PLACEHOLDER_IMAGE) {
                  img.onerror = null;
                  img.setAttribute('src', PLACEHOLDER_IMAGE);
                }
              };
            }
          );
        } else {
          experienceGrid.innerHTML = '';
          experienceGrid.classList.add('d-none');
        }
      }

      // Zero-experiences message (requirement 4.7).
      if (experienceEmpty) {
        experienceEmpty.classList.toggle('d-none', hasExperiences);
      }
    }

    // Build the selection checkboxes inside the form (requirements 6.3, 7.4).
    function renderChoices() {
      if (!experienceChoices) return;
      experienceChoices.innerHTML = '';
      experiences.forEach(function (exp) {
        const wrapper = d.createElement('div');
        wrapper.className = 'form-check';

        const input = d.createElement('input');
        input.className = 'form-check-input experience-choice';
        input.type = 'checkbox';
        input.id = 'experience-' + exp.id;
        input.value = exp.id;
        input.name = 'selectedExperiences';

        const label = d.createElement('label');
        label.className = 'form-check-label';
        label.setAttribute('for', input.id);
        label.textContent = exp.title;

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        experienceChoices.appendChild(wrapper);
      });
    }

    // ----- payment link (requirements 5.4, 5.5) ------------------------
    function applyPaymentConfig() {
      const link = d.getElementById('paypalLink');
      if (!link) return;
      const url = paymentConfig.paypalUrl;
      if (typeof url === 'string' && url.trim().length > 0) {
        link.setAttribute('href', url);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
      }
      // When no URL is provided we leave the page's static placeholder intact.
    }

    // ----- collect current values --------------------------------------
    function collect() {
      const selected = [];
      choiceInputs().forEach(function (cb) {
        if (cb.checked) selected.push(cb.value);
      });
      return {
        name: getValue('#name'),
        email: getValue('#email'),
        selectedExperiences: selected,
        amountOrNote: getValue('#amountOrNote'),
        message: getValue('#message')
      };
    }

    // ----- draft persistence (requirements 10.1–10.5) ------------------
    function saveDraft() {
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return;
        localStorage.setItem(DRAFT_KEY, serializeDraft(collect()));
      } catch (e) {
        /* localStorage unavailable — silent no-op (req 10.5) */
      }
    }
    const saveDraftDebounced = debounce(saveDraft, AUTOSAVE_DELAY_MS);

    function clearDraft() {
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return;
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {
        /* no-op */
      }
    }

    function restoreDraft() {
      let raw = null;
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return;
        raw = localStorage.getItem(DRAFT_KEY);
      } catch (e) {
        return; // storage unavailable (req 10.5)
      }
      if (!raw) return;

      const result = deserializeDraft(raw);
      if (!result.ok) {
        // Stale or unparseable draft: discard it (requirement 10.3).
        clearDraft();
        return;
      }

      const draft = result.draft;
      if (typeof draft.name === 'string') setValue('#name', draft.name);
      if (typeof draft.email === 'string') setValue('#email', draft.email);
      if (typeof draft.amountOrNote === 'string') {
        setValue('#amountOrNote', draft.amountOrNote);
      }
      if (typeof draft.message === 'string') setValue('#message', draft.message);

      const selected = Array.isArray(draft.selectedExperiences)
        ? draft.selectedExperiences
        : [];
      choiceInputs().forEach(function (cb) {
        cb.checked = selected.indexOf(cb.value) !== -1;
      });
    }

    // ----- validation messaging (requirements 7.1–7.8, 11.2) -----------
    function markField(fieldName, invalid) {
      if (fieldName === 'name' || fieldName === 'email') {
        const el = field('#' + fieldName);
        if (el) el.classList.toggle('is-invalid', !!invalid);
      } else if (fieldName === 'experiences' && experienceSelection) {
        experienceSelection.classList.toggle('invalid', !!invalid);
      }
    }

    function renderMessages(errors) {
      if (!formError) return;
      if (!errors.length) {
        formError.classList.add('d-none');
        formError.innerHTML = '';
        return;
      }
      formError.classList.remove('d-none');
      formError.innerHTML = errors
        .map(function (e) {
          return '<div>• ' + escapeHtml(e.message) + '</div>';
        })
        .join('');
    }

    // Surface a fresh set of validation errors (on submit).
    function showErrors(errors) {
      // Reset any previously-marked fields first.
      ['name', 'email', 'experiences'].forEach(function (f) {
        markField(f, false);
      });
      errors.forEach(function (e) {
        markField(e.field, true);
      });
      activeErrorFields = errors
        .map(function (e) { return e.field; })
        .filter(function (f) { return f === 'name' || f === 'email' || f === 'experiences'; });
      renderMessages(errors);
      if (errors.length) scrollIntoViewSafe(formError);
    }

    // On edit, clear the invalid state + message for any active field that now
    // passes, leaving the rest untouched (requirement 7.7).
    function refreshActiveErrors() {
      if (!activeErrorFields.length) return;
      const result = validateContribution(collect());
      const stillFailing = {};
      result.errors.forEach(function (e) { stillFailing[e.field] = e; });

      const remaining = [];
      activeErrorFields.forEach(function (f) {
        if (stillFailing[f]) {
          remaining.push(stillFailing[f]);
        } else {
          markField(f, false);
        }
      });
      activeErrorFields = remaining.map(function (e) { return e.field; });
      renderMessages(remaining);
    }

    // ----- submission (requirements 8.1, 8.4–8.7) ----------------------
    function setSubmitting(btn, submitting) {
      if (!btn) return;
      btn.disabled = submitting;
      if (submitting) {
        btn.dataset.originalHtml = btn.innerHTML;
        btn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" ' +
          'aria-hidden="true"></span>Sending contribution...';
      } else if (btn.dataset.originalHtml != null) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }

    function showThankYou() {
      // Replace the form contents with a polite live region so assistive tech
      // announces the confirmation (requirements 8.5, 11.3).
      form.innerHTML =
        '<div class="alert alert-success m-3 text-center" role="status" ' +
        'aria-live="polite">Thank you so much — your contribution details are ' +
        'on their way to us. We will be in touch with a proper thank-you. 💛</div>';
      scrollIntoViewSafe(form);
    }

    async function handleSubmit(event) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      // In-flight guard: ignore repeat activations (requirement 8.4).
      if (isSubmitting) return;

      const result = validateContribution(collect());
      if (!result.valid) {
        // Block submission, retain values, surface every failing field
        // (requirements 7.1–7.6, 7.8).
        showErrors(result.errors);
        return;
      }

      // Clear any lingering errors before submitting.
      showErrors([]);

      const submitBtn = form.querySelector('button[type="submit"]');
      isSubmitting = true;
      setSubmitting(submitBtn, true);

      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(function () {
        if (controller) controller.abort();
      }, SUBMIT_TIMEOUT_MS);

      let succeeded = false;
      let errorMessage =
        'Sorry, something went wrong sending your contribution. Please try again.';

      try {
        const response = await fetch(SUBMIT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(collect())),
          signal: controller ? controller.signal : undefined
        });

        if (response && response.ok) {
          succeeded = true;
        } else if (response) {
          // Non-OK response: prefer a server-provided message (req 8.6).
          try {
            const body = await response.json();
            if (body && body.error) errorMessage = body.error;
          } catch (parseErr) {
            /* keep the generic message */
          }
        }
      } catch (err) {
        // Network error or timeout/abort (requirement 8.7).
      } finally {
        clearTimeout(timer);
      }

      if (succeeded) {
        clearDraft(); // requirement 10.4
        showThankYou();
        return;
      }

      // Restore the editable state with all values retained (req 8.6, 8.7).
      isSubmitting = false;
      setSubmitting(submitBtn, false);
      showErrors([{ field: '', message: errorMessage }]);
    }

    // ----- wire everything ---------------------------------------------
    renderGrid();
    renderChoices();
    applyPaymentConfig();
    restoreDraft();

    // Autosave on any field change (requirement 10.1).
    form.addEventListener('input', saveDraftDebounced, true);
    form.addEventListener('change', saveDraftDebounced, true);

    // Clear invalid state/message as the guest edits (requirement 7.7).
    form.addEventListener('input', refreshActiveErrors);
    form.addEventListener('change', refreshActiveErrors);

    form.addEventListener('submit', handleSubmit);

    return true;
  }

  // Auto-initialise in the browser once the DOM is ready. Guarded so importing
  // the module under Node/Vitest (no #giftForm) attaches nothing.
  if (typeof document !== 'undefined' && document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        init(document);
      });
    } else {
      init(document);
    }
  }

  // ----- Public API ------------------------------------------------------

  const GiftRegistry = {
    // Constants
    GIFT_REGISTRY_TYPE: GIFT_REGISTRY_TYPE,
    PLACEHOLDER_IMAGE: PLACEHOLDER_IMAGE,
    DRAFT_MAX_AGE_MS: DRAFT_MAX_AGE_MS,
    SUBMIT_ENDPOINT: SUBMIT_ENDPOINT,
    DRAFT_KEY: DRAFT_KEY,
    SUBMIT_TIMEOUT_MS: SUBMIT_TIMEOUT_MS,
    // Pure functions
    isValidEmail: isValidEmail,
    validateContribution: validateContribution,
    buildPayload: buildPayload,
    serializeDraft: serializeDraft,
    deserializeDraft: deserializeDraft,
    renderExperiences: renderExperiences,
    // Page data
    experiences: experiences,
    paymentConfig: paymentConfig,
    // DOM wiring entry point (idempotent; inert without #giftForm)
    init: init
  };

  return GiftRegistry;
});
