# BUXENA V2 — working from the Chromebook

Everything here is set up so the same branch can be reviewed and continued from a
browser, with zero additional spending and without exposing secrets.

## What is prepared

| Thing | Where | State |
| --- | --- | --- |
| Source of truth | GitHub `valentinaxentii/buxena`, branch `buxena-v2` | pushed |
| Working environment | GitHub Codespaces, configured by `.devcontainer/devcontainer.json` | one sign-in step needed |
| Non-production preview | Netlify (BUXENA account) | blocked: no Netlify credential on the Windows machine |
| Production | `main` branch → the BUXENA "Coming Soon" placeholder | untouched, remains at `e3b457d` |

## Starting the environment (one step for the account owner)

Open this link while signed in to GitHub as the repository owner:

<https://codespaces.new/valentinaxentii/buxena?ref=buxena-v2>

It opens **create a Codespace** with the `buxena-v2` branch already selected.
Choose **2 cores / 8 GB** (the smallest) and leave **prebuilds off**, then create
it. The container installs dependencies once (`npm ci`); no `.env` is created and
no production credential is copied in.

### Spending controls to confirm before starting

GitHub only bills Codespaces usage beyond the included allowance if a payment
method and spending limit allow it. To guarantee no charge:

1. <https://github.com/settings/billing/spending_limits> — confirm the spending
   limit is **$0** (the default on personal accounts: usage is then blocked, not
   billed, once the included allowance is exhausted).
2. <https://github.com/settings/billing> — check remaining included Codespaces
   compute hours and storage before starting.
3. Set the Codespace idle timeout to **30 minutes** (Settings → Codespaces →
   Default idle timeout) and stop it when finished instead of leaving it running.

The official **Cline** extension (`saoudrizwan.claude-dev`) is requested by the
devcontainer; if Codespaces ever changes that identifier, install "Cline" from
the Extensions view in one click instead.

## Working safely after it starts

```bash
npm ci                 # only if the container did not already do it
npm run check          # type/Astro check
npm test               # unit tests
npm run prelaunch      # full local launch board (safe mode, nothing sent)
npm run qa:flow        # real-browser inquiry-flow QA (safe mode, nothing sent)
npm run dev            # local site at http://127.0.0.1:4321
```

Enquiries stay in safe mode: `npm run dev` is only live if
`ENQUIRIES_DEV_LIVE=true`, and the devcontainer sets it to `false` explicitly.
A submission validates, shows "Local test mode", and writes/sends nothing.

## Rules that still apply

- Never commit `.env`, API keys or production credentials. `.env` is gitignored;
  put local values in the Codespaces secrets store if they are ever needed.
- Do not push to `main`, merge into it, force-push, or trigger a production
  deploy. Production is `main`; `buxena-v2` is a non-production branch.
- ULLA's image rights are unresolved and unchanged: it is excluded from the
  2026-08-11 CAPRA grant and covered only by the 2026-08-17 founder exception for
  its existing catalogue photograph. Do not declare it licensed or use it in paid
  advertising.
- No public prices, stock claims or delivery promises may be invented; the public
  pricing register stays empty until the founder approves exact figures.

## Preview on Netlify (blocked on one credential)

This machine has no Netlify credential: the `netlify` CLI is not installed, there
is no `NETLIFY_AUTH_TOKEN`, `%APPDATA%\netlify\Config\config.json` contains only
`cliId` and telemetry settings, and `.netlify/state.json` holds only geolocation
data with no site ID. Without that credential the account plan, the included
access-protection option and the linked site cannot even be read — so no preview
was created and none is claimed.

### The one sign-in step (account owner only)

Either:

1. `npx --yes netlify-cli login` — opens a browser to authorise the BUXENA
   account, or
2. create a personal access token at
   <https://app.netlify.com/user/applications#personal-access-tokens> and set it
   for the session only: `$env:NETLIFY_AUTH_TOKEN = '<paste once>'`

Never write that token into a file, a commit or this repository.

### Exact sequence after signing in (all non-production)

```powershell
# 1. Confirm who is signed in and whether a site is linked.
npx --yes netlify-cli status

# 2. Read the plan/allowance and find the BUXENA site BEFORE deploying.
npx --yes netlify-cli sites:list
#    Confirm the plan, and check whether deploy/access protection is included.
#    If protection is a PAID feature: stop and report it. Do not upgrade, do not
#    accept an overage, and do not deploy an unprotected preview.

# 3. Build locally, then add a preview-only robots header.
npm run build
node -e "require('fs').writeFileSync('dist/_headers','/*\n  X-Robots-Tag: noindex, nofollow\n')"

# 4. Create a NON-PRODUCTION draft deploy with a stable alias.
#    NEVER add --prod: that publishes production (buxena.com).
npx --yes netlify-cli deploy --dir=dist --alias=buxena-v2-preview
```

Then, in the Netlify UI for that deploy: confirm `BUXENA_SAFE_MODE=true` applies
to it (`netlify.toml` sets it for the deploy-preview and branch-deploy contexts)
and switch access protection on **before** sharing the URL.

### Verify the preview

Open the homepage, `/saunas/`, a product image, `/saunas/bux-ulla/` and the
inquiry flow. Confirm the form reports “Local test mode” (safe mode) instead of
sending anything, and that no new enquiry, email or upload appeared. Confirm
production still shows the “Coming Soon” placeholder.
