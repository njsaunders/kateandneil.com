// js/rsvp.js (full replacement with autosave)
(function () {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const form = $('#rsvpForm');
  if (!form) return;

  const formError = $('#formError');
  const formSuccess = $('#formSuccess');
  const addBtn = $('#addGuestBtn');
  const extraGuestsWrap = $('#extraGuests');
  const MAX_EXTRA = 3;  // Guests 3–5
  const DRAFT_KEY = 'kn-rsvp-draft-v1';

  // ---------- Utilities ----------
  const any = (v) => (v || '').trim().length > 0;
  function debounce(fn, delay = 300){
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  // ---------- Dynamic guests ----------
  function nextGuestNumber() {
    const existing = $$('#extraGuests fieldset[data-guest]').map(fs => parseInt(fs.dataset.guest, 10));
    let n = 3;
    while (existing.includes(n)) n++;
    return n;
  }
  function updateAddButton() {
    addBtn && (addBtn.disabled = $$('#extraGuests fieldset[data-guest]').length >= MAX_EXTRA);
  }
  function addGuest() {
    const n = nextGuestNumber();
    if (n > 5) return;

    const tplEl = $('#guestTemplate');
    if (!tplEl) return;

    const tpl = tplEl.content.cloneNode(true);
    const fs = tpl.querySelector('fieldset');
    fs.dataset.guest = String(n);
    fs.querySelector('legend').textContent = `Guest ${n}`;

    // First / Last / Diet
    const floatInputs = fs.querySelectorAll('.form-floating input');
    const first = floatInputs[0], last = floatInputs[1], diet = floatInputs[2];
    first.id = `guest${n}_first`; first.name = `guest${n}[first]`;
    last.id  = `guest${n}_last`;  last.name  = `guest${n}[last]`;
    diet.id  = `guest${n}_diet`;  diet.name  = `guest${n}[diet]`;

    const floatLabels = fs.querySelectorAll('.form-floating label');
    floatLabels[0].setAttribute('for', first.id);
    floatLabels[1].setAttribute('for', last.id);
    floatLabels[2].setAttribute('for', diet.id);

    // Radios
    const radios = fs.querySelectorAll('.form-check-input');
    const labels = fs.querySelectorAll('.form-check-label');
    radios[0].name = `guest${n}[attending]`; radios[0].id = `guest${n}_yes`; labels[0].setAttribute('for', radios[0].id);
    radios[1].name = `guest${n}[attending]`; radios[1].id = `guest${n}_no`;  labels[1].setAttribute('for', radios[1].id);

    // Remove
    fs.querySelector('[data-remove]').addEventListener('click', () => { fs.remove(); updateAddButton(); saveDraft(); });

    extraGuestsWrap.appendChild(fs);
    updateAddButton();
    saveDraft(); // persist structure change
  }
  addBtn?.addEventListener('click', addGuest);
  updateAddButton();

  // ---------- Collect ----------
  function collectData() {
    const data = {};
    const presentExtra = [];
    for (let n = 1; n <= 5; n++) {
      const fs = document.querySelector(`[data-guest="${n}"]`);
      if (!fs) continue;
      const first = $(`#guest${n}_first`)?.value.trim() || '';
      const last  = $(`#guest${n}_last`)?.value.trim() || '';
      const attending = ($$(`input[name="guest${n}[attending]"]`).find(r => r.checked) || {}).value || '';
      const diet = $(`#guest${n}_diet`)?.value.trim() || '';
      data[`guest${n}`] = { first, last, attending, diet };
      if (n >= 3 && (any(first) || any(last) || any(attending) || any(diet))) {
        presentExtra.push(n);
      }
    }
    data.email = $('#email')?.value.trim() || '';
    data.message = $('#message')?.value.trim() || '';
    data.presentExtra = presentExtra; // helps rebuild extra fieldsets
    return data;
  }

  // ---------- Autosave (localStorage) ----------
  function saveDraft() {
    try {
      const payload = collectData();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {}
  }
  const saveDraftDebounced = debounce(saveDraft, 250);

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);

      // Rebuild extra guests first (based on stored list)
      const extras = Array.isArray(d.presentExtra) ? d.presentExtra : [];
      // Ensure we have fieldsets for 3..5 if needed
      extras.sort((a,b)=>a-b).forEach(n => {
        // addGuest() adds next number sequentially; loop until we reach n
        while (!$(`[data-guest="${n}"]`) && nextGuestNumber() <= n) addGuest();
      });

      // Now set values for guests 1..5
      for (let n = 1; n <= 5; n++) {
        const g = d[`guest${n}`] || {};
        const firstEl = $(`#guest${n}_first`);
        const lastEl  = $(`#guest${n}_last`);
        const dietEl  = $(`#guest${n}_diet`);
        if (firstEl) firstEl.value = g.first || '';
        if (lastEl)  lastEl.value  = g.last  || '';
        if (dietEl)  dietEl.value  = g.diet  || '';
        if (g.attending) {
          const r = $(`input[name="guest${n}[attending]"][value="${g.attending}"]`);
          if (r) r.checked = true;
        }
      }

      if ('email' in d && $('#email'))   $('#email').value   = d.email || '';
      if ('message' in d && $('#message')) $('#message').value = d.message || '';
    } catch {}
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  // Save on any changes
  form.addEventListener('input', saveDraftDebounced, true);
  form.addEventListener('change', saveDraftDebounced, true);

  // Load previous draft once DOM is ready for this module
  loadDraft();

  // ---------- Validation helpers (incl. red outlines) ----------
  function clearInvalid() {
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.att-row.invalid').forEach(el => el.classList.remove('invalid'));
  }
  function markInvalidInput(selector) {
    const el = document.querySelector(selector);
    if (el) el.classList.add('is-invalid');
  }
  function markInvalidRadio(name) {
    const input = form.querySelector(`input[name="${name}"]`);
    const groupRow = input ? input.closest('.att-row') : null;
    if (groupRow) groupRow.classList.add('invalid');
  }
  function validEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val).trim());
  }

  // Live-clear invalid state as user edits
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('form-control') && t.classList.contains('is-invalid')) {
      t.classList.remove('is-invalid');
    }
  });
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('.form-check-input')) {
      const name = t.getAttribute('name');
      const row  = t.closest('.att-row');
      if (name && row) {
        const checked = Array.from(form.querySelectorAll(`input[name="${name}"]`)).some(r => r.checked);
        if (checked) row.classList.remove('invalid');
      }
    }
  });

  function validate() {
  clearInvalid();
  const errs = [];

  // --- Guest 1 (required) ---
  if (!any($('#guest1_first').value)) {
    errs.push('Guest 1 – please enter a first name.');
    markInvalidInput('#guest1_first');
  }
  if (!any($('#guest1_last').value)) {
    errs.push('Guest 1 – please enter a surname.');
    markInvalidInput('#guest1_last');
  }
  if (!$$('input[name="guest1[attending]"]').some(r => r.checked)) {
    errs.push('Guest 1 – please select attending or not attending.');
    markInvalidRadio('guest1[attending]');
  }

  // --- Guest 2 (surname optional) ---
  const g2first = $('#guest2_first').value.trim();
  const g2last  = $('#guest2_last').value.trim(); // optional
  const g2picked = $$('input[name="guest2[attending]"]').some(r => r.checked);

  // if they interacted with the guest (any name entered or picked attendance)
  if (any(g2first) || any(g2last) || g2picked) {
    if (!any(g2first)) {
      errs.push('Guest 2 – please add a first name.');
      markInvalidInput('#guest2_first');
    }
    if (!g2picked) {
      errs.push('Guest 2 – please select attending or not attending.');
      markInvalidRadio('guest2[attending]');
    }
    // surname optional: no error on #guest2_last
  }

  // --- Guests 3–5 (surname optional) ---
  for (let n = 3; n <= 5; n++) {
    const fs = document.querySelector(`[data-guest="${n}"]`);
    if (!fs) continue;

    const first = $(`#guest${n}_first`)?.value.trim() || '';
    const last  = $(`#guest${n}_last`)?.value.trim() || ''; // optional
    const picked = $$(`input[name="guest${n}[attending]"]`).some(r => r.checked);

    // validate only if interacted
    if (any(first) || any(last) || picked) {
      if (!any(first)) {
        errs.push(`Guest ${n} – please add a first name.`);
        markInvalidInput(`#guest${n}_first`);
      }
      if (!picked) {
        errs.push(`Guest ${n} – please select attending or not attending.`);
        markInvalidRadio(`guest${n}[attending]`);
      }
      // surname optional: no error on last
    }
  }

  // --- Email: required + format ---
  const email = $('#email').value.trim();
  if (!any(email)) {
    errs.push('Please enter your email address.');
    markInvalidInput('#email');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errs.push('Please enter a valid email address.');
    markInvalidInput('#email');
  }

  return errs;
}


  // ---------- UI helpers ----------
  function getHeaderOffset(){
    const h = document.querySelector('.header');
    return h ? Math.ceil(h.getBoundingClientRect().height) : 0;
  }
  function smartScrollTo(el){
    if (!el) return;
    const pad = 12; // breathing room
    const y = el.getBoundingClientRect().top + window.pageYOffset - getHeaderOffset() - pad;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function showError(messages) {
    if (!formError) return;
    if (!messages.length) { formError.classList.add('d-none'); formError.innerHTML=''; return; }
    formError.classList.remove('d-none');
    formError.innerHTML = messages.map(m => `<div>• ${m}</div>`).join('');
    smartScrollTo(formError);
  }

  function showSuccess(msg) {
    if (!formSuccess) return;
    formSuccess.classList.remove('d-none');
    formSuccess.textContent = msg;
    smartScrollTo(formSuccess);
  }


  // ---------- Submit ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length) return showError(errs);
    showError([]);

    const payload = collectData();

    // TODO: hook up your POST here
    // await fetch('/your-endpoint', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });

    // Clear draft on success (comment this out if you prefer to keep it)
    clearDraft();

    showSuccess('Thank you 😊 your RSVP has been sent!');
  });
})();
