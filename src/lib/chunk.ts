export type Chunk = {
  id: string;
  docId: string;
  text: string;
  charStart: number;
  charEnd: number;
};

export function simpleTextChunk(
  text: string,
  docId: string,
  maxChars = 800,
  overlap = 120
): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const piece = text.slice(start, end);
    const id = `${docId}:${start}-${end}`;
    chunks.push({ id, docId, text: piece, charStart: start, charEnd: end });
    if (end === text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

// --- Free (client-side) chunkers ---

export type ChunkingMethod =
  | { kind: "fixed_tokens"; maxTokens: number }
  | { kind: "sliding_tokens"; maxTokens: number; overlapTokens: number }
  | { kind: "sent_paragraph"; targetChars: number; sentenceOverlap?: number }
  | { kind: "recursive"; targetChars: number };

export function chunkByTokens(
  text: string,
  docId: string,
  maxTokens: number,
  overlapTokens = 0
): Chunk[] {
  const tokenMatches = [...text.matchAll(/\S+/g)];
  if (tokenMatches.length === 0) return [];
  const tokenStarts = tokenMatches.map((m) => m.index ?? 0);
  const tokenEnds = tokenMatches.map((m) => (m.index ?? 0) + m[0].length);

  const chunks: Chunk[] = [];
  const stride = Math.max(1, maxTokens - Math.max(0, overlapTokens));
  for (let tStart = 0; tStart < tokenMatches.length; tStart += stride) {
    const tEnd = Math.min(tStart + maxTokens, tokenMatches.length);
    const charStart = tokenStarts[tStart];
    const charEnd = tokenEnds[tEnd - 1];
    const piece = text.slice(charStart, charEnd);
    const id = `${docId}:${charStart}-${charEnd}`;
    chunks.push({ id, docId, text: piece, charStart, charEnd });
    if (tEnd === tokenMatches.length) break;
  }
  return chunks;
}

export function chunkBySentencesParagraphs(
  text: string,
  docId: string,
  targetChars = 800,
  sentenceOverlap = 0
): Chunk[] {
  const paraSplits = splitParagraphs(text);
  const seg = typeof (Intl as unknown as { Segmenter?: { new(locale?: string, options?: { granularity: "sentence" }): { segment: (input: string) => Iterable<{ segment: string; index: number }> } } }).Segmenter !== "undefined"
    ? new (Intl as unknown as { Segmenter: { new(locale?: string, options?: { granularity: "sentence" }): { segment: (input: string) => Iterable<{ segment: string; index: number }> } } }).Segmenter(undefined as unknown as string, { granularity: "sentence" })
    : null;
  const chunks: Chunk[] = [];
  let accText = "";
  let accStart = 0;
  let lastEnd = 0;
  for (const p of paraSplits) {
    const { start: pStart, end: pEnd, text: pText } = p;
    if (!seg) {
      // fallback: treat paragraph as one unit
      flushOrAccumulate(pText, pStart, pEnd);
      continue;
    }
    const sentences = [...seg.segment(pText)] as Array<{ segment: string; index: number }>;
    const overlapQueue: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const sStart = pStart + s.index;
      const sEnd = sStart + s.segment.length;
      const candidate = (accText ? accText + (accText.endsWith("\n") ? "" : " ") : "") + s.segment;
      if (candidate.length >= targetChars && accText) {
        const piece = accText.trim();
        const id = `${docId}:${accStart}-${lastEnd}`;
        chunks.push({ id, docId, text: piece, charStart: accStart, charEnd: lastEnd });
        // seed overlap
        accText = overlapQueue.slice(-sentenceOverlap).join(" ");
        accStart = lastEnd;
      }
      if (!accText) accStart = sStart;
      accText = (accText ? accText + (accText.endsWith("\n") ? "" : " ") : "") + s.segment;
      lastEnd = sEnd;
      overlapQueue.push(s.segment);
    }
    // paragraph boundary: prefer to flush if large
    if (accText.length >= targetChars) {
      const piece = accText.trim();
      const id = `${docId}:${accStart}-${lastEnd}`;
      chunks.push({ id, docId, text: piece, charStart: accStart, charEnd: lastEnd });
      accText = "";
    }
  }
  if (accText) {
    const id = `${docId}:${accStart}-${lastEnd}`;
    chunks.push({ id, docId, text: accText.trim(), charStart: accStart, charEnd: lastEnd });
  }
  return chunks;

  function flushOrAccumulate(unit: string, start: number, end: number) {
    if ((accText + unit).length >= targetChars && accText) {
      const id = `${docId}:${accStart}-${lastEnd}`;
      chunks.push({ id, docId, text: accText.trim(), charStart: accStart, charEnd: lastEnd });
      accText = unit;
      accStart = start;
      lastEnd = end;
    } else {
      if (!accText) accStart = start;
      accText += (accText ? "\n\n" : "") + unit;
      lastEnd = end;
    }
  }
}

export function chunkRecursive(
  text: string,
  docId: string,
  targetChars = 800
): Chunk[] {
  // Split by top-level markdown headings as sections
  const sections = splitByHeadings(text);
  const chunks: Chunk[] = [];
  for (const sec of sections) {
    const paras = splitParagraphs(sec.text);
    let buffer = "";
    let bufStart = sec.start;
    let lastEnd = sec.start;
    for (const p of paras) {
      if ((buffer + p.text).length > targetChars && buffer) {
        const id = `${docId}:${bufStart}-${lastEnd}`;
        chunks.push({ id, docId, text: buffer.trim(), charStart: bufStart, charEnd: lastEnd });
        buffer = p.text;
        bufStart = p.start;
        lastEnd = p.end;
      } else {
        if (!buffer) bufStart = p.start;
        buffer += (buffer ? "\n\n" : "") + p.text;
        lastEnd = p.end;
      }
      // If paragraph still exceeds target, fall back to sentence packing
      if (p.text.length > targetChars * 1.5) {
        const inner = chunkBySentencesParagraphs(p.text, docId, targetChars);
        chunks.push(...inner);
        buffer = "";
      }
    }
    if (buffer) {
      const id = `${docId}:${bufStart}-${lastEnd}`;
      chunks.push({ id, docId, text: buffer.trim(), charStart: bufStart, charEnd: lastEnd });
    }
  }
  return chunks;
}

function splitParagraphs(text: string): Array<{ start: number; end: number; text: string }> {
  const parts: Array<{ start: number; end: number; text: string }> = [];
  let idx = 0;
  const re = /\n{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = idx;
    const end = m.index;
    parts.push({ start, end, text: text.slice(start, end) });
    idx = m.index + m[0].length;
  }
  if (idx <= text.length) parts.push({ start: idx, end: text.length, text: text.slice(idx) });
  return parts.filter((p) => p.text.trim().length > 0);
}

function splitByHeadings(text: string): Array<{ start: number; end: number; text: string }> {
  const parts: Array<{ start: number; end: number; text: string }> = [];
  const re = /^#{1,6} .*$/gm;
  const indices: number[] = [0];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) indices.push(m.index);
  indices.push(text.length);
  for (let i = 0; i < indices.length - 1; i++) {
    const start = indices[i];
    const end = indices[i + 1];
    parts.push({ start, end, text: text.slice(start, end) });
  }
  return parts;
}


