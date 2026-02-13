/**
 * Clients for two free public APIs from the US government:
 * - RxNorm (National Library of Medicine) to understand drug names,
 * - openFDA to read the official prescribing labels.
 * Both allow browser requests, so the app has no backend.
 */
import { cached, politeFetch } from "./fetching";

const RXNAV = "https://rxnav.nlm.nih.gov/REST";
const OPENFDA = "https://api.fda.gov/drug/label.json";

export type Ingredient = { rxcui: string; name: string };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | undefined> {
  const res = await politeFetch(url, signal);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Name suggestions for an autocomplete, best matches first. */
export async function suggest(term: string, signal?: AbortSignal): Promise<string[]> {
  if (term.trim().length < 2) return [];
  type Approx = { approximateGroup?: { candidate?: { name?: string; rank: string }[] } };
  const data = await getJson<Approx>(`${RXNAV}/approximateTerm.json?term=${encodeURIComponent(term.trim())}&maxEntries=12`, signal);
  const names = (data?.approximateGroup?.candidate ?? []).filter((c) => c.name).map((c) => c.name as string);
  // RxNorm returns forms like "Lipitor 10 MG Oral Tablet"; keep distinct, short names first.
  return [...new Set(names)].sort((a, b) => a.length - b.length).slice(0, 8);
}

/**
 * The active ingredients behind a name: "Lipitor" becomes atorvastatin, and a
 * combination product such as "Vicodin" becomes hydrocodone and acetaminophen.
 */
export function ingredientsFor(name: string, signal?: AbortSignal): Promise<Ingredient[]> {
  return cached(`ingredients:${name.toLowerCase()}`, () => loadIngredients(name, signal));
}

async function loadIngredients(name: string, signal?: AbortSignal): Promise<Ingredient[]> {
  type Approx = { approximateGroup?: { candidate?: { rxcui: string }[] } };
  const match = await getJson<Approx>(`${RXNAV}/approximateTerm.json?term=${encodeURIComponent(name.trim())}&maxEntries=1`, signal);
  const rxcui = match?.approximateGroup?.candidate?.[0]?.rxcui;
  if (!rxcui) return [];

  type Related = { relatedGroup?: { conceptGroup?: { tty: string; conceptProperties?: { rxcui: string; name: string }[] }[] } };
  const related = await getJson<Related>(`${RXNAV}/rxcui/${rxcui}/related.json?tty=IN+MIN`, signal);
  const groups = related?.relatedGroup?.conceptGroup ?? [];
  // Single ingredients (IN) are what labels name; fall back to multi-ingredient (MIN) names.
  const singles = groups.find((g) => g.tty === "IN")?.conceptProperties ?? [];
  return singles.map((c) => ({ rxcui: c.rxcui, name: c.name.toLowerCase() }));
}

export type Label = {
  ingredient: string;
  brand?: string;
  setId: string;
  effective: string;
  interactions: string;
  contraindications: string;
  boxedWarning: string;
};

type LabelResult = {
  set_id: string;
  effective_time: string;
  drug_interactions?: string[];
  contraindications?: string[];
  boxed_warning?: string[];
  openfda?: { brand_name?: string[]; generic_name?: string[] };
};

/**
 * The most recent FDA label for an ingredient. Labels name the salt
 * ("ATORVASTATIN CALCIUM"), so this is a phrase search; single-ingredient
 * labels are preferred over combinations ("AMLODIPINE AND ATORVASTATIN").
 */
export function labelFor(ingredient: string, signal?: AbortSignal): Promise<Label | undefined> {
  return cached(`label:${ingredient}`, () => loadLabel(ingredient, signal));
}

async function loadLabel(ingredient: string, signal?: AbortSignal): Promise<Label | undefined> {
  const search = `openfda.generic_name:"${ingredient}"`;
  const data = await getJson<{ results?: LabelResult[] }>(`${OPENFDA}?search=${encodeURIComponent(search)}&sort=effective_time:desc&limit=10`, signal);
  const results = data?.results ?? [];
  const single = (x: LabelResult) => !(x.openfda?.generic_name ?? []).some((g) => / AND |,/.test(g.toUpperCase()));
  const r = results.find(single) ?? results[0];
  if (!r) return undefined;
  const join = (parts?: string[]) => (parts ?? []).join(" ");
  return {
    ingredient,
    brand: r.openfda?.brand_name?.[0],
    setId: r.set_id,
    effective: r.effective_time,
    interactions: join(r.drug_interactions),
    contraindications: join(r.contraindications),
    boxedWarning: join(r.boxed_warning),
  };
}

/** The label's page on DailyMed, the National Library of Medicine's label viewer. */
export const dailyMedUrl = (setId: string) => `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`;

/** FDA Established Pharmacologic Classes for an ingredient, e.g. "Nonsteroidal Anti-inflammatory Drug". */
export function classesFor(rxcui: string, signal?: AbortSignal): Promise<string[]> {
  return cached(`classes:${rxcui}`, () => loadClasses(rxcui, signal));
}

async function loadClasses(rxcui: string, signal?: AbortSignal): Promise<string[]> {
  type Classes = { rxclassDrugInfoList?: { rxclassDrugInfo?: { rxclassMinConceptItem: { className: string } }[] } };
  const data = await getJson<Classes>(`${RXNAV}/rxclass/class/byRxcui.json?rxcui=${encodeURIComponent(rxcui)}&relaSource=FDASPL&relas=has_epc`, signal);
  return [...new Set((data?.rxclassDrugInfoList?.rxclassDrugInfo ?? []).map((d) => d.rxclassMinConceptItem.className))].sort();
}
