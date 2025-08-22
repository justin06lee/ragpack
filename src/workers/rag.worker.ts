/// <reference lib="webworker" />
import { type Chunk, type ChunkingMethod, chunkByTokens, chunkBySentencesParagraphs, chunkRecursive } from "@/lib/chunk";
import { BM25Index } from "@/lib/bm25";
import { tokenize } from "@/lib/tokenize";
import JSZip from "jszip";

// Dense retrieval via sentence embedding model
type EmbeddingVector = Float32Array;
let embedderReady: Promise<void> | null = null;
const embeddingsByChunkId = new Map<string, EmbeddingVector>();

export type RAGWorkerRequest =
  | { type: "ingest"; files: { path: string; text: string }[]; chunking?: ChunkingMethod; retrieval: "sparse" | "dense" | "hybrid" }
  | { type: "search"; query: string; topK?: number; mode?: "sparse" | "dense" | "hybrid" }
  | { type: "export"; kind: "sparse" | "dense" | "hybrid" | "chunks" };

export type RAGWorkerResponse =
  | { type: "ingested"; stats: { docs: number; chunks: number } }
  | { type: "searchResults"; results: { chunk: Chunk; score: number }[] }
  | { type: "exported"; blob: Blob; filename?: string }
  | { type: "status"; message: string }
  | { type: "embedderLoading" }
  | { type: "embedderReady" }
  | { type: "embedderFailed"; message?: string }
  | { type: "embeddingStarted"; total: number }
  | { type: "embeddingsBuilt"; count: number };

const bm25 = new BM25Index();
const chunkIdToChunk = new Map<string, Chunk>();

function parseAndChunk(files: { path: string; text: string }[], method?: ChunkingMethod): Chunk[] {
  const chunks: Chunk[] = [];
  for (const f of files) {
    const docId = f.path;
    const docChunks =
      !method || method.kind === "fixed_tokens"
        ? chunkByTokens(f.text, docId, (method && "maxTokens" in method ? method.maxTokens : 200), 0)
        : method.kind === "sliding_tokens"
          ? chunkByTokens(f.text, docId, method.maxTokens, method.overlapTokens)
          : method.kind === "sent_paragraph"
            ? chunkBySentencesParagraphs(f.text, docId, method.targetChars, method.sentenceOverlap ?? 0)
            : chunkRecursive(f.text, docId, method.targetChars);
    chunks.push(...docChunks);
  }
  return chunks;
}

function buildBM25(chunks: Chunk[]) {
  bm25.addDocuments(
    chunks.map((c) => ({ id: c.id, text: c.text }))
  );
}

async function handleIngest(files: { path: string; text: string }[], method?: ChunkingMethod, retrieval: "sparse" | "dense" | "hybrid" = "sparse") {
  const chunks = parseAndChunk(files, method);
  for (const c of chunks) chunkIdToChunk.set(c.id, c);
  
  // Always build BM25 for sparse and hybrid modes
  if (retrieval === "sparse" || retrieval === "hybrid") {
    buildBM25(chunks);
  }
  
  // Only build embeddings for dense and hybrid modes
  if (retrieval === "dense" || retrieval === "hybrid") {
    if (!embedderReady) postMessage({ type: "embedderLoading" } satisfies RAGWorkerResponse);
    
    try {
      await ensureEmbedder();
      postMessage({ type: "embedderReady" } satisfies RAGWorkerResponse);
      
      if (chunks.length === 0) return;
      
      postMessage({ type: "embeddingStarted", total: chunks.length } satisfies RAGWorkerResponse);
      
      // Process embeddings in smaller batches to avoid memory issues and provide progress updates
      const batchSize = 10; // Process 10 chunks at a time
      let processedCount = 0;
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchTexts = batch.map((c) => c.text);
        
        try {
          const batchVecs = await embedTexts(batchTexts);
          
          // Store the embeddings
          for (let j = 0; j < batch.length; j++) {
            embeddingsByChunkId.set(batch[j].id, batchVecs[j]);
          }
          
          processedCount += batch.length;
          postMessage({ type: "embeddingsBuilt", count: batch.length } satisfies RAGWorkerResponse);
          
          // Small delay to prevent overwhelming the browser
          if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {


          // Continue with next batch instead of failing completely
        }
      }
      


    } catch (err: unknown) {
      // Surface error details to help debug CSP/network issues
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);


      postMessage({ type: "embedderFailed", message: `Failed to load embedding model (${msg}). Dense/Hybrid will be unavailable.` } satisfies RAGWorkerResponse);
    }
  }
  
  postMessage({ type: "ingested", stats: { docs: files.length, chunks: chunks.length } } satisfies RAGWorkerResponse);
}

async function handleSearch(query: string, topK = 8, mode: "sparse" | "dense" | "hybrid" = "sparse") {
  if (mode === "sparse") {
    const results = bm25.search(query, topK).map(({ docId, score }) => ({ chunk: chunkIdToChunk.get(docId)!, score }));
    postMessage({ type: "searchResults", results } satisfies RAGWorkerResponse);
    return;
  }

  if (mode === "dense") {
    await ensureEmbedder();
    const qVecArray = await embedTexts([query]);
    if (!qVecArray || qVecArray.length === 0) {


      postMessage({ type: "searchResults", results: [] } satisfies RAGWorkerResponse);
      return;
    }
    const qVec = qVecArray[0];
    if (!qVec) {


      postMessage({ type: "searchResults", results: [] } satisfies RAGWorkerResponse);
      return;
    }
    
    const scores: { id: string; score: number }[] = [];
    for (const [id, vec] of embeddingsByChunkId) {
      // Skip invalid embeddings
      if (!vec || vec.length === 0) {


        continue;
      }
      const s = cosineSimilarity(qVec, vec);
      scores.push({ id, score: s });
    }
    scores.sort((a, b) => b.score - a.score);
    const results = scores.slice(0, topK).map(({ id, score }) => ({ chunk: chunkIdToChunk.get(id)!, score }));
    postMessage({ type: "searchResults", results } satisfies RAGWorkerResponse);
    return;
  }

  // hybrid
  await ensureEmbedder();
  const qVecArray = await embedTexts([query]);
  if (!qVecArray || qVecArray.length === 0) {


    postMessage({ type: "searchResults", results: [] } satisfies RAGWorkerResponse);
    return;
  }
  const qVec = qVecArray[0];
  if (!qVec) {


    postMessage({ type: "searchResults", results: [] } satisfies RAGWorkerResponse);
    return;
  }
  
  const denseScores = new Map<string, number>();
  for (const [id, vec] of embeddingsByChunkId) {
    // Skip invalid embeddings
    if (!vec || vec.length === 0) {


      continue;
    }
    const score = cosineSimilarity(qVec, vec);
    denseScores.set(id, score);
  }
  const sparse = bm25.search(query, Math.max(topK * 4, 40));
  // Reciprocal rank fusion (RRF)
  const kRRF = 60;
  const fused = new Map<string, number>();
  // dense ranks
  const denseSorted = [...denseScores.entries()].sort((a, b) => b[1] - a[1]);
  denseSorted.forEach(([id], idx) => {
    fused.set(id, (fused.get(id) ?? 0) + 1 / (kRRF + idx + 1));
  });
  // sparse ranks
  sparse.forEach((r, idx) => {
    fused.set(r.docId, (fused.get(r.docId) ?? 0) + 1 / (kRRF + idx + 1));
  });
  const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK);
  const results = ranked.map(([id, score]) => ({ chunk: chunkIdToChunk.get(id)!, score }));
  postMessage({ type: "searchResults", results } satisfies RAGWorkerResponse);
}

function generateSparseTerms(text: string): Record<string, number> {
  // Simple sparse term extraction for export - just use the tokenizer
  const tokens = tokenize(text);
  const termCounts = new Map<string, number>();
  
  // Count term frequencies
  tokens.forEach(token => {
    termCounts.set(token, (termCounts.get(token) || 0) + 1);
  });
  
  // Convert to sparse representation with simple TF scoring
  const sparse: Record<string, number> = {};
  const totalTokens = tokens.length;
  
  for (const [term, count] of termCounts) {
    const tf = count / totalTokens;
    if (tf > 0.01) { // Only include terms with decent frequency
      sparse[term] = Math.round(tf * 1000) / 1000; // Round to 3 decimal places
    }
  }
  
  return sparse;
}

async function handleExport(kind: "sparse" | "dense" | "hybrid" | "chunks") {
  const chunks = [...chunkIdToChunk.values()];
  if (chunks.length === 0) {
    postMessage({ type: "exported", blob: new Blob([JSON.stringify({ error: "No chunks to export" })]), filename: "error.json" } satisfies RAGWorkerResponse);
    return;
  }
  
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  
  // Generate source list with unique file paths
  const sources = [...new Set(chunks.map(c => c.docId))].map(path => ({ path }));
  
  if (kind === "chunks") {
    // Raw chunks export - no processing, just chunked text
    const exportChunks = chunks.map((chunk, index) => ({
      id: `c_${String(index + 1).padStart(6, '0')}`,
      text: chunk.text,
      doc_id: chunk.docId,
      start: chunk.charStart,
      end: chunk.charEnd
    }));
    
    const metadata = {
      schema_version: "1.0",
      export_type: "chunks",
      created_at: new Date().toISOString(),
      processing: "none",
      source: sources,
      total_chunks: exportChunks.length
    };
    
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    zip.file("chunks.json", JSON.stringify(exportChunks, null, 2));
    const blob = await zip.generateAsync({ type: "blob" });
    postMessage({ type: "exported", blob, filename: `ragpack-chunks-${timestamp}.zip` } satisfies RAGWorkerResponse);
    return;
  }
  
  if (kind === "sparse") {
    const exportChunks = chunks.map((chunk, index) => ({
      id: `c_${String(index + 1).padStart(6, '0')}`,
      text: chunk.text,
      sparse: generateSparseTerms(chunk.text)
    }));
    
    const metadata = {
      schema_version: "1.0",
      export_type: "sparse",
      created_at: new Date().toISOString(),
      sparse: { 
        model: "bm25", 
        k1: 1.2, 
        b: 0.75, 
        tokenizer: "unicode_word_lower" 
      },
      source: sources,
      total_chunks: exportChunks.length
    };
    
    // Add files to ZIP
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    zip.file("chunks.json", JSON.stringify(exportChunks, null, 2));
    
    const blob = await zip.generateAsync({ type: "blob" });
    postMessage({ type: "exported", blob, filename: `ragpack-sparse-${timestamp}.zip` } satisfies RAGWorkerResponse);
    return;
  }
  
  if (kind === "dense") {
    const exportChunks = chunks
      .map((chunk, index) => {
        const embedding = embeddingsByChunkId.get(chunk.id);
        if (!embedding || embedding.length === 0) {


          return null;
        }
        
        return {
          id: `c_${String(index + 1).padStart(6, '0')}`,
          text: chunk.text,
          dense: Array.from(embedding)
        };
      })
      .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== null);
    
    const metadata = {
      schema_version: "1.0",
      export_type: "dense",
      created_at: new Date().toISOString(),
      dense: { 
        model: "all-MiniLM-L6-v2", 
        dim: exportChunks[0]?.dense?.length || 384, 
        metric: "cosine", 
        normalized: true 
      },
      source: sources,
      total_chunks: exportChunks.length
    };
    
    // Add files to ZIP
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    zip.file("chunks.json", JSON.stringify(exportChunks, null, 2));
    
    const blob = await zip.generateAsync({ type: "blob" });
    postMessage({ type: "exported", blob, filename: `ragpack-dense-${timestamp}.zip` } satisfies RAGWorkerResponse);
    return;
  }
  
  if (kind === "hybrid") {
    const exportChunks = chunks
      .map((chunk, index) => {
        const embedding = embeddingsByChunkId.get(chunk.id);
        if (!embedding || embedding.length === 0) {


          return null;
        }
        
        return {
          id: `c_${String(index + 1).padStart(6, '0')}`,
          text: chunk.text,
          dense: Array.from(embedding),
          sparse: generateSparseTerms(chunk.text)
        };
      })
      .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== null);
    
    const metadata = {
      schema_version: "1.0",
      export_type: "hybrid",
      created_at: new Date().toISOString(),
      dense: { 
        model: "all-MiniLM-L6-v2", 
        dim: exportChunks[0]?.dense?.length || 384, 
        metric: "cosine", 
        normalized: true 
      },
      sparse: { 
        model: "bm25", 
        k1: 1.2, 
        b: 0.75, 
        tokenizer: "unicode_word_lower" 
      },
      fusion: { 
        strategy: "rrf", 
        k: 60 
      },
      source: sources,
      total_chunks: exportChunks.length
    };
    
    // Add files to ZIP
    zip.file("metadata.json", JSON.stringify(metadata, null, 2));
    zip.file("chunks.json", JSON.stringify(exportChunks, null, 2));
    
    const blob = await zip.generateAsync({ type: "blob" });
    postMessage({ type: "exported", blob, filename: `ragpack-hybrid-${timestamp}.zip` } satisfies RAGWorkerResponse);
    return;
  }
}

self.onmessage = async (ev: MessageEvent<RAGWorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === "ingest") return handleIngest(msg.files, msg.chunking, msg.retrieval);
  if (msg.type === "search") return handleSearch(msg.query, msg.topK, msg.mode);
  if (msg.type === "export") return handleExport(msg.kind);
};

// ---------- Dense embedding utilities ----------
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (!a || !b || a.length === 0 || b.length === 0) {


    return 0;
  }
  
  if (a.length !== b.length) {


    return 0;
  }
  
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function ensureEmbedder() {
  if (embedderReady) return embedderReady;
  embedderReady = (async () => {
    try {


      
      // Lazy import to keep initial worker small
      const transformers = await import("@xenova/transformers");
      


      
      const { pipeline, env } = transformers;
      
      if (!pipeline) {
        throw new Error('Pipeline function not found in transformers import');
      }
      
      if (!env) {


      } else {
        // Configure environment to use CDN and avoid local models
        try {


          env.allowLocalModels = false;
          if (env.allowRemoteModels !== undefined) {
            env.allowRemoteModels = true;
          }
          // Use CDN for better reliability
          if (env.remoteHost !== undefined) {
            env.remoteHost = 'https://huggingface.co';
          }
          // Set WASM configuration if available
          if (env.backends?.onnx?.wasm) {
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.simd = true;
          }


        } catch (err) {


        }
      }
      
      const tryModels = [
        "Xenova/all-MiniLM-L6-v2", 
        "Xenova/all-distilroberta-v1",
        "Xenova/gte-small",
        "Xenova/all-MiniLM-L12-v2",
      ];
      
      let lastErr: unknown = null;
      for (const model of tryModels) {
        try {


          
          // @ts-expect-error - assign dynamic global
          self.__embedder = await pipeline("feature-extraction", model, {
            quantized: true,
            progress_callback: (progress: unknown) => {
    
              if (progress && typeof progress === 'object') {

              }
            },
          });
          


          lastErr = null;
          break;
        } catch (e) {


          lastErr = e;
        }
      }
      if (lastErr) throw lastErr;
    } catch (error) {


      throw error;
    }
  })();
  return embedderReady;
}

type TensorLike = { data: Float32Array | number[]; dims: number[] };
type FeatureExtractor = (input: string | string[]) => Promise<TensorLike | TensorLike[]>;

async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const embed = (self as unknown as { __embedder: FeatureExtractor }).__embedder;
  if (!embed) {
    throw new Error('Embedder not initialized');
  }
  
  try {
    const outputs = await embed(texts);
    const out = Array.isArray(outputs) ? outputs : [outputs];
    
    return out.map((t: TensorLike, index: number) => {
      if (!t || !t.data || !t.dims) {
        throw new Error(`Invalid tensor structure for text ${index}: ${JSON.stringify(t)}`);
      }
      
      const data = t.data;
      const dims = t.dims; // [seq, dim] or [1, seq, dim] or [batch, seq, dim]
      
      // Handle different tensor shapes
      let seq: number, dim: number;
      if (dims.length === 3) {
        // [batch, seq, dim] format
        seq = dims[1];
        dim = dims[2];
      } else if (dims.length === 2) {
        // [seq, dim] format
        seq = dims[0];
        dim = dims[1];
      } else {
        throw new Error(`Unexpected tensor dimensions: ${dims}`);
      }
      
      if (seq <= 0 || dim <= 0) {
        throw new Error(`Invalid tensor dimensions: seq=${seq}, dim=${dim}`);
      }
      
      const arr = data instanceof Float32Array ? data : new Float32Array(data);
      const pooled = new Float32Array(dim);
      
      // Mean pooling across sequence dimension
      for (let i = 0; i < seq; i++) {
        for (let j = 0; j < dim; j++) {
          pooled[j] += arr[i * dim + j];
        }
      }
      
      // Normalize by sequence length
      for (let j = 0; j < dim; j++) {
        pooled[j] /= seq;
      }
      
      return pooled;
    });
  } catch (error) {


    throw error;
  }
}


