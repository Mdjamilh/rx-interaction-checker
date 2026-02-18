import type { Label } from "./api";
import type { PairResult } from "./interactions";

/** openFDA dates are YYYYMMDD; show them the way people read dates. */
export function labelDate(effective: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(effective);
  if (!m) return effective;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Plain text to paste into a message to a pharmacist or doctor: what was
 * checked, which pairs the labels mention, and where each quote comes from.
 */
export function plainSummary(pairs: PairResult[], labels: Map<string, Label>, checkedAt = new Date()): string {
  const meds = [...new Map(pairs.flatMap((p) => [p.a, p.b]).map((m) => [m.name, m])).values()].map((m) => m.name);
  const lines = [`Medications checked: ${meds.join(", ")}`, `Checked ${checkedAt.toISOString().slice(0, 10)} against FDA drug labels (openFDA).`, ""];
  const flagged = pairs.filter((p) => p.evidence.length);
  if (!flagged.length) lines.push("None of the labels mention the other medications on this list.");
  for (const p of flagged) {
    lines.push(`${p.a.name} + ${p.b.name}`);
    for (const e of p.evidence) {
      const label = labels.get(e.source);
      const when = label ? `, label revised ${labelDate(label.effective)}` : "";
      lines.push(`  ${e.section} (${e.source} label${when}${e.viaClass ? `, by class: ${e.viaClass}` : ""}):`);
      for (const s of e.sentences) lines.push(`    "${s}"`);
    }
    lines.push("");
  }
  lines.push("This summary quotes drug labels and is not medical advice.");
  return lines.join("\n");
}
