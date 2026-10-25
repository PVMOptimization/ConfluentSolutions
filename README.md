# Cofulent Solutions

Vite + React + TypeScript. All page code is in `src/App.tsx`.

- Local: `npm install && npm run dev`
- Cloudflare Pages: build command `npm run build`, output directory `dist`
- Hero form posts to `/api/lead` (`functions/api/lead.ts`). Set env var `LEAD_WEBHOOK_URL` (Zapier/Make/Slack webhook) in Pages settings; without it the form shows a call-us error instead of faking success.
- Scroll frames live in `public/Plumberanimated/`.

## Lead form + ad tracking
- Form questions and the budget ranges live near `SERVICE_OPTIONS` in `src/App.tsx`. Swap in real price ranges there.
- Leads reach GoHighLevel with `budgetQualified`, `timelineQualified`, `isQualified`, `adSource` and the ad's `utm_*` / `fbclid`.
- Meta Pixel (browser): set `VITE_META_PIXEL_ID` in Cloudflare Pages, then redeploy. Without it, no pixel loads.
- Meta Conversions API (server): set `META_PIXEL_ID` and `META_CAPI_TOKEN`. Sends a Lead event on final submit, deduplicated with the pixel.
- Meta ad URL parameters: `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}`
