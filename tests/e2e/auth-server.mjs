// Local Supabase Auth protocol fixture. Never imported by application code.
// Real invitation email delivery and provider integration still require staging.
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
if (process.env.VOCABDECK_E2E !== "1")
  throw new Error("Test auth fixture requires VOCABDECK_E2E=1");
const identities = {
  "learner@example.test": "11111111-1111-4111-8111-111111111111",
  "other@example.test": "22222222-2222-4222-8222-222222222222",
  "admin@example.test": "33333333-3333-4333-8333-333333333333",
};
const secret = "vocabdeck-local-auth-fixture-not-a-production-secret";
const b64 = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
const signature = (data) =>
  createHmac("sha256", secret).update(data).digest("base64url");
const userFor = (id, email) => ({
  id,
  email,
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
});
function session(id, email) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, email, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600 })}`;
  return {
    access_token: `${unsigned}.${signature(unsigned)}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `fixture-${id}`,
    user: userFor(id, email),
  };
}
http
  .createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const send = (status, body) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    if (req.url === "/health") return send(200, { ok: true });
    if (req.url.startsWith("/auth/v1/token") && req.method === "POST") {
      let text = "";
      for await (const chunk of req) text += chunk;
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        return send(400, {});
      }
      if (body.password !== "vocabdeck-e2e-password" || !identities[body.email])
        return send(400, {
          code: "invalid_credentials",
          msg: "Invalid login credentials",
        });
      return send(200, session(identities[body.email], body.email));
    }
    if (req.url.startsWith("/auth/v1/user")) {
      try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        const [header, payload, signed] = token.split(".");
        const expected = signature(`${header}.${payload}`);
        if (
          signed.length !== expected.length ||
          !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))
        )
          throw new Error("bad signature");
        const claims = JSON.parse(Buffer.from(payload, "base64url"));
        if (
          claims.exp < Date.now() / 1000 ||
          identities[claims.email] !== claims.sub
        )
          throw new Error("expired");
        return send(200, userFor(claims.sub, claims.email));
      } catch {
        return send(401, { code: "bad_jwt", msg: "Invalid token" });
      }
    }
    if (req.url.startsWith("/auth/v1/logout")) return send(200, {});
    if (req.url.startsWith("/auth/v1/recover")) return send(200, {});
    return send(403, {
      code: "signup_disabled",
      msg: "Only fixtures may sign in",
    });
  })
  .listen(55434, "127.0.0.1");
