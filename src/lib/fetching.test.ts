import { afterEach, describe, expect, it, vi } from "vitest";

import { cached, clearCache, politeFetch } from "./fetching";

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("politeFetch", () => {
  it("retries after 429 and 503, then gives up", async () => {
    const statuses = [429, 503, 200];
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: statuses.shift() })));
    expect((await politeFetch("https://api.test", undefined, 1)).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 429 })));
    expect((await politeFetch("https://api.test", undefined, 1)).status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(3); // first try plus two retries
  });

  it("doesn't retry other errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 500 })));
    expect((await politeFetch("https://api.test", undefined, 1)).status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("runs at most four requests at once", async () => {
    let running = 0;
    let peak = 0;
    vi.stubGlobal("fetch", async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return new Response("ok");
    });
    await Promise.all(Array.from({ length: 12 }, () => politeFetch("https://api.test")));
    expect(peak).toBe(4);
  });
});

describe("cached", () => {
  it("shares one load per key and forgets failures", async () => {
    const load = vi.fn(async () => 42);
    expect(await Promise.all([cached("k", load), cached("k", load)])).toEqual([42, 42]);
    expect(load).toHaveBeenCalledTimes(1);

    const failing = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");
    await expect(cached("f", failing)).rejects.toThrow("down");
    expect(await cached("f", failing)).toBe("ok");
  });
});
