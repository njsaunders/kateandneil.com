// js/rsvp.js
(function () {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const form = $('#rsvpForm');
  const formError = $('#formError');
  const formSuccess = $('#formSuccess');
  const addBtn = $('#addGuestBtn');
  const extraGuestsWrap = $('#extraGuests');
  const MAX_EXTRA = 3;  // Guests 3–5

  // ---------- Dynamic guests ----------
  function nextGuestNumber() {
    const existing = $$('#extraGuests fieldset[data-guest]').map(fs => parseInt(fs.dataset.guest, 10));
    let n = 3;
    while (existing.includes(n)) n++;
    return n;
  }
  function updateAddButton() {
    addBtn.disabled = $$('#extraGuests fieldset[data-guest]').length >= MAX_EXTRA;
  }
  function addGuest() {
    const n = nextGuestNumber();
    if (n > 5) return;
    const tpl = $('#guestTemplate').content.cloneNode(true);
    const fs = tpl.querySelector('fieldset');
    fs.dataset.guest = String(n);
    fs.querySelector('legend').textContent = `Guest ${n}`;

    // First + Last
    const floats = fs.querySelectorAll('.form-floating input');
    const first = floats[0], last = floats[1], diet = floats[2];
    first.id = `guest${n}_first`; first.name = `guest${n}[first]`;
    last.id  = `guest${n}_last`;  last.name  = `guest${n}[last]`;
    diet.id  = `guest${n}_diet`;  diet.name  = `guest${n}[diet]`;
    fs.querySelectorAll('.form-floating label')[0].setAttribute('for', first.id);
    fs.querySelectorAll('.form-floating label')[1].setAttribute('for', last.id);
    fs.querySelectorAll('.form-floating label')[2].setAttribute('for', diet.id);

    // Radios
    const radios = fs.querySelectorAll('.form-check-input');
    const labels = fs.querySelectorAll('.form-check-label');
    radios[0].name = `guest${n}[attending]`; radios[0].id = `guest${n}_yes`; labels[0].setAttribute('for', radios[0].id);
    radios[1].name = `guest${n}[attending]`; radios[1].id = `guest${n}_no`;  labels[1].setAttribute('for', radios[1].id);

    // Remove
    fs.querySelector('[data-remove]').addEventListener('click', () => { fs.remove(); updateAddButton(); });

    extraGuestsWrap.appendChild(fs);
    updateAddButton();
  }
  addBtn?.addEventListener('click', addGuest);
  updateAddButton();

  // ---------- Validation ----------
  function any(val){ return (val || '').trim().length > 0; }

  function validate() {
    const errs = [];

    // Guest 1: all required
    if (!any($('#guest1_first').value)) errs.push('Guest 1, please enter a first name.');
    if (!any($('#guest1_last').value))  errs.push('Guest 1, please enter a surname.');
    if (!$$('input[name="guest1[attending]"]').some(r => r.checked)) errs.push('Guest 1, please select whethere you\'re attending or not.');

    // Guest 2: if either name is entered, require the other + attendance
    const g2first = $('#guest2_first').value.trim();
    const g2last  = $('#guest2_last').value.trim();
    const g2picked = $$('input[name="guest2[attending]"]').some(r => r.checked);
    if ((any(g2first) || any(g2last)) && (!any(g2first) || !any(g2last) || !g2picked)) {
      errs.push('Guest 2, please complete first name, surname and/or attendance, or clear the names.');
    }

    // Guests 3–5: same conditional rule
    for (let n = 3; n <= 5; n++) {
      const fs = document.querySelector(`[data-guest="${n}"]`);
      if (!fs) continue;
      const first = $(`#guest${n}_first`).value.trim();
      const last  = $(`#guest${n}_last`).value.trim();
      const picked = $$(`input[name="guest${n}[attending]"]`).some(r => r.checked);
      if ((any(first) || any(last)) && (!any(first) || !any(last) || !picked)) {
        errs.push(`Guest ${n} – please complete first name, surname and/or attendance, or remove the guest.`);
      }
    }

    // Optional email format
    const email = $('#email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('Please enter a valid email address.');

    return errs;
  }

  // ---------- Collect ----------
  function collectData() {
    const data = {};
    for (let n = 1; n <= 5; n++) {
      const fs = document.querySelector(`[data-guest="${n}"]`);
      if (!fs) continue;
      const first = $(`#guest${n}_first`)?.value.trim() || '';
      const last  = $(`#guest${n}_last`)?.value.trim() || '';
      const attending = ($$(`input[name="guest${n}[attending]"]`).find(r => r.checked) || {}).value || '';
      const diet = $(`#guest${n}_diet`)?.value.trim() || '';
      data[`guest${n}`] = { first, last, attending, diet };
    }
    data.email = $('#email').value.trim();
    data.message = $('#message').value.trim();
    data.submittedAt = new Date().toISOString();
    return data;
  }

  // ---------- UI helpers ----------
  function showError(messages) {
    if (!messages.length) { formError.classList.add('d-none'); formError.innerHTML=''; return; }
    formError.classList.remove('d-none');
    formError.innerHTML = messages.map(m => `<div>• ${m}</div>`).join('');
    formError.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function showSuccess(msg) {
    formSuccess.classList.remove('d-none');
    formSuccess.textContent = msg;
    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Submit ----------
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errs = validate();
    if (errs.length) return showError(errs);
    showError([]);

    const payload = collectData();

    // Hook up your custom POST here later:
    // await fetch('/your-endpoint', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });

    showSuccess('Thank you, your RSVP has sent 😊');
  });
})();
