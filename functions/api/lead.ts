// Cloudflare Pages Function: POST /api/lead
// Forwards the step-by-step hero form to a webhook you control (GoHighLevel, n8n, Zapier, Make, etc.).
// Set LEAD_WEBHOOK_URL in Cloudflare Pages > Settings > Environment variables.
// If it is not set this returns 503 so the form never pretends a lead was delivered.
//
// The form posts more than once per visitor:
//   stage "partial"  – sent after every step once the phone number is in
//   stage "complete" – sent once on the final submit
// Every post carries the same leadId, so the receiving side should UPDATE one contact
// (match on phone or leadId), not create a new one each time.
//
// Flags sent to the webhook:
//   isFirstContact     – first post with a phone number: start speed-to-lead on this one only
//   isComplete         – final submit
//   budgetQualified    – said they have a $5,000+ budget (cash or financing)
//   timelineQualified  – wants the work within 2 weeks (Confluent's window)
//   isQualified        – both of the above: book these, nurture the rest
//   adSource           – "facebook_ad", "google_ad", or "website"
//   utm_* / fbclid / gclid / gbraid / wbraid – which campaign and ad sent them
//
// Optional Meta Conversions API (server-side Lead event, deduplicated with the browser pixel):
// set META_PIXEL_ID and META_CAPI_TOKEN in Cloudflare Pages. Without them this part is skipped.

// Keep in sync with TIMELINE_OPTIONS in src/App.tsx (the first two options).
const QUALIFIED_TIMELINES: readonly string[] = ["As soon as possible", "Within 2 weeks"];
// Keep in sync with BUDGET_OPTIONS in src/App.tsx (the first two options).
const QUALIFIED_BUDGETS: readonly string[] = ["Yes, I have $5,000+ set aside", "Yes, with financing"];

interface Env {
  LEAD_WEBHOOK_URL?: string;
  META_PIXEL_ID?: string;
  META_CAPI_TOKEN?: string;
  META_GRAPH_VERSION?: string; // defaults to v23.0
}

interface PagesContext {
  request: Request;
  env: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}

type Stage = "partial" | "complete";

// Max length for each text field. Anything longer is rejected.
const TEXT_LIMITS = {
  leadId: 80,
  name: 120,
  firstName: 60,
  lastName: 60,
  phone: 40,
  email: 120,
  service: 120,
  leakCheck: 60,
  budget: 60,
  urgency: 60,
  ownership: 60,
  address: 160,
  zip: 10,
  details: 1000,
  smsConsentText: 600,
  page: 500,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 200,
  utm_term: 200,
  fbclid: 500,
  gclid: 200,
  gbraid: 200,
  wbraid: 200,
  landingPage: 300,
  referrer: 500,
  fbc: 700,
  fbp: 200,
  metaEventId: 120,
} as const;

type TextField = keyof typeof TEXT_LIMITS;

type LeadPayload = Record<TextField, string> & {
  stage: Stage;
  lastStep: number;
  totalSteps: number;
  smsConsent: boolean;
};

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const digits = (value: string): string => value.replace(/\D/g, "");

// Accepts the current form's payload and older versions (missing fields default to "").
function parseLead(value: unknown): LeadPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;

  const text = {} as Record<TextField, string>;
  for (const key of Object.keys(TEXT_LIMITS) as TextField[]) {
    const raw = v[key];
    if (raw === undefined || raw === null) {
      text[key] = "";
    } else if (typeof raw === "string") {
      if (raw.length > TEXT_LIMITS[key]) return null;
      text[key] = raw.trim();
    } else {
      return null;
    }
  }

  const phoneDigits = digits(text.phone);
  if (!(phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1")))) return null;

  const name = text.name || `${text.firstName} ${text.lastName}`.trim();
  if (!name) return null;

  const num = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? Math.trunc(x) : 0);

  return {
    ...text,
    name,
    leadId: text.leadId || crypto.randomUUID(),
    stage: v.stage === "partial" ? "partial" : "complete",
    lastStep: num(v.lastStep),
    totalSteps: num(v.totalSteps),
    // Only text people who ticked the consent box. Without it, call or email instead.
    smsConsent: v.smsConsent === true,
  };
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Server-side copy of the browser "Lead" event. Same event_id as the pixel, so Meta counts it once.
async function sendMetaLead(lead: LeadPayload, env: Env, request: Request, qualified: boolean): Promise<void> {
  if (!env.META_PIXEL_ID || !env.META_CAPI_TOKEN) return;
  const version = env.META_GRAPH_VERSION || "v23.0";
  const phone = digits(lead.phone).slice(-10);

  const userData: Record<string, unknown> = {
    ph: [await sha256(`1${phone}`)],
    external_id: [await sha256(lead.leadId)],
    country: [await sha256("us")],
    st: [await sha256("tx")],
  };
  if (lead.email) userData.em = [await sha256(lead.email.toLowerCase())];
  if (lead.firstName) userData.fn = [await sha256(lead.firstName.toLowerCase())];
  if (lead.lastName) userData.ln = [await sha256(lead.lastName.toLowerCase())];
  if (/^\d{5}$/.test(lead.zip)) userData.zp = [await sha256(lead.zip)];
  if (lead.fbc) userData.fbc = lead.fbc;
  if (lead.fbp) userData.fbp = lead.fbp;
  const ip = request.headers.get("CF-Connecting-IP");
  const ua = request.headers.get("User-Agent");
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;

  const body = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: lead.metaEventId || `lead-${lead.leadId}`,
        action_source: "website",
        event_source_url: lead.page || undefined,
        user_data: userData,
        custom_data: { content_name: lead.service, lead_qualified: qualified },
      },
    ],
  };

  try {
    await fetch(`https://graph.facebook.com/${version}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* tracking must never block a lead */
  }
}

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  if (!env.LEAD_WEBHOOK_URL) return json({ ok: false, error: "not_configured" }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const lead = parseLead(body);
  if (!lead) return json({ ok: false, error: "invalid" }, 400);

  // Phone is question 2, so the first post that reaches us is the first time we can call them.
  const isFirstContact = lead.stage === "partial" ? lead.lastStep <= 2 : lead.totalSteps === 0;
  const isComplete = lead.stage === "complete";
  const budgetQualified = QUALIFIED_BUDGETS.includes(lead.budget);
  const timelineQualified = QUALIFIED_TIMELINES.includes(lead.urgency);
  const isQualified = budgetQualified && timelineQualified;
  const fromMetaAd = Boolean(lead.fbclid) || /facebook|instagram|^fb$|^ig$|^meta$/i.test(lead.utm_source);
  const fromGoogleAd = Boolean(lead.gclid || lead.gbraid || lead.wbraid) || /^google$|adwords/i.test(lead.utm_source);

  const upstream = await fetch(env.LEAD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...lead,
      phoneE164: `+1${digits(lead.phone).slice(-10)}`,
      isFirstContact,
      isComplete,
      smsConsentAt: lead.smsConsent ? new Date().toISOString() : "",
      budgetAnswered: lead.budget !== "",
      budgetQualified,
      timelineAnswered: lead.urgency !== "",
      timelineQualified,
      isQualified,
      adSource: fromMetaAd ? "facebook_ad" : fromGoogleAd ? "google_ad" : "website",
      source: "cofulent-hero-form",
      receivedAt: new Date().toISOString(),
    }),
  });

  if (upstream.ok && isComplete) {
    const task = sendMetaLead(lead, env, request, isQualified);
    if (context.waitUntil) context.waitUntil(task);
    else await task;
  }

  return upstream.ok ? json({ ok: true }, 200) : json({ ok: false, error: "upstream" }, 502);
};
