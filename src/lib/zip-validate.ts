import { ZIP_MESSAGE, isValidUsZip } from './zip';

/**
 * Client-side ZIP validation, wired once per page.
 *
 * Runs in the browser. Marks up any input carrying `data-zip-input` with
 * immediate inline feedback and blocks submission while the value is wrong.
 *
 * Why a shared module rather than per-form code: BUXENA collects a ZIP on
 * seven different forms, two of which are multi-step wizards with their own
 * navigation. Seven copies of a validation rule is how you end up with the
 * bug this replaces — most fields already carried a `pattern`, but the two
 * wizard steps were never inside a submitting form, so their pattern was
 * decorative and 012545 sailed through.
 */

const INVALID_CLASS = 'is-zip-invalid';

function messageElementFor(input: HTMLInputElement): HTMLElement {
  const existing = input.parentElement?.querySelector<HTMLElement>('[data-zip-error]');
  if (existing) return existing;

  const el = document.createElement('p');
  el.setAttribute('data-zip-error', '');
  el.className = 'zip-error';
  el.setAttribute('role', 'alert');
  el.hidden = true;
  // After the input so screen readers meet the field first, and so it does not
  // displace the label.
  input.insertAdjacentElement('afterend', el);
  return el;
}

/**
 * Validate one field and paint the result.
 * `eager` false means "do not shout at someone who is still typing".
 */
export function validateZipInput(input: HTMLInputElement, eager = true): boolean {
  const raw = input.value.trim();
  const empty = raw === '';
  const required = input.required;
  const valid = empty ? !required : isValidUsZip(raw);

  const error = messageElementFor(input);

  // setCustomValidity keeps native form submission blocked too, so a form that
  // posts normally cannot get past this even if the inline UI is bypassed.
  input.setCustomValidity(valid ? '' : ZIP_MESSAGE);

  const show = !valid && (eager || !empty);
  error.textContent = show ? (empty ? 'Enter your ZIP code.' : ZIP_MESSAGE) : '';
  error.hidden = !show;
  input.classList.toggle(INVALID_CLASS, show);
  input.setAttribute('aria-invalid', show ? 'true' : 'false');

  return valid;
}

/** Every ZIP field on the page. */
export function zipInputs(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('[data-zip-input]'));
}

/**
 * True when every ZIP field in `root` is valid; paints all of them and focuses
 * the first offender. Call from a custom submit or wizard "next" handler.
 */
export function zipFieldsValid(root: ParentNode = document): boolean {
  const fields = zipInputs(root);
  let firstBad: HTMLInputElement | null = null;
  for (const input of fields) {
    if (!validateZipInput(input, true) && !firstBad) firstBad = input;
  }
  if (firstBad) {
    firstBad.focus();
    firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

/**
 * Attach behaviour to every ZIP field on the page.
 *
 * - strips anything that is not a digit as it is typed, and caps at 5, so the
 *   field cannot hold 012545 in the first place
 * - validates quietly while typing, firmly on blur
 * - blocks the submit event of any form containing a ZIP field
 */
export function initZipValidation(root: ParentNode = document): void {
  const fields = zipInputs(root);
  if (fields.length === 0) return;

  for (const input of fields) {
    // Belt: keep the attributes right even if a template forgets one.
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'postal-code';
    input.maxLength = 5;

    input.addEventListener('input', () => {
      // Digits only, five at most. Done on input so a pasted "06410-1234"
      // becomes "06410" rather than sitting there as an error.
      const cleaned = input.value.replace(/\D/g, '').slice(0, 5);
      if (cleaned !== input.value) {
        const atEnd = input.selectionStart === input.value.length;
        input.value = cleaned;
        if (atEnd) input.setSelectionRange(cleaned.length, cleaned.length);
      }
      // Quiet while typing: no error until they have had a chance to finish.
      validateZipInput(input, false);
    });

    input.addEventListener('blur', () => validateZipInput(input, true));

    const form = input.form;
    if (form && !form.hasAttribute('data-zip-guarded')) {
      form.setAttribute('data-zip-guarded', '');
      form.addEventListener(
        'submit',
        (event) => {
          if (!zipFieldsValid(form)) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        // Capture phase: this must run BEFORE the page's own submit handler,
        // which typically calls preventDefault and posts via fetch. Registering
        // in the bubble phase would let that handler send the request first.
        true
      );
    }
  }
}
