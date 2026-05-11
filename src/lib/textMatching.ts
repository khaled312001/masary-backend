export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s+#.]/gu, " ")
    .replace(/\s+/g, " ");
}

export function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,،؛;\n|]/g)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 120)
    )
  );
}

export function similarity(a: string, b: string) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return Math.min(0.95, Math.min(x.length, y.length) / Math.max(x.length, y.length) + 0.2);

  const distance = levenshtein(x, y);
  return Math.max(0, 1 - distance / Math.max(x.length, y.length));
}

export function closest<T>(items: T[], query: string, getNames: (item: T) => (string | null | undefined)[], minScore = 0.78) {
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = Math.max(...getNames(item).filter(Boolean).map((name) => similarity(query, String(name))));
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= minScore ? best : null;
}

function levenshtein(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}
