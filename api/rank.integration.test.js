import test from "node:test";
import assert from "node:assert/strict";
import handler from "./rank.js";

function makeResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    headers,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers.set(name, value); },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

function makeRequest(body, headers = {}) {
  return {
    method: "POST",
    body,
    headers: {
      origin: "https://manmicheal214-maker.github.io",
      "content-length": JSON.stringify(body).length,
      "x-forwarded-for": `test-${Math.random()}`,
      ...headers
    },
    socket: { remoteAddress: "127.0.0.1" }
  };
}

test("returns a useful error when ZenRows key is missing", async () => {
  const previous = process.env.ZENROWS_API_KEY;
  delete process.env.ZENROWS_API_KEY;
  const response = makeResponse();

  await handler(makeRequest({ keyword: "best running shoes", domain: "example.com" }), response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.match(response.body.error, /not configured/i);
  if (previous !== undefined) process.env.ZENROWS_API_KEY = previous;
});

test("returns a matched organic result", async () => {
  process.env.ZENROWS_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    organic_results: [
      { title: "Other result", link: "https://other.example/page" },
      { title: "Best Running Shoes", link: "https://www.example.com/running-shoes" }
    ]
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const response = makeResponse();
    await handler(makeRequest({ keyword: "best running shoes", domain: "https://www.example.com/", country: "United States", device: "desktop" }), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.position, 2);
    assert.equal(response.body.url, "https://www.example.com/running-shoes");
    assert.equal(response.body.title, "Best Running Shoes");
    assert.ok(response.body.checkedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns null position when the domain is not in the first 100 organic results", async () => {
  process.env.ZENROWS_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    organic_results: [{ title: "Other result", link: "https://other.example/page" }]
  }), { status: 200 });

  try {
    const response = makeResponse();
    await handler(makeRequest({ keyword: "best running shoes", domain: "example.com" }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.position, null);
    assert.equal(response.body.url, null);
    assert.equal(response.body.title, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps ZenRows failures to safe API errors", async () => {
  process.env.ZENROWS_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limited", { status: 429 });

  try {
    const response = makeResponse();
    await handler(makeRequest({ keyword: "test", domain: "example.com" }), response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.success, false);
    assert.doesNotMatch(JSON.stringify(response.body), /test-key/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enforces exact CORS origins", async () => {
  process.env.ZENROWS_API_KEY = "test-key";
  const response = makeResponse();
  await handler(
    makeRequest({ keyword: "test", domain: "example.com" }, { origin: "https://evil.example" }),
    response
  );
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), undefined);
});
