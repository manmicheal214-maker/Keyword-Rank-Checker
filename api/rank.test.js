import test from "node:test";
import assert from "node:assert/strict";
import { domainsMatch, normalizeDomain } from "./rank.js";

test("normalizes common domain formats", () => {
  assert.equal(normalizeDomain("https://www.example.com/"), "example.com");
  assert.equal(normalizeDomain("http://example.com/path"), "example.com");
  assert.equal(normalizeDomain("example.com/path"), "example.com");
});

test("rejects invalid or unsafe domains", () => {
  assert.equal(normalizeDomain("example.com.evil.com"), "example.com.evil.com");
  assert.equal(normalizeDomain("https://user:pass@example.com"), null);
  assert.equal(normalizeDomain("not-a-domain"), null);
  assert.equal(normalizeDomain("https://example..com"), null);
});

test("matches the exact domain and subdomains", () => {
  assert.equal(domainsMatch("https://example.com/page", "example.com"), true);
  assert.equal(domainsMatch("https://www.example.com/page", "example.com"), true);
  assert.equal(domainsMatch("https://blog.example.com/page", "example.com"), true);
  assert.equal(domainsMatch("https://example.com.evil.com/page", "example.com"), false);
  assert.equal(domainsMatch("https://notexample.com/page", "example.com"), false);
});
