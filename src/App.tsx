import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useReducedMotion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import type { MotionValue } from "framer-motion";

// Lets TSX accept the <wistia-player> custom element.
interface WistiaPlayerElement extends HTMLElement {
  play?: () => Promise<void> | void;
  pause?: () => void;
}

interface WistiaPlayerAttributes {
  "media-id": string;
  aspect?: string;
  autoplay?: string;
  muted?: string;
  "silent-autoplay"?: string;
  "end-video-behavior"?: string;
  "controls-visible-on-load"?: string;
  "play-bar-control"?: string;
  "play-pause-control"?: string;
  "big-play-button"?: string;
  "volume-control"?: string;
  "fullscreen-control"?: string;
  "settings-control"?: string;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wistia-player": DetailedHTMLProps<HTMLAttributes<WistiaPlayerElement>, WistiaPlayerElement> & WistiaPlayerAttributes;
    }
  }
}

/* ==========================================================================
   DESIGN TOKENS: single source of truth. CSS variables are generated from this.
   ========================================================================== */
const T = {
  color: {
    bg: "#D9E6F5", // light blue page field: keeps the #182e6f logo high contrast
    bgDeep: "#C7D9EE",
    paper: "#F3F7FC",
    brand: "#182e6f", // logo colour
    brandDark: "#0E1D4A",
    ink: "#0B1633",
    inkSoft: "#44547D",
    line: "rgba(24, 46, 111, 0.16)",
    glassLight: "rgba(255, 255, 255, 0.62)",
    glassDark: "rgba(255, 255, 255, 0.12)",
    glassEdge: "rgba(255, 255, 255, 0.32)",
    onDark: "#F4F8FF",
    onDarkSoft: "rgba(244, 248, 255, 0.76)",
    aqua: "#8EC5F5", // water accent: replaces orange everywhere except call actions
    aquaDeep: "#2F6FB5",
    call: "#F26B1D", // used only for call-to-action surfaces
    scrim: "rgba(8, 17, 44, 0.78)",
  },
  space: { xs: "0.5rem", sm: "0.75rem", md: "1rem", lg: "1.5rem", xl: "2.5rem", xxl: "4rem", section: "clamp(4.5rem, 9vw, 8rem)" },
  radius: { sm: "4px", md: "8px", lg: "14px" },
  font: {
    display: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    body: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  },
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.25rem",
    xl: "clamp(1.5rem, 2.4vw, 2.1rem)",
    xxl: "clamp(2.25rem, 5vw, 4.25rem)",
    mega: "clamp(3rem, 6.4vw, 6.5rem)",
  },
  sizeMobile: { xs: "0.6875rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.5rem", xxl: "2rem", mega: "2.375rem" },
  bp: { mobile: 768, wide: 1280 },
  layout: { max: "1200px", maxWide: "1360px", gutter: "clamp(1rem, 4vw, 3rem)", header: "88px", callBar: "60px", protrude: "clamp(28px, calc((100vw - 1230px) / 2), 88px)", wave: "clamp(32px, 5vw, 64px)", meterMin: 1280 },
  map: { w: 800, h: 520, pad: 50, lonMin: -97.5, lonSpan: 0.45, latMax: 32.97, latSpan: 0.42, home: "Fort Worth", rotateMs: 2600 },
  motion: { ease: "cubic-bezier(0.22, 1, 0.36, 1)", fast: "180ms", base: "320ms" },
  scroll: { runDesktop: "170vh", runMobile: "160vh", revealStart: 0.08, revealStep: 0.18, revealSpan: 0.1 },
  spring: { stiffness: 230, damping: 32, mass: 0.3, restDelta: 0.0005 },
  focal: { x: 0.5, y: 0.5 },
  frames: { count: 120, dir: "/Plumberanimated", prefix: "ezgif-frame-", ext: ".jpg", pad: 3 },
  business: {
    name: "Confluent Solutions",
    phoneDisplay: "817-999-7363",
    phoneHref: "tel:+18179997363",
    smsNumber: "+18179997363",
    smsBody: "Hi Confluent Solutions, I need help with: ",
    address: "1319 Madeline Pl, Fort Worth, Texas 76107",
    leadEndpoint: "/api/lead",
    logoCandidates: ["/logo.png", "/Logo.png", "/logo.PNG", "/logo.webp", "/logo.svg", "/logo.jpg"] as readonly string[], // first one that exists is used; save yours in public/
    wistia: { mediaId: "19s5ibgs65", playerSrc: "https://fast.wistia.com/player.js", embedSrc: "https://fast.wistia.com/embed/19s5ibgs65.js" },
    legalName: "Confluent Solutions", // name used on the legal pages and SMS consent; must match the EIN / A2P registration
    email: "consols@outlook.com",
    // Static pages in public/. The GoHighLevel chat widget is embedded ONLY on /contact,
    // because carrier rules say no phone-collecting form may share a page with the widget.
    privacyHref: "/privacy-policy",
    termsHref: "/terms",
    contactHref: "/contact",
    facebook: "https://facebook.com/ConfluentSolutionsTX/",
    google: "https://www.google.com/maps/place/Confluent+Solutions/@32.7462208,-97.3747285,2107m/data=!3m1!1e3!4m6!3m5!1s0x864e7374d014c9e3:0xd453b45bc08216e6!8m2!3d32.7462431!4d-97.3744597!16s%2Fg%2F11jp9n7nrs!5m1!1e2?entry=ttu",
  },
} as const;

const frameUrl = (n: number): string =>
  `${T.frames.dir}/${T.frames.prefix}${String(n).padStart(T.frames.pad, "0")}${T.frames.ext}`;

/* ==========================================================================
   CONTENT
   ========================================================================== */
const SERVICES: readonly string[] = [
  "Gas Line Repair & Gas Leak Detection",
  "Water Line & Sewer Line Replacement",
  "Whole-House Repiping Services",
  "Slab Leak Detection & Repair",
  "Drain Cleaning & Sewer Backup Repair",
  "Water Heater Installation & Repair",
  "Leak Detection Services",
  "Residential Plumbing Repairs",
];

interface AreaGeo {
  name: string;
  lat: number;
  lon: number;
}
const AREA_GEO: readonly AreaGeo[] = [
  { name: "Fort Worth", lat: 32.75, lon: -97.33 },
  { name: "Haltom City", lat: 32.8, lon: -97.27 },
  { name: "Richland Hills", lat: 32.81, lon: -97.23 },
  { name: "White Settlement", lat: 32.76, lon: -97.46 },
  { name: "Saginaw", lat: 32.86, lon: -97.36 },
  { name: "Forest Hill", lat: 32.67, lon: -97.27 },
  { name: "North Richland Hills", lat: 32.83, lon: -97.23 },
  { name: "Watauga", lat: 32.86, lon: -97.25 },
  { name: "Hurst", lat: 32.82, lon: -97.19 },
  { name: "Euless", lat: 32.84, lon: -97.08 },
  { name: "Bedford", lat: 32.84, lon: -97.14 },
  { name: "Colleyville", lat: 32.88, lon: -97.15 },
  { name: "Keller", lat: 32.93, lon: -97.25 },
  { name: "Southlake", lat: 32.94, lon: -97.13 },
  { name: "Crowley", lat: 32.58, lon: -97.36 },
];
const SERVICE_AREAS: readonly string[] = AREA_GEO.map((area) => area.name);
const ROTATING_LINES: readonly string[] = ["Slab leaks.", "Gas lines.", "Sewer backups.", "Water heaters.", "Burst pipes.", "Repiping."];

// Drop a photo at /public/services/<slug>.jpg and the card uses it automatically. Index-aligned with SERVICES.
const SERVICE_SLUGS: readonly string[] = [
  "gas-line",
  "water-sewer-line",
  "repiping",
  "slab-leak",
  "drain-cleaning",
  "water-heater",
  "leak-detection",
  "plumbing-repairs",
];

interface Badge {
  name: string;
  src: string;
  width: number;
  height: number;
}

const BADGES: readonly Badge[] = [
  { name: "Nextdoor Neighborhood Fave", src: "/badges/nextdoor-fave.png", width: 126, height: 126 },
  { name: "Rinnai Pro", src: "/badges/rinnai-pro.png", width: 126, height: 126 },
  { name: "MapQuest", src: "/badges/mapquest.png", width: 306, height: 57 },
  { name: "BuildZoom", src: "/badges/buildzoom.png", width: 212, height: 38 },
  { name: "Atmos Energy", src: "/badges/atmos-energy.png", width: 246, height: 114 },
  { name: "Bradford White Water Heaters", src: "/badges/bradford-white.png", width: 297, height: 110 },
  { name: "Delta", src: "/badges/delta.png", width: 294, height: 80 },
];

interface Step {
  n: string;
  title: string;
  body: string;
}

// Draft process copy: confirm steps 2 and 4 match how you actually work before launch.
const STEPS: readonly Step[] = [
  { n: "01", title: "You call or send the form", body: "A person picks up. Tell us what you are seeing, at any hour." },
  { n: "02", title: "We tell you what to do right now", body: "Shutoff valves, gas safety, what not to touch, before anyone is on the road." },
  { n: "03", title: "We find the problem first", body: "Leak and line detection before digging, so only what has to open gets opened." },
  { n: "04", title: "You get the plan and price before work starts", body: "You decide. No surprise add-ons after the fact." },
];

// Fill in any of these and they appear on the site automatically. Empty values stay hidden.
const TRUST_FACTS: readonly { label: string; value: string }[] = [
  { label: "License", value: "" },
  { label: "Insured", value: "" },
  { label: "Warranty", value: "" },
  { label: "Service call fee", value: "" },
];

interface Triage {
  symptom: string;
  level: "now" | "today" | "soon";
  headline: string;
  advice: string;
}

const TRIAGE: readonly Triage[] = [
  { symptom: "I smell gas", level: "now", headline: "Leave the home first", advice: "Do not use switches, lighters or phones inside. From outside, call 911 and your gas utility, then call us for repair and leak detection." },
  { symptom: "Water is flowing and won't stop", level: "now", headline: "Shut off the main valve", advice: "Turn off the main water shutoff, then call us right away. Move belongings away from the wet area." },
  { symptom: "Sewage is backing up", level: "now", headline: "Stop using every drain", advice: "No sinks, showers or toilets until it is cleared. Call us for drain cleaning and sewer backup repair." },
  { symptom: "Water heater is not working", level: "today", headline: "Call today", advice: "No hot water is disruptive but rarely dangerous. If you see water pooling under the tank, turn off its supply and call us." },
  { symptom: "Damp floor spot or high water bill", level: "soon", headline: "Possible hidden leak", advice: "Check that the meter stops when everything is off. If it keeps moving, request a call for leak and slab leak detection." },
  { symptom: "Slow drain or low pressure", level: "soon", headline: "Book a visit", advice: "Usually not an emergency, but it seldom fixes itself. Send a call request and we will schedule it." },
];

interface Faq {
  q: string;
  a: string;
}

const FAQS: readonly Faq[] = [
  { q: "How can I tell if a plumbing issue is urgent or can wait?", a: "Act immediately for a gas smell, water that will not stop, sewage backing into the home or no water at all. Slow drains, small drips and uneven pressure can usually wait for a scheduled visit, but they rarely fix themselves." },
  { q: "Why does my water pressure suddenly drop throughout the house?", a: "Common causes are a failing pressure regulator or partly closed valve, buildup inside aging pipes, or a hidden leak. Testing pressure at the source shows which one it is." },
  { q: "Why do plumbing leaks often go unnoticed until damage appears?", a: "Slab, in-wall and underground leaks stay out of sight. Clues include an unexplained jump in the water bill, damp or warm floor spots, musty smells, or a meter that moves while everything is off." },
  { q: "Is it safe to use chemical drain cleaners regularly?", a: "Regular use is not recommended. Harsh chemicals can wear on pipes and fittings and do not remove the underlying cause. Mechanical cleaning or a camera inspection is the safer route for repeat clogs." },
  { q: "What's the difference between a plumbing repair and a long-term solution?", a: "A repair fixes the section that failed. A long-term fix such as repiping or line replacement addresses why it failed, which matters when pipes are aging or keep failing." },
  { q: "How often should plumbing systems be professionally inspected?", a: "A periodic inspection helps most homes, especially older ones and before buying or selling. Ask us what interval fits your home." },
];

interface Stage {
  time: string;
  label: string;
  frame: number;
}

// Frame numbers map the 0-5s timestamps onto the extracted 24fps sequence (second * 24 + 1).
const STAGES: readonly Stage[] = [
  { time: "0s", label: "Disconnected", frame: 1 },
  { time: "1s", label: "Alignment begins", frame: 25 },
  { time: "2s", label: "Connection in progress", frame: 49 },
  { time: "3s", label: "Fittings coming together", frame: 73 },
  { time: "4s", label: "Final alignment", frame: 97 },
  { time: "5s", label: "Connected", frame: 120 },
];

interface Reason {
  title: string;
  detail: string;
  spotX: string;
  spotY: string;
}

const REASONS: readonly Reason[] = [
  { title: "Decades of proven expertise", detail: "Experience that reads the problem before the shovel goes in.", spotX: "50%", spotY: "72%" },
  { title: "True 24/7 emergency response", detail: "Leaks and gas issues keep no schedule. Call any hour: " + T.business.phoneDisplay + ".", spotX: "50%", spotY: "34%" },
  { title: "Advanced, non-invasive solutions", detail: "Locate first, then repair only what has to open, so less of your property is torn up.", spotX: "16%", spotY: "68%" },
  { title: "Honest, residential-focused service", detail: "Homes only. Plain answers on what is wrong and what the fix takes.", spotX: "74%", spotY: "14%" },
];

const HERO_TITLE = "Plumbing and gas line work, done right.";

const NAV_LINKS: readonly { href: string; label: string }[] = [
  { href: "#services", label: "Services" },
  { href: "#triage", label: "Is It Urgent?" },
  { href: "#why", label: "Why Us" },
  { href: "#jobs", label: "Job Files" },
  { href: "#areas", label: "Areas" },
  { href: "#faq", label: "FAQ" },
];

/* ==========================================================================
   STYLES: one template literal. Every rule references the :root variables.
   ========================================================================== */
const mq = `${T.bp.mobile - 1}px`;
const wide = `${T.bp.wide}px`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');

:root {
  --c-bg: ${T.color.bg}; --c-bg-deep: ${T.color.bgDeep}; --c-paper: ${T.color.paper};
  --c-brand: ${T.color.brand}; --c-brand-dark: ${T.color.brandDark};
  --c-ink: ${T.color.ink}; --c-ink-soft: ${T.color.inkSoft}; --c-line: ${T.color.line};
  --c-glass-light: ${T.color.glassLight}; --c-glass-dark: ${T.color.glassDark}; --c-glass-edge: ${T.color.glassEdge};
  --c-on-dark: ${T.color.onDark}; --c-on-dark-soft: ${T.color.onDarkSoft};
  --c-aqua: ${T.color.aqua}; --c-aqua-deep: ${T.color.aquaDeep}; --c-call: ${T.color.call}; --c-scrim: ${T.color.scrim};
  --s-xs: ${T.space.xs}; --s-sm: ${T.space.sm}; --s-md: ${T.space.md}; --s-lg: ${T.space.lg};
  --s-xl: ${T.space.xl}; --s-xxl: ${T.space.xxl}; --s-section: ${T.space.section};
  --r-sm: ${T.radius.sm}; --r-md: ${T.radius.md}; --r-lg: ${T.radius.lg};
  --f-display: ${T.font.display}; --f-body: ${T.font.body};
  --t-xs: ${T.size.xs}; --t-sm: ${T.size.sm}; --t-md: ${T.size.md}; --t-lg: ${T.size.lg};
  --t-xl: ${T.size.xl}; --t-xxl: ${T.size.xxl}; --t-mega: ${T.size.mega};
  --max: ${T.layout.max}; --gutter: ${T.layout.gutter}; --header-h: ${T.layout.header};
  --callbar-h: ${T.layout.callBar}; --protrude: ${T.layout.protrude}; --wave-h: ${T.layout.wave};
  --ease: ${T.motion.ease}; --dur-fast: ${T.motion.fast}; --dur-base: ${T.motion.base};
  --scroll-run: ${T.scroll.runDesktop};
  --shadow-1: 0 1px 2px rgba(24, 46, 111, 0.08), 0 0 0 1px var(--c-line);
}

@media (max-width: ${mq}) {
  :root {
    --t-xs: ${T.sizeMobile.xs}; --t-sm: ${T.sizeMobile.sm}; --t-md: ${T.sizeMobile.md}; --t-lg: ${T.sizeMobile.lg};
    --t-xl: ${T.sizeMobile.xl}; --t-xxl: ${T.sizeMobile.xxl}; --t-mega: ${T.sizeMobile.mega};
    --header-h: 56px; --scroll-run: ${T.scroll.runMobile};
  }
}

@media (min-width: ${wide}) {
  :root { --max: ${T.layout.maxWide}; }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; scroll-padding-top: var(--header-h); -webkit-text-size-adjust: 100%; }
body {
  background: var(--c-bg); color: var(--c-ink); font-family: var(--f-body); font-size: var(--t-md);
  line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden;
}
@media (max-width: ${mq}) { body { padding-bottom: calc(var(--callbar-h) + env(safe-area-inset-bottom)); } }
a { color: inherit; text-decoration: none; }
button, input, select, textarea { font: inherit; color: inherit; }
img { display: block; max-width: 100%; }
:focus-visible { outline: 3px solid var(--c-aqua-deep); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; } }

.wrap { width: 100%; max-width: var(--max); margin-inline: auto; padding-inline: var(--gutter); }
.section { padding-block: var(--s-section); }
.eyebrow { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-ink-soft); }
.h2 { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; letter-spacing: -0.02em; color: var(--c-brand); margin-top: var(--s-sm); }


/* ---------- Header ---------- */
.header {
  position: fixed; inset: 0 0 auto 0; z-index: 50; height: var(--header-h);
  background: rgba(217, 230, 245, 0.82); -webkit-backdrop-filter: blur(16px) saturate(1.4); backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--c-line);
}
.header__row { height: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--s-lg); }
.logo { display: inline-flex; align-items: center; gap: var(--s-xs); color: var(--c-brand); font-family: var(--f-display); font-weight: 700; font-size: var(--t-lg); letter-spacing: -0.01em; }
.logo svg { width: 1.5em; height: 1.5em; flex: none; }
.logo__img { height: 100px; width: auto; max-width: 220px; object-fit: contain; }
.logo__img--light { filter: brightness(0) invert(1); height: 52px; }
@media (max-width: ${mq}) { .logo__img { height: 34px; } }
.nav { display: flex; gap: var(--s-lg); font-size: var(--t-sm); font-weight: 500; color: var(--c-ink-soft); }
.nav a { padding-block: var(--s-xs); border-bottom: 2px solid transparent; transition: color var(--dur-fast), border-color var(--dur-fast); }
.nav a:hover { color: var(--c-brand); border-color: var(--c-brand); }
.call-btn {
  display: inline-flex; align-items: center; gap: var(--s-xs); padding: var(--s-sm) var(--s-lg); border-radius: var(--r-sm);
  background: var(--c-call); color: var(--c-ink); font-weight: 700; font-size: var(--t-sm); letter-spacing: 0.02em;
  box-shadow: 0 1px 2px rgba(11, 22, 51, 0.25); transition: transform var(--dur-fast) var(--ease), background var(--dur-fast);
}
.call-btn:hover { transform: translateY(-1px); background: #ff7a2e; }
@media (max-width: ${mq}) { .nav, .header .call-btn { display: none; } }

/* ---------- Mobile call bar ---------- */
.callbar { display: none; }
@media (max-width: ${mq}) {
  .callbar {
    display: flex; align-items: center; justify-content: center; position: fixed; inset: auto 0 0 0; z-index: 60;
    min-height: calc(var(--callbar-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);
    background: var(--c-call); color: var(--c-ink); font-family: var(--f-display); font-weight: 700; font-size: var(--t-lg); letter-spacing: 0.04em;
  }
}

/* ---------- Hero (scroll-scrubbed frame sequence) ---------- */
.hero { position: relative; isolation: isolate; overflow: hidden; min-height: 100vh; min-height: 100svh; background: var(--c-brand-dark); }
.hero__bg { position: absolute; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; background: var(--c-brand-dark) url(/video/section-poster.jpg) center / cover no-repeat; }
.hero__bg wistia-player { position: absolute; top: 50%; left: 50%; width: var(--bgw, 100%); height: calc(var(--bgw, 100%) * 9 / 16); transform: translate(-50%, -50%); display: block; }
.hero__bg wistia-player:not(:defined) { background: center / cover no-repeat url('https://fast.wistia.com/embed/medias/${T.business.wistia.mediaId}/swatch'); filter: blur(5px); }
.scrollsec { position: relative; height: var(--scroll-run); }
.scrollsec__stick { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; color: var(--c-on-dark); background: var(--c-brand-dark) url(${frameUrl(1)}) center / cover no-repeat; }
.scrollsec__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hero__missing { position: absolute; z-index: 5; inset: calc(var(--header-h) + var(--s-md)) var(--gutter) auto var(--gutter); padding: var(--s-md); border-radius: var(--r-md); background: var(--c-call); color: var(--c-ink); font-weight: 700; font-size: var(--t-sm); }
.hero__layout {
  position: relative; min-height: 100vh; min-height: 100svh; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.8fr); gap: var(--s-xl);
  align-items: end; padding: calc(var(--header-h) + var(--s-xl)) var(--gutter) var(--s-xxl);
  max-width: var(--max); margin-inline: auto; width: 100%; color: var(--c-on-dark);
}
.hero__copy { display: grid; gap: var(--s-md); align-self: end; text-shadow: 0 2px 22px rgba(5, 10, 30, 0.55); }
.hero__copy .eyebrow { color: var(--c-on-dark-soft); }
.hero__title { font-family: var(--f-display); font-weight: 700; font-size: var(--t-mega); line-height: 0.95; letter-spacing: -0.03em; max-width: 13ch; }
.hero__word { display: inline-block; margin-right: 0.24em; }
.hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-lg) var(--s-xl); }
.text-btn { display: inline-flex; align-items: center; gap: var(--s-md); padding: var(--s-sm) var(--s-lg) var(--s-sm) var(--s-sm); border-radius: 999px; color: var(--c-on-dark); text-shadow: none; transition: transform var(--dur-base) var(--ease), border-color var(--dur-fast); }
.text-btn:hover { transform: translateY(-2px); border-color: rgba(255, 255, 255, 0.7); }
.text-btn__icon { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--c-call); color: var(--c-ink); box-shadow: 0 2px 10px rgba(242, 107, 29, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45); }
.text-btn__icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
.text-btn__icon circle { fill: currentColor; stroke: none; }
.text-btn__label { display: grid; line-height: 1.15; text-align: left; }
.text-btn__label strong { font-family: var(--f-display); font-weight: 700; font-size: var(--t-lg); }
.text-btn__label small { font-size: var(--t-xs); color: var(--c-on-dark-soft); letter-spacing: 0.02em; }
.text-fab { display: none; }
@media (max-width: ${mq}) {
  .hero__actions { display: none; }
  .text-fab {
    display: inline-flex; align-items: center; gap: var(--s-sm); position: fixed; z-index: 55; right: var(--gutter);
    bottom: calc(var(--callbar-h) + env(safe-area-inset-bottom) + var(--s-md)); padding: 6px var(--s-lg) 6px 6px; border-radius: 999px;
    background: linear-gradient(140deg, rgba(24, 46, 111, 0.88), rgba(14, 29, 74, 0.88)); -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
    border: 1px solid rgba(255, 255, 255, 0.28); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 6px 18px rgba(8, 17, 44, 0.35);
    color: var(--c-on-dark); font-family: var(--f-display); font-weight: 700; font-size: var(--t-md);
  }
  .text-fab .text-btn__icon { width: 40px; height: 40px; animation: nudge 5s ease-in-out 3s infinite; }
}
@keyframes nudge { 0%, 92%, 100% { transform: scale(1); } 96% { transform: scale(1.14); } }
.hero__phone { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); letter-spacing: -0.02em; line-height: 1; width: fit-content; border-bottom: 3px solid var(--c-aqua); padding-bottom: var(--s-xs); transition: color var(--dur-fast); }
.hero__phone:hover { color: var(--c-aqua); }
.hero__side { align-self: center; }

.glass {
  position: relative; background: linear-gradient(140deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.06));
  -webkit-backdrop-filter: blur(20px) saturate(1.5); backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid var(--c-glass-edge); border-radius: var(--r-lg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 0 rgba(255, 255, 255, 0.1), 0 1px 2px rgba(8, 17, 44, 0.3);
}
.glass::before { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(120% 60% at 0% 0%, rgba(255, 255, 255, 0.28), transparent 55%); }

.form { padding: var(--s-lg); display: grid; gap: var(--s-md); }
.form__title { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; }
.form__sub { font-size: var(--t-sm); color: var(--c-on-dark-soft); margin-top: calc(var(--s-xs) * -0.5); }
.field { display: grid; gap: 0.35rem; position: relative; }
.field label { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-on-dark-soft); }
.field input, .field select {
  width: 100%; min-height: 46px; padding: 0 var(--s-md); border-radius: var(--r-md); border: 1px solid var(--c-glass-edge);
  background: rgba(8, 17, 44, 0.28); color: var(--c-on-dark); font-size: var(--t-md); transition: border-color var(--dur-fast), background var(--dur-fast);
}
.field input::placeholder { color: rgba(244, 248, 255, 0.5); }
.field input:focus, .field select:focus { outline: none; border-color: #fff; background: rgba(8, 17, 44, 0.45); }
.field select option { color: var(--c-ink); }
.field--pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-sm); }
.submit {
  min-height: 50px; border: 0; border-radius: var(--r-md); cursor: pointer; background: var(--c-call); color: var(--c-ink);
  font-weight: 700; font-size: var(--t-md); letter-spacing: 0.02em; transition: transform var(--dur-fast) var(--ease), background var(--dur-fast);
}
.submit:hover:not(:disabled) { transform: translateY(-1px); background: #ff7a2e; }
.submit:disabled { opacity: 0.7; cursor: progress; }
.form__note { font-size: var(--t-sm); color: var(--c-on-dark-soft); }
.form__note a { color: var(--c-on-dark); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.form__status { font-size: var(--t-sm); font-weight: 700; }

/* Step form: one question at a time */
.form--steps { gap: var(--s-sm); min-width: 0; }
.form__top { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--t-xs); color: var(--c-on-dark-soft); }
.form__pct { color: var(--c-aqua); font-weight: 700; font-variant-numeric: tabular-nums; }
.form__track { height: 4px; border-radius: 999px; background: rgba(255, 255, 255, 0.16); overflow: hidden; }
.form__bar { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--c-aqua-deep), var(--c-aqua)); transition: width var(--dur-base) var(--ease); }
.form__step { display: grid; gap: var(--s-sm); padding-top: var(--s-xs); }
.form__count { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-aqua); }
.form__q { font-family: var(--f-display); font-weight: 700; font-size: clamp(1.45rem, 2.3vw, 1.9rem); line-height: 1.1; letter-spacing: -0.015em; color: #fff; text-shadow: 0 2px 14px rgba(8, 17, 44, 0.45); }
.form__q--long { font-size: clamp(1.2rem, 1.75vw, 1.45rem); line-height: 1.18; }
.form__hint { font-size: var(--t-sm); color: rgba(244, 248, 255, 0.86); margin-top: -0.35rem; }
.field textarea {
  width: 100%; min-height: 96px; padding: var(--s-sm) var(--s-md); border-radius: var(--r-md); border: 1px solid var(--c-glass-edge); resize: vertical;
  background: rgba(8, 17, 44, 0.28); color: var(--c-on-dark); font-size: var(--t-md); line-height: 1.4; transition: border-color var(--dur-fast), background var(--dur-fast);
}
.field textarea::placeholder { color: rgba(244, 248, 255, 0.5); }
.field textarea:focus { outline: none; border-color: #fff; background: rgba(8, 17, 44, 0.45); }
.field--zip { max-width: 9rem; }
.consent { display: grid; grid-template-columns: auto 1fr; gap: var(--s-xs); align-items: start; font-size: 11px; line-height: 1.45; color: var(--c-on-dark-soft); cursor: pointer; }
.consent input { width: 16px; height: 16px; margin-top: 1px; accent-color: var(--c-aqua); }
.consent a { color: var(--c-on-dark); text-decoration: underline; text-underline-offset: 2px; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-xs); }
.choice {
  min-height: 46px; padding: 0.55rem var(--s-sm); border-radius: var(--r-md); border: 1px solid var(--c-glass-edge); background: rgba(8, 17, 44, 0.28);
  color: var(--c-on-dark); font-size: var(--t-sm); font-weight: 700; line-height: 1.2; text-align: left; cursor: pointer;
  transition: border-color var(--dur-fast), background var(--dur-fast), transform var(--dur-fast) var(--ease);
}
.choice:hover { border-color: rgba(255, 255, 255, 0.7); }
.choice:active { transform: scale(0.98); }
.choice[aria-pressed="true"] { border-color: var(--c-aqua); background: rgba(142, 197, 245, 0.2); }
.form__err { font-size: var(--t-sm); font-weight: 700; color: #FFD0B5; }
.form__nav { display: flex; align-items: center; justify-content: space-between; gap: var(--s-sm); padding-top: var(--s-xs); }
.form__back { border: 0; background: none; padding: 0.5rem 0; cursor: pointer; color: var(--c-on-dark-soft); font-size: var(--t-sm); font-weight: 700; }
.form__back:hover { color: var(--c-on-dark); }
.form__back[hidden] { display: block; visibility: hidden; }
.form__go { display: flex; align-items: center; gap: var(--s-sm); margin-left: auto; }
.form__enter { font-size: var(--t-xs); color: var(--c-on-dark-soft); white-space: nowrap; }
.form__go .submit { padding: 0 var(--s-lg); display: inline-flex; align-items: center; gap: 0.5rem; }
.form__done { display: grid; gap: var(--s-sm); padding-block: var(--s-sm); }
.form__done .form__q { font-size: var(--t-xl); }
@media (hover: none) { .form__enter { display: none; } }

.meter { position: absolute; inset: auto var(--gutter) var(--s-lg) var(--gutter); max-width: var(--max); margin-inline: auto; display: grid; gap: var(--s-xs); color: var(--c-on-dark); pointer-events: none; }
.meter__row { display: flex; justify-content: space-between; align-items: baseline; gap: var(--s-md); font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.meter__stage { font-variant-numeric: tabular-nums; }
.meter__hint { color: var(--c-on-dark-soft); }
.meter__track { height: 2px; background: rgba(255, 255, 255, 0.28); overflow: hidden; }
.meter__bar { height: 100%; background: var(--c-aqua); transform-origin: left center; }

@media (max-width: ${mq}) {
  .hero__layout { grid-template-columns: 1fr; align-content: space-between; align-items: start; gap: var(--s-md); padding: calc(var(--header-h) + var(--s-md)) var(--gutter) calc(var(--callbar-h) + var(--s-xxl) + var(--s-lg) + env(safe-area-inset-bottom)); }
  .hero__copy { gap: var(--s-xs); align-self: start; }
  .hero__title { max-width: 15ch; line-height: 1; }
  .hero__phone { display: none; }
  .hero__side { align-self: end; }
  .form { padding: var(--s-md); gap: var(--s-sm); }
  .form__sub, .form__note, .field label { display: none; }
  .field input, .field select { min-height: 44px; }
  .form__hint { font-size: var(--t-xs); }
  .choice { min-height: 42px; padding: 0.45rem var(--s-xs); }
  .field textarea { min-height: 72px; }
  .meter { inset: auto var(--gutter) calc(var(--callbar-h) + var(--s-sm) + env(safe-area-inset-bottom)) var(--gutter); }
  .meter__hint { display: none; }
}

/* ---------- Cards ---------- */
.card { background: var(--c-glass-light); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-radius: var(--r-md); box-shadow: var(--shadow-1); }

/* ---------- Stats strip ---------- */
.stats { border-block: 1px solid var(--c-line); background: var(--c-paper); }
.stats__row { display: grid; grid-template-columns: repeat(3, 1fr); }
.stat { padding: var(--s-lg) var(--s-md); display: grid; gap: 2px; }
.stat + .stat { border-left: 1px solid var(--c-line); }
.stat__n { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; color: var(--c-brand); font-variant-numeric: tabular-nums; }
.stat__l { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-ink-soft); }

/* ---------- Services (bento with cursor spotlight) ---------- */
.spot { position: relative; overflow: hidden; --mx: 50%; --my: 50%; }
.spot::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity var(--dur-base); background: radial-gradient(260px circle at var(--mx) var(--my), rgba(24, 46, 111, 0.16), transparent 70%); }
.spot:hover::after { opacity: 1; }
.services__head { display: grid; gap: var(--s-sm); max-width: 44rem; margin-bottom: var(--s-xl); }
.services__lede { color: var(--c-ink-soft); font-size: var(--t-lg); }
.services__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-md); list-style: none; }
.service { display: grid; grid-template-rows: auto 1fr; transition: transform var(--dur-base) var(--ease); }
.service:hover { transform: translateY(-3px); }
.service__media { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: var(--c-bg-deep); }
.service__media img { width: 100%; height: 100%; object-fit: cover; transition: transform 700ms var(--ease); }
.service:hover .service__media img { transform: scale(1.05); }
.service__art { width: 100%; height: 100%; display: grid; place-items: center; background: linear-gradient(140deg, var(--c-brand) 0%, #2a4aa3 100%); color: var(--c-on-dark); }
.service__art svg { width: 38%; height: auto; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.service__body { display: grid; gap: var(--s-sm); padding: var(--s-md) var(--s-lg) var(--s-lg); align-content: start; }
.service__n { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xs); color: var(--c-ink-soft); letter-spacing: 0.14em; }
.service__t { font-family: var(--f-display); font-weight: 500; font-size: var(--t-lg); line-height: 1.15; color: var(--c-brand); }
@media (max-width: 1024px) { .services__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: ${mq}) {
  .services__grid { grid-template-columns: 1fr; gap: var(--s-sm); }
  .service { grid-template-rows: none; grid-template-columns: 96px 1fr; align-items: stretch; }
  .service__media { aspect-ratio: auto; min-height: 88px; }
  .service__body { padding: var(--s-sm) var(--s-md); align-content: center; gap: 2px; }
  .service:hover { transform: none; }
  .service:hover .service__media img { transform: none; }
  .spot::after { display: none; }
}

/* ---------- Badges + social ---------- */
.badges__grid { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-md); margin-top: var(--s-xl); }
.badge { display: grid; place-items: center; min-height: 128px; padding: var(--s-md); transition: transform var(--dur-base) var(--ease); }
.badge:hover { transform: translateY(-2px); }
.badge img { width: auto; max-width: 100%; max-height: 84px; object-fit: contain; }
.badge--wide img { max-height: 64px; }
.badges__social { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-md); margin-top: var(--s-xl); }
.badges__social p { font-weight: 500; color: var(--c-ink-soft); margin-right: var(--s-sm); }
.social { display: inline-flex; align-items: center; gap: var(--s-sm); padding: var(--s-sm) var(--s-lg) var(--s-sm) var(--s-md); border-radius: var(--r-md); background: var(--c-glass-light); box-shadow: var(--shadow-1); font-weight: 700; font-size: var(--t-sm); color: var(--c-brand); transition: transform var(--dur-fast) var(--ease); }
.social:hover { transform: translateY(-2px); }
.social svg { width: 22px; height: 22px; flex: none; }
.footer__social { display: flex; gap: var(--s-sm); margin-top: var(--s-md); }
.footer__social a { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.24); transition: background var(--dur-fast); }
.footer__social a:hover { background: rgba(255, 255, 255, 0.24); }
.footer__social svg { width: 18px; height: 18px; }
@media (max-width: 1024px) { .badges__grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: ${mq}) { .badges__grid { grid-template-columns: repeat(2, 1fr); gap: var(--s-sm); } .badge { min-height: 96px; } .badge img { max-height: 64px; } .badge:hover { transform: none; } }

/* ---------- Exit intent ---------- */
.exit { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: var(--s-lg); background: rgba(8, 17, 44, 0.62); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.exit__card { position: relative; width: min(520px, 100%); padding: var(--s-xxl) var(--s-xl) var(--s-xl); color: var(--c-on-dark); text-align: left; background: linear-gradient(150deg, rgba(24, 46, 111, 0.96), rgba(14, 29, 74, 0.96)); }
.exit__line { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); line-height: 1.1; letter-spacing: -0.01em; }
.exit__call { display: block; margin-top: var(--s-lg); padding: var(--s-md) var(--s-lg); border-radius: var(--r-md); background: var(--c-call); color: var(--c-ink); text-align: center; white-space: nowrap; font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); letter-spacing: -0.01em; transition: transform var(--dur-fast) var(--ease); }
.exit__call:hover { transform: translateY(-2px); }
.exit__close { position: absolute; top: var(--s-sm); right: var(--s-sm); width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--c-glass-edge); background: rgba(255, 255, 255, 0.1); cursor: pointer; color: var(--c-on-dark); font-size: var(--t-lg); line-height: 1; }
.exit__close:hover { background: rgba(255, 255, 255, 0.2); }

/* ---------- Process (video background section) ---------- */
.process__layout { position: absolute; inset: 0; display: grid; grid-template-rows: auto 1fr auto; width: 100%; max-width: var(--max); margin-inline: auto; padding: calc(var(--header-h) + var(--s-xl)) var(--gutter) calc(var(--s-xxl) + var(--s-lg)); }
.process__head { text-shadow: 0 2px 22px rgba(5, 10, 30, 0.6); }
.process__head .eyebrow { color: var(--c-on-dark-soft); }
.process__title { margin-top: var(--s-sm); max-width: 18ch; font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; letter-spacing: -0.03em; }
.process__steps { grid-row: 3; list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--s-md); }
.step { padding: var(--s-lg); display: grid; gap: var(--s-sm); align-content: start; min-height: 200px; }
.step__n { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; color: transparent; -webkit-text-stroke: 1.5px var(--c-aqua); }
.step__t { font-family: var(--f-display); font-weight: 500; font-size: var(--t-lg); line-height: 1.15; }
.step__b { font-size: var(--t-sm); color: var(--c-on-dark); }
.trust { padding-block: var(--s-lg); background: var(--c-paper); border-bottom: 1px solid var(--c-line); }
.trust__list { list-style: none; display: flex; flex-wrap: wrap; gap: var(--s-xs) var(--s-xl); font-size: var(--t-sm); color: var(--c-brand); font-weight: 500; }
.trust__list span { font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-ink-soft); margin-right: var(--s-xs); }
@media (max-width: 1024px) { .process__steps { grid-template-columns: repeat(2, 1fr); } .step { min-height: 0; } }
@media (max-width: ${mq}) {
  .process__layout { padding: calc(var(--header-h) + var(--s-md)) var(--gutter) calc(var(--callbar-h) + var(--s-xxl)); }
  .process__steps { grid-template-columns: 1fr; gap: var(--s-xs); }
  .step { grid-template-columns: auto 1fr; column-gap: var(--s-md); padding: var(--s-sm) var(--s-md); }
  .step__n { grid-row: span 2; font-size: var(--t-xl); }
  .step__b { font-size: var(--t-xs); }
}

/* ---------- Triage ---------- */
.triage__grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: var(--s-lg); margin-top: var(--s-xl); align-items: stretch; }
.triage__list { list-style: none; display: grid; gap: var(--s-xs); align-content: start; }
.triage__btn { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--s-md); text-align: left; cursor: pointer; border: 0; padding: var(--s-md) var(--s-lg); min-height: 56px; border-radius: var(--r-md); background: var(--c-glass-light); box-shadow: var(--shadow-1); font-weight: 500; transition: background var(--dur-fast), color var(--dur-fast), transform var(--dur-fast) var(--ease); }
.triage__btn:hover { transform: translateX(3px); }
.triage__btn[aria-pressed="true"] { background: var(--c-brand); color: var(--c-on-dark); }
.triage__result { position: relative; display: grid; align-content: space-between; gap: var(--s-lg); padding: var(--s-xl); min-height: 320px; border-radius: var(--r-lg); background: var(--c-brand); color: var(--c-on-dark); overflow: hidden; box-shadow: var(--shadow-1); }
.triage__result::before { content: ""; position: absolute; inset: -40% -20% auto auto; width: 70%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 65%); pointer-events: none; }
.pill { width: fit-content; padding: 0.3rem 0.7rem; border-radius: 999px; font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; background: rgba(255, 255, 255, 0.16); border: 1px solid var(--c-glass-edge); }
.pill--now { background: var(--c-aqua-deep); color: #fff; border-color: transparent; }
.triage__head { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); line-height: 1.05; margin-top: var(--s-sm); }
.triage__advice { margin-top: var(--s-sm); font-size: var(--t-lg); color: var(--c-on-dark-soft); max-width: 34rem; }
@media (max-width: 1024px) { .triage__grid { grid-template-columns: 1fr; } }
@media (max-width: ${mq}) { .triage__result { padding: var(--s-lg); min-height: 0; } .triage__btn:hover { transform: none; } }

/* ---------- FAQ ---------- */
.faq__list { list-style: none; margin-top: var(--s-xl); border-top: 1px solid var(--c-line); max-width: 60rem; }
.faq__item { border-bottom: 1px solid var(--c-line); }
.faq__q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: var(--s-lg); padding: var(--s-lg) 0; text-align: left; background: none; border: 0; cursor: pointer; font-family: var(--f-display); font-weight: 500; font-size: var(--t-lg); line-height: 1.2; color: var(--c-brand); }
.faq__icon { flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--c-line); font-size: var(--t-lg); transition: transform var(--dur-base) var(--ease), background var(--dur-fast); }
.faq__q[aria-expanded="true"] .faq__icon { transform: rotate(45deg); background: var(--c-glass-light); }
.faq__a { overflow: hidden; }
.faq__a p { padding: 0 var(--s-xxl) var(--s-lg) 0; color: var(--c-ink-soft); font-size: var(--t-md); max-width: 46rem; }
@media (max-width: ${mq}) { .faq__a p { padding-right: 0; } }

/* ---------- Why us ---------- */
.why { background: var(--c-bg-deep); }
.why__head { margin-bottom: var(--s-xl); }
.why__stage { position: relative; width: min(100%, calc(1200px + var(--protrude) * 2)); margin-inline: auto; padding-inline: var(--protrude); }
.why__frame { position: relative; aspect-ratio: 4 / 3; }
.why__image { position: absolute; inset: 0; isolation: isolate; overflow: hidden; border-radius: var(--r-md); box-shadow: var(--shadow-1); background: var(--c-brand-dark); }
.why__image img { width: 100%; height: 100%; object-fit: cover; }
.why__spot { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 2px solid #fff; background: rgba(142, 197, 245, 0.85); box-shadow: 0 0 0 0 rgba(142, 197, 245, 0.7); animation: pulse 2s ease-out infinite; }
@keyframes pulse { to { box-shadow: 0 0 0 18px rgba(142, 197, 245, 0); } }
.why__caption { position: absolute; inset: auto var(--s-lg) var(--s-lg) var(--s-lg); max-width: 28rem; padding: var(--s-md) var(--s-lg); color: var(--c-on-dark); font-size: var(--t-md); }
.why__list { list-style: none; }
.why__list li { display: contents; }
.why__btn {
  position: absolute; width: min(320px, 34%); display: flex; align-items: center; justify-content: space-between; gap: var(--s-md); text-align: left; cursor: pointer;
  padding: var(--s-md) var(--s-lg); min-height: 76px; border-radius: var(--r-md); border: 1px solid var(--c-glass-edge);
  background: var(--c-glass-light); -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), var(--shadow-1); color: var(--c-brand);
  font-family: var(--f-display); font-weight: 700; font-size: var(--t-md); line-height: 1.1; letter-spacing: 0.02em; text-transform: uppercase;
  transition: transform var(--dur-base) var(--ease), background var(--dur-fast), color var(--dur-fast);
}
.why__btn:hover { transform: translateX(var(--nudge)); }
.why__btn[aria-pressed="true"] { background: var(--c-brand); color: var(--c-on-dark); border-color: var(--c-brand); }
.why__btn--l { left: calc(var(--protrude) * -1); --nudge: 8px; }
.why__btn--r { right: calc(var(--protrude) * -1); --nudge: -8px; }
.why__list li:nth-child(1) .why__btn { top: 8%; } .why__list li:nth-child(2) .why__btn { top: 30%; } .why__list li:nth-child(3) .why__btn { top: 54%; } .why__list li:nth-child(4) .why__btn { top: 76%; }
.why__idx { font-size: var(--t-xs); letter-spacing: 0.1em; opacity: 0.7; }
.why__detail { display: none; font-family: var(--f-body); font-weight: 400; text-transform: none; letter-spacing: 0; font-size: var(--t-sm); margin-top: var(--s-xs); opacity: 0.85; }
@media (max-width: ${mq}) {
  .why__stage { padding-inline: var(--gutter); }
  .why__frame { aspect-ratio: auto; }
  .why__image, .why__caption { display: none; }
  .why__list { display: grid; gap: var(--s-sm); }
  .why__btn { position: static; width: 100%; min-height: 0; align-items: flex-start; flex-direction: column; gap: 0; }
  .why__btn:hover { transform: none; }
  .why__detail { display: block; }
}

/* ---------- Job files (comparator + two-frame comparison) ---------- */
.jobs__stage { margin-top: var(--s-xl); }
.compare { position: relative; aspect-ratio: 16 / 9; border-radius: var(--r-md); overflow: hidden; background: var(--c-brand-dark); box-shadow: var(--shadow-1); touch-action: pan-y; user-select: none; }
.compare img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.photo-missing { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: var(--s-lg); text-align: center; background: var(--c-brand-dark); color: var(--c-on-dark-soft); font-size: var(--t-sm); }
.compare__tag { position: absolute; top: var(--s-md); padding: var(--s-xs) var(--s-sm); border-radius: var(--r-sm); font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c-on-dark); background: rgba(8, 17, 44, 0.6); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.compare__tag--l { left: var(--s-md); } .compare__tag--r { right: var(--s-md); }
.compare__handle { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #fff; pointer-events: none; }
.compare__handle::after { content: "\\2194"; position: absolute; top: 50%; left: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; display: grid; place-items: center; border-radius: 50%; background: var(--c-glass-light); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: var(--c-brand); font-weight: 700; box-shadow: var(--shadow-1); }
.compare__range { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: ew-resize; margin: 0; }
.compare:focus-within { outline: 3px solid var(--c-aqua-deep); outline-offset: 3px; }
.jobs__note { margin-top: var(--s-md); font-size: var(--t-sm); color: var(--c-ink-soft); }
@media (max-width: ${mq}) {
  .compare { aspect-ratio: 4 / 5; margin-inline: calc(var(--gutter) * -1); border-radius: 0; }
}

/* ---------- Areas ---------- */
.marquee { overflow: hidden; margin-top: var(--s-xl); -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.marquee__track { display: flex; width: max-content; animation: marquee 48s linear infinite; }
.marquee:hover .marquee__track { animation-play-state: paused; }
.marquee__list { list-style: none; display: flex; flex: none; font-family: var(--f-display); font-weight: 500; font-size: var(--t-xxl); line-height: 1.2; color: var(--c-brand); }
.marquee__list li { padding-right: var(--s-xl); white-space: nowrap; }
.marquee__list li::after { content: "\\2022"; margin-left: var(--s-xl); color: var(--c-call); }
@keyframes marquee { to { transform: translateX(-50%); } }
.areas__cta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-lg); margin-top: var(--s-xl); }
.areas__addr { color: var(--c-ink-soft); font-size: var(--t-sm); }

/* ---------- Water: liquid glass, eyebrow droplet, mesh, rhythm ---------- */
.eyebrow { display: inline-flex; align-items: center; gap: var(--s-xs); }
.eyebrow::before { content: ""; flex: none; width: 9px; height: 9px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: linear-gradient(135deg, #fff, var(--c-aqua-deep)); box-shadow: 0 0 0 1px rgba(47, 111, 181, 0.35); }
.hero .eyebrow::before, .areas .eyebrow::before { background: linear-gradient(135deg, #fff, var(--c-aqua)); box-shadow: none; }
.card {
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.78), rgba(196, 223, 250, 0.5));
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -10px 24px rgba(142, 197, 245, 0.18), 0 8px 24px rgba(24, 46, 111, 0.08), 0 0 0 1px var(--c-line);
}
.mesh {
  background-color: var(--c-bg);
  background-image:
    radial-gradient(38% 30% at 10% 32%, rgba(142, 197, 245, 0.6), transparent 72%),
    radial-gradient(34% 28% at 90% 52%, rgba(255, 255, 255, 0.75), transparent 72%),
    radial-gradient(42% 30% at 58% 80%, rgba(120, 170, 230, 0.38), transparent 72%);
}
.why {
  background-image:
    radial-gradient(36% 28% at 86% 24%, rgba(142, 197, 245, 0.55), transparent 72%),
    radial-gradient(40% 30% at 12% 74%, rgba(255, 255, 255, 0.55), transparent 72%);
}

/* ---------- Animated headings ---------- */
.reveal { display: block; }
.reveal__mask { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: 0.14em; margin-bottom: -0.14em; margin-right: 0.24em; }
.reveal__word { display: inline-block; will-change: transform; }

/* ---------- Wave dividers ---------- */
.wave { position: relative; height: var(--wave-h); overflow: hidden; line-height: 0; background: var(--w-from); }
.wave__svg { position: absolute; left: 0; bottom: -1px; width: 200%; height: 100%; animation: drift 30s linear infinite; }
.wave__svg--slow { animation-duration: 46s; animation-direction: reverse; }
.wave__fill { fill: var(--w-to); }
.wave__sheen { fill: var(--c-aqua); opacity: 0.4; }
.wave--bg-deep { --w-from: var(--c-bg); --w-to: var(--c-bg-deep); }
.wave--deep-bg { --w-from: var(--c-bg-deep); --w-to: var(--c-bg); }
.wave--deep-navy { --w-from: var(--c-bg-deep); --w-to: var(--c-brand-dark); }
.wave--navy-bg { --w-from: var(--c-brand-dark); --w-to: var(--c-bg); }
.wave--bg-brand { --w-from: var(--c-bg); --w-to: var(--c-brand); }
@keyframes drift { to { transform: translateX(-50%); } }

/* ---------- Rotating line under the hero headline ---------- */
.hero__rotor { display: flex; align-items: baseline; gap: var(--s-sm); flex-wrap: nowrap; font-family: var(--f-display); font-weight: 500; font-size: var(--t-xl); line-height: 1.2; min-height: 1.5em; }
.hero__rotor-label { color: var(--c-on-dark-soft); white-space: nowrap; }
.hero__rotor-slot { position: relative; display: inline-block; min-width: 9.5ch; padding-bottom: 4px; border-bottom: 2px solid var(--c-aqua); color: var(--c-aqua); white-space: nowrap; overflow: hidden; }
.hero__rotor-word { display: inline-block; }
@media (max-width: ${mq}) { .hero__rotor { font-size: var(--t-lg); } .hero__rotor-slot { min-width: 8.5ch; } }

/* ---------- Water-level scroll indicator ---------- */
.watermeter { position: fixed; z-index: 40; right: 4px; top: 50%; width: 6px; height: 36vh; transform: translateY(-50%); border-radius: 999px; overflow: hidden; pointer-events: none; background: rgba(255, 255, 255, 0.4); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); box-shadow: inset 0 0 0 1px rgba(24, 46, 111, 0.28), 0 0 10px rgba(142, 197, 245, 0.55); }
.watermeter__fill { position: absolute; inset: 0; transform-origin: bottom center; background: linear-gradient(to top, var(--c-aqua-deep), var(--c-aqua)); }
@media (max-width: ${T.layout.meterMin - 1}px) { .watermeter { display: none; } }

/* ---------- Service-area map ---------- */
.areas { background: var(--c-brand-dark); color: var(--c-on-dark); background-image: radial-gradient(38% 30% at 16% 48%, rgba(47, 111, 181, 0.55), transparent 72%), radial-gradient(34% 26% at 88% 70%, rgba(142, 197, 245, 0.22), transparent 72%); }
.areas .eyebrow { color: var(--c-on-dark-soft); }
.areas .h2 { color: var(--c-on-dark); }
.areas__addr { color: var(--c-on-dark-soft); }
.map { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: var(--s-xl); align-items: center; margin-top: var(--s-xl); }
.map__panel { padding: var(--s-sm); border-radius: var(--r-lg); background: linear-gradient(145deg, rgba(255, 255, 255, 0.16), rgba(142, 197, 245, 0.07)); border: 1px solid var(--c-glass-edge); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 18px 48px rgba(3, 9, 28, 0.4); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); }
.map__svg { display: block; width: 100%; height: auto; }
.map__grid { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; }
.map__water { fill: rgba(142, 197, 245, 0.26); stroke: rgba(142, 197, 245, 0.55); stroke-width: 1.5; }
.map__river { fill: none; stroke: rgba(142, 197, 245, 0.55); stroke-width: 4; stroke-linecap: round; }
.map__dot { fill: rgba(244, 248, 255, 0.85); transition: fill var(--dur-fast), r var(--dur-fast); }
.map__node { cursor: pointer; }
.map__node.is-active .map__dot { fill: var(--c-aqua); }
.map__ring { fill: none; stroke: var(--c-aqua); stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: ripple 2.4s ease-out infinite; }
.map__ring--late { animation-delay: 1.2s; }
.map__label { font-family: var(--f-display); font-weight: 700; font-size: 20px; fill: var(--c-on-dark); paint-order: stroke; stroke: var(--c-brand-dark); stroke-width: 5px; stroke-linejoin: round; }
.map__legend { fill: rgba(244, 248, 255, 0.6); font-family: var(--f-body); font-size: 13px; letter-spacing: 0.06em; }
@keyframes ripple { from { transform: scale(0.6); opacity: 0.9; } to { transform: scale(3.4); opacity: 0; } }
.map__side { display: grid; gap: var(--s-lg); }
.map__figs { display: flex; gap: var(--s-xl); }
.map__n { display: block; font-family: var(--f-display); font-weight: 700; font-size: var(--t-xxl); line-height: 1; font-variant-numeric: tabular-nums; color: var(--c-aqua); }
.map__cap { display: block; margin-top: var(--s-xs); font-size: var(--t-xs); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-on-dark-soft); }
.map__now { font-size: var(--t-lg); line-height: 1.35; min-height: 2.7em; color: var(--c-on-dark); }
.map__chips { list-style: none; display: flex; flex-wrap: wrap; gap: var(--s-xs); }
.map__chip { padding: 6px var(--s-md); border-radius: 999px; cursor: pointer; font-size: var(--t-sm); font-weight: 500; color: var(--c-on-dark); background: rgba(255, 255, 255, 0.1); border: 1px solid var(--c-glass-edge); transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast); }
.map__chip:hover, .map__chip.is-active { background: var(--c-aqua); color: var(--c-brand-dark); border-color: var(--c-aqua); }
.areas :focus-visible { outline-color: var(--c-aqua); }
@media (max-width: 1024px) { .map { grid-template-columns: 1fr; } }
@media (max-width: ${mq}) { .map { gap: var(--s-lg); margin-top: var(--s-lg); } .map__figs { gap: var(--s-lg); } .map__now { font-size: var(--t-md); min-height: 3em; } .map__label { font-size: 26px; } }

/* ---------- Footer ---------- */
.footer { background: var(--c-brand); color: var(--c-on-dark); padding-block: var(--s-xl) var(--s-lg); }
.footer__row { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--s-lg); }
.footer .logo { color: var(--c-on-dark); font-size: var(--t-xl); }
.footer__addr { margin-top: var(--s-xs); color: var(--c-on-dark-soft); font-size: var(--t-sm); }
.footer__phone { font-family: var(--f-display); font-weight: 700; font-size: var(--t-xl); letter-spacing: -0.01em; }
.footer__phone:hover { color: var(--c-aqua); }
.footer__addr a { color: var(--c-on-dark); text-decoration: underline; text-underline-offset: 3px; }
.footer__links { display: flex; flex-wrap: wrap; gap: var(--s-xs) var(--s-lg); margin-top: var(--s-lg); font-size: var(--t-sm); }
.footer__links a { color: var(--c-on-dark-soft); text-decoration: underline; text-underline-offset: 3px; }
.footer__links a:hover { color: var(--c-on-dark); }
.footer__legal { margin-top: var(--s-md); padding-top: var(--s-md); border-top: 1px solid rgba(255, 255, 255, 0.18); font-size: 11px; color: var(--c-on-dark-soft); }
`;

/* ==========================================================================
   LOGO (SVG placeholder wordmark in the brand colour; swap for the real asset)
   ========================================================================== */
function Logo({ onDark = false }: { onDark?: boolean }) {
  const [candidate, setCandidate] = useState<number>(0);
  const src = T.business.logoCandidates[candidate];
  return (
    <a className="logo" href="#top" aria-label={`${T.business.name} home`}>
      {src === undefined ? (
        <>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path fill="currentColor" d="M16 2C16 2 6 14 6 20a10 10 0 0 0 20 0C26 14 16 2 16 2z" />
          </svg>
          <span>{T.business.name}</span>
        </>
      ) : (
        <img
          className={`logo__img ${onDark ? "logo__img--light" : ""}`}
          src={src}
          alt={T.business.name}
          height={64}
          onError={() => setCandidate((n) => n + 1)}
        />
      )}
    </a>
  );
}

/* ==========================================================================
   VIDEO SCROLL ENGINE: preloads the frame sequence, scrubs it to scroll position.
   Owns the canvas ref, useScroll, and the derived spring / stage values.
   ========================================================================== */
type FramesStatus = "loading" | "ok" | "missing";
const FramesContext = createContext<FramesStatus>("loading");

interface EngineValues {
  progress: MotionValue<number>;
  stage: MotionValue<number>;
}

interface VideoScrollEngineProps {
  onStatus: (status: FramesStatus) => void;
  children: (values: EngineValues) => ReactNode;
}

function VideoScrollEngine({ onStatus, children }: VideoScrollEngineProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const lastDrawn = useRef<number>(-1);
  const loadedFlags = useRef<boolean[]>([]);
  const [settled, setSettled] = useState<number>(0);
  const [failed, setFailed] = useState<number>(0);
  const ready = settled >= T.frames.count;

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, T.spring);
  const progressRef = useRef<MotionValue<number>>(progress);
  progressRef.current = progress;
  const stage = useTransform(progress, (v) => Math.min(STAGES.length - 1, Math.max(0, Math.floor(v * STAGES.length))));

  const indexFor = (v: number): number => Math.min(T.frames.count - 1, Math.max(0, Math.round(v * (T.frames.count - 1))));

  // "Cover" draw: fills the canvas at any aspect ratio, centred on the focal point.
  // While frames are still arriving it shows the nearest frame that has loaded, so there is never a blank screen.
  const draw = useCallback((target: number): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let index = -1;
    for (let d = 0; d < T.frames.count && index < 0; d += 1) {
      if (loadedFlags.current[target - d]) index = target - d;
      else if (loadedFlags.current[target + d]) index = target + d;
    }
    const image = imagesRef.current[index];
    if (!image || image.naturalWidth === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, (canvas.width - w) * T.focal.x, (canvas.height - h) * T.focal.y, w, h);
    lastDrawn.current = target;
  }, []);

  // Load frames in the background. No loading screen: the first frame is also the CSS background, and scrolling is never blocked.
  useEffect(() => {
    let cancelled = false;
    const images = Array.from({ length: T.frames.count }, (_, i) => {
      const img = new Image();
      img.decoding = "async";
      if (i === 0) img.fetchPriority = "high";
      img.onload = () => {
        loadedFlags.current[i] = true;
        if (cancelled) return;
        setSettled((n) => n + 1);
        draw(indexFor(progressRef.current.get()));
      };
      img.onerror = () => {
        if (cancelled) return;
        setFailed((n) => n + 1);
        setSettled((n) => n + 1);
      };
      img.src = frameUrl(i + 1);
      return img;
    });
    imagesRef.current = images;
    return () => {
      cancelled = true;
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);

  // Keep the canvas pixel buffer matched to its CSS box (capped DPR for performance).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      draw(lastDrawn.current >= 0 ? lastDrawn.current : indexFor(progress.get()));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  useMotionValueEvent(progress, "change", (v) => {
    const index = indexFor(v);
    if (index !== lastDrawn.current) draw(index);
  });

  const framesMissing = ready && failed > T.frames.count / 2;
  useEffect(() => {
    if (!ready) return;
    if (framesMissing) {
      console.error(`Hero frames failed to load. Expected ${T.frames.dir}/${T.frames.prefix}001${T.frames.ext} to ${T.frames.count}.`);
      onStatus("missing");
    } else {
      onStatus("ok");
    }
  }, [ready, framesMissing, onStatus]);

  return (
    <section className="scrollsec" ref={sectionRef} id="process" aria-label="What happens when you call">
      <div className="scrollsec__stick">
        <canvas className="scrollsec__canvas" ref={canvasRef} aria-hidden="true" />
        {framesMissing && (
          <p className="hero__missing" role="alert">
            Scroll frames did not load. Check that the folder public{T.frames.dir} was uploaded in full ({T.frames.count} files named {T.frames.prefix}001{T.frames.ext} to {T.frames.prefix}
            {T.frames.count}
            {T.frames.ext}).
          </p>
        )}
        {children({ progress, stage })}
      </div>
    </section>
  );
}

/* ==========================================================================
   HERO
   ========================================================================== */
function StageReadout({ stage }: { stage: MotionValue<number> }) {
  const [index, setIndex] = useState<number>(stage.get());
  useMotionValueEvent(stage, "change", setIndex);
  const current = STAGES[index] ?? STAGES[0];
  return (
    <span className="meter__stage">
      {current ? `${current.time} · ${current.label}` : ""}
    </span>
  );
}

/* ==========================================================================
   LEAD FORM: 8 questions, one at a time. Phone is asked second, and every
   step after it is saved to the lead endpoint, so drop-offs are still callable.
   ========================================================================== */
type FormStatus = "idle" | "sending" | "sent" | "error";

interface LeadAnswers {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  service: string;
  urgency: string;
  ownership: string;
  address: string;
  zip: string;
  details: string;
  smsConsent: boolean;
  leakCheck: string;
  budget: string;
}

const EMPTY_ANSWERS: LeadAnswers = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  service: "",
  urgency: "",
  ownership: "",
  address: "",
  zip: "",
  details: "",
  smsConsent: false,
  leakCheck: "",
  budget: "",
};

type ChoiceField = "service" | "leakCheck" | "budget" | "urgency" | "ownership";
type QuestionKind = "name" | "phone" | "email" | "choice" | "address" | "details";

interface Question {
  kind: QuestionKind;
  title: string | ((a: LeadAnswers) => string);
  hint: string | ((a: LeadAnswers) => string);
  field?: ChoiceField;
  options?: readonly string[];
  // Only ask this question when it returns true (e.g. the leak check only for leak jobs).
  when?: (a: LeadAnswers) => boolean;
  // Use the smaller headline size for long questions.
  long?: boolean;
}

// Confluent's services, in the order they should appear in the form.
// range + depends feed the budget question. They are DFW research ranges (Oct 2026);
// replace them with Philip's real numbers when he sends them.
interface ServiceOption {
  label: string; // button text in the form
  phrase: string; // how the budget question refers to the job
  range: string; // what it usually runs, low to high
  depends: string; // why it can run higher
}

const SERVICE_OPTIONS: readonly ServiceOption[] = [
  { label: "Slab leak or yard line leak", phrase: "Fixing a slab or yard line leak", range: "$4,500–$15,000", depends: "where the leak is and how many lines need to be rerouted" },
  { label: "Water line replacement (meter to house)", phrase: "Replacing a water line", range: "$2,000–$5,000", depends: "the length of the line and what's on top of it, like a driveway, trees or landscaping" },
  { label: "Whole-house repipe (galvanized pipes)", phrase: "A whole-house repipe", range: "$6,000–$20,000", depends: "the size of your home, the number of bathrooms and how far the line runs from the meter" },
  { label: "Cast iron sewer line under the slab", phrase: "Replacing cast iron under the slab", range: "$9,000–$28,000", depends: "how many feet of pipe need replacing and how far we have to tunnel" },
  { label: "Gas line replacement", phrase: "A gas line replacement", range: "$3,000–$7,000", depends: "the length of the line and whether it runs under your yard, driveway or house" },
  { label: "Tankless water heater conversion", phrase: "A tankless conversion", range: "$6,000–$12,000", depends: "whether your gas line needs upsizing and where the new venting has to run" },
  { label: "Repipe + tankless (both)", phrase: "A repipe plus tankless", range: "$10,000–$25,000", depends: "the size of your home and whether your gas line and venting need upgrading" },
];

const OTHER_SERVICE = "Something else";
const LEAK_SERVICE = "Slab leak or yard line leak";
const FORM_SERVICES: readonly string[] = [...SERVICE_OPTIONS.map((s) => s.label), OTHER_SERVICE];
const serviceInfo = (a: LeadAnswers): ServiceOption | undefined => SERVICE_OPTIONS.find((s) => s.label === a.service);

// A lead is qualified only with a $5,000+ budget (cash or financing).
// Keep the first two in sync with QUALIFIED_BUDGETS in functions/api/lead.ts.
const BUDGET_OPTIONS: readonly string[] = ["Yes, I have $5,000+ set aside", "Yes, with financing", "No, I'm under $5,000"];

// Confluent counts a lead as qualified only if the job is within 2 weeks.
// The first two options are qualified; keep this in sync with QUALIFIED_TIMELINES in functions/api/lead.ts.
const TIMELINE_OPTIONS: readonly string[] = ["As soon as possible", "Within 2 weeks", "2 to 4 weeks", "1 to 3 months", "Just comparing prices"];

const FIRST_QUESTION: Question = { kind: "name", title: "First things first. What's your name?", hint: "Takes about 60 seconds." };

const QUESTIONS: readonly Question[] = [
  FIRST_QUESTION,
  { kind: "phone", title: "What's the best number to reach you?", hint: "We call back fast. No spam, ever." },
  { kind: "email", title: "And your email?", hint: "Optional. For your estimate and appointment details." },
  { kind: "choice", field: "service", title: "What do you need help with?", hint: "Pick the closest match. Financing available.", options: FORM_SERVICES },
  {
    kind: "choice",
    field: "leakCheck",
    title: "Have you ruled out toilets, sprinklers and outdoor faucets?",
    hint: "Most high water bills start there. If you've checked them and it's still leaking, it's likely under the slab or in the yard line.",
    options: ["Yes, I've checked them", "Not sure yet"],
    when: (a) => a.service === LEAK_SERVICE,
    long: true,
  },
  {
    kind: "choice",
    field: "budget",
    title: (a) => {
      const info = serviceInfo(a);
      return info
        ? `${info.phrase} usually runs ${info.range}. Do you have a budget of $5,000 or more for this project?`
        : "Most of our projects run $5,000 or more. Do you have a budget of $5,000 or more for this project?";
    },
    hint: (a) => {
      const info = serviceInfo(a);
      const why = info ? `Depending on ${info.depends}. ` : "";
      return `${why}Doing it right the first time costs less than doing it twice. Financing available.`;
    },
    options: BUDGET_OPTIONS,
    long: true,
  },
  {
    kind: "choice",
    field: "urgency",
    title: "When do you want the work done?",
    hint: "Smell gas? Get everyone outside first, then call us.",
    options: TIMELINE_OPTIONS,
  },
  {
    kind: "choice",
    field: "ownership",
    title: "Do you own the property?",
    hint: "Helps us know who signs off on the work.",
    options: ["I own it", "I rent", "Landlord or property manager", "Commercial property"],
  },
  { kind: "address", title: "Where's the job?", hint: "Street address and ZIP code." },
  { kind: "details", title: "Anything we should know before we call?", hint: "Optional. What you're seeing and how long it's been going on." },
];

// The questions this visitor will actually see, based on their answers so far.
const activeQuestions = (a: LeadAnswers): readonly Question[] => QUESTIONS.filter((q) => !q.when || q.when(a));
const textFor = (value: string | ((a: LeadAnswers) => string), a: LeadAnswers): string => (typeof value === "function" ? value(a) : value);

const PHONE_STEP = QUESTIONS.findIndex((q) => q.kind === "phone");

// Optional, unchecked by default (carriers do not allow consent to be required or pre-checked).
// The exact wording is sent with the lead so there is a record of what the person agreed to.
const SMS_CONSENT_TEXT =
  `I agree to receive text messages from ${T.business.legalName} about my service request, including appointment scheduling, reminders and follow-ups. ` +
  "Consent is not a condition of purchase. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

const digitsOnly = (value: string): string => value.replace(/\D/g, "");
const isValidPhone = (value: string): boolean => {
  const d = digitsOnly(value);
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
};
const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

function formatPhone(value: string): string {
  let d = digitsOnly(value);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

function newLeadId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateStep(question: Question, a: LeadAnswers): string | null {
  switch (question.kind) {
    case "name":
      return a.firstName.trim() ? null : "Please enter your first name.";
    case "phone":
      return isValidPhone(a.phone) ? null : "Please enter a 10-digit phone number.";
    case "email":
      return !a.email.trim() || isValidEmail(a.email) ? null : "That email doesn't look right. Fix it or leave it blank.";
    case "choice":
      return question.field && a[question.field] ? null : "Pick one to continue.";
    case "address":
      if (!a.address.trim()) return "Please enter the street address.";
      return /^\d{5}$/.test(a.zip.trim()) ? null : "Please enter a 5-digit ZIP code.";
    case "details":
      return null;
  }
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
  }
}

/* ==========================================================================
   AD TRACKING (Meta -> site -> GoHighLevel)
   - Saves which ad/campaign brought the visitor (UTMs + Facebook click ID) for 30 days
     and sends it with every lead, so GoHighLevel knows the source.
   - Loads the Meta Pixel only when VITE_META_PIXEL_ID is set in Cloudflare Pages.
   ========================================================================== */
const ATTR_KEY = "cs_attr";
const ATTR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const GOOGLE_CLICK_KEYS = ["gclid", "gbraid", "wbraid"] as const;

// Google Ads conversion for a completed quote form. Paste the label from the
// "Quote Form Submit" event snippet (the part after the slash in send_to).
const GOOGLE_ADS_ID = "AW-18522908290";
const GOOGLE_ADS_LEAD_LABEL = "gEnbCO-MrqodEILNtIBF";

type Attribution = Partial<
  Record<(typeof UTM_KEYS)[number] | (typeof GOOGLE_CLICK_KEYS)[number] | "fbclid" | "landingPage" | "referrer", string>
> & {
  fbclidAt?: number;
  capturedAt?: number;
};

function readAttribution(): Attribution {
  try {
    const raw = window.localStorage.getItem(ATTR_KEY);
    const a = raw ? (JSON.parse(raw) as Attribution) : {};
    if (!a.capturedAt || Date.now() - a.capturedAt > ATTR_TTL_MS) return {};
    return a;
  } catch {
    return {};
  }
}

function captureAttribution(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const found: Attribution = {};
    for (const key of UTM_KEYS) {
      const v = q.get(key);
      if (v) found[key] = v.slice(0, 200);
    }
    for (const key of GOOGLE_CLICK_KEYS) {
      const v = q.get(key);
      if (v) found[key] = v.slice(0, 200);
    }
    const fbclid = q.get("fbclid");
    if (fbclid) {
      found.fbclid = fbclid.slice(0, 500);
      found.fbclidAt = Date.now();
    }
    if (!Object.keys(found).length) return;
    const ref = document.referrer.slice(0, 500);
    window.localStorage.setItem(
      ATTR_KEY,
      JSON.stringify({ ...readAttribution(), ...found, landingPage: window.location.pathname.slice(0, 300), referrer: ref, capturedAt: Date.now() }),
    );
  } catch {
    /* storage blocked: attribution just won't be saved */
  }
}

function readCookie(name: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  if (!m || m[1] === undefined) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// Facebook click cookie, rebuilt from the saved click ID if the pixel was blocked.
function getFbc(a: Attribution): string {
  const cookie = readCookie("_fbc");
  if (cookie) return cookie;
  return a.fbclid ? `fb.1.${a.fbclidAt ?? a.capturedAt ?? Date.now()}.${a.fbclid}` : "";
}

// Google Ads lead conversion with hashed-on-Google's-side customer data (enhanced conversions).
function sendGoogleLead(a: LeadAnswers, leadId: string): void {
  if (!window.gtag || !GOOGLE_ADS_LEAD_LABEL) return;
  const digits = a.phone.replace(/\D/g, "").slice(-10);
  const userData: Record<string, string> = {};
  if (a.email.trim()) userData.email = a.email.trim().toLowerCase();
  if (digits.length === 10) userData.phone_number = `+1${digits}`;
  if (Object.keys(userData).length) window.gtag("set", "user_data", userData);
  window.gtag("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_LEAD_LABEL}`,
    value: 1.0,
    currency: "USD",
    transaction_id: leadId,
  });
}

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: unknown };

function initMetaPixel(pixelId: string | undefined): void {
  if (!pixelId || typeof window === "undefined" || window.fbq) return;
  const fbq = function (...args: unknown[]): void {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", pixelId);
  fbq("track", "PageView");
}

const META_PIXEL_ID: string | undefined = import.meta.env.VITE_META_PIXEL_ID;

function LeadForm() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LeadAnswers>(EMPTY_ANSWERS);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<FormStatus>("idle");
  const leadId = useRef<string>(newLeadId());
  const touched = useRef(false);
  const reduceMotion = useReducedMotion();

  const active = activeQuestions(answers);
  const total = active.length;
  const question: Question = active[step] ?? FIRST_QUESTION;
  const pct = status === "sent" ? 100 : Math.floor(((step + 1) / total) * 100);
  const isLast = step === total - 1;
  const title = textFor(question.title, answers);
  const hint = textFor(question.hint, answers);

  // Focus the new question's first input when it mounts (after the slide), never on first page load.
  const stepRef = useCallback((node: HTMLDivElement | null): void => {
    if (!node || !touched.current) return;
    node.querySelector<HTMLElement>("input, textarea, button.choice")?.focus({ preventScroll: true });
  }, []);

  const set = <K extends keyof LeadAnswers>(key: K, value: LeadAnswers[K]): void => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  const send = useCallback(async (a: LeadAnswers, stage: "partial" | "complete", lastStep: number): Promise<boolean> => {
    const attr = readAttribution();
    const payload = {
      leadId: leadId.current,
      stage,
      lastStep: lastStep + 1,
      totalSteps: activeQuestions(a).length,
      name: `${a.firstName.trim()} ${a.lastName.trim()}`.trim(),
      firstName: a.firstName.trim(),
      lastName: a.lastName.trim(),
      phone: formatPhone(a.phone),
      email: a.email.trim(),
      service: a.service,
      leakCheck: a.leakCheck,
      budget: a.budget,
      urgency: a.urgency,
      ownership: a.ownership,
      address: a.address.trim(),
      zip: a.zip.trim(),
      details: a.details.trim(),
      smsConsent: a.smsConsent,
      smsConsentText: a.smsConsent ? SMS_CONSENT_TEXT : "",
      page: typeof window !== "undefined" ? window.location.href : "",
      // Which ad sent them (saved when they landed from the ad).
      utm_source: attr.utm_source ?? "",
      utm_medium: attr.utm_medium ?? "",
      utm_campaign: attr.utm_campaign ?? "",
      utm_content: attr.utm_content ?? "",
      utm_term: attr.utm_term ?? "",
      fbclid: attr.fbclid ?? "",
      // Google click IDs, so GoHighLevel can send booked jobs back to Google Ads.
      gclid: attr.gclid ?? "",
      gbraid: attr.gbraid ?? "",
      wbraid: attr.wbraid ?? "",
      landingPage: attr.landingPage ?? "",
      referrer: attr.referrer ?? "",
      fbc: getFbc(attr),
      fbp: readCookie("_fbp"),
      // Same ID the browser pixel uses, so Meta counts the lead once.
      metaEventId: `lead-${leadId.current}`,
    };
    try {
      const response = await fetch(T.business.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const goNext = async (a: LeadAnswers = answers): Promise<void> => {
    touched.current = true;
    const list = activeQuestions(a);
    const current = list[step] ?? FIRST_QUESTION;
    const problem = validateStep(current, a);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    if (step === list.length - 1) {
      setStatus("sending");
      const ok = await send(a, "complete", step);
      if (ok) {
        setStatus("sent");
        window.fbq?.("track", "Lead", { content_name: a.service }, { eventID: `lead-${leadId.current}` });
        sendGoogleLead(a, leadId.current);
      } else {
        setStatus("error");
      }
      return;
    }

    // Once we have a phone number, save progress after every step (fire and forget).
    if (step >= PHONE_STEP) void send(a, "partial", step);
    setStep((s) => Math.min(s + 1, list.length - 1));
  };

  const goBack = (): void => {
    touched.current = true;
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const pick = (field: ChoiceField, value: string): void => {
    const next = { ...answers, [field]: value };
    setAnswers(next);
    void goNext(next);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void goNext();
  };

  if (status === "sent") {
    return (
      <div className="form form--steps glass" role="status" aria-live="polite">
        <div className="form__track" aria-hidden="true">
          <div className="form__bar" style={{ width: "100%" }} />
        </div>
        <div className="form__done">
          <p className="form__count">All set</p>
          <h2 className="form__q">Thanks, {answers.firstName.trim() || "there"}. We'll call you shortly.</h2>
          <p className="form__hint">
            Keep your phone close. We'll call {formatPhone(answers.phone)} from {T.business.phoneDisplay}.
          </p>
          <p className="form__note">
            Emergency? Call now: <a href={T.business.phoneHref}>{T.business.phoneDisplay}</a>
          </p>
        </div>
      </div>
    );
  }

  const slide = reduceMotion ? {} : { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 } };

  return (
    <form className="form form--steps glass" onSubmit={onSubmit} noValidate aria-label="Request a call back">
      <div className="form__top">
        <span>{step === 0 ? "Let's go" : "Get a call back fast"}</span>
        <span className="form__pct">{pct}%</span>
      </div>
      <div className="form__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Form progress">
        <div className="form__bar" style={{ width: `${pct}%` }} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} ref={stepRef} className="form__step" transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} {...slide}>
          <p className="form__count">
            Question {step + 1} of {total}
          </p>
          <h2 className={`form__q${question.long ? " form__q--long" : ""}`} id={`lead-q-${step}`}>
            {title}
          </h2>
          <p className="form__hint">{hint}</p>

          {question.kind === "name" && (
            <div className="field--pair">
              <div className="field">
                <input aria-label="First name" name="firstName" type="text" autoComplete="given-name" placeholder="First name" maxLength={60} value={answers.firstName} onChange={(e) => set("firstName", e.target.value)} />
              </div>
              <div className="field">
                <input aria-label="Last name" name="lastName" type="text" autoComplete="family-name" placeholder="Last name" maxLength={60} value={answers.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
            </div>
          )}

          {question.kind === "phone" && (
            <div className="field">
              <input aria-label="Phone number" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="817-000-0000" maxLength={20} value={answers.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} />
            </div>
          )}

          {question.kind === "phone" && (
            <label className="consent">
              <input type="checkbox" name="smsConsent" checked={answers.smsConsent} onChange={(e) => set("smsConsent", e.target.checked)} />
              <span>
                {SMS_CONSENT_TEXT} See our <a href={T.business.privacyHref} target="_blank" rel="noopener">Privacy Policy</a> and{" "}
                <a href={T.business.termsHref} target="_blank" rel="noopener">Terms</a>.
              </span>
            </label>
          )}

          {question.kind === "email" && (
            <div className="field">
              <input aria-label="Email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" maxLength={120} value={answers.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          )}

          {question.kind === "choice" && question.field && question.options && (
            <div className="choices" role="group" aria-labelledby={`lead-q-${step}`}>
              {question.options.map((option) => {
                const field = question.field as ChoiceField;
                return (
                  <button key={option} type="button" className="choice" aria-pressed={answers[field] === option} onClick={() => pick(field, option)}>
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {question.kind === "address" && (
            <>
              <div className="field">
                <input aria-label="Street address" name="address" type="text" autoComplete="street-address" placeholder="Street address" maxLength={160} value={answers.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="field field--zip">
                <input aria-label="ZIP code" name="zip" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="ZIP" maxLength={5} value={answers.zip} onChange={(e) => set("zip", digitsOnly(e.target.value).slice(0, 5))} />
              </div>
            </>
          )}

          {question.kind === "details" && (
            <div className="field">
              <textarea aria-label="Details" name="details" placeholder="Example: water pooling by the water heater since this morning." maxLength={1000} value={answers.details} onChange={(e) => set("details", e.target.value)} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="form__err" role="alert" aria-live="assertive">
        {error ?? (status === "error" ? `Could not send. Please call ${T.business.phoneDisplay}.` : "")}
      </p>

      <div className="form__nav">
        <button type="button" className="form__back" onClick={goBack} hidden={step === 0}>
          ← Back
        </button>
        {question.kind !== "choice" && (
          <div className="form__go">
            {question.kind !== "details" && <span className="form__enter">press Enter ↵</span>}
            <button className="submit" type="submit" disabled={status === "sending"}>
              {isLast ? (status === "sending" ? "Sending…" : "Request my call") : "Continue →"}
            </button>
          </div>
        )}
      </div>

      <p className="form__note">
        Emergency? Call <a href={T.business.phoneHref}>{T.business.phoneDisplay}</a>
      </p>
    </form>
  );
}

function HeroSection() {
  return (
    <section className="hero" id="top" aria-label="Confluent Solutions, Fort Worth plumbing">
      <WistiaBackground />
      <div className="hero__layout">
        <div className="hero__copy">
          <p className="eyebrow">{T.business.name} · Fort Worth, TX</p>
          <h1 className="hero__title" aria-label={HERO_TITLE}>
            {HERO_TITLE.split(" ").map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className="hero__word"
                aria-hidden="true"
                initial={{ opacity: 0, y: "0.4em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                {word}
              </motion.span>
            ))}
          </h1>
          <RotatingLine />
          <div className="hero__actions">
            <a className="hero__phone" href={T.business.phoneHref}>
              {T.business.phoneDisplay}
            </a>
            <TextUsButton />
          </div>
        </div>
        <div className="hero__side">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   SERVICES
   ========================================================================== */
function useSpotlight<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const onPointerMove = (event: ReactPointerEvent<E>): void => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };
  return { ref, onPointerMove };
}

const ART_PATHS: readonly ReactNode[] = [
  // gas: flame
  <path key="gas" d="M32 6c2 10 14 16 14 30a14 14 0 0 1-28 0c0-7 4-10 7-14 1 5 4 7 6 8-1-8 0-16 1-24z" />,
  // water / sewer line: two pipes and a coupling
  <g key="line"><path d="M4 24h20v16H4z" /><path d="M40 24h20v16H40z" /><path d="M24 20h16v24H24z" /></g>,
  // repiping: elbows
  <g key="repipe"><path d="M8 10v20a8 8 0 0 0 8 8h12" /><path d="M20 10v16a4 4 0 0 0 4 4h8" /><path d="M36 38h20" /><path d="M32 30h24" /></g>,
  // slab leak: slab and drop
  <g key="slab"><path d="M4 46h56v10H4z" /><path d="M32 8c0 0-10 12-10 20a10 10 0 0 0 20 0c0-8-10-20-10-20z" /></g>,
  // drain: grate
  <g key="drain"><circle cx="32" cy="32" r="24" /><path d="M20 32h24M24 24h16M24 40h16" /></g>,
  // water heater: tank
  <g key="heater"><rect x="16" y="6" width="32" height="48" rx="8" /><path d="M24 54v6M40 54v6" /><path d="M32 24c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-4 3-6" /></g>,
  // leak detection: magnifier with drop
  <g key="detect"><circle cx="27" cy="27" r="18" /><path d="M40 40l18 18" /><path d="M27 17c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" /></g>,
  // repairs: wrench
  <path key="repair" d="M46 6a14 14 0 0 0-12 19L8 51a5 5 0 0 0 7 7l26-26A14 14 0 0 0 58 18l-9 9-8-2-2-8 9-9z" />,
];

function ServiceCard({ index, title }: { index: number; title: string }) {
  const spotlight = useSpotlight<HTMLLIElement>();
  const slug = SERVICE_SLUGS[index];
  const [photoFailed, setPhotoFailed] = useState<boolean>(false);
  const photo = slug && !photoFailed ? `/services/${slug}.jpg` : undefined;
  return (
    <li className="service card spot" ref={spotlight.ref} onPointerMove={spotlight.onPointerMove}>
      <div className="service__media">
        {photo ? (
          <img src={photo} alt={title} width={640} height={480} loading="lazy" onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="service__art" aria-hidden="true">
            <svg viewBox="0 0 64 64">{ART_PATHS[index]}</svg>
          </div>
        )}
      </div>
      <div className="service__body">
        <span className="service__n">{String(index + 1).padStart(2, "0")}</span>
        <span className="service__t">{title}</span>
      </div>
    </li>
  );
}

function ServicesSection() {
  return (
    <section className="section mesh" id="services">
      <div className="wrap">
        <div className="services__head">
          <p className="eyebrow">Services</p>
          <RevealHeading>What we fix, find and replace.</RevealHeading>
          <p className="services__lede">Residential plumbing and gas line work across the Fort Worth area.</p>
        </div>
        <ul className="services__grid">
          {SERVICES.map((service, i) => (
            <ServiceCard key={service} index={i} title={service} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ==========================================================================
   STATS STRIP (only figures that come from the supplied business details)
   ========================================================================== */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const value = useMotionValue<number>(0);
  const [shown, setShown] = useState<number>(0);
  useMotionValueEvent(value, "change", (v) => setShown(Math.round(v)));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, to, value]);
  return <span ref={ref}>{shown}</span>;
}

function StatsStrip() {
  return (
    <div className="stats">
      <div className="wrap stats__row">
        <div className="stat">
          <span className="stat__n">
            <CountUp to={24} />/7
          </span>
          <span className="stat__l">Emergency response</span>
        </div>
        <div className="stat">
          <span className="stat__n">
            <CountUp to={SERVICE_AREAS.length} />
          </span>
          <span className="stat__l">Cities served</span>
        </div>
        <div className="stat">
          <span className="stat__n">
            <CountUp to={SERVICES.length} />
          </span>
          <span className="stat__l">Core services</span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   TRIAGE: "Is it urgent?" interactive helper
   ========================================================================== */
const LEVEL_LABEL: Record<Triage["level"], string> = { now: "Act now", today: "Call today", soon: "Book a visit" };

function TriageSection() {
  const [active, setActive] = useState<number>(0);
  const item = TRIAGE[active] ?? TRIAGE[0];
  if (!item) return null;
  return (
    <section className="section mesh" id="triage">
      <div className="wrap">
        <p className="eyebrow">Is it urgent?</p>
        <RevealHeading>Pick what you are seeing.</RevealHeading>
        <div className="triage__grid">
          <ul className="triage__list">
            {TRIAGE.map((t, i) => (
              <li key={t.symptom}>
                <button type="button" className="triage__btn" aria-pressed={active === i} onClick={() => setActive(i)}>
                  <span>{t.symptom}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="triage__result" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={item.symptom}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <span className={`pill ${item.level === "now" ? "pill--now" : ""}`}>{LEVEL_LABEL[item.level]}</span>
                <h3 className="triage__head">{item.headline}</h3>
                <p className="triage__advice">{item.advice}</p>
              </motion.div>
            </AnimatePresence>
            <a className="call-btn" href={T.business.phoneHref}>
              Call {T.business.phoneDisplay}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   FAQ
   ========================================================================== */
function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section mesh" id="faq">
      <div className="wrap">
        <p className="eyebrow">FAQ</p>
        <RevealHeading>Straight answers.</RevealHeading>
        <ul className="faq__list">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <li className="faq__item" key={f.q}>
                <button type="button" className="faq__q" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <span>{f.q}</span>
                  <span className="faq__icon" aria-hidden="true">+</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq__a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p>{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ==========================================================================
   WHY CHOOSE US: 1200x900 image (desktop only) with buttons protruding from its edges
   ========================================================================== */
function WhySection() {
  const [whySrc, setWhySrc] = useState<string>("/images/why-1200x900.jpg");
  const [active, setActive] = useState<number>(0);
  const reason = REASONS[active] ?? REASONS[0];
  if (!reason) return null;
  return (
    <section className="section why" id="why">
      <div className="wrap why__head">
        <p className="eyebrow">Why choose us</p>
        <RevealHeading>Four reasons homeowners call us back.</RevealHeading>
      </div>
      <div className="why__stage">
        <div className="why__frame">
          <div className="why__image">
            {whySrc === "" ? (
              <p className="photo-missing">Image not found</p>
            ) : (
              <img
                src={whySrc}
                alt="Completed pipe connection at a home foundation"
                width={1200}
                height={900}
                loading="lazy"
                onError={() => setWhySrc((current) => (current === frameUrl(T.frames.count) ? "" : frameUrl(T.frames.count)))}
              />
            )}
            <motion.span
              className="why__spot"
              initial={false}
              animate={{ left: reason.spotX, top: reason.spotY }}
              transition={{ type: "spring", stiffness: 160, damping: 24 }}
            />
            <p className="why__caption glass" aria-live="polite">
              {reason.detail}
            </p>
          </div>
          <ul className="why__list">
            {REASONS.map((r, i) => (
              <li key={r.title}>
                <button
                  type="button"
                  className={`why__btn ${i % 2 === 0 ? "why__btn--l" : "why__btn--r"}`}
                  aria-pressed={active === i}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                >
                  <span>
                    {r.title}
                    <span className="why__detail">{r.detail}</span>
                  </span>
                  <span className="why__idx">{String(i + 1).padStart(2, "0")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   JOB FILES: before/after comparator + two-frame comparison
   ========================================================================== */
function JobsSection() {
  const framesStatus = useContext(FramesContext);
  const split = useMotionValue<number>(50);
  const clip = useTransform(split, (v) => `inset(0 ${100 - v}% 0 0)`);
  const handleLeft = useTransform(split, (v) => `${v}%`);
  const first = STAGES[0];
  const last = STAGES[STAGES.length - 1];
  if (!first || !last) return null;

  return (
    <section className="section mesh" id="jobs">
      <div className="wrap">
        <p className="eyebrow">Job files</p>
        <RevealHeading>From disconnected to connected.</RevealHeading>
        <div className="jobs__stage">
          <div className="compare">
            {framesStatus === "missing" && <p className="photo-missing">Images not found in {T.frames.dir}</p>}
            <img src={frameUrl(last.frame)} alt={`Pipe connection at ${last.time}: ${last.label}`} width={1280} height={720} loading="lazy" />
            <motion.img src={frameUrl(first.frame)} alt={`Pipe sections at ${first.time}: ${first.label}`} width={1280} height={720} loading="lazy" style={{ clipPath: clip }} />
            <span className="compare__tag compare__tag--l">Before</span>
            <span className="compare__tag compare__tag--r">After</span>
            <motion.span className="compare__handle" style={{ left: handleLeft }} />
            <input
              className="compare__range"
              type="range"
              min={0}
              max={100}
              step={1}
              defaultValue={50}
              aria-label="Drag to compare before and after"
              onChange={(e) => split.set(Number(e.currentTarget.value))}
            />
          </div>
          <p className="jobs__note">Drag the divider to compare.</p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   WISTIA BACKGROUND: looping, muted, no controls, fills its parent like object-fit: cover
   ========================================================================== */
function addScriptOnce(src: string, isModule: boolean): void {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const el = document.createElement("script");
  el.src = src;
  el.async = true;
  if (isModule) el.type = "module";
  document.head.appendChild(el);
}

function WistiaBackground() {
  const bgRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<WistiaPlayerElement>(null);
  const inView = useInView(bgRef, { margin: "120px" });
  const reduceMotion = useReducedMotion();

  // Same scripts as Wistia's embed code, loaded once.
  useEffect(() => {
    if (reduceMotion) return;
    addScriptOnce(T.business.wistia.playerSrc, false);
    addScriptOnce(T.business.wistia.embedSrc, true);
  }, [reduceMotion]);

  // "Cover" sizing: scale the 16:9 player so it always fills the section.
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    const fit = (): void => {
      const width = Math.max(bg.clientWidth, (bg.clientHeight * 16) / 9);
      bg.style.setProperty("--bgw", `${Math.ceil(width)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(bg);
    return () => observer.disconnect();
  }, []);

  // Play only while on screen (saves battery and bandwidth).
  useEffect(() => {
    if (reduceMotion) return;
    void customElements.whenDefined("wistia-player").then(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        if (inView) void player.play?.();
        else player.pause?.();
      } catch {
        /* player not ready yet: autoplay handles the first start */
      }
    });
  }, [inView, reduceMotion]);

  return (
    <div className="hero__bg" ref={bgRef} aria-hidden="true">
      {!reduceMotion && (
        <wistia-player
          ref={playerRef}
          media-id={T.business.wistia.mediaId}
          aspect="1.7777777777777777"
          autoplay="true"
          muted="true"
          silent-autoplay="allow"
          end-video-behavior="loop"
          controls-visible-on-load="false"
          play-bar-control="false"
          play-pause-control="false"
          big-play-button="false"
          volume-control="false"
          fullscreen-control="false"
          settings-control="false"
        />
      )}
    </div>
  );
}

/* ==========================================================================
   PROCESS: scroll-scrubbed frames as the background, cards 01-04 revealed by scroll position
   ========================================================================== */
function StepCard({ step, index, progress }: { step: Step; index: number; progress: MotionValue<number> }) {
  const start = T.scroll.revealStart + index * T.scroll.revealStep;
  const end = start + T.scroll.revealSpan;
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const y = useTransform(progress, [start, end], [48, 0]);
  return (
    <motion.li className="step glass" style={{ opacity, y }}>
      <span className="step__n">{step.n}</span>
      <h3 className="step__t">{step.title}</h3>
      <p className="step__b">{step.body}</p>
    </motion.li>
  );
}

function ProcessSection({ progress, stage }: { progress: MotionValue<number>; stage: MotionValue<number> }) {
  return (
    <>
      <div className="process__layout">
        <div className="process__head">
          <p className="eyebrow">What happens when you call</p>
          <h2 className="process__title">No guessing. Here is the whole job, start to finish.</h2>
        </div>
        <ol className="process__steps">
          {STEPS.map((step, i) => (
            <StepCard key={step.n} step={step} index={i} progress={progress} />
          ))}
        </ol>
      </div>
      <div className="meter" aria-hidden="true">
        <div className="meter__row">
          <StageReadout stage={stage} />
        </div>
        <div className="meter__track">
          <motion.div className="meter__bar" style={{ scaleX: progress }} />
        </div>
      </div>
    </>
  );
}

function TrustFacts() {
  const facts = TRUST_FACTS.filter((f) => f.value.trim() !== "");
  if (facts.length === 0) return null;
  return (
    <div className="trust">
      <div className="wrap">
        <ul className="trust__list">
          {facts.map((f) => (
            <li key={f.label}>
              <span>{f.label}</span>
              {f.value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


/* ==========================================================================
   SOCIAL ICONS, BADGES
   ========================================================================== */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.85v-8.38H7.1V12h3V9.36c0-3 1.8-4.67 4.54-4.67 1.31 0 2.69.23 2.69.23v2.95h-1.51c-1.5 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.57-5.17 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function BadgesSection() {
  return (
    <section className="section why" id="badges">
      <div className="wrap">
        <p className="eyebrow">Recognition and partners</p>
        <RevealHeading>Names homeowners already know.</RevealHeading>
        <ul className="badges__grid">
          {BADGES.map((badge) => (
            <li className={`badge card ${badge.width / badge.height > 2 ? "badge--wide" : ""}`} key={badge.name}>
              <img src={badge.src} alt={badge.name} width={badge.width} height={badge.height} loading="lazy" />
            </li>
          ))}
        </ul>
        <div className="badges__social">
          <p>Find and review us</p>
          <a className="social" href={T.business.google} target="_blank" rel="noopener noreferrer">
            <GoogleIcon />
            Google reviews
          </a>
          <a className="social" href={T.business.facebook} target="_blank" rel="noopener noreferrer">
            <FacebookIcon />
            Facebook
          </a>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   EXIT INTENT: cursor leaves through the top of the viewport. One line, the number.
   ========================================================================== */
const EXIT_STORAGE_KEY = "cofulent-exit-shown";
const EXIT_MIN_DWELL_MS = 4000;

function ExitIntentPopup() {
  const [open, setOpen] = useState<boolean>(false);
  const mountedAt = useRef<number>(Date.now());
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(EXIT_STORAGE_KEY) === "1";
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return;

    const onLeave = (event: MouseEvent): void => {
      if (event.clientY > 0 || event.relatedTarget !== null) return;
      if (Date.now() - mountedAt.current < EXIT_MIN_DWELL_MS) return;
      setOpen(true);
      try {
        sessionStorage.setItem(EXIT_STORAGE_KEY, "1");
      } catch {
        /* storage unavailable: popup may show again, which is acceptable */
      }
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="exit"
          role="dialog"
          aria-modal="true"
          aria-label="Call Confluent Solutions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="exit__card glass"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="exit__close" ref={closeRef} onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
            <p className="exit__line">Leak, gas smell or no hot water? Call before it gets worse.</p>
            <a className="exit__call" href={T.business.phoneHref}>
              {T.business.phoneDisplay}
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ==========================================================================
   FOOTER, HEADER, MOBILE CALL BAR
   ========================================================================== */
function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__row">
          <div>
            <Logo onDark />
            <p className="footer__addr">{T.business.address}</p>
            <p className="footer__addr">
              <a href={`mailto:${T.business.email}`}>{T.business.email}</a>
            </p>
            <div className="footer__social">
              <a href={T.business.facebook} target="_blank" rel="noopener noreferrer" aria-label="Confluent Solutions on Facebook">
                <FacebookIcon />
              </a>
              <a href={T.business.google} target="_blank" rel="noopener noreferrer" aria-label="Confluent Solutions on Google">
                <GoogleIcon />
              </a>
            </div>
          </div>
          <a className="footer__phone" href={T.business.phoneHref}>
            {T.business.phoneDisplay}
          </a>
        </div>
        <nav className="footer__links" aria-label="Legal">
          <a href={T.business.contactHref}>Contact</a>
          <a href={T.business.privacyHref}>Privacy Policy</a>
          <a href={T.business.termsHref}>Terms of Service</a>
        </nav>
        <p className="footer__legal">© {new Date().getFullYear()} {T.business.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}

function smsHref(): string {
  return `sms:${T.business.smsNumber}?&body=${encodeURIComponent(T.business.smsBody)}`;
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6a.6.6 0 0 1-1-.46V16H6.5A2.5 2.5 0 0 1 4 13.5v-8z" />
      <circle cx="9" cy="9.5" r="1" />
      <circle cx="12.5" cy="9.5" r="1" />
      <circle cx="16" cy="9.5" r="1" />
    </svg>
  );
}

// Glass pill used next to the hero phone number (tablet and desktop).
function TextUsButton() {
  return (
    <a className="text-btn glass" href={smsHref()}>
      <span className="text-btn__icon">
        <ChatIcon />
      </span>
      <span className="text-btn__label">
        <strong>Text us</strong>
        <small>Send a photo of the problem</small>
      </span>
    </a>
  );
}

// Floating pill on phones, sitting just above the tap-to-call bar.
function TextUsFab() {
  return (
    <motion.a
      className="text-fab"
      href={smsHref()}
      aria-label={`Text ${T.business.name}`}
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.96 }}
    >
      <span className="text-btn__icon">
        <ChatIcon />
      </span>
      <span>Text us</span>
    </motion.a>
  );
}

function MagneticCall() {
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const onMove = (event: ReactPointerEvent<HTMLAnchorElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * 0.25);
    y.set((event.clientY - (rect.top + rect.height / 2)) * 0.35);
  };
  const onLeave = (): void => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.a className="call-btn" href={T.business.phoneHref} style={{ x, y }} onPointerMove={onMove} onPointerLeave={onLeave}>
      Call {T.business.phoneDisplay}
    </motion.a>
  );
}

/* ==========================================================================
   WATER DETAILS: animated headings, wave dividers, rotating line, level meter
   ========================================================================== */
const HEADING_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const HEADING_STAGGER_S = 0.07;
const HEADING_DURATION_S = 0.7;

function RevealHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const reduce = useReducedMotion();
  const shown = inView || reduce === true;
  return (
    <h2 className="h2 reveal" ref={ref} aria-label={children}>
      {children.split(" ").map((word, i) => (
        <span className="reveal__mask" key={`${word}-${i}`} aria-hidden="true">
          <motion.span
            className="reveal__word"
            initial={{ y: "115%" }}
            animate={{ y: shown ? "0%" : "115%" }}
            transition={{ delay: i * HEADING_STAGGER_S, duration: HEADING_DURATION_S, ease: HEADING_EASE }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </h2>
  );
}

type WaveTone = "bg-deep" | "deep-bg" | "deep-navy" | "navy-bg" | "bg-brand";
const WAVE_VIEW = { w: 2880, h: 56, mid: 28, amp: 26, period: 360 } as const;
function buildWave(offsetY: number): string {
  const { w, h, mid, amp, period } = WAVE_VIEW;
  let d = `M0 ${mid + offsetY} Q ${period / 2} ${mid + offsetY - amp} ${period} ${mid + offsetY}`;
  for (let x = period * 2; x <= w; x += period) d += ` T ${x} ${mid + offsetY}`;
  return `${d} V${h} H0 Z`;
}
const WAVE_MAIN = buildWave(0);
const WAVE_SHEEN = buildWave(-WAVE_VIEW.amp / 4);

function WaveDivider({ tone }: { tone: WaveTone }) {
  return (
    <div className={`wave wave--${tone}`} aria-hidden="true">
      <svg className="wave__svg wave__svg--slow" viewBox={`0 0 ${WAVE_VIEW.w} ${WAVE_VIEW.h}`} preserveAspectRatio="none">
        <path className="wave__sheen" d={WAVE_SHEEN} />
      </svg>
      <svg className="wave__svg" viewBox={`0 0 ${WAVE_VIEW.w} ${WAVE_VIEW.h}`} preserveAspectRatio="none">
        <path className="wave__fill" d={WAVE_MAIN} />
      </svg>
    </div>
  );
}

function RotatingLine() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState<number>(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ROTATING_LINES.length), T.map.rotateMs);
    return () => window.clearInterval(id);
  }, [reduce]);
  const line = ROTATING_LINES[index] ?? "";
  return (
    <p className="hero__rotor">
      <span className="hero__rotor-label">We handle</span>
      <span className="hero__rotor-slot" aria-live="off">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={line}
            className="hero__rotor-word"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: 0.35, ease: HEADING_EASE }}
          >
            {line}
          </motion.span>
        </AnimatePresence>
      </span>
    </p>
  );
}

function WaterMeter() {
  const { scrollYProgress } = useScroll();
  const level = useSpring(scrollYProgress, T.spring);
  const scaleY = useTransform(level, [0, 1], [0.02, 1]);
  return (
    <div className="watermeter" aria-hidden="true">
      <motion.div className="watermeter__fill" style={{ scaleY }} />
    </div>
  );
}

/* ==========================================================================
   SERVICE-AREA MAP (stylized, not to scale)
   ========================================================================== */
function projectArea(area: AreaGeo): { x: number; y: number } {
  const { w, h, pad, lonMin, lonSpan, latMax, latSpan } = T.map;
  return {
    x: pad + ((area.lon - lonMin) / lonSpan) * (w - pad * 2),
    y: pad + ((latMax - area.lat) / latSpan) * (h - pad * 2),
  };
}
const MAP_POINTS = AREA_GEO.map((area) => ({ name: area.name, ...projectArea(area) }));
const MAP_LABEL_FLIP_X = T.map.w * 0.7;
const MAP_LABEL_LIFT = 16;
const MAP_DOT_R = 6;
const MAP_DOT_R_ACTIVE = 9;

function AreaMap() {
  const [active, setActive] = useState<string>(T.map.home);
  const current = MAP_POINTS.find((p) => p.name === active);
  const flip = current !== undefined && current.x > MAP_LABEL_FLIP_X;
  return (
    <div className="map">
      <div className="map__panel">
        <svg className="map__svg" viewBox={`0 0 ${T.map.w} ${T.map.h}`} role="img" aria-label="Stylized map of the cities Confluent Solutions serves around Fort Worth">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <line key={`v${n}`} className="map__grid" x1={(T.map.w / 8) * n} y1={0} x2={(T.map.w / 8) * n} y2={T.map.h} />
          ))}
          {[1, 2, 3, 4, 5].map((n) => (
            <line key={`h${n}`} className="map__grid" x1={0} y1={(T.map.h / 6) * n} x2={T.map.w} y2={(T.map.h / 6) * n} />
          ))}
          <path className="map__water" d="M92 192 C96 164 150 156 184 174 C214 190 196 222 152 224 C112 226 88 214 92 192 Z" />
          <path className="map__river" d="M40 340 C150 312 240 252 310 272 S440 336 520 304 S690 384 770 452" />
          {MAP_POINTS.map((p) => {
            const isActive = p.name === active;
            return (
              <g key={p.name} className={isActive ? "map__node is-active" : "map__node"} aria-hidden="true" onPointerEnter={() => setActive(p.name)} onClick={() => setActive(p.name)}>
                <circle cx={p.x} cy={p.y} r={T.map.pad / 2} fill="transparent" />
                {isActive && <circle className="map__ring" cx={p.x} cy={p.y} r={MAP_DOT_R_ACTIVE} />}
                {isActive && <circle className="map__ring map__ring--late" cx={p.x} cy={p.y} r={MAP_DOT_R_ACTIVE} />}
                <circle className="map__dot" cx={p.x} cy={p.y} r={isActive ? MAP_DOT_R_ACTIVE : MAP_DOT_R} />
              </g>
            );
          })}
          {current && (
            <text className="map__label" x={current.x} y={current.y - MAP_LABEL_LIFT} textAnchor={flip ? "end" : "middle"}>
              {current.name}
            </text>
          )}
          <text className="map__legend" x={T.map.pad / 2} y={T.map.h - T.map.pad / 3}>
            STYLIZED MAP, NOT TO SCALE
          </text>
        </svg>
      </div>
      <div className="map__side">
        <div className="map__figs">
          <div>
            <span className="map__n">
              <CountUp to={SERVICE_AREAS.length} />
            </span>
            <span className="map__cap">Cities served</span>
          </div>
          <div>
            <span className="map__n">
              <CountUp to={24} />/7
            </span>
            <span className="map__cap">Emergency line</span>
          </div>
        </div>
        <p className="map__now" aria-live="polite">
          {active === T.map.home ? `Home base: ${T.business.address}.` : `We serve ${active}, TX. Call and we will get you on the schedule.`}
        </p>
        <ul className="map__chips">
          {SERVICE_AREAS.map((city) => (
            <li key={city}>
              <button type="button" className={city === active ? "map__chip is-active" : "map__chip"} onPointerEnter={() => setActive(city)} onFocus={() => setActive(city)} onClick={() => setActive(city)}>
                {city}
              </button>
            </li>
          ))}
        </ul>
        <div className="areas__cta">
          <a className="call-btn" href={T.business.phoneHref}>
            Call {T.business.phoneDisplay}
          </a>
        </div>
      </div>
    </div>
  );
}

function AreasSection() {
  return (
    <section className="section areas" id="areas">
      <div className="wrap">
        <p className="eyebrow">Service areas</p>
        <RevealHeading>Serving Fort Worth and nearby.</RevealHeading>
        <AreaMap />
      </div>
    </section>
  );
}

function Header() {
  return (
    <header className="header">
      <div className="wrap header__row">
        <Logo />
        <nav className="nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <MagneticCall />
      </div>
    </header>
  );
}

function MobileCallBar() {
  return (
    <a className="callbar" href={T.business.phoneHref} aria-label={`Tap to call ${T.business.phoneDisplay}`}>
      TAP TO CALL — {T.business.phoneDisplay}
    </a>
  );
}

/* ==========================================================================
   APP
   ========================================================================== */
export default function App() {
  const [framesStatus, setFramesStatus] = useState<FramesStatus>("loading");
  const reduceMotion = useReducedMotion();
  // Ad tracking: remember which ad brought them, and load the Meta Pixel if it's configured.
  useEffect(() => {
    captureAttribution();
    initMetaPixel(META_PIXEL_ID);
  }, []);
  return (
    <FramesContext.Provider value={framesStatus}>
      <style>{CSS}</style>
      <Header />
      <WaterMeter />
      <motion.main initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, ease: HEADING_EASE }}>
        <HeroSection />
        <StatsStrip />
        <ServicesSection />
        <VideoScrollEngine onStatus={setFramesStatus}>{({ progress, stage }) => <ProcessSection progress={progress} stage={stage} />}</VideoScrollEngine>
        <TrustFacts />
        <TriageSection />
        <WaveDivider tone="bg-deep" />
        <WhySection />
        <WaveDivider tone="deep-bg" />
        <JobsSection />
        <WaveDivider tone="bg-deep" />
        <BadgesSection />
        <WaveDivider tone="deep-navy" />
        <AreasSection />
        <WaveDivider tone="navy-bg" />
        <FaqSection />
        <WaveDivider tone="bg-brand" />
      </motion.main>
      <Footer />
      <MobileCallBar />
      <TextUsFab />
      <ExitIntentPopup />
    </FramesContext.Provider>
  );
}
