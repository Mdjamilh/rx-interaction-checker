import { useEffect, useRef, useState } from "react";

import { DrugSearch } from "./components/DrugSearch";
import { Results } from "./components/Results";
import { classesFor, ingredientsFor, labelFor, type Label } from "./lib/api";
import { checkPairs, findDuplicates, type Duplicate, type Medication, type PairResult } from "./lib/interactions";
import { plainSummary } from "./lib/summary";

/** The list lives in the URL (?meds=Advil,warfarin), so a check can be shared or bookmarked. */
function readList(): string[] {
  const raw = new URLSearchParams(window.location.search).get("meds");
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_MEDS) : [];
}

function writeList(names: string[]) {
  const url = new URL(window.location.href);
  if (names.length) url.searchParams.set("meds", names.join(","));
  else url.searchParams.delete("meds");
  window.history.replaceState(null, "", url);
}

type State = { status: "idle" } | { status: "checking"; done: number; total: number } | { status: "done"; pairs: PairResult[]; labels: Map<string, Label>; missing: string[]; duplicates: Duplicate[]; unlabeled: string[] } | { status: "error"; message: string };

function CopySummary({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="secondary"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? "Copied" : "Copy a summary for your pharmacist"}
    </button>
  );
}

/** Each check reads every pair's labels, so the list is capped to keep it quick and polite to the APIs. */
const MAX_MEDS = 10;

/** A list with well-documented interactions, so the tool can be tried in one click. */
const EXAMPLE = ["Coumadin", "Advil", "clarithromycin", "Lipitor"];

export default function App() {
  const [names, setNames] = useState<string[]>(readList);
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => writeList(names), [names]);

  const add = (name: string) => setNames((list) => (list.some((n) => n.toLowerCase() === name.toLowerCase()) || list.length >= MAX_MEDS ? list : [...list, name]));
  const remove = (name: string) => {
    setNames((list) => list.filter((n) => n !== name));
    setState({ status: "idle" });
  };

  // A check in flight is cancelled when the list changes or a new check starts.
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), [names]);

  const check = async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const { signal } = controller;
    setState({ status: "checking", done: 0, total: names.length });
    try {
      const meds: Medication[] = await Promise.all(
        names.map(async (name) => {
          const ingredients = await ingredientsFor(name, signal);
          const classes = (await Promise.all(ingredients.map((i) => classesFor(i.rxcui, signal)))).flat();
          return { name, ingredients, classes: [...new Set(classes)] };
        }),
      );
      const labels = new Map<string, Label>();
      const ingredients = [...new Set(meds.flatMap((m) => m.ingredients.map((i) => i.name)))];
      let done = 0;
      setState({ status: "checking", done, total: ingredients.length });
      await Promise.all(
        ingredients.map(async (i) => {
          const l = await labelFor(i, signal);
          if (l) labels.set(i, l);
          if (!signal.aborted) setState({ status: "checking", done: ++done, total: ingredients.length });
        }),
      );
      if (signal.aborted) return;
      const missing = meds.filter((m) => m.ingredients.length === 0).map((m) => m.name);
      const unlabeled = ingredients.filter((i) => !labels.has(i));
      const known = meds.filter((m) => m.ingredients.length);
      setState({ status: "done", pairs: checkPairs(known, labels), labels, missing, duplicates: findDuplicates(known), unlabeled });
    } catch (error) {
      if (signal.aborted) return;
      setState({ status: "error", message: error instanceof Error ? error.message : "Something went wrong" });
    }
  };

  // Move focus to the results so screen reader and keyboard users land on them.
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "done") resultsRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [state.status]);

  return (
    <main>
      <header>
        <h1>Medication interaction check</h1>
        <p className="lead">See what the official FDA labels say about the medicines on your list when they're taken together.</p>
      </header>

      <div className="panel">
        {names.length >= MAX_MEDS ? (
          <p className="warn">That's {MAX_MEDS} medications, the most one check covers ({(MAX_MEDS * (MAX_MEDS - 1)) / 2} pairs). Remove one to add another.</p>
        ) : (
          <DrugSearch onAdd={add} />
        )}
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
        {names.length === 0 && (
          <p className="example">
            Not sure what to try?{" "}
            <button type="button" className="link" onClick={() => setNames(EXAMPLE)}>
              Use an example list
            </button>
          </p>
        )}
        <button type="button" className="primary" disabled={names.length < 2 || state.status === "checking"} onClick={() => void check()}>
          {state.status === "checking" ? (state.done ? `Reading labels (${state.done} of ${state.total})…` : "Looking up medications…") : names.length < 2 ? "Add at least two medications" : `Check ${names.length} medications`}
        </button>
      </div>

      <div aria-live="polite" ref={resultsRef}>
        {state.status === "error" && (
          <p className="error" role="alert">
            Couldn't reach the drug databases ({state.message}).{" "}
            <button type="button" className="link" onClick={() => void check()}>
              Try again
            </button>
          </p>
        )}
        {state.status === "done" && (
          <>
            {state.duplicates.map((d) => (
              <p key={d.ingredient} className="duplicate" role="alert">
                <strong>Same ingredient twice:</strong> {d.medications.join(" and ")} both contain {d.ingredient}. Taking them together may double the dose.
              </p>
            ))}
            {state.missing.length > 0 && <p className="warn">Not recognized, so not checked: {state.missing.join(", ")}.</p>}
            {state.unlabeled.length > 0 && <p className="warn">No FDA label found for {state.unlabeled.join(", ")}, so their own labels couldn't be checked.</p>}
            <Results pairs={state.pairs} labels={state.labels} />
            <CopySummary text={plainSummary(state.pairs, state.labels)} />
          </>
        )}
      </div>

      <details className="how">
        <summary>How this works</summary>
        <ol>
          <li>Each name is looked up in RxNorm, the National Library of Medicine's drug vocabulary, to find its active ingredients. Brand names such as Advil become ibuprofen.</li>
          <li>For each ingredient, the newest FDA prescribing label is read from openFDA, along with the drug's official class (for example "Nonsteroidal Anti-inflammatory Drug").</li>
          <li>For every pair, both labels' boxed warnings, contraindications and drug interaction sections are searched for the other drug's name or class, and the matching sentences are quoted.</li>
          <li>Entries that share an ingredient are flagged separately, because taking both can double the dose.</li>
        </ol>
      </details>

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
