import { describe, expect, it } from "vitest";

import { findMentions, highlight, splitSentences } from "./mentions";

const WARFARIN = `7 DRUG INTERACTIONS Concomitant use of drugs that increase bleeding risk, antibiotics, antifungals, botanical (herbal) products, and inhibitors and inducers of CYP2C9, 1A2, or 3A4. ( 7 ) 7.4 Drugs that Increase Bleeding Risk Examples of drugs known to increase the risk of bleeding are presented in Table 2. Antiplatelet agents: aspirin, cilostazol, clopidogrel. Nonsteroidal anti-inflammatory agents (NSAIDs): celecoxib, diclofenac, ibuprofen, naproxen. Monitor INR closely when ibuprofen is started or stopped. Aspirinate is not a real drug.`;

describe("splitSentences", () => {
  it("splits on sentence ends but not inside section numbers", () => {
    const parts = splitSentences("First one. Second ( 7.2 ) still second. Third!");
    expect(parts).toEqual(["First one.", "Second ( 7.2 ) still second.", "Third!"]);
  });
});

describe("findMentions", () => {
  it("returns sentences that name the other drug as a whole word", () => {
    expect(findMentions(WARFARIN, ["ibuprofen"])).toEqual([
      "Nonsteroidal anti-inflammatory agents (NSAIDs): celecoxib, diclofenac, ibuprofen, naproxen.",
      "Monitor INR closely when ibuprofen is started or stopped.",
    ]);
    expect(findMentions(WARFARIN, ["aspirin"])).toEqual(["Antiplatelet agents: aspirin, cilostazol, clopidogrel."]);
  });

  it("matches any of several names, case-insensitively, and respects the limit", () => {
    expect(findMentions(WARFARIN, ["ASPIRIN", "naproxen"], 1)).toHaveLength(1);
    expect(findMentions(WARFARIN, ["metformin"])).toEqual([]);
    expect(findMentions("", ["aspirin"])).toEqual([]);
    expect(findMentions(WARFARIN, [])).toEqual([]);
  });

  it("ignores names too short to match safely and escapes regex characters", () => {
    expect(findMentions("Take with K+ supplements.", ["k+"])).toEqual([]);
    expect(findMentions("Avoid (sic) here.", ["(sic)"])).toEqual([]);
  });
});

describe("long table rows", () => {
  it("keep a window around the match so the name stays visible", () => {
    const row = `Table 2: Inhibitors ${"amiodarone, capecitabine, ".repeat(30)}clarithromycin, erythromycin ${"fluconazole, ".repeat(30)}end.`;
    const [quote] = findMentions(row, ["clarithromycin"]);
    expect(quote).toContain("clarithromycin");
    expect(quote!.startsWith("…")).toBe(true);
    expect(quote!.endsWith("…")).toBe(true);
    expect(quote!.length).toBeLessThanOrEqual(402);

    const early = findMentions(`Clarithromycin first. ${"x".repeat(10)}`, ["clarithromycin"]);
    expect(early[0]).toBe("Clarithromycin first.");
  });
});

describe("highlight", () => {
  it("marks every occurrence of the names", () => {
    expect(highlight("Ibuprofen and aspirin; more ibuprofen.", ["ibuprofen"])).toEqual([
      { text: "Ibuprofen", match: true },
      { text: " and aspirin; more ", match: false },
      { text: "ibuprofen", match: true },
      { text: ".", match: false },
    ]);
  });
});
