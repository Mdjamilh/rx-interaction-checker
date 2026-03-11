import { beforeEach, describe, expect, it } from "vitest";

import { forgetLists, recentLists, rememberList } from "./recent";

beforeEach(() => localStorage.clear());

describe("recent lists", () => {
  it("keeps the newest five, with the same list (in any order) only once", () => {
    rememberList(["Advil", "Coumadin"]);
    rememberList(["Lipitor", "clarithromycin"]);
    rememberList(["coumadin", "advil"]);
    expect(recentLists()).toEqual([
      ["coumadin", "advil"],
      ["Lipitor", "clarithromycin"],
    ]);
    for (let i = 0; i < 6; i++) rememberList([`a${i}`, `b${i}`]);
    expect(recentLists()).toHaveLength(5);
    expect(recentLists()[0]).toEqual(["a5", "b5"]);
  });

  it("ignores corrupted storage and can be cleared", () => {
    localStorage.setItem("rx-check:recent", "{not json");
    expect(recentLists()).toEqual([]);
    localStorage.setItem("rx-check:recent", JSON.stringify([["ok"], [1, 2], "x"]));
    expect(recentLists()).toEqual([["ok"]]);
    forgetLists();
    expect(recentLists()).toEqual([]);
  });
});
