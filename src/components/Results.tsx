import { dailyMedUrl, type Label } from "../lib/api";
import type { PairResult } from "../lib/interactions";
import { classPhrases } from "../lib/classes";
import { highlight } from "../lib/mentions";
import { labelDate } from "../lib/summary";

const label = (r: PairResult["a"]) => (r.ingredients.length && r.ingredients.map((i) => i.name).join(" + ") !== r.name.toLowerCase() ? `${r.name} (${r.ingredients.map((i) => i.name).join(" + ")})` : r.name);

export function Results({ pairs, labels }: { pairs: PairResult[]; labels: Map<string, Label> }) {
  const flagged = pairs.filter((p) => p.evidence.length > 0);
  const clear = pairs.filter((p) => p.evidence.length === 0);

  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title" tabIndex={-1}>
        {flagged.length === 0 ? "No label mentions found" : `${flagged.length} of ${pairs.length} ${pairs.length === 1 ? "pair is" : "pairs are"} mentioned in the labels`}
      </h2>
      {flagged.map((p) => (
        <article key={`${p.a.name}+${p.b.name}`} className={`pair ${p.evidence.some((e) => e.section !== "Drug interactions") ? "serious" : ""}`}>
          <h3>
            {label(p.a)} <span aria-hidden="true">+</span>
            <span className="visually-hidden">and</span> {label(p.b)}
          </h3>
          {p.evidence.map((e) => (
            <div key={`${e.source}-${e.section}`} className="evidence">
              <p className="where">
                <span className={`section ${e.section === "Drug interactions" ? "" : "strong"}`}>{e.section}</span> in the {e.source} label
                {labels.get(e.source) && (
                  <>
                    {labels.get(e.source)?.brand && ` (${labels.get(e.source)?.brand})`}, revised {labelDate(labels.get(e.source)?.effective ?? "")}
                  </>
                )}
                {e.viaClass && <> · mentions its class ({e.viaClass})</>} ·{" "}
                <a href={dailyMedUrl(e.setId)} target="_blank" rel="noreferrer">
                  read the full label
                </a>
              </p>
              {e.sentences.map((s) => (
                <blockquote key={s}>
                  {/* A quote from A's label names B, and the other way round. */}
                  {highlight(s, e.viaClass ? classPhrases(e.viaClass) : (p.a.ingredients.some((i) => i.name === e.source) ? p.b : p.a).ingredients.map((i) => i.name)).map((part, i) =>
                    part.match ? <mark key={i}>{part.text}</mark> : part.text,
                  )}
                </blockquote>
              ))}
            </div>
          ))}
        </article>
      ))}
      {clear.length > 0 && (
        <p className="clear">
          Not mentioned in each other's labels: {clear.map((p) => `${p.a.name} + ${p.b.name}`).join(", ")}. That isn't proof they're safe together.
        </p>
      )}
    </section>
  );
}
