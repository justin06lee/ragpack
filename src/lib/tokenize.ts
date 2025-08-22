export type TokenizerOptions = {
  toLower?: boolean;
  removeStopwords?: boolean;
};

const DEFAULT_STOPWORDS = new Set<string>([
  "a","an","and","are","as","at","be","but","by","for","if","in","into","is","it","no","not","of","on","or","such","that","the","their","then","there","these","they","this","to","was","will","with"
]);

export function tokenize(text: string, options: TokenizerOptions = {}): string[] {
  const { toLower = true, removeStopwords = true } = options;
  const normalized = toLower ? text.toLowerCase() : text;
  const tokens = normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!removeStopwords) return tokens;
  return tokens.filter((t) => !DEFAULT_STOPWORDS.has(t));
}


