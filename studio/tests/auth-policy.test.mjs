import assert from "node:assert/strict";
import { test } from "node:test";

const { parseEmail, safeCallbackUrl, outboxAllowed, MAGIC_LINK_LIMITS } = await import("../lib/auth/policy.ts");

test("emails are trimmed, lower-cased and validated", () => {
  assert.equal(parseEmail("  Mike@Example.COM "), "mike@example.com");
  for (const bad of ["", "not-an-email", "a@b", "x".repeat(250) + "@example.com", null, 42]) {
    assert.equal(parseEmail(bad), null, String(bad));
  }
});

test("callback URLs stay on this site", () => {
  assert.equal(safeCallbackUrl("/video?model=seedance-2.5"), "/video?model=seedance-2.5");
  assert.equal(safeCallbackUrl("/assets#top"), "/assets#top");
  for (const evil of [
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/a\nb",
    "",
    undefined,
  ]) {
    assert.equal(safeCallbackUrl(evil), "/", String(evil));
  }
  assert.equal(safeCallbackUrl("//evil", "/video"), "/video");
});

test("the outbox transport only runs on localhost", () => {
  assert.equal(outboxAllowed("http://localhost:3000"), true);
  assert.equal(outboxAllowed("http://127.0.0.1:3123"), true);
  assert.equal(outboxAllowed("https://design.ai"), false);
  assert.equal(outboxAllowed("https://localhost.evil.example"), false);
  assert.equal(outboxAllowed(undefined), false);
  assert.equal(outboxAllowed("not a url"), false);
});

test("per-address limit is stricter than per-network", () => {
  assert.ok(MAGIC_LINK_LIMITS.perEmail.limit < MAGIC_LINK_LIMITS.perIp.limit);
});

const { sendFailed } = await import("../lib/auth/policy.ts");

test("a signIn result with ?error= counts as a failed send, never as success", () => {
  assert.equal(sendFailed("http://localhost:3123/api/auth/verify-request?provider=resend&type=email"), false);
  assert.equal(sendFailed("http://localhost:3123/login/error?error=EmailSignin"), true);
  assert.equal(sendFailed("/login/error?error=Configuration"), true);
  assert.equal(sendFailed(undefined), true);
  assert.equal(sendFailed(""), true);
});
