import { afterEach, describe, expect, it, vi } from "vitest";

import { dailyMedUrl, ingredientsFor, labelFor, suggest } from "./api";
import { checkPairs, type Medication } from "./interactions";

function mockFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("not found", { status: 404 });
    return Response.json(routes[key]);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("RxNorm", () => {
  it("suggests distinct names, shortest first", async () => {
    mockFetch({
      "approximateTerm.json?term=lipi": {
        approximateGroup: { candidate: [{ name: "Lipitor 10 MG Oral Tablet", rank: "1" }, { name: "Lipitor", rank: "1" }, { rank: "2" }, { name: "Lipitor", rank: "3" }] },
      },
    });
    expect(await suggest("lipi")).toEqual(["Lipitor", "Lipitor 10 MG Oral Tablet"]);
    expect(await suggest("l")).toEqual([]);
  });

  it("resolves a brand name to its ingredients", async () => {
    const calls = mockFetch({
      "approximateTerm.json?term=Lipitor&maxEntries=1": { approximateGroup: { candidate: [{ rxcui: "153165" }] } },
      "rxcui/153165/related.json": { relatedGroup: { conceptGroup: [{ tty: "IN", conceptProperties: [{ rxcui: "83367", name: "Atorvastatin" }] }, { tty: "MIN" }] } },
    });
    expect(await ingredientsFor("Lipitor")).toEqual([{ rxcui: "83367", name: "atorvastatin" }]);
    expect(calls[1]).toContain("tty=IN+MIN");
  });

  it("returns nothing for unknown names", async () => {
    mockFetch({ "approximateTerm.json": { approximateGroup: {} } });
    expect(await ingredientsFor("zzzz")).toEqual([]);
  });
});

describe("openFDA", () => {
  it("reads the newest label's sections", async () => {
    const calls = mockFetch({
      "api.fda.gov": {
        results: [{ set_id: "abc", effective_time: "20240101", drug_interactions: ["7 DRUG INTERACTIONS", "Avoid aspirin."], openfda: { brand_name: ["Coumadin"] } }],
      },
    });
    expect(await labelFor("warfarin")).toEqual({
      ingredient: "warfarin",
      brand: "Coumadin",
      setId: "abc",
      effective: "20240101",
      interactions: "7 DRUG INTERACTIONS Avoid aspirin.",
      contraindications: "",
      boxedWarning: "",
    });
    expect(decodeURIComponent(calls[0]!)).toContain('openfda.generic_name:"warfarin"');
    expect(calls[0]).toContain("sort=effective_time:desc");
  });

  it("prefers a single-ingredient label over combinations", async () => {
    mockFetch({
      "api.fda.gov": {
        results: [
          { set_id: "combo", effective_time: "2025", openfda: { generic_name: ["AMLODIPINE AND ATORVASTATIN"] } },
          { set_id: "single", effective_time: "2024", openfda: { generic_name: ["ATORVASTATIN CALCIUM"] } },
        ],
      },
    });
    expect((await labelFor("atorvastatin"))?.setId).toBe("single");
  });

  it("treats a missing label as undefined and other failures as errors", async () => {
    mockFetch({});
    expect(await labelFor("nothing")).toBeUndefined();
    vi.stubGlobal("fetch", async () => new Response("busy", { status: 429 }));
    await expect(labelFor("warfarin")).rejects.toThrow("Request failed (429)");
  });

  it("links to DailyMed", () => {
    expect(dailyMedUrl("a b")).toBe("https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a%20b");
  });
});

describe("checkPairs", () => {
  const med = (name: string, ...ingredients: string[]): Medication => ({ name, ingredients: ingredients.map((i) => ({ rxcui: i, name: i })) });
  const label = (ingredient: string, parts: Partial<Record<"interactions" | "contraindications" | "boxedWarning", string>>) => ({
    ingredient,
    setId: `set-${ingredient}`,
    effective: "2024",
    interactions: "",
    contraindications: "",
    boxedWarning: "",
    ...parts,
  });

  it("checks both directions and every pair, most serious first", () => {
    const meds = [med("Coumadin", "warfarin"), med("Advil", "ibuprofen"), med("Glucophage", "metformin"), med("Zocor", "simvastatin")];
    const labels = new Map([
      ["warfarin", label("warfarin", { interactions: "NSAIDs such as ibuprofen increase bleeding risk." })],
      ["ibuprofen", label("ibuprofen", { boxedWarning: "Nothing about the others." })],
      ["simvastatin", label("simvastatin", { contraindications: "Contraindicated with strong CYP3A4 inhibitors. Do not use with metformin." })],
    ]);
    const results = checkPairs(meds, labels);
    expect(results).toHaveLength(6);
    expect(results.map((r) => `${r.a.name}+${r.b.name}:${r.evidence.length}`)).toEqual([
      "Glucophage+Zocor:1", // contraindication outranks an interaction mention
      "Coumadin+Advil:1",
      "Coumadin+Glucophage:0",
      "Coumadin+Zocor:0",
      "Advil+Glucophage:0",
      "Advil+Zocor:0",
    ]);
    expect(results[1]!.evidence[0]).toEqual({
      source: "warfarin",
      section: "Drug interactions",
      sentences: ["NSAIDs such as ibuprofen increase bleeding risk."],
      setId: "set-warfarin",
    });
  });

  it("looks up every ingredient of a combination product", () => {
    const results = checkPairs([med("Vicodin", "hydrocodone", "acetaminophen"), med("Xanax", "alprazolam")], new Map([["hydrocodone", label("hydrocodone", { boxedWarning: "Concomitant use with benzodiazepines such as alprazolam may cause profound sedation." })]]));
    expect(results[0]!.evidence.map((e) => [e.source, e.section])).toEqual([["hydrocodone", "Boxed warning"]]);
  });
});
