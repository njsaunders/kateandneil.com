// tests/gift-registry-markup.test.js
//
// Unit tests for the static markup of gift-registry.html (Task 4.2).
//
// The page is read from disk and parsed into a DOM so we can assert the
// presence and structure of: stylesheets + fonts, the favicon set, the
// document title/description, the navigation (labels, order, cross-page
// hrefs, the current-page Gift Registry link), the intro copy, the payment
// details, the form-field maxlength attributes, and the ARIA wiring of the
// live regions and labelled required inputs.
//
// Validates: Requirements 1.2, 1.3, 1.6, 1.8, 2.3, 3.1, 3.2, 5.1, 5.2,
//            6.6, 6.7, 11.1, 11.2, 11.3, 11.4
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs with the repo root as the working directory, so the page sits
// at <cwd>/gift-registry.html.
const HTML_PATH = resolve(process.cwd(), 'gift-registry.html');

let doc;

beforeAll(() => {
  const html = readFileSync(HTML_PATH, 'utf8');
  // Running under the jsdom environment, so DOMParser is available globally.
  doc = new DOMParser().parseFromString(html, 'text/html');
});

const NAV_LABELS = ['Home', 'Getting there', 'Accommodation', 'FAQs', 'Gift Registry'];

// Expected cross-page hrefs for the shared navigation links.
const CROSS_PAGE_HREFS = {
  Home: 'index.html#home',
  'Getting there': 'index.html#getting-there',
  Accommodation: 'index.html#accommodation',
  FAQs: 'index.html#faqs',
  'Gift Registry': 'gift-registry.html',
};

describe('gift-registry.html stylesheets and fonts (Req 1.2, 1.3)', () => {
  it('links both site stylesheets', () => {
    const hrefs = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) =>
      l.getAttribute('href')
    );
    expect(hrefs).toContain('vendor/bootstrap.min.css');
    expect(hrefs).toContain('css/custom.css');
  });

  it('links the Frank Ruhl Libre and Qwitcher Grypen web fonts', () => {
    const fontLink = [...doc.querySelectorAll('link[href*="fonts.googleapis.com"]')].find(
      (l) => /Frank\+Ruhl\+Libre/.test(l.getAttribute('href'))
    );
    expect(fontLink, 'a Google Fonts stylesheet link should be present').toBeTruthy();
    const href = fontLink.getAttribute('href');
    expect(href).toMatch(/Frank\+Ruhl\+Libre/);
    expect(href).toMatch(/Qwitcher\+Grypen/);
  });
});

describe('gift-registry.html favicon set (Req 1.8)', () => {
  it('includes the full favicon link set and web manifest', () => {
    const linkHrefs = [...doc.querySelectorAll('head link')].map((l) => l.getAttribute('href'));
    const expected = [
      'images/favicon_io/apple-touch-icon.png',
      'images/favicon_io/favicon-32x32.png',
      'images/favicon_io/favicon-16x16.png',
      'images/favicon_io/favicon.ico',
      'images/favicon_io/site.webmanifest',
    ];
    for (const href of expected) {
      expect(linkHrefs, `expected favicon link ${href}`).toContain(href);
    }
    expect(doc.querySelector('link[rel="manifest"]').getAttribute('href')).toBe(
      'images/favicon_io/site.webmanifest'
    );
  });
});

describe('gift-registry.html title and description (Req 1.8)', () => {
  it('has a non-empty document title', () => {
    expect(doc.title.trim().length).toBeGreaterThan(0);
  });

  it('has a non-empty meta description', () => {
    const desc = doc.querySelector('meta[name="description"]');
    expect(desc, 'meta description should exist').toBeTruthy();
    expect(desc.getAttribute('content').trim().length).toBeGreaterThan(0);
  });
});

describe('gift-registry.html navigation (Req 2.3)', () => {
  it('desktop nav has the expected labels in order', () => {
    const labels = [...doc.querySelectorAll('.nav-links ul li a')].map((a) =>
      a.textContent.trim()
    );
    expect(labels).toEqual(NAV_LABELS);
  });

  it('mobile offcanvas menu has the expected labels in order', () => {
    const labels = [...doc.querySelectorAll('#mobileMenu .menu-link')].map((a) =>
      a.textContent.trim()
    );
    expect(labels).toEqual(NAV_LABELS);
  });

  it('desktop nav links use the correct cross-page hrefs', () => {
    const links = [...doc.querySelectorAll('.nav-links ul li a')];
    for (const link of links) {
      const label = link.textContent.trim();
      expect(link.getAttribute('href')).toBe(CROSS_PAGE_HREFS[label]);
    }
  });

  it('offcanvas links use the correct cross-page hrefs', () => {
    const links = [...doc.querySelectorAll('#mobileMenu .menu-link')];
    for (const link of links) {
      const label = link.textContent.trim();
      expect(link.getAttribute('href')).toBe(CROSS_PAGE_HREFS[label]);
    }
  });

  it('monogram logo and RSVP buttons point back to the home page', () => {
    expect(doc.querySelector('a.monogram').getAttribute('href')).toBe('index.html#home');
    const rsvpHrefs = [...doc.querySelectorAll('a')]
      .filter((a) => a.textContent.trim().startsWith('RSVP'))
      .map((a) => a.getAttribute('href'));
    expect(rsvpHrefs.length).toBeGreaterThan(0);
    for (const href of rsvpHrefs) {
      expect(href).toBe('index.html#rsvp');
    }
  });

  it('marks exactly one Gift Registry link as the current page in each nav', () => {
    const desktopGift = [...doc.querySelectorAll('.nav-links ul li a')].filter(
      (a) => a.textContent.trim() === 'Gift Registry'
    );
    expect(desktopGift).toHaveLength(1);
    expect(desktopGift[0].getAttribute('aria-current')).toBe('page');
    expect(desktopGift[0].getAttribute('href')).toBe('gift-registry.html');

    const mobileGift = [...doc.querySelectorAll('#mobileMenu .menu-link')].filter(
      (a) => a.textContent.trim() === 'Gift Registry'
    );
    expect(mobileGift).toHaveLength(1);
    expect(mobileGift[0].getAttribute('aria-current')).toBe('page');
    expect(mobileGift[0].getAttribute('href')).toBe('gift-registry.html');
  });
});

describe('gift-registry.html intro copy (Req 3.1, 3.2)', () => {
  it('states that gifts are not expected and invites optional contributions', () => {
    const intro = doc.querySelector('section.section--cream');
    expect(intro, 'intro section should exist').toBeTruthy();
    const text = intro.textContent.toLowerCase();
    // Req 3.1: gifts are not expected.
    expect(text).toMatch(/don.t feel you need to bring a gift|gift/);
    expect(text).toMatch(/no pressure|don.t feel/);
    // Req 3.2: optional invitation to contribute toward the honeymoon.
    expect(text).toMatch(/honeymoon/);
    expect(text).toMatch(/invited|chip in|contribute/);
  });

  it('places the intro above the experience grid', () => {
    const sections = [...doc.querySelectorAll('main section')];
    const introIndex = sections.findIndex((s) => s.classList.contains('section--cream'));
    const experiencesIndex = sections.findIndex((s) => s.querySelector('#experienceGrid'));
    expect(introIndex).toBeGreaterThanOrEqual(0);
    expect(experiencesIndex).toBeGreaterThan(introIndex);
  });
});

describe('gift-registry.html payment details (Req 5.1, 5.2)', () => {
  it('shows a PayPal payment method labelled PayPal', () => {
    const payment = doc.querySelector('#payment');
    expect(payment, 'payment section should exist').toBeTruthy();
    expect(payment.textContent).toMatch(/PayPal/);
  });

  it('shows bank transfer details with the confirmed sort code and account number', () => {
    const payment = doc.querySelector('#payment');
    const text = payment.textContent;
    expect(text).toMatch(/Bank transfer/i);
    expect(text).toMatch(/Account name/i);
    expect(text).toContain('40-44-06');
    expect(text).toContain('11311093');
  });
});

describe('gift-registry.html form field maxlength attributes (Req 6.6, 6.7)', () => {
  it('applies the specified maxlength to each field', () => {
    const form = doc.querySelector('#giftForm');
    expect(form, 'gift form should exist').toBeTruthy();
    expect(form.querySelector('#name').getAttribute('maxlength')).toBe('100');
    expect(form.querySelector('#email').getAttribute('maxlength')).toBe('254');
    expect(form.querySelector('#amountOrNote').getAttribute('maxlength')).toBe('200');
    expect(form.querySelector('#message').getAttribute('maxlength')).toBe('1000');
  });

  it('reuses the RSVP form styling conventions (floating labels and card)', () => {
    const form = doc.querySelector('#giftForm');
    expect(form.classList.contains('card')).toBe(true);
    expect(form.querySelectorAll('.form-floating').length).toBeGreaterThan(0);
  });
});

describe('gift-registry.html ARIA wiring (Req 11.1, 11.2, 11.3, 11.4)', () => {
  it('exposes the error region as an assertive live region (Req 11.2)', () => {
    const formError = doc.querySelector('#formError');
    expect(formError, '#formError should exist').toBeTruthy();
    expect(formError.getAttribute('aria-live')).toBe('assertive');
    expect(formError.getAttribute('role')).toBe('alert');
  });

  it('exposes the success region as a polite live region (Req 11.3)', () => {
    const formSuccess = doc.querySelector('#formSuccess');
    expect(formSuccess, '#formSuccess should exist').toBeTruthy();
    expect(formSuccess.getAttribute('aria-live')).toBe('polite');
    expect(formSuccess.getAttribute('role')).toBe('status');
  });

  it('labels every input control and marks required ones (Req 11.1)', () => {
    const form = doc.querySelector('#giftForm');
    const controls = [...form.querySelectorAll('input, textarea')];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const id = control.getAttribute('id');
      expect(id, 'each control should have an id for label association').toBeTruthy();
      const label = form.querySelector(`label[for="${id}"]`);
      expect(label, `control #${id} should have an associated label`).toBeTruthy();
      expect(label.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('programmatically marks the required inputs as required (Req 11.1)', () => {
    const form = doc.querySelector('#giftForm');
    for (const id of ['name', 'email']) {
      const control = form.querySelector(`#${id}`);
      expect(control.hasAttribute('required')).toBe(true);
      expect(control.getAttribute('aria-required')).toBe('true');
    }
    // The experience-selection group is also marked required.
    expect(
      doc.querySelector('#experienceSelection').getAttribute('aria-required')
    ).toBe('true');
  });

  it('gives the mobile menu toggle an accessible name and expanded state wiring (Req 11.4)', () => {
    const toggle = doc.querySelector('.menu-toggle');
    expect(toggle, 'mobile menu toggle should exist').toBeTruthy();
    expect(toggle.getAttribute('aria-label')).toMatch(/menu/i);
    expect(toggle.getAttribute('aria-controls')).toBe('mobileMenu');
  });
});
