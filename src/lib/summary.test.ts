import { describe, expect, it } from "vitest";

import type { Label } from "./api";
import type { PairResult } from "./interactions";
import { labelDate, plainSummary } from "./summary";

describe("labelDate", () => {
  it("formats openFDA dates without shifting days", () => {
    expect(labelDate("20260831")).toBe("August 31, 2026");
    expect(labelDate("2026")).toBe("2026");
  });
});

describe("plainSummary", () => {
  const coumadin = { name: "Coumadin", ingredients: [{ rxcui: "1", name: "warfarin" }] };
  const advil = { name: "Advil", ingredients: [{ rxcui: "2", name: "ibuprofen" }] };
  const tylenol = { name: "Tylenol", ingredients: [{ rxcui: "3", name: "acetaminophen" }] };
  const label: Label = { ingredient: "warfarin", setId: "w", effective: "20260831", interactions: "", contraindications: "", boxedWarning: "" };

  it("lists the medications and quotes each finding with its source", () => {
    const pairs: PairResult[] = [
      { a: coumadin, b: advil, evidence: [{ source: "warfarin", section: "Drug interactions", sentences: ["NSAIDs increase bleeding risk."], setId: "w", viaClass: "Nonsteroidal Anti-inflammatory Drug" }] },
      { a: coumadin, b: tylenol, evidence: [] },
      { a: advil, b: tylenol, evidence: [] },
    ];
    expect(plainSummary(pairs, new Map([["warfarin", label]]), new Date("2026-10-23T10:00:00Z"))).toBe(
      [
        "Medications checked: Coumadin, Advil, Tylenol",
        "Checked 2026-10-23 against FDA drug labels (openFDA).",
        "",
        "Coumadin + Advil",
        "  Drug interactions (warfarin label, label revised August 31, 2026, by class: Nonsteroidal Anti-inflammatory Drug):",
        '    "NSAIDs increase bleeding risk."',
        "",
        "This summary quotes drug labels and is not medical advice.",
      ].join("\n"),
    );
  });

  it("says so when nothing was found", () => {
    const text = plainSummary([{ a: coumadin, b: tylenol, evidence: [] }], new Map());
    expect(text).toContain("None of the labels mention the other medications on this list.");
  });
});
