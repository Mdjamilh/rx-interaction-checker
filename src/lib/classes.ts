/**
 * Labels often name a class instead of each drug ("NSAIDs", "SSRIs").
 * RxClass gives each drug's FDA Established Pharmacologic Class (EPC); this
 * maps the common ones to the wordings labels actually use. Classes not
 * listed here still match by their EPC name.
 */
const ALIASES: Record<string, string[]> = {
  "Nonsteroidal Anti-inflammatory Drug": ["NSAID", "NSAIDs", "nonsteroidal anti-inflammatory drug", "nonsteroidal anti-inflammatory drugs", "non-steroidal anti-inflammatory drugs"],
  "Serotonin Reuptake Inhibitor": ["SSRI", "SSRIs", "selective serotonin reuptake inhibitor", "selective serotonin reuptake inhibitors"],
  "Serotonin and Norepinephrine Reuptake Inhibitor": ["SNRI", "SNRIs", "serotonin and norepinephrine reuptake inhibitors", "serotonin-norepinephrine reuptake inhibitors"],
  "Monoamine Oxidase Inhibitor": ["MAOI", "MAOIs", "monoamine oxidase inhibitor", "monoamine oxidase inhibitors"],
  "Platelet Aggregation Inhibitor": ["antiplatelet agent", "antiplatelet agents", "antiplatelet drugs", "platelet aggregation inhibitors", "platelet inhibitors"],
  "HMG-CoA Reductase Inhibitor": ["statin", "statins", "HMG-CoA reductase inhibitor", "HMG-CoA reductase inhibitors"],
  "Angiotensin Converting Enzyme Inhibitor": ["ACE inhibitor", "ACE inhibitors", "angiotensin converting enzyme inhibitors", "angiotensin-converting enzyme inhibitors"],
  "Angiotensin 2 Receptor Blocker": ["ARB", "ARBs", "angiotensin receptor blocker", "angiotensin receptor blockers", "angiotensin II receptor blockers"],
  "Benzodiazepine": ["benzodiazepine", "benzodiazepines"],
  "Opioid Agonist": ["opioid", "opioids", "opioid analgesics"],
  "Proton Pump Inhibitor": ["PPI", "PPIs", "proton pump inhibitor", "proton pump inhibitors"],
  "Macrolide Antimicrobial": ["macrolide", "macrolides", "macrolide antibiotics"],
  "Aldosterone Antagonist": ["potassium-sparing diuretic", "potassium-sparing diuretics", "aldosterone antagonists"],
};

/** The phrases to look for in a label for a drug of this class. */
export function classPhrases(epcName: string): string[] {
  const own = [epcName, `${epcName}s`];
  return [...new Set([...(ALIASES[epcName] ?? []), ...own])];
}
