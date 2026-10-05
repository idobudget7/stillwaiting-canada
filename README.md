# StillWaiting — Canada

A minimalist, privacy-first Canadian service-standard calculator.

## What it does

A visitor selects a Canadian service, chooses the applicable submission method, enters the date the complete request was received, and gets:

- the published service standard
- an estimated service-standard date
- whether they are within or past the standard
- plain-language next steps
- a link to the official source
- a live check that the official source still contains the rule markers used by the calculator
- an optional local `.ics` calendar reminder

No account, email, database, API key, analytics or AI is required.

## Freshness architecture

`services.json` remains the reviewed source of truth for calculations. The site does **not** blindly scrape a government page and automatically change deadlines, because a wording/layout change could create a dangerously wrong rule.

Instead it uses two safeguards:

1. **Live source check on Vercel** — `/api/source-health` fetches the selected official government page and checks that expected rule markers are still present. If the markers change, the result warns the visitor to use the official source rather than silently trusting stale data.
2. **Weekly GitHub source watch** — `.github/workflows/source-watch.yml` checks all official pages every Monday. A changed/missing marker fails the GitHub Action so the repository owner can review `services.json`.

After reviewing an official rule change, update `services.json` and its top-level `verified` date.

This is intentionally fail-safe rather than fully automatic: official pages can change structure or wording, and auto-parsing legal/service rules into new deadlines without human review is less trustworthy than flagging a change.

## Run locally

Because the service library is loaded with `fetch`, use a local web server rather than double-clicking the HTML file:

```bash
python3 -m http.server 8080
```

The calculator works locally. The live `/api/source-health` endpoint requires Vercel (or `vercel dev`), so a plain Python server will show that live verification is unavailable.

## Deploy to Vercel

1. Create a GitHub repository.
2. Upload the entire project, including the `.github`, `api`, and `scripts` folders.
3. In Vercel choose **Add New > Project** and import the GitHub repository.
4. Framework preset: **Other**.
5. No build command or environment variables are required.
6. Deploy.

Vercel serves the static site and automatically deploys `api/source-health.js` as a serverless function.

## Privacy rule

Do not ask visitors for SINs, passport numbers, application numbers or case identifiers. The source-health endpoint receives only the selected public service ID; the visitor's date is not sent to it.

## Important limitation

No public website can guarantee that external government rules or pages will never change or disappear. This project is designed to **detect** likely source changes and fail visibly instead of silently serving old information.
