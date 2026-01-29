/**
 * Finds where one drug's label talks about another drug. Labels are long,
 * so results are whole sentences containing the other drug's name as a word
 * (so "aspirin" doesn't match inside "aspirinate"), with duplicates removed.
 */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    // Section numbers like "( 7.2 )" and "7.3" aren't sentence ends.
    .split(/(?<=[.;!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** null when no name is long enough to match safely (an empty pattern would match everything). */
export function mentionPattern(names: string[]): RegExp | null {
  const alternatives = [...new Set(names.map((n) => n.trim().toLowerCase()).filter((n) => n.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .map(escape);
  if (alternatives.length === 0) return null;
  return new RegExp(`\\b(${alternatives.join("|")})\\b`, "i");
}

/** Sentences in `labelText` that mention any of `names`, at most `limit`. */
export function findMentions(labelText: string, names: string[], limit = 4): string[] {
  const pattern = mentionPattern(names);
  if (!labelText || !pattern) return [];
  const seen = new Set<string>();
  const found: string[] = [];
  for (const sentence of splitSentences(labelText)) {
    if (!pattern.test(sentence)) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(sentence.length > 400 ? sentence.slice(0, 400).trimEnd() + "…" : sentence);
    if (found.length >= limit) break;
  }
  return found;
}

/** Splits a sentence into parts so the matched names can be highlighted. */
export function highlight(sentence: string, names: string[]): { text: string; match: boolean }[] {
  const base = mentionPattern(names);
  if (!base) return [{ text: sentence, match: false }];
  const pattern = new RegExp(base.source, "gi");
  const parts: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const m of sentence.matchAll(pattern)) {
    if (m.index > last) parts.push({ text: sentence.slice(last, m.index), match: false });
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) parts.push({ text: sentence.slice(last), match: false });
  return parts;
}
