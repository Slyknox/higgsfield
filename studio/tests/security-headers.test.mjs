// The Content Security Policy names our hosts and blocks framing and plugins.
import assert from "node:assert/strict";
import { test } from "node:test";

import "./support/harness.mjs";

const { contentSecurityPolicy, securityHeaders } = await import("../lib/security-headers.ts");

const directives = (policy) =>
  Object.fromEntries(policy.split("; ").map((d) => { const [k, ...v] = d.split(" "); return [k, v]; }));

test("named media and upload hosts replace the https: fallback", () => {
  const d = directives(contentSecurityPolicy({
    mediaBaseUrl: "https://media.example.com/bucket",
    uploadOrigins: "https://uploads.example.net, not a url, javascript:alert(1)",
  }));
  assert.deepEqual(d["img-src"], ["'self'", "data:", "blob:", "https://media.example.com", "https://uploads.example.net"]);
  assert.deepEqual(d["connect-src"], ["'self'", "https://uploads.example.net"]);
  assert.ok(!d["media-src"].includes("https:"));
});

test("without named upload hosts, uploads fall back to any https origin", () => {
  const d = directives(contentSecurityPolicy({}));
  assert.deepEqual(d["connect-src"], ["'self'", "https:"]);
});

test("framing, plugins and foreign form posts are blocked; eval only in dev", () => {
  const prod = directives(contentSecurityPolicy({}));
  assert.deepEqual(prod["frame-ancestors"], ["'none'"]);
  assert.deepEqual(prod["object-src"], ["'none'"]);
  assert.deepEqual(prod["form-action"], ["'self'"]);
  assert.deepEqual(prod["base-uri"], ["'self'"]);
  assert.ok(!prod["script-src"].includes("'unsafe-eval'"));
  assert.ok(directives(contentSecurityPolicy({ dev: true }))["script-src"].includes("'unsafe-eval'"));
  const names = securityHeaders({}).map((h) => h.key);
  assert.ok(names.includes("Strict-Transport-Security"));
  assert.ok(!securityHeaders({ dev: true }).some((h) => h.key === "Strict-Transport-Security"));
});
