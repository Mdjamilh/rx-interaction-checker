import { useEffect, useState } from "react";

import { DrugSearch } from "./components/DrugSearch";
import { Results } from "./components/Results";
import { classesFor, ingredientsFor, labelFor, type Label } from "./lib/api";
import { checkPairs, type Medication, type PairResult } from "./lib/interactions";

/** The list lives in the URL (?meds=Advil,warfarin), so a check can be shared or bookmarked. */
function readList(): string[] {
  const raw = new URLSearchParams(window.location.search).get("meds");
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) : [];
}

function writeList(names: string[]) {
  const url = new URL(window.location.href);
  if (names.length) url.searchParams.set("meds", names.join(","));
  else url.searchParams.delete("meds");
  window.history.replaceState(null, "", url);
}

type State = { status: "idle" } | { status: "checking" } | { status: "done"; pairs: PairResult[]; missing: string[] } | { status: "error"; message: string };

export default function App() {
  const [names, setNames] = useState<string[]>(readList);
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => writeList(names), [names]);

  const add = (name: string) => setNames((list) => (list.some((n) => n.toLowerCase() === name.toLowerCase()) || list.length >= 10 ? list : [...list, name]));
  const remove = (name: string) => {
    setNames((list) => list.filter((n) => n !== name));
    setState({ status: "idle" });
  };

  const check = async () => {
    setState({ status: "checking" });
    try {
      const meds: Medication[] = await Promise.all(
        names.map(async (name) => {
          const ingredients = await ingredientsFor(name);
          const classes = (await Promise.all(ingredients.map((i) => classesFor(i.rxcui)))).flat();
          return { name, ingredients, classes: [...new Set(classes)] };
        }),
      );
      const labels = new Map<string, Label>();
      const ingredients = [...new Set(meds.flatMap((m) => m.ingredients.map((i) => i.name)))];
      await Promise.all(
        ingredients.map(async (i) => {
          const l = await labelFor(i);
          if (l) labels.set(i, l);
        }),
      );
      const missing = meds.filter((m) => m.ingredients.length === 0).map((m) => m.name);
      setState({ status: "done", pairs: checkPairs(meds.filter((m) => m.ingredients.length), labels), missing });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Something went wrong" });
    }
  };

  return (
    <main>
      <header>
        <h1>Medication interaction check</h1>
        <p className="lead">See what the official FDA labels say about the medicines on your list when they're taken together.</p>
      </header>

      <div className="panel">
        <DrugSearch onAdd={add} />
        {names.length > 0 && (
          <ul className="chips" aria-label="Your medications">
            {names.map((n) => (
              <li key={n}>
                {n}
                <button type="button" aria-label={`Remove ${n}`} onClick={() => remove(n)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="primary" disabled={names.length < 2 || state.status === "checking"} onClick={() => void check()}>
          {state.status === "checking" ? "Reading labels…" : names.length < 2 ? "Add at least two medications" : `Check ${names.length} medications`}
        </button>
      </div>

      <div aria-live="polite">
        {state.status === "error" && (
          <p className="error" role="alert">
            Couldn't reach the drug databases ({state.message}). Please try again.
          </p>
        )}
        {state.status === "done" && (
          <>
            {state.missing.length > 0 && <p className="warn">Not recognized, so not checked: {state.missing.join(", ")}.</p>}
            <Results pairs={state.pairs} />
          </>
        )}
      </div>

      <footer>
        <p>
          <strong>This is not medical advice.</strong> It quotes FDA prescribing labels, matching drugs by name and by common class names (such as "NSAIDs"), and can
          still miss interactions a label describes in other ways, such as by enzyme ("CYP3A4 inhibitors"). Always ask a pharmacist or doctor before starting, stopping or combining medicines.
        </p>
        <p>
          Data: <a href="https://lhncbc.nlm.nih.gov/RxNav/">RxNorm</a> from the National Library of Medicine and <a href="https://open.fda.gov/">openFDA</a>. Only drug
          names are sent to them; nothing is stored.
        </p>
      </footer>
    </main>
  );
}
