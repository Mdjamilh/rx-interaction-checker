import { describe, expect, it } from "vitest";

import { classPhrases } from "./classes";

describe("classPhrases", () => {
  it("includes the wordings labels use and the class's own name", () => {
    expect(classPhrases("Serotonin Reuptake Inhibitor")).toEqual(expect.arrayContaining(["SSRIs", "selective serotonin reuptake inhibitors", "Serotonin Reuptake Inhibitor"]));
    expect(classPhrases("Thiazide Diuretic")).toEqual(["Thiazide Diuretic", "Thiazide Diuretics"]);
  });
});
