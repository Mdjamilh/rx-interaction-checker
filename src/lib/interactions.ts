import type { Ingredient, Label } from "./api";
import { findMentions } from "./mentions";

export type Medication = { name: string; ingredients: Ingredient[] };

export type Evidence = {
  /** Whose label says it. */
  source: string;
  section: "Boxed warning" | "Contraindications" | "Drug interactions";
  sentences: string[];
  setId: string;
};

export type PairResult = { a: Medication; b: Medication; evidence: Evidence[] };

const SECTIONS = [
  ["Boxed warning", "boxedWarning"],
  ["Contraindications", "contraindications"],
  ["Drug interactions", "interactions"],
] as const;

/**
 * Every pair of medications, with what each one's label says about the
 * other. Both directions are checked: warfarin's label may name ibuprofen
 * even when ibuprofen's label doesn't name warfarin. Pairs with evidence
 * come first, most serious section first.
 */
export function checkPairs(meds: Medication[], labels: Map<string, Label>): PairResult[] {
  const results: PairResult[] = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const a = meds[i]!;
      const b = meds[j]!;
      const evidence = [...evidenceFor(a, b, labels), ...evidenceFor(b, a, labels)];
      results.push({ a, b, evidence });
    }
  }
  const rank = (r: PairResult) => (r.evidence.length === 0 ? 3 : Math.min(...r.evidence.map((e) => SECTIONS.findIndex(([s]) => s === e.section))));
  return results.sort((x, y) => rank(x) - rank(y));
}

function evidenceFor(from: Medication, about: Medication, labels: Map<string, Label>): Evidence[] {
  const names = about.ingredients.map((i) => i.name);
  if (names.length === 0) return [];
  const out: Evidence[] = [];
  for (const ingredient of from.ingredients) {
    const label = labels.get(ingredient.name);
    if (!label) continue;
    for (const [section, key] of SECTIONS) {
      const sentences = findMentions(label[key], names);
      if (sentences.length) out.push({ source: ingredient.name, section, sentences, setId: label.setId });
    }
  }
  return out;
}
