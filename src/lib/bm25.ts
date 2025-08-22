import { tokenize } from "./tokenize";

export type BM25Doc = {
  id: string;
  text: string;
};

type Posting = { docId: string; tf: number };

export class BM25Index {
  private readonly k1 = 1.2;
  private readonly b = 0.75;
  private vocab = new Map<string, Posting[]>();
  private docLengths = new Map<string, number>();
  private totalDocs = 0;
  private totalDocLength = 0;

  addDocuments(docs: BM25Doc[]) {
    for (const doc of docs) {
      const tokens = tokenize(doc.text);
      this.totalDocs += 1;
      this.totalDocLength += tokens.length;
      this.docLengths.set(doc.id, tokens.length);
      const tfMap = new Map<string, number>();
      for (const t of tokens) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
      for (const [term, tf] of tfMap) {
        const postings = this.vocab.get(term) ?? [];
        postings.push({ docId: doc.id, tf });
        this.vocab.set(term, postings);
      }
    }
  }

  private avgDocLen() {
    return this.totalDocs ? this.totalDocLength / this.totalDocs : 0;
  }

  search(query: string, topK = 10): { docId: string; score: number }[] {
    const qTokens = tokenize(query);
    const scores = new Map<string, number>();
    const N = this.totalDocs;
    const avgdl = this.avgDocLen();
    for (const term of qTokens) {
      const postings = this.vocab.get(term);
      if (!postings) continue;
      const n_qi = postings.length;
      const idf = Math.log(1 + (N - n_qi + 0.5) / (n_qi + 0.5));
      for (const { docId, tf } of postings) {
        const dl = this.docLengths.get(docId) ?? 0;
        const denom = tf + this.k1 * (1 - this.b + (this.b * dl) / avgdl);
        const score = idf * ((tf * (this.k1 + 1)) / denom);
        scores.set(docId, (scores.get(docId) ?? 0) + score);
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docId, score]) => ({ docId, score }));
  }

  serialize(): {
    k1: number;
    b: number;
    totalDocs: number;
    totalDocLength: number;
    docLengths: Array<[string, number]>;
    vocab: Array<[string, Array<{ docId: string; tf: number }>]>
  } {
    return {
      k1: this.k1,
      b: this.b,
      totalDocs: this.totalDocs,
      totalDocLength: this.totalDocLength,
      docLengths: [...this.docLengths.entries()],
      vocab: [...this.vocab.entries()].map(([term, postings]) => [term, postings.map(p => ({ docId: p.docId, tf: p.tf }))]),
    };
  }

  static fromJSON(data: {
    k1: number;
    b: number;
    totalDocs: number;
    totalDocLength: number;
    docLengths: Array<[string, number]>;
    vocab: Array<[string, Array<{ docId: string; tf: number }>]>
  }): BM25Index {
    const idx = new BM25Index();
    (idx as unknown as { k1: number }).k1 = data.k1;
    (idx as unknown as { b: number }).b = data.b;
    (idx as unknown as { totalDocs: number }).totalDocs = data.totalDocs;
    (idx as unknown as { totalDocLength: number }).totalDocLength = data.totalDocLength;
    (idx as unknown as { docLengths: Map<string, number> }).docLengths = new Map(data.docLengths);
    (idx as unknown as { vocab: Map<string, Posting[]> }).vocab = new Map(
      data.vocab.map(([term, postings]) => [term, postings.map(p => ({ docId: p.docId, tf: p.tf }))])
    );
    return idx;
  }
}


