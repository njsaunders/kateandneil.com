# Requirements Document

## Introduction

This feature adds a gift registry page to the Kate & Neil wedding website
(kateandneil.com). The page is a standalone HTML page styled to match the rest
of the site (Bootstrap base, `css/custom.css`, Frank Ruhl Libre + Qwitcher
Grypen fonts, cream/forest colour theme, chevron/curve section dividers, glass
header, mobile offcanvas menu, monogram logo, and `headings-img` decorative
images).

The page invites guests, in a warm and low-pressure tone, to optionally
contribute toward honeymoon experiences. It displays a list of experiences (each
with an image thumbnail and short description), shows fee-free payment methods
(PayPal and bank transfer), and provides a contribution form so the couple can
send personalised thank-you notes. The contribution form reuses the existing
form-handler Lambda endpoint, sending a distinct JSON payload shape so
contributions can be told apart from RSVP submissions.

This requirements document focuses on observable behaviour (the "what"). Specific
copy, experience content, payment account details, and implementation choices are
captured during design and tasks.

### Confirmed decisions

- **D1** — The navigation link to the new page is labelled "Gift Registry".
- **D2** — Displayed payment methods are a PayPal link/handle and UK bank
  transfer details. The couple have confirmed they are comfortable showing bank
  details on the public page. Confirmed bank details: sort code 40-44-06, account
  number 11311093. The account holder name and PayPal link/handle are still to be
  provided and are captured during tasks.
- **D3** — The contribution form captures: contributor name, contact email, the
  experience(s) selected, an optional amount/contribution note, and an optional
  free-text message.

### Pending content (to be provided later)

- **P1** — The honeymoon experiences (title, short description, and image) will
  be provided by the couple later. Until then the Experience_List uses
  placeholder content backed by an existing or placeholder image in `images/`,
  structured so real experiences can be dropped in without code changes.
- **P2** — The PayPal link/handle and the bank account holder name will be
  provided by the couple later.

## Glossary

- **Registry_Page**: The standalone gift registry HTML page added to the site.
- **Home_Page**: The existing `index.html` single-page site.
- **Site_Navigation**: The header navigation present on every page, including the
  desktop nav links and the mobile offcanvas menu.
- **Experience**: A single honeymoon item presented to guests, consisting of a
  title, a short description, and an image thumbnail.
- **Experience_List**: The collection of all Experiences shown on the
  Registry_Page.
- **Payment_Section**: The area of the Registry_Page that displays fee-free
  payment methods (PayPal and bank transfer).
- **Contribution_Form**: The form on the Registry_Page used to capture what a
  guest has selected or contributed toward.
- **Form_Handler**: The existing Lambda application (form-handler repo) that
  accepts a JSON POST at the HTTP API submit endpoint and stores submissions to
  S3 and DynamoDB and emails them.
- **Submit_Endpoint**: The HTTP API endpoint
  `https://bjr173uis4.execute-api.us-east-1.amazonaws.com/submit` exposed by the
  Form_Handler.
- **Contribution_Payload**: The JSON object the Contribution_Form sends to the
  Submit_Endpoint describing a guest's selections.
- **Draft**: A locally stored, in-progress copy of the Contribution_Form input
  saved in the browser's localStorage.

## Requirements

### Requirement 1: Standalone, on-brand registry page

**User Story:** As a wedding guest, I want a gift registry page that looks and
feels like the rest of the wedding website, so that the experience is seamless
and trustworthy.

#### Acceptance Criteria

1. THE Registry_Page SHALL be served as a separate HTML page reachable at its own
   distinct URL path, separate from the Home_Page.
2. THE Registry_Page SHALL load the same stylesheets used by the Home_Page,
   namely `vendor/bootstrap.min.css` and `css/custom.css`.
3. THE Registry_Page SHALL load the same web fonts used by the Home_Page (Frank
   Ruhl Libre and Qwitcher Grypen).
4. IF a web font fails to load, THEN THE Registry_Page SHALL fall back to the
   site's default font stack without breaking the page layout.
5. THE Registry_Page SHALL apply the site cream/forest colour theme using the
   existing CSS theme variables and classes (such as `bg-cream` and `text-dark`)
   and SHALL NOT introduce new colour values outside the existing theme.
6. THE Registry_Page SHALL include the glass header, monogram logo, chevron/curve
   section dividers, and at least one `headings-img` decorative image consistent
   with the Home_Page.
7. WHEN a guest selects a header navigation link or the monogram logo on the
   Registry_Page, THE Site_Navigation SHALL resolve to the Home_Page or the
   corresponding Home_Page section rather than to a broken in-page anchor.
8. THE Registry_Page SHALL include the same favicon link set as the Home_Page and
   SHALL provide a non-empty document title and a non-empty meta description.
9. THE Registry_Page SHALL render without horizontal page scrolling and with all
   text and interactive elements visible and legible across mobile (320–575px),
   tablet (576–991px), and desktop (992–1920px) viewport widths using the
   existing Bootstrap responsive layout.

### Requirement 2: Navigation between pages

**User Story:** As a wedding guest, I want a clear link to the gift registry from
the site navigation, so that I can find it from any part of the site.

#### Acceptance Criteria

1. THE Site_Navigation desktop links on the Home_Page SHALL include exactly one
   visible, selectable link to the Registry_Page, labelled with text that
   identifies the gift registry.
2. WHILE the viewport renders the mobile offcanvas menu on the Home_Page, THE
   Site_Navigation SHALL include exactly one visible, selectable link to the
   Registry_Page within the offcanvas menu.
3. THE Registry_Page SHALL include the same Site_Navigation structure as the
   Home_Page, containing the identical set of desktop link labels and the
   identical set of mobile offcanvas menu link labels in the same order.
4. THE Site_Navigation on the Registry_Page SHALL provide a selectable link to
   the Home_Page and a selectable link to each primary section listed in the
   Home_Page Site_Navigation.
5. WHEN a guest selects the registry navigation link, THE Site_Navigation SHALL
   load and display the Registry_Page within 3 seconds under normal network
   conditions.
6. WHEN a guest opens the mobile offcanvas menu and selects the registry
   navigation link, THE Site_Navigation SHALL close the offcanvas menu and load
   and display the Registry_Page within 3 seconds under normal network conditions.
7. IF the Registry_Page fails to load after a guest selects the registry
   navigation link, THEN THE Site_Navigation SHALL display an error message
   indicating the page could not be loaded and SHALL keep the guest on the current
   page.

### Requirement 3: Warm, low-pressure introduction

**User Story:** As a wedding guest, I want a friendly introduction that makes
clear gifts are not expected, so that I feel no obligation to contribute.

#### Acceptance Criteria

1. THE Registry_Page SHALL display an introductory message that explicitly states
   contributions and gifts are not expected.
2. THE Registry_Page SHALL display, within the introductory message, an optional
   invitation to contribute toward the honeymoon experiences for guests who wish
   to.
3. THE introductory message SHALL use a tone consistent with the published site
   copy (relaxed, warm, playful, British, understated) and SHALL NOT use formal,
   demanding, or guilt-inducing language.
4. THE introductory message SHALL appear above the Experience_List and SHALL be
   visible on initial page load without scrolling on a desktop viewport.
5. IF the introductory message content fails to load, THEN THE Registry_Page SHALL
   still render the Experience_List and Contribution_Form without error.

### Requirement 4: Display honeymoon experiences

**User Story:** As a wedding guest, I want to see the honeymoon experiences with
images and descriptions, so that I can choose something meaningful to contribute
toward.

#### Acceptance Criteria

1. THE Registry_Page SHALL display each Experience in the Experience_List as a
   card containing the Experience title (1 to 80 characters), an image thumbnail,
   and a description of no more than 200 characters.
2. THE Registry_Page SHALL render exactly one card for every Experience present in
   the Experience_List.
3. IF an Experience image is unavailable (its source is missing or fails to load),
   THEN THE Registry_Page SHALL display the placeholder image in its place,
   occupying the same thumbnail dimensions as a loaded image.
4. WHILE the viewport width is 600 pixels or less, THE Registry_Page SHALL reflow
   the Experience grid to a single column.
5. WHILE the viewport width is greater than 600 pixels, THE Registry_Page SHALL
   present the Experience grid in two or more columns.
6. THE Registry_Page SHALL provide alternative text for each Experience image that
   includes that Experience's title.
7. WHEN the Experience_List contains zero Experiences, THE Registry_Page SHALL
   display a message indicating that no honeymoon experiences are currently
   available.

### Requirement 5: Fee-free payment methods

**User Story:** As a couple, we want to show payment methods that do not charge
commission or transaction fees, so that contributions are not reduced by fees.

#### Acceptance Criteria

1. THE Payment_Section SHALL display a PayPal payment method labelled as PayPal.
2. THE Payment_Section SHALL display bank transfer details as a payment method,
   including account holder name, sort code, and account number.
3. THE Registry_Page SHALL NOT integrate any third-party payment service or widget
   that deducts commission or per-transaction fees from a contribution.
4. WHERE a PayPal link is provided, THE Payment_Section SHALL render it as an
   activatable link that opens the linked destination in a new browser tab.
5. IF a PayPal link is not provided, THEN THE Payment_Section SHALL omit the
   PayPal activatable link and SHALL NOT display a non-functional or empty link
   element.
6. WHEN the Payment_Section is rendered, THE Payment_Section SHALL present each
   payment method inside the same card component and divider elements used
   elsewhere on the Registry_Page, with no payment-method-specific overrides to
   card border, padding, or divider styling.

### Requirement 6: Capture contributions via a form

**User Story:** As a couple, we want to capture what guests selected or
contributed toward, so that we can send personalised thank-you notes.

#### Acceptance Criteria

1. THE Contribution_Form SHALL capture the contributor name as a required text
   field accepting 1 to 100 characters.
2. THE Contribution_Form SHALL capture a contact email address as a required text
   field accepting 1 to 254 characters.
3. THE Contribution_Form SHALL allow a guest to select between one and the total
   number of Experiences present in the Experience_List.
4. THE Contribution_Form SHALL provide an optional contribution amount-or-note
   text field accepting 0 to 200 characters.
5. THE Contribution_Form SHALL provide an optional free-text message field
   accepting 0 to 1000 characters.
6. THE Contribution_Form SHALL present fields using the same form styling
   conventions as the existing RSVP form (Bootstrap floating labels, cards, and
   buttons).
7. IF a guest enters more characters than a field's maximum length, THEN THE
   Contribution_Form SHALL prevent input beyond that maximum length.

### Requirement 7: Contribution form validation

**User Story:** As a wedding guest, I want clear feedback when my form input is
incomplete or invalid, so that I can correct it before submitting.

#### Acceptance Criteria

1. WHEN a guest submits the Contribution_Form with a name field that is empty or
   contains only whitespace characters, THE Contribution_Form SHALL display a
   validation message indicating that the name is required and SHALL mark the name
   field as invalid.
2. WHEN a guest submits the Contribution_Form with an email field that is empty or
   contains only whitespace characters, THE Contribution_Form SHALL display a
   validation message indicating that the email is required and SHALL mark the
   email field as invalid.
3. IF a guest submits the Contribution_Form with an email value that does not
   contain a non-empty local part, a single "@" separator, and a non-empty domain
   part containing at least one "." separator, THEN THE Contribution_Form SHALL
   display a validation message indicating that the email format is invalid and
   SHALL mark the email field as invalid.
4. IF a guest submits the Contribution_Form without selecting at least one
   Experience, THEN THE Contribution_Form SHALL display a validation message
   indicating that at least one Experience selection is required.
5. IF a guest submits the Contribution_Form while one or more fields fail
   validation, THEN THE Contribution_Form SHALL NOT submit the contribution and
   SHALL retain all guest-entered field values.
6. WHEN a guest submits the Contribution_Form with more than one field failing
   validation, THE Contribution_Form SHALL display a validation message for, and
   mark as invalid, every field that fails validation.
7. WHEN a guest changes the value of a field previously marked invalid and the
   changed value passes that field's validation rules, THE Contribution_Form SHALL
   clear the invalid indicator and the associated validation message for that
   field.
8. WHILE one or more validation messages are displayed, THE Contribution_Form
   SHALL scroll the topmost displayed validation message into view within 1 second
   of the messages being displayed.

### Requirement 8: Submit contributions to the existing endpoint

**User Story:** As a couple, we want contribution submissions delivered through
our existing form-handler, so that they are stored and emailed alongside our
other submissions.

#### Acceptance Criteria

1. WHEN a guest submits a valid Contribution_Form, THE Contribution_Form SHALL
   send exactly one Contribution_Payload as a JSON POST to the Submit_Endpoint.
2. THE Contribution_Payload SHALL include a field that identifies the submission
   as a gift-registry contribution, distinct from an RSVP submission.
3. THE Contribution_Payload SHALL include the contributor name, contact email,
   selected Experiences, optional amount or note, and optional message.
4. WHILE a submission request is in progress, THE Contribution_Form SHALL disable
   the submit control, display a submitting indicator, and ignore any further
   submit activations.
5. WHEN the Submit_Endpoint returns a success response, THE Contribution_Form
   SHALL display a confirmation message indicating the contribution was received
   successfully.
6. IF the Submit_Endpoint returns a response that does not indicate success, THEN
   THE Contribution_Form SHALL display an error message indicating the submission
   failed, remove the submitting indicator, re-enable the submit control, and
   retain all entered field values.
7. IF the submission request fails due to a network error, or no response is
   received within 30 seconds of sending the request, THEN THE Contribution_Form
   SHALL display an error message indicating the submission failed, remove the
   submitting indicator, re-enable the submit control, and retain all entered
   field values.

### Requirement 9: Form-handler compatibility

**User Story:** As a couple, we want the form-handler to correctly receive and
distinguish contribution submissions, so that thank-you follow-up is reliable.

#### Acceptance Criteria

1. WHEN the Form_Handler receives a Contribution_Payload at the Submit_Endpoint,
   THE Form_Handler SHALL store the payload to S3 and DynamoDB before returning a
   response.
2. WHEN the Form_Handler receives a Contribution_Payload, THE Form_Handler SHALL
   email the contributor name, contact email, selected Experiences, optional
   amount or note, and optional message to the couple.
3. WHEN a received payload contains the field that identifies it as a
   gift-registry contribution, THE Form_Handler SHALL indicate in the
   notification email subject and body that the submission is a gift-registry
   contribution rather than an RSVP.
4. THE Form_Handler SHALL continue to store and email existing RSVP submissions
   with the same storage and email outcomes as before this feature.
5. WHEN the Form_Handler successfully stores a Contribution_Payload, THE
   Form_Handler SHALL return a success response to the Contribution_Form.
6. IF the Form_Handler fails to store or email a received Contribution_Payload,
   THEN THE Form_Handler SHALL return an error response to the Contribution_Form.

### Requirement 10: Draft autosave for the contribution form

**User Story:** As a wedding guest, I want my in-progress contribution input to be
remembered, so that I do not lose it if I navigate away and return.

#### Acceptance Criteria

1. WHEN a guest changes any Contribution_Form field, THE Contribution_Form SHALL
   save the current values of all Contribution_Form fields as a single Draft to
   browser localStorage within 1 second of the change.
2. WHEN the Registry_Page loads and a valid Draft saved within the previous 30
   days exists, THE Contribution_Form SHALL restore the saved values into their
   corresponding Contribution_Form fields.
3. IF a stored Draft is older than 30 days, or cannot be parsed as valid Draft
   data, THEN THE Contribution_Form SHALL remove the stored Draft from
   localStorage and load the Contribution_Form with empty fields.
4. WHEN a contribution submission succeeds, THE Contribution_Form SHALL remove
   the stored Draft from browser localStorage.
5. IF localStorage is unavailable, THEN THE Contribution_Form SHALL continue to
   accept input and allow submission without raising an error and without saving
   a Draft.

### Requirement 11: Accessibility

**User Story:** As a guest using assistive technology, I want the registry page to
be accessible, so that I can read the content and complete the form.

#### Acceptance Criteria

1. THE Contribution_Form SHALL associate a programmatic label with every input
   control, and SHALL programmatically indicate which controls are required so
   that assistive technologies announce the required state.
2. WHEN the Contribution_Form displays one or more validation messages, THE
   Contribution_Form SHALL expose those messages to assistive technologies using
   an assertive live region and SHALL programmatically associate each validation
   message with its corresponding input control.
3. WHEN the Contribution_Form displays a submission confirmation message, THE
   Contribution_Form SHALL expose that message to assistive technologies using a
   polite live region.
4. THE Registry_Page SHALL provide accessible names for the Site_Navigation
   controls, including the mobile menu toggle, and SHALL expose the expanded or
   collapsed state of the mobile menu toggle to assistive technologies.
5. THE Registry_Page interactive controls, including the Site_Navigation links,
   the mobile menu toggle, the Experience selection controls, the
   Contribution_Form input fields, and the submit control, SHALL be reachable and
   activatable using only a keyboard, presented in a logical focus order, with a
   visible focus indicator on the currently focused control.
6. WHEN a guest closes the mobile offcanvas menu, THE Site_Navigation SHALL return
   keyboard focus to the mobile menu toggle.
