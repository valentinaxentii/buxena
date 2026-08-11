/**
 * Shared client-side enquiry submission for every public lead form.
 *
 * One path for all forms (quote, availability, project intake, trade,
 * see-it-in-my-space, advisor review):
 *  - POSTs to /api/enquiries
 *  - dev mode: the server short-circuits before any production service and
 *    answers { ok, devMode } — the UI shows a "local test mode" success
 *    instead of redirecting
 *  - errors render as an inline BUXENA-styled status block (never
 *    window.alert), and the visitor's entered data is left untouched
 *  - successful real submissions store a summary in sessionStorage so
 *    /thank-you/ can greet the buyer with their actual project details
 *
 * SECURITY: this file runs in the browser. It holds no keys of any kind —
 * Supabase, SMTP and Telegram credentials live exclusively server-side.
 */

export interface EnquiryResult {
  ok: boolean;
  devMode?: boolean;
  error?: string;
}

export async function submitEnquiry(payload: Record<string, unknown>): Promise<EnquiryResult> {
  // Captured only at submission time, not across visits. Query-string values
  // are limited to standard campaign keys so CRM users see useful attribution
  // without storing arbitrary URL parameters or a visitor's full referrer URL.
  const params = new URLSearchParams(window.location.search);
  const attribution = {
    landingPath: `${window.location.pathname}${window.location.search}`,
    referrerHost: (() => {
      try { return document.referrer ? new URL(document.referrer).hostname : ''; }
      catch { return ''; }
    })(),
    utmSource: params.get('utm_source') ?? '',
    utmMedium: params.get('utm_medium') ?? '',
    utmCampaign: params.get('utm_campaign') ?? '',
    utmContent: params.get('utm_content') ?? '',
    utmTerm: params.get('utm_term') ?? '',
  };
  const enrichedPayload = { ...payload, attribution };

  const emit = (event: 'form_success' | 'form_error', extra: Record<string, unknown> = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event,
      formType: payload.source ?? '',
      model: payload.saunaInterest ?? '',
      landing_page: window.location.pathname,
      ...extra,
    });
  };

  try {
    const res = await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      emit('form_error', { errorStatus: res.status });
      return { ok: false, error: body.error || `Request failed (${res.status})` };
    }
    emit('form_success', { devMode: Boolean(body.devMode) });
    return { ok: true, devMode: Boolean(body.devMode) };
  } catch {
    emit('form_error', { errorStatus: 'network' });
    return { ok: false, error: 'Network error' };
  }
}

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Summary the thank-you page renders. Only non-sensitive display fields. */
export function rememberEnquiry(summary: Record<string, string>): void {
  try {
    sessionStorage.setItem('buxena:lastEnquiry', JSON.stringify(summary));
  } catch {
    /* storage unavailable — thank-you page falls back to its generic copy */
  }
}

/**
 * Inline status block, injected after the form's submit button. Replaces
 * window.alert for both the dev-mode success and the failure state. The
 * form's fields are never cleared — "Try again" just dismisses the notice.
 */
export function showFormStatus(
  form: HTMLFormElement,
  kind: 'dev-success' | 'error',
  detail?: string
): void {
  form.querySelector('.form-status')?.remove();

  const box = document.createElement('div');
  box.className = `form-status form-status--${kind === 'error' ? 'error' : 'dev'}`;
  box.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  if (kind === 'dev-success') {
    // devMode is only ever true from the astro-dev server — this copy
    // cannot appear in a production build's runtime behavior.
    box.innerHTML = `
      <p class="form-status__title">Your project is started</p>
      <p class="form-status__body">Local test mode — this enquiry was captured for testing and was not sent to the live BUXENA sales system.</p>
      ${detail ? `<p class="form-status__body form-status__detail"></p>` : ''}
    `;
    if (detail) box.querySelector('.form-status__detail')!.textContent = detail;
  } else {
    box.innerHTML = `
      <p class="form-status__title">We couldn't send your request just now.</p>
      <p class="form-status__body">Your information is still on this page. Please try again.</p>
      <div class="form-status__actions">
        <button type="button" class="form-status__retry">Try again</button>
        <a class="form-status__mail" href="mailto:info@buxena.com">Email BUXENA</a>
      </div>
    `;
    box.querySelector('.form-status__retry')!.addEventListener('click', () => box.remove());
  }

  form.appendChild(box);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
