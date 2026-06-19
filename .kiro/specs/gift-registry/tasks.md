# Implementation Plan: Gift Registry

## Overview

This plan implements the gift registry across two repositories:

- **`kateandneil.com`** (static site): a new `gift-registry.html` page, a new
  `js/gift-registry.js` module that separates testable pure functions from DOM
  wiring, additive `css/custom.css` rules, and a new "Gift Registry" nav link in
  both the desktop nav and the mobile offcanvas menu on `index.html`. The repo
  currently has no JS test tooling, so a front-end test harness (Vitest +
  fast-check + jsdom) is set up first.
- **`form-handler`** (SAM app, Python 3.13): `src/app.py` gains pure helpers
  `is_gift_registry(payload)` and `build_email(payload)` that branch the SES
  subject/body on the payload `type` field, plus the missing `statusCode 200`
  success return for all payload types, without regressing RSVP behaviour. A
  pytest + Hypothesis + moto/mock harness is set up if not already present.

Work is sequenced so pure functions and their property tests land before/with DOM
wiring, the form-handler change is independently testable, and a final
deploy/commit task pushes both repos to the current branch.

Property-based tests use **fast-check** (front end, via Vitest) and **Hypothesis**
(back end, via pytest with mocked boto3), run a minimum of **100 iterations**
each, and are tagged with a comment in the format:
`Feature: gift-registry, Property {number}: {property_text}`.

## Tasks

- [x] 1. Set up the front-end test harness (kateandneil.com)
  - [x] 1.1 Add JS test tooling and configuration
    - Add `package.json` (dev-only) with Vitest, fast-check, and jsdom as devDependencies
    - Add a Vitest config using the `jsdom` environment and a `test`/`coverage` script
    - Add a `tests/` (or `js/__tests__/`) directory and a smoke test that imports the (initially empty) `js/gift-registry.js` module exports
    - Ensure `node_modules/` and lockfile are git-ignored as appropriate; do not modify site runtime behaviour
    - _Requirements: testing infrastructure for 4.x, 6.x, 7.x, 8.x, 10.x_

- [x] 2. Implement `js/gift-registry.js` pure functions and their property tests
  - [x] 2.1 Implement and export the pure functions
    - In `js/gift-registry.js`, implement `isValidEmail`, `validateContribution`, `buildPayload`, `serializeDraft`, `deserializeDraft`, and a pure `renderExperiences(container, experiences)` grid-render helper
    - `validateContribution` returns `{ valid, errors: [{ field, message }] }` with no DOM access; an entry is produced for every failing field (name 1–100 non-whitespace, email present + well-formed, at least one experience selected) and no others
    - `buildPayload` returns an object with fixed `type: "gift-registry-contribution"` and the captured `name`, `email`, `selectedExperiences`, `amountOrNote`, `message`
    - `serializeDraft` writes a JSON string with a `savedAt` epoch-ms timestamp; `deserializeDraft(json, nowMs)` returns `{ ok: true, draft }` only when parseable and within 30 days, otherwise `{ ok: false }`
    - `renderExperiences` produces exactly one card per experience (title, `<img>` with `alt` including the title, description), substituting `images/placeholder.jpg` when the image source is missing/empty
    - Export the functions in a way importable by Vitest (e.g. attach to `window.GiftRegistry` and provide a module export guard) without breaking direct `<script>` loading in the browser
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 10.1, 10.2, 10.3_

  - [x] 2.2 Write property test for email format
    - **Property 3: Email format acceptance matches the specified rule** — `isValidEmail` returns true iff non-empty local part, exactly one "@", and a non-empty domain containing at least one "."
    - Use fast-check, `numRuns: 100`, generators mixing valid and malformed emails
    - **Validates: Requirements 7.3**

  - [x] 2.3 Write property test for contribution validation
    - **Property 2: Contribution validation flags exactly the failing fields and gates submission** — error set is empty iff all rules pass; otherwise contains an entry for every failing field and no others; correcting one failing field removes exactly that field
    - Use fast-check, `numRuns: 100`, generators producing valid and invalid names/emails/selections
    - **Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.2, 7.4, 7.5, 7.6, 7.7**

  - [x] 2.4 Write property test for payload construction
    - **Property 4: Built payload always identifies the type and preserves all captured fields** — `buildPayload` output has `type === "gift-registry-contribution"` and each field equals its captured input
    - Use fast-check, `numRuns: 100`
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [x] 2.5 Write property test for draft round-trip
    - **Property 5: Draft serialization round-trips within the freshness window** — deserializing the serialization of an input (with a `savedAt` within the last 30 days) yields draft data equal to the original input
    - Use fast-check, `numRuns: 100`
    - **Validates: Requirements 10.1, 10.2**

  - [x] 2.6 Write property test for stale/invalid draft rejection
    - **Property 6: Stale or invalid drafts are rejected** — for any `savedAt` older than 30 days, and any non-parseable string, `deserializeDraft` returns a not-ok result
    - Use fast-check, `numRuns: 100`, generators for stale timestamps and arbitrary non-JSON strings
    - **Validates: Requirements 10.3**

  - [x] 2.7 Write property test for experience grid rendering
    - **Property 1: Experience grid renders one complete card per experience** — for any experience list, rendering into a jsdom container produces exactly one card per experience containing title, an image whose `alt` includes the title, and the description; missing/empty image sources render with `images/placeholder.jpg`
    - Use fast-check, `numRuns: 100`, operating on a jsdom container; generators include missing/empty image cases
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6**

- [x] 3. Checkpoint - pure functions verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create the `gift-registry.html` page (kateandneil.com)
  - [x] 4.1 Build the page scaffold and static structure
    - Mirror `index.html`'s `<head>`: same font preconnect/stylesheet, `vendor/bootstrap.min.css`, `css/custom.css`, full favicon set + `site.webmanifest`, a non-empty `<title>` ("Gift Registry • Kate & Neil") and non-empty `<meta name="description">`
    - Copy the header/nav and mobile offcanvas markup, rewriting Home/section links to `index.html#home`, `index.html#getting-there`, `index.html#accommodation`, `index.html#faqs`, the RSVP button to `index.html#rsvp`, and the monogram logo to `index.html#home`; add the "Gift Registry" link marked `aria-current="page"` in both the desktop nav and the offcanvas, preserving label set and order
    - Add the warm, low-pressure intro section (with a `headings-img`) above the experience grid stating gifts are not expected plus an optional invitation; reserve `--header-offset` top spacing (no `#home` hero)
    - Add the experience grid container `id="experienceGrid"` and a hidden `id="experienceEmpty"` message element
    - Add the payment section using `.standout-card` + `.divider`: PayPal placeholder link (TBD handle, opens in new tab via `target="_blank" rel="noopener"`) and bank transfer details (account holder name TBD placeholder, sort code 40-44-06, account number 11311093)
    - Add the contribution form `id="giftForm"` reusing RSVP form classes (floating labels, cards, buttons) with required `name`/`email`, experience selection group, optional `amountOrNote` (maxlength 200) and `message` (maxlength 1000), programmatic labels/required states, an assertive `#formError` live region and a polite `#formSuccess` live region
    - Add footer/curve markup and deferred scripts: `vendor/bootstrap.bundle.min.js`, `js/main.js`, `js/gift-registry.js`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.4, 5.6, 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 11.1, 11.2, 11.3, 11.4_

  - [x] 4.2 Write unit tests for page markup
    - Parse `gift-registry.html` in jsdom and assert: both stylesheets and fonts linked, full favicon set present, non-empty title + description, nav link count/labels/order and cross-page hrefs, the single "Gift Registry" link with `aria-current="page"`, intro copy present, payment details (sort code `40-44-06`, account `11311093`), form field maxlength attributes, and ARIA wiring (`#formError` assertive, `#formSuccess` polite, labelled required inputs)
    - _Requirements: 1.2, 1.3, 1.6, 1.8, 2.3, 3.1, 3.2, 5.1, 5.2, 6.6, 6.7, 11.1, 11.2, 11.3, 11.4_

- [x] 5. Wire DOM behaviour in `js/gift-registry.js` (kateandneil.com)
  - [x] 5.1 Add the impure DOM-wiring layer over the pure functions
    - Declare the data-driven `experiences` array (placeholder honeymoon experiences, each `{ id, title, description, image }`) and the payment config (`paypalUrl` nullable, bank details)
    - On load: render experiences via `renderExperiences` into `#experienceGrid`, attaching an `onerror` fallback to `images/placeholder.jpg`; if the array is empty, hide the grid and show `#experienceEmpty`
    - Wire debounced (≤1s) `input`/`change` autosave to `localStorage` key `kn-gift-registry-draft-v1` via `serializeDraft(collect())`, wrapped in try/catch (no-op if storage unavailable)
    - On load: restore via `deserializeDraft`; if ok, populate fields and re-check selected experiences; if not ok, remove the stored draft
    - On submit: run `validateContribution`, apply `.is-invalid` to failing inputs and an invalid marker on the experience-selection group, render all messages into `#formError`, scroll the top message into view, and clear a field's invalid state on edit once it passes
    - On valid submit: guard against duplicates, disable button + show spinner, POST `buildPayload(collect())` as JSON to `https://bjr173uis4.execute-api.us-east-1.amazonaws.com/submit` with a 30s `AbortController` timeout; on success show `#formSuccess`, clear the draft, and replace the form inner HTML with a thank-you message; on non-OK/error restore the editable state with values retained
    - _Requirements: 3.5, 4.4, 4.5, 4.7, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.4, 8.5, 8.6, 8.7, 10.1, 10.2, 10.3, 10.4, 10.5, 11.2, 11.3_

  - [x] 5.2 Write unit tests for submit interaction and draft lifecycle
    - With mocked `fetch` and jsdom: single POST on valid submit (8.1), in-flight guard ignores repeat submits (8.4), success message + draft removal (8.5, 10.4), non-OK response restores editable state with values retained (8.6), network error/timeout via aborted fetch (8.7), empty-grid message (4.7), and localStorage-throwing no-op (10.5)
    - _Requirements: 4.7, 8.1, 8.4, 8.5, 8.6, 8.7, 10.4, 10.5_

- [x] 6. Integrate navigation and styling (kateandneil.com)
  - [x] 6.1 Add the "Gift Registry" nav link on `index.html`
    - Add exactly one "Gift Registry" link to the desktop nav `<ul>` and exactly one to the mobile offcanvas menu, both pointing to `gift-registry.html`, preserving existing label order and the offcanvas `data-bs-dismiss="offcanvas"` behaviour
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 Add additive registry styling to `css/custom.css`
    - Add only registry-grid-scoped rules reusing existing theme variables (single column ≤600px, multi-column >600px); introduce no new colour values and no payment-method-specific overrides to card/divider styling
    - _Requirements: 1.5, 4.4, 4.5, 5.6_

- [x] 7. Set up the back-end test harness (form-handler)
  - [x] 7.1 Add pytest + Hypothesis + boto3 mocking if not present
    - Add `requirements-dev.txt` (or equivalent) with `pytest`, `hypothesis`, and `moto` (or rely on `unittest.mock`); add a `tests/` directory and pytest config
    - Add a smoke test importing `src.app` to confirm the harness runs under Python 3.13
    - _Requirements: testing infrastructure for 9.x_

- [x] 8. Update `form-handler/src/app.py` email routing and success return
  - [x] 8.1 Add `is_gift_registry`, `build_email`, and the success response
    - Add `GIFT_REGISTRY_TYPE = "gift-registry-contribution"` and pure `is_gift_registry(payload)` returning `payload.get("type") == GIFT_REGISTRY_TYPE`
    - Add pure `build_email(payload)` returning `{"subject", "body"}`: for gift-registry payloads, subject `"GIFT REGISTRY CONTRIBUTION RECEIVED!"` and a human-readable body listing name, email, selected experiences, amount/note, and message (falling back to `json.dumps(payload, indent=2)` for unexpected shapes); otherwise subject `"RSVP RECEIVED!"` and body `json.dumps(payload, indent=2)` (byte-identical to current behaviour)
    - Use `build_email` to populate the SES `Subject`/`Body`, then add the missing `return {"statusCode": 200, "headers": _cors_headers(), "body": json.dumps({"ok": True, "id": payload["id"]})}` after a successful SES send, for all payload types; leave the existing S3/DynamoDB/SES 500 error branches intact
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.2 Write property test for email routing
    - **Property 7: Email routing distinguishes gift-registry from RSVP without regressing RSVP** — `build_email` returns the gift-registry subject when `type == "gift-registry-contribution"`, else the unchanged `"RSVP RECEIVED!"` subject with the original `json.dumps(payload, indent=2)` body
    - Use Hypothesis, `max_examples=100`, payloads with type present vs absent; assert RSVP body is byte-equal to the legacy dump
    - **Validates: Requirements 9.3, 9.4**

  - [x] 8.3 Write property test for gift-registry email body content
    - **Property 8: Gift-registry email body contains all contribution fields** — for any gift-registry `Contribution_Payload`, the `build_email` body contains the name, email, each selected experience, the amount/note, and the message
    - Use Hypothesis, `max_examples=100`
    - **Validates: Requirements 9.2**

  - [x] 8.4 Write property test for the success response
    - **Property 9: Successfully processed payloads return a success response** — with boto3 mocked to succeed, for any payload the handler returns `statusCode 200` with `ok: true`
    - Use Hypothesis, `max_examples=100`, with S3/DynamoDB/SES mocked
    - **Validates: Requirements 9.5**

  - [x] 8.5 Write integration and RSVP regression tests
    - With mocked boto3: assert `put_object` (S3) and `put_item` (DynamoDB) run before the response and SES `send_email` is called (9.1, 9.2); inject S3/DynamoDB/SES failures each yielding 500 `ok: false` (9.6); regression-guard an existing-shape RSVP payload still yields `"RSVP RECEIVED!"` subject + JSON body and a 200 success (9.4, 9.5)
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6_

- [x] 9. Checkpoint - all automated tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Deploy and publish both repositories
  - [x] 10.1 Commit and push to the current branch in both repos, then deploy the SAM app
    - **Out-of-the-ordinary actions — confirm with the user before running.** This task performs `git push` and an AWS deploy.
    - Per the user's explicit instruction, commit and push directly to the **current branch** in **both** repositories (NO feature branch)
    - `kateandneil.com`: stage `gift-registry.html`, `js/gift-registry.js`, `index.html`, `css/custom.css` (and the dev-only test harness files), commit, and push to the current branch (publishes via GitHub Pages / `CNAME`, no build step)
    - `form-handler`: commit `src/app.py` (and dev test files), push to the current branch, then run `sam build` followed by `sam deploy` using the existing `samconfig.toml`; the `Submit_Endpoint` URL is unchanged so no front-end endpoint change is needed
    - _Requirements: deployment of all of the above_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific granular requirements for traceability.
- Property tests use fast-check (front end) and Hypothesis (back end) at a minimum of 100 iterations, each tagged `Feature: gift-registry, Property {number}: {property_text}`.
- Pure functions (Task 2) and their property tests land before/with the DOM wiring (Task 5); the form-handler change (Task 8) is independently testable.
- Task 10 is the only task involving `git push` and AWS deployment and is intentionally separated and flagged as requiring confirmation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "7.1", "8.1", "4.1", "6.1", "6.2"] },
    { "id": 1, "tasks": ["2.1", "4.2", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "5.1"] },
    { "id": 3, "tasks": ["5.2"] },
    { "id": 4, "tasks": ["10.1"] }
  ]
}
```
