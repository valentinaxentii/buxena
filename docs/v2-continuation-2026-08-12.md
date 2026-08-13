# BUXENA V2 — Continuation State — 2026-08-12

Branch: `buxena-v2` only. V1 / `main` must remain untouched. Nothing in this continuation authorizes a production deploy.

## Completed in this continuation

- Admin/settings authorization changed from fail-open to fail-closed.
- Added independent server-side admin verification to Settings and Staff management before service-role operations.
- Public `/api/enquiries` no longer returns Supabase/internal exception text.
- Public enquiry payloads are size-bounded and text fields are length-bounded before service-role writes.
- Enquiry source labels are normalized to the live `enquiries_source_check` contract so forms such as Quote Comparison and Check Availability cannot be rejected by the database.
- Password-reset requests now have local IP throttling in addition to provider limits.
- Project file drag/drop no longer opens/navigates the browser; invalid/oversize files are rejected. Files remain metadata-only and are not uploaded.
- Added `scripts/security-audit.mjs` and wired it into V2 CI along with Astro check and production build.
- Added `supabase/security-hardening.sql` from live Supabase advisor findings. It is PREPARED ONLY and has not been applied to live Supabase.
- Added `scripts/sync-products-from-content.mjs`, dry-run by default. It audits V2 content models against Supabase and can insert missing product identities only with explicit `--apply`.

## Live Supabase findings (read-only audit)

- Project: BUXENA, healthy.
- `enquiries` live source constraint currently accepts only: Website, Sauna Advisor, Contact Form, Quote Form, Other.
- Live product table currently has 8 rows while V2 has ~35 content models; this can leave converted Leads/Quotes without a matched `product_id` for many models.
- No Storage buckets currently exist. Customer project files therefore must remain metadata-only until a deliberately private storage design is approved.
- Security advisor: `orders_with_margin` security-definer view; three public/signed-in executable SECURITY DEFINER RPCs; mutable search paths on helper functions; leaked-password protection disabled.
- The three SECURITY DEFINER business RPCs already have explicit `service_role` EXECUTE grants, so the prepared revoke-public hardening preserves the server path.
- Performance advisor mainly reports missing foreign-key indexes; these are not current launch blockers at present data volume.

## Verification limitations

- The ChatGPT runtime cannot clone/download a usable repository archive from GitHub, so a local `npm ci`, `astro check`, and `npm run build` could not be truthfully executed here.
- GitHub Actions workflow code exists at `.github/workflows/v2-ci.yml`, but the connected GitHub integration receives 403 for Actions-permission inspection and no workflow run has been observable yet.
- Do not mark build/CI green until a real run is observed.

## Remaining technical blockers before any production launch

1. Execute and verify security audit + Astro check + production build in a runner with repository access.
2. Review/apply `supabase/security-hardening.sql` to the intended BUXENA project, then re-run Supabase security advisor.
3. Reconcile the 35 V2 content models with the 8 live Supabase product identities using `npm run catalog:audit`; review before any `--apply`.
4. Decide whether rich enquiry source labels should get a dedicated DB field/expanded constraint. Current normalization favors never losing a lead over preserving every source label in the row; exact source remains in the activity timeline.
5. Design private customer-project storage before enabling real file upload. Do not use a public bucket.
6. Perform controlled preview/live-enquiry test only with explicit approval and without promoting V2 to production.

## Commercial blockers remain unchanged

- Written image/document permissions.
- Missing dealer EXW for most models.
- Customs-broker duty confirmation.
- Destination/broker/drayage/warehouse/storage/insurance/CAC cost inputs.
- No public retail prices until founder-approved figures exist.
