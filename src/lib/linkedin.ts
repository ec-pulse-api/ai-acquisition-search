import crypto from "node:crypto";

const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202609";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is not configured");
  return value;
}

function key() {
  return crypto.createHash("sha256").update(required("LINKEDIN_TOKEN_ENCRYPTION_KEY")).digest();
}

export function encryptLinkedInToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptLinkedInToken(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid LinkedIn token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function linkedInAuthUrl(params: { state: string; redirectUri: string }) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: required("LINKEDIN_CLIENT_ID"),
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: "openid profile email w_member_social",
  });
  return "https://www.linkedin.com/oauth/v2/authorization?" + query.toString();
}

export async function exchangeLinkedInCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: required("LINKEDIN_CLIENT_ID"),
    client_secret: required("LINKEDIN_CLIENT_SECRET"),
  });
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || "LinkedIn OAuth token exchange failed");
  return data as { access_token: string; expires_in?: number; scope?: string };
}

export async function getLinkedInUserInfo(accessToken: string) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: "Bearer " + accessToken },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.sub) throw new Error(data.message || "LinkedIn userinfo failed");
  return data as { sub: string; name?: string; email?: string; picture?: string };
}

export async function createLinkedInPost(accessToken: string, author: string, commentary: string) {
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      "Linkedin-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.errorDetail || "LinkedIn post failed");
  return { id: response.headers.get("x-restli-id") || data.id || null, raw: data };
}
