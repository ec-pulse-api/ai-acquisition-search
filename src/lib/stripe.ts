import { createHmac, timingSafeEqual } from "node:crypto";

const stripeApiVersion = "2026-08-26.dahlia";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function stripeRequest<T>(
  path: string,
  init: RequestInit & { form?: Record<string, string | undefined> } = {},
): Promise<T> {
  const secret = requireEnv("STRIPE_SECRET_KEY");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  headers.set("Stripe-Version", stripeApiVersion);
  let body = init.body;

  if (init.form) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(init.form)) {
      if (value !== undefined) params.set(key, value);
    }
    body = params.toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    method: init.method ?? "POST",
    headers,
    body,
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: { message?: string } }).error?.message ?? response.statusText)
        : response.statusText;
    throw new Error(`Stripe API error: ${message}`);
  }

  return data as T;
}

export function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return signatures.some((candidate) => {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
