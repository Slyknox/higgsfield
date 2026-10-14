import assert from "node:assert/strict";
import { test } from "node:test";
import { toAuthorizationHeader } from "../generation/credentials.ts";

test("the platform key keeps the Key authorization scheme, trimmed", () => {
  for (const apiKey of ["test_api_key", "test-id:test-secret"]) {
    assert.equal(toAuthorizationHeader(`  ${apiKey}\n`), `Key ${apiKey}`);
  }
});

test("malformed keys never become a header (no header injection)", () => {
  for (const apiKey of ["", "  ", "test key", "test\r\nInjected: value", "test\0key"]) {
    assert.throws(() => toAuthorizationHeader(apiKey), /API key/);
  }
});
