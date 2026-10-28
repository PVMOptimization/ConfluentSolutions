# /quote landing page: conversion redesign spec

This spec is for the page Meta and Google ads send people to: `https://confluentsolutions.pages.dev/quote`. The page code is in `src/App.tsx` (React) and `quote.html`.

**Goal:** a Fort Worth homeowner who taps an ad knows within 3 seconds who you are, that the page matches the ad they tapped, and the one thing to do next. Each step of the form is easier than the last, and every element on the page either builds trust or moves them forward.

Each item is marked **P1** (fix first, biggest impact), **P2** or **P3**.

---

## 0. What the research says (why each change is here)

| Finding | Source | What it means for this page |
|---|---|---|
| Landing pages convert at a median of 6.6% (41k pages, 464M visits). The top quarter convert above 11%. | Unbounce benchmark via ClickMinded | Aim for 8–12% of ad clicks completing the form. |
| Copy at a 5th–7th grade reading level converted at 11.1%, versus 5.3% for professional-level copy. | Unbounce 2024 via FoundryCRO | Use short words and short sentences. Headlines of 4–9 words. |
| Matching the landing page to the ad gave a 212% lift (Moz/CRE case). Swapping headline text to match the ad gave a 31.4% lift. | FoundryCRO | Use one headline that names all 5 jobs, then make the first form question the job type (section 1.3). |
| Specific headlines beat generic ones by 18–47%. Headlines naming a benefit and a time frame averaged a 23% lift. | FoundryCRO | "Plumbing and gas line work, done right" is generic, so replace it. |
| One link on a page: 13.5% conversion. Five or more links: 10.5%. Removing navigation lifted every page HubSpot tested, by up to 28%. | VWO, HubSpot via ClickMinded | Strip /quote down to the form, call and text, and proof. |
| Conversion drops as the number of form fields rises. Long text areas and dropdowns hurt most. | HubSpot (40k pages) | Cut optional typing. Use taps instead of typing. |
| Multi-step forms convert well for 6+ fields when the easy questions come first. Steps should be labelled. 3–5 steps is the sweet spot. | Zuko | Start with a one-tap question, not "What's your name?" |
| 97% of people read reviews for local businesses. 68% need 4+ stars, and 31% need 4.5+ (up from 17%). 74% want reviews from the last 3 months. | BrightLocal Local Consumer Review Survey 2026 | Real Google rating and recent reviews must be on screen near the form. There are none now. |
| An exact rating with a review count is trusted more than a vague one. Proof placed close to the action button converts best. | SaaS Hero | Put "★★★★★ 5.0 · 44 Google reviews" directly above the form. |
| A logo on the left gets 39% brand recall, versus 21% on the right. | NN/g via WPMU DEV | Keep the logo top left, but make it big enough to read. |
| Conversion is about 3.5% lower for every extra 100 ms of load time. Pages over 4 seconds convert 22% lower. | Shopify, Yottaa via Shopify | /quote currently loads a 13 MB animation and 6.8 MB of service photos. |
| Real photos of the crew and the work are trusted more than stock photos. | Hook Agency (SIGCHI/Wiley studies cited) | Use Philip's real crew, truck and job photos. Use a face if possible. |
| Starting a progress bar partly filled raises completion (the "endowed progress" effect: Nunes & Drèze 2006, loyalty-card study, 34% vs 19% completion). | Journal of Consumer Research | Start the bar at about 15–20% and label it with a step count. |

---

## 1. Fix now (P1)

### 1.1 The brand name is misspelled across the site
The page says **"Cofulent Solutions"** in the hero label, the page title, the meta description, the footer and the SMS text. The logo, the Facebook page and the ads all say **Confluent**. To someone checking a $10k contractor, a misspelled company name looks like a scam.
- In `src/App.tsx`, replace every `Cofulent` with `Confluent`. It appears at lines ~95, 99, 1553, 2151, 2195, 2198 and 2405, plus the footer copyright.
- Do the same in the `<title>` and meta description of `quote.html` and `index.html`.
- `EXIT_STORAGE_KEY = "cofulent-exit-shown"` can stay as it is, because visitors never see it.

### 1.2 The logo is too small
It currently renders at **34×34 px**, and the "CONFLUENT SOLUTIONS" text inside it can't be read.
- The header should be 64px tall with a white background.
- The logo should be **44–48 px tall**, top left. Use the horizontal logo (icon plus wordmark) so the name is readable. If you only have the square logo, show it at 44px with "Confluent Solutions" as text beside it in 18px bold navy.
- The right side of the header gets a phone button: `📞 817-999-7363`, an outline pill, at least 44px tall.
- Remove the light-blue band. It doesn't match the navy hero and looks like a loading error.

### 1.3 One catch-all headline that matches every ad
There's one page for 5 different ads plus Google, so the headline has to work for all of them. It does that in two ways:
1. **The headline names all 5 jobs.** Whichever ad someone tapped, they see their problem in the first line.
2. **The first form question is "What do you need help with?"** with the 5 jobs as big tap tiles. One tap puts them on their own path, so the match finishes inside the form instead of the headline.

**Headline:** **Repipes, slab leaks, sewer & gas lines. Done right.**

**Proof line** (directly under the headline, small, with gold stars):
`★★★★★ 5.0 · 44 Google reviews` (links to the Google Business Profile)

**Subhead:** Free estimates from a licensed master plumber with 35+ years in Fort Worth. Tap your problem below and we'll call with a price range.

**Three checkmark lines** (one row on desktop, stacked on mobile):
- ✓ Free estimate
- ✓ License M-44554
- ✓ Open 24/7

Notes:
- Remove the rotating "We handle ___" line. Motion beside the headline pulls attention away from the form.
- Hold back "Insured" and "Financing available" until Philip confirms them. "Financing available" already appears in the form hints, so confirm it or remove it there too.
- "Master plumber" is based on the M- prefix of his Texas license (TSBPE). Have Philip glance at it before launch.
- If you want more precise matching later, an optional upgrade is to read `utm_content` (each Meta ad name starts with `O1`–`O5`) and pre-select that service tile. The headline stays the same either way.

### 1.4 Reorder the form: taps first, typing last
At the moment, question 1 of 9 is "What's your name?", which asks for personal information before the visitor has invested anything. The new order:

| Step | Question | Input |
|---|---|---|
| 1 | What do you need help with? | Big tap tiles with an icon each. Order them to match the ads: Whole-house repipe · Slab or yard line leak · Cast iron sewer under the slab · Repipe + tankless · Gas line · Something else. |
| (2) | Leak check | Taps. Only shown for slab leaks, as now. |
| 2 | When do you want the work done? | Taps |
| 3 | Budget question (keep the price-range wording, it builds trust) | Taps |
| 4 | Do you own the property? | Taps |
| 5 | **"Where should we send your price range?"** First name + mobile on one screen, with the SMS consent box | Typing |
| 6 | Street address + ZIP | Typing |
| — | Email and "anything else" | Move to the thank-you screen as optional, or drop them |

- That's 6 steps. Nobody types until step 5, when they're already committed.
- Partial-lead rescue still works: the `partial` post to GHL fires as soon as the phone number is entered at step 5. Fewer partial leads will come in, but more people will finish the form.
- Progress label: "Step 1 of 6 · about 45 seconds". Start the bar at 15%. Each step adds an equal share.
- Tap tiles: full width, at least 56px tall, 12px gap, a left-side icon and a 17px label. Selecting a tile moves to the next step automatically, with no Continue button on tap steps.
- Typing steps: a full-width orange button 56px tall. Button text says what happens: "Get my price range →", not "Continue".
- Inputs: 16px or larger (anything smaller makes iOS zoom in). Use `autocomplete="given-name"` and `autocomplete="tel"`, `inputmode="tel"`, and format phone numbers as they're typed.

### 1.5 The form must be fully visible on the first screen
At 390×844 (iPhone), there is about 250px of empty navy between the headline and the form. Close that gap. The first question, the first two tiles and the progress bar should all show without scrolling, above the sticky call bar.

### 1.6 Real proof directly above the form
The rating line from 1.3 (`★★★★★ 5.0 · 44 Google reviews`) sits between the headline block and the form card, so it's the last thing people read before the first question. Link it to the Google reviews.
- Update the count by hand when it changes. Don't round up.
- A perfect 5.0 clears the 4.5-star bar that 31% of people now require.

---

## 2. Below the form (P2): order and contents
On /quote, keep only what helps someone decide on a $5k–$25k job:

1. **Three real Google reviews** with first name, city, star rating and date (from the last 3 months if possible). Pick ones that mention repipes, leaks, sewer or gas work. Copy them from the Google profile (44 reviews, 5.0). eclecticplumber.com loads its reviews in a way that couldn't be scraped. A GHL reviews widget is another option if you want them to update automatically.
2. **Meet the owner.** A photo of Philip O'Hara with 2 lines: "35+ years plumbing in Fort Worth. Licensed master plumber, M-44554. I or my crew lead every job." [Confirm the last line with Philip.] A face plus a name is the strongest trust signal a local contractor has.
3. **"What happens next": the existing 4-step section** (call or form → advice → find the problem first → price before work). Keep it, because explaining the process lowers anxiety. Change the heading to "What happens after you send this".
4. **Before/after slider.** Keep it, but use one of Philip's real jobs.
5. **"What it usually costs."** A table built from the price ranges already in `FORM_SERVICES` (slab leak $4.5k–15k, repipe $6k–20k and so on), followed by "Financing available." Showing prices up front screens out tire-kickers and builds trust.
6. **FAQ, cut to 5 cost and process questions:**
   - Is the estimate free? **Yes.**
   - Do you tear up my floors?
   - How long does a repipe take?
   - Do you pull permits?
   - Do you offer financing? [confirm with Philip]
7. **Final call to action:** "Get my price range" scrolls back up to the form, plus the call button.

**Remove from /quote** (keep them on the main site):
- the 8-service grid, because drain cleaning and general repairs pull people away from the $5k+ offers
- the "Is it urgent?" triage, which is emergency messaging aimed at a different buyer
- the stats row and the service-area map counters, which render as **"0/7", "0 cities served" and "0 core services"** until the animation runs and look broken on slow phones
- the empty partner-badge boxes
- the 120-frame scroll animation

---

## 3. Visual system (P2)

- **One action color.** Use orange `#F26B1D` only for things people should tap: the main button, the call bar and selected tiles. Everything else is navy, white or gray. Right now the orange call bar, the orange Continue button and the orange "Text us" icon all compete.
- **Calls to action on mobile:** a fixed bottom bar split 50/50 into **📞 Call** (orange) and **💬 Text** (white with navy text). Remove the floating "Text us" pill, which sits over the form.
- **Hero background:** a real photo of Philip and the crew, or the truck, behind a navy gradient at 70–85% opacity, so white text stays readable. Faces build trust faster than any other image.
- **Type sizes:** 34–40px mobile headline at weight 800 with tight line height (1.05). 17px subhead at weight 400, 80% white. Body text at least 16px.
- **Contrast:** at least 4.5:1 for text. The small gray "Takes about 60 seconds" and "press Enter" text is too faint, so make it 85% white. Drop "press Enter" on mobile.
- **Spacing:** 16px side margins, 24px between blocks. The form card corners at 16px radius are fine.
- **Motion:** only a 150ms fade or slide between form steps. No rotating text or counters on /quote.

---

## 4. Speed (P2)
- Don't load `/Plumberanimated/*` (13 MB, 120 frames) on /quote.
- Convert the service and hero images to WebP or AVIF under 150 KB each, with `width`/`height` set and `loading="lazy"` below the first screen.
- Preload only the hero image and the logo.
- Load the GHL chat widget after the first interaction, or skip it on /quote, since the sticky Text button covers that need.
- Targets: LCP under 2.5s on 4G and total first-load weight under 1 MB. Check with PageSpeed Insights on mobile.

---

## 5. Measurement (P3)
- Fire a Meta custom event `FormStep` with `{step, offer}` on each step, so you can see exactly where people drop off.
- The thank-you screen should say "Thanks, {first name}. Philip's team will text you shortly from 817-999-7363", with a "Call now instead" button. Lead tracking (`fbq Lead` and the Google conversion) stays exactly as it is.
- After launch, compare form completion rate by `utm_content` for 7 days, against the 8–12% target.

---

## 6. Confirmed facts, and what's still missing

**Confirmed** (from the Google profile, eclecticplumber.com and JK):
- Business: Confluent Solutions, owned by Philip O'Hara
- License: M-44554
- Experience: 35+ years. One spot on eclecticplumber.com says 33+, so use 35+.
- Google: **5.0 ★, 44 reviews**. Hours: open 24 hours, 7 days.
- **Estimates are free**
- Phone: 817-999-7363. Address: 1319 Madeline Pl, Fort Worth 76107.
- Badges: Nextdoor Neighborhood Fave, Rinnai Pro, Bradford White, Delta, BuildZoom (already in `/public/badges`)
- Service area: Fort Worth, Haltom City, Richland Hills, White Settlement, Saginaw, Forest Hill, North Richland Hills, Watauga, Hurst, Euless, Bedford, Colleyville, Keller, Southlake, Crowley

**Still needed from Philip:**
1. 3 Google reviews to quote, with first name and city
2. Is he insured? Who provides financing, if anyone? Is there a warranty on the work?
3. 3–6 real photos: him, the crew, the truck, before/after shots of real jobs
4. A horizontal logo file (PNG or SVG with a transparent background)

Until he supplies them, leave those spots out. Don't fill them with made-up claims.

---

## Sources
- [Landing Page Statistics 2026 – ClickMinded](https://www.clickminded.com/landing-page-statistics/)
- [Landing Page Headline Benchmarks 2026 – FoundryCRO](https://foundrycro.com/blog/landing-page-headline-benchmarks-2026/)
- [Single page or multi-step form – Zuko](https://zuko.io/blog/single-page-or-multi-step-form)
- [Local Consumer Review Survey 2026 – BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey/)
- [Landing page trust signals – SaaS Hero](https://www.saashero.net/uncategorized/landing-page-design-trust-signals/)
- [Logo placement research – WPMU DEV](https://wpmudev.com/blog/logo-placement/)
- [Stock photos and contractors – Hook Agency](https://hookagency.com/blog/why-stock-photos-are-costing-contractors-jobs-and-what-to-use-instead/)
- [Website load time statistics – Shopify](https://www.shopify.com/blog/website-load-time-statistics)
- Nunes & Drèze (2006), "The Endowed Progress Effect", *Journal of Consumer Research*
