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

## Preview — live and protected

**URL:** <https://v2--buxena-v2-preview.netlify.app>

It is a draft deploy (with a stable alias) of the built `buxena-v2` revision on a
**separate Netlify project** called `buxena-v2-preview`, not on the project that
serves buxena.com. Nothing done there can affect production.

**Access:** the project is **private**, enforced by Netlify login — the included
protection on credit-based plans (site passwords are Pro-only). Sign in to Netlify
as `valentin.axentii@gmail.com` in the same browser. An unauthenticated request
currently gets **HTTP 401**, which was verified after protection was enabled.

**Safety on that project:** `BUXENA_SAFE_MODE=true` is set on the project *and*
passed per deploy, so the inquiry API answers `{"ok":true,"devMode":true}` and
writes and sends nothing. No Supabase, Zoho or Telegram credential exists on that
project, so the enquiry API could not reach live services even if the flag were
wrong. `X-Robots-Tag: noindex, nofollow` and a `Disallow: /` robots.txt are served
on this preview only.

**Verified on the hosted preview:** homepage (V2 wording), catalogue with ULLA
listed, ULLA page with its hero image and presentation PDF, EDA 160 with the
verified CAPRA hero, a source PNG and a WebP variant, robots.txt, and the
safe-mode inquiry API — **16/16 checks** before protection was switched on, then a
**401** gate afterwards.


### The one sign-in step (account owner only)

Either:

1. `npx --yes netlify-cli login` — opens a browser to authorise the BUXENA
   account, or
2. create a personal access token at
   <https://app.netlify.com/user/applications#personal-access-tokens> and set it
   for the session only: `$env:NETLIFY_AUTH_TOKEN = '<paste once>'`

Never write that token into a file, a commit or this repository.

### Updating the preview (exact commands that were used)

```powershell
npm run build

# A normal `netlify deploy` runs the build itself, which deletes these two files,
# so patch them and deploy with --no-build.
node -e "require('fs').writeFileSync('dist/_headers','/*\n  X-Robots-Tag: noindex, nofollow\n')"
node -e "require('fs').writeFileSync('dist/robots.txt','# BUXENA V2 non-production preview. Not for indexing.\nUser-agent: *\nDisallow: /\n')"

npx --yes netlify-cli@latest deploy --dir=dist --no-build --site 1c41d814-c514-4236-a98d-826b49dea4a3 --alias v2 --env BUXENA_SAFE_MODE=true --message "V2 preview"
```

Never add `--prod`: on the production project that publishes buxena.com. The site
id above is the separate `buxena-v2-preview` project.

### How the protection was set (and how to undo it)

Team login (private project) is applied to the preview project only:

```powershell
# on  — unauthenticated visitors get 401; the owner signs in to Netlify
npx --yes netlify-cli@latest api updateSite --data '{\"site_id\":\"1c41d814-c514-4236-a98d-826b49dea4a3\",\"sso_login\":true,\"sso_login_context\":\"all\"}'
# off — make the preview public again
npx --yes netlify-cli@latest api updateSite --data '{\"site_id\":\"1c41d814-c514-4236-a98d-826b49dea4a3\",\"sso_login\":false}'
```

### Removing the preview entirely

```powershell
npx --yes netlify-cli@latest api deleteSite --data '{\"site_id\":\"1c41d814-c514-4236-a98d-826b49dea4a3\"}'
```

Production was verified unchanged throughout: `buxena.com` still serves the
"Coming Soon" page, and the production project still publishes `main` at
`e3b457d` with protection off.
