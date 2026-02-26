// Records the real RxNorm/openFDA responses the browser tests need into
// e2e/fixtures.json, so the tests run offline. Usage: node scripts/record-fixtures.mjs
// It runs the app's own API code in Node and saves whatever URLs it fetches.
import { writeFile } from "node:fs/promises";

const recorded = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const res = await realFetch(url, init);
  const body = await res.json().catch(() => null);
  if (res.ok && body) recorded[url] = slim(url, body);
  return Response.json(body, { status: res.status });
};

// Labels are large; keep only what the app reads.
function slim(url, body) {
  if (!url.includes("api.fda.gov")) return body;
  return {
    results: (body.results ?? []).map((r) => ({
      set_id: r.set_id,
      effective_time: r.effective_time,
      drug_interactions: r.drug_interactions,
      contraindications: r.contraindications,
      boxed_warning: r.boxed_warning,
      openfda: { brand_name: r.openfda?.brand_name, generic_name: r.openfda?.generic_name },
    })),
  };
}

const { suggest, ingredientsFor, classesFor, labelFor } = await import("../src/lib/api.ts");
await suggest("advi");
for (const name of ["Coumadin", "Advil", "clarithromycin", "Lipitor", "ibuprofen"]) {
  for (const i of await ingredientsFor(name)) {
    await classesFor(i.rxcui);
    await labelFor(i.name);
  }
}
await writeFile(new URL("../e2e/fixtures.json", import.meta.url), JSON.stringify(recorded, null, 1) + "\n");
console.log(`Recorded ${Object.keys(recorded).length} responses`);
