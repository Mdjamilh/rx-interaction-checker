import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearCache } from "./lib/fetching";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const RXCUI: Record<string, string> = { coumadin: "1", advil: "2", metformin: "3" };
const INGREDIENT: Record<string, string> = { "1": "Warfarin", "2": "Ibuprofen", "3": "Metformin" };

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("fetch", async (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("approximateTerm.json")) {
      const term = url.searchParams.get("term")!.toLowerCase();
      if (url.searchParams.get("maxEntries") === "12") return Response.json({ approximateGroup: { candidate: [{ name: "Advil", rank: "1" }, { name: "Advil Liqui-Gels", rank: "2" }] } });
      return Response.json({ approximateGroup: { candidate: RXCUI[term] ? [{ rxcui: RXCUI[term] }] : [] } });
    }
    const related = url.pathname.match(/rxcui\/(\d+)\/related/);
    if (related) return Response.json({ relatedGroup: { conceptGroup: [{ tty: "IN", conceptProperties: [{ rxcui: related[1], name: INGREDIENT[related[1]!] }] }] } });
    if (url.hostname === "api.fda.gov") {
      const search = url.searchParams.get("search") ?? "";
      if (search.includes("warfarin"))
        return Response.json({ results: [{ set_id: "w1", effective_time: "2026", drug_interactions: ["NSAIDs such as ibuprofen increase the risk of bleeding."], openfda: { generic_name: ["WARFARIN SODIUM"] } }] });
      return Response.json({ results: [{ set_id: "x", effective_time: "2026", drug_interactions: ["Nothing relevant here."] }] });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("App", () => {
  it("adds medications, checks them and quotes the label", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByRole("combobox", { name: "Add a medication" });

    await user.type(input, "Coumadin{Enter}");
    expect(screen.getByRole("button", { name: "Add at least two medications" })).toBeDisabled();

    // Pick from suggestions with the keyboard.
    await user.type(input, "adv");
    await screen.findByRole("option", { name: "Advil" });
    await user.keyboard("{ArrowDown}{Enter}");
    await user.type(input, "Metformin{Enter}");
    expect(window.location.search).toBe("?meds=Coumadin%2CAdvil%2CMetformin");

    await user.click(screen.getByRole("button", { name: "Check 3 medications" }));
    const pair = (await screen.findByRole("heading", { name: /Coumadin \(warfarin\).*Advil \(ibuprofen\)/ })).closest("article")!;
    expect(within(pair).getByText("Drug interactions")).toBeInTheDocument();
    expect(within(pair).getByText("ibuprofen", { selector: "mark" })).toBeInTheDocument();
    expect(within(pair).getByRole("link", { name: "read the full label" })).toHaveAttribute("href", "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=w1");
    expect(screen.getByRole("heading", { name: "1 of 3 pairs are mentioned in the labels" })).toHaveFocus();
    expect(screen.getByText(/Not mentioned in each other's labels: Coumadin \+ Metformin, Advil \+ Metformin/)).toBeInTheDocument();
  });

  it("restores the list from the URL, ignores duplicates and reports unknown names", async () => {
    window.history.replaceState(null, "", "/?meds=Coumadin,Zzzqx");
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole("combobox", { name: "Add a medication" }), "coumadin{Enter}");
    expect(within(screen.getByRole("list", { name: "Your medications" })).getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Check 2 medications" }));
    expect(await screen.findByText("Not recognized, so not checked: Zzzqx.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Zzzqx" }));
    expect(window.location.search).toBe("?meds=Coumadin");
  });

  it("fills in an example list and copies a summary", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Use an example list" }));
    expect(within(screen.getByRole("list", { name: "Your medications" })).getAllByRole("listitem")).toHaveLength(4);

    window.history.replaceState(null, "", "/?meds=Coumadin,Advil");
    render(<App />);
    const check = screen.getAllByRole("button", { name: /^Check 2 medications$/ })[0]!;
    await user.click(check);
    const copy = await screen.findByRole("button", { name: "Copy a summary for your pharmacist" });
    await user.click(copy);
    expect(await navigator.clipboard.readText()).toContain("Coumadin + Advil");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("explains network failures", async () => {
    vi.stubGlobal("fetch", async () => new Response("down", { status: 500 }));
    window.history.replaceState(null, "", "/?meds=a1,b2");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check 2 medications" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the drug databases (Request failed (500))");
  });
});
