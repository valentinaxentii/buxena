# Controlled Acknowledgment Test — exact email

Rendered 2026-08-11 through the real code path (`/api/enquiries` → dev-mode
preview), so this is byte-for-byte what a live test would send.

**NOT SENT.** Sending requires the Netlify environment variables and a preview
deployment — see `docs/launch-checklists.md` §2–3.

**Test input used**

| Field | Value |
|---|---|
| Name | Valentin Axentii |
| Email | daxentii57@gmail.com |
| ZIP | 06010 |
| Model | UKU 230 (BUH-11) |
| Message | Controlled live test of the BUXENA acknowledgment email. |
| Source | Quote Form |

---

**From:** BUXENA &lt;info@buxena.com&gt; *(derived from `ZOHO_SMTP_USER`)*
**To:** daxentii57@gmail.com
**Subject:** We received your BUXENA request

---

```
BUXENA

Thank you, Valentin.

We've received your request for the UKU 230.

A BUXENA specialist will review your project details and follow up with you directly.

Your request:
  Model: UKU 230
  Location / ZIP: 06010

Your notes:
Controlled live test of the BUXENA acknowledgment email.

Your UKU 230 presentation:
https://buxena.com/docs/presentations/uku-230-presentation.pdf

If there's anything else you'd like us to consider — measurements, photos, site
details, or questions — simply reply to this email.

We look forward to helping you create the right sauna for your space.

BUXENA
Where Wellness Starts
buxena.com · info@buxena.com
```

The HTML version carries the same wording in the BUXENA card layout (cream
ground, espresso wordmark, bronze download button reading **Download the
UKU 230 presentation**), with a plain-text fallback for clients that block HTML.

---

## What to check when the test arrives

- [ ] It arrives at all (not in spam — check the spam folder too)
- [ ] Sender shows as **BUXENA**, not a raw address
- [ ] Your first name only, spelled correctly
- [ ] Model reads **UKU 230** — never the supplier's designation
- [ ] The presentation link opens the **UKU 230** PDF, not another model
- [ ] Renders correctly on a phone
- [ ] Replying goes to info@buxena.com
- [ ] No price, no delivery promise, no warranty claim anywhere

## One known behaviour

The link points at `https://buxena.com/docs/presentations/…`, the **production**
domain. On a preview deployment that URL only resolves once the site is live on
buxena.com. If you want it clickable during the preview test, open the same path
on the preview domain manually to confirm the file is correct.
