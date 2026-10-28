// Cloudflare Pages Function: POST /api/event
// Server-side copy of the browser pixel's PageView and Contact events (Meta Conversions API).
// The browser sends the same event_id it gave the pixel, so Meta counts each event once.
// Lead is handled in /api/lead. Uses the same META_PIXEL_ID / META_CAPI_TOKEN settings;
// without them this does nothing.

interface Env {
  META_PIXEL_ID?: string;
  META_CAPI_TOKEN?: string;
  META_GRAPH_VERSION?: string; // defaults to v23.0
}

interface PagesContext {
  request: Request;
  env: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}

const ALLOWED_EVENTS = new Set(["PageView", "Contact"]);
const ALLOWED_CUSTOM_KEYS = ["contact_method", "button", "page"];

function readCookie(header: string | null, name: string): string {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("=")).slice(0, 300);
  }
  return "";
}

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  const done = new Response(null, { status: 204 });
  if (!env.META_PIXEL_ID || !env.META_CAPI_TOKEN) return done;

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 4000) return done;
    body = JSON.parse(text);
  } catch {
    return done;
  }

  const eventName = typeof body.event_name === "string" ? body.event_name : "";
  const eventId = typeof body.event_id === "string" ? body.event_id.slice(0, 100) : "";
  if (!ALLOWED_EVENTS.has(eventName) || !eventId) return done;

  let url = typeof body.url === "string" ? body.url.slice(0, 1000) : "";
  let fbclid = "";
  try {
    const u = new URL(url);
    if (u.host !== new URL(request.url).host) url = "";
    fbclid = u.searchParams.get("fbclid") || "";
  } catch {
    url = "";
  }

  const cookies = request.headers.get("Cookie");
  const fbp = readCookie(cookies, "_fbp");
  let fbc = readCookie(cookies, "_fbc");
  if (!fbc && fbclid) fbc = `fb.1.${Date.now()}.${fbclid.slice(0, 500)}`;

  const userData: Record<string, unknown> = {};
  const ip = request.headers.get("CF-Connecting-IP");
  const ua = request.headers.get("User-Agent");
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent = ua;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const customData: Record<string, string> = {};
  const raw = body.custom_data;
  if (raw && typeof raw === "object") {
    for (const key of ALLOWED_CUSTOM_KEYS) {
      const val = (raw as Record<string, unknown>)[key];
      if (typeof val === "string") customData[key] = val.slice(0, 100);
    }
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: url || undefined,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  const version = env.META_GRAPH_VERSION || "v23.0";
  const send = fetch(
    `https://graph.facebook.com/${version}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
  ).catch(() => undefined);

  if (context.waitUntil) context.waitUntil(send);
  else await send;
  return done;
};
