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

The Windows machine has no Netlify login (`netlify` CLI not installed, no
`NETLIFY_AUTH_TOKEN`, no `%APPDATA%\netlify\config.json`, and `.netlify/state.json`
holds only geolocation data with no site ID). Without that credential the plan,
the available access-protection option and the linked site cannot even be read,
so no preview was created and none is claimed.

To unblock, do **one** of these on the Windows machine (or in the Codespace):

1. `npx netlify-cli login` — opens a browser to authorise the BUXENA account, or
2. create a personal access token at
   <https://app.netlify.com/user/applications#personal-access-tokens> and set it
   for the session only: `$env:NETLIFY_AUTH_TOKEN = '<paste once>'`.

Then the preview needs no code changes: `netlify deploy` from this repository
creates a draft deploy, `netlify status` shows the plan and allowance, and the
passwords/access-protection option can be checked **before** deploying. Nothing
paid is required for a draft deploy, and no plan upgrade may be accepted.
