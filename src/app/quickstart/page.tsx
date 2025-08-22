"use client";

import Link from "next/link";
import { useState } from "react";

type Language = "python" | "javascript" | "go";
type RetrievalType = "chunks" | "sparse" | "dense" | "hybrid";

export default function QuickstartPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("python");
  const [selectedRetrieval, setSelectedRetrieval] = useState<RetrievalType>("sparse");

  const getCode = () => {
    if (selectedLanguage === "python") {
      return getPythonCode(selectedRetrieval);
    } else if (selectedLanguage === "javascript") {
      return getJavaScriptCode(selectedRetrieval);
    } else if (selectedLanguage === "go") {
      return getGoCode(selectedRetrieval);
    }
    return "";
  };

  return (
    <div className="min-h-screen w-full">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80">
            <img src="/ragpack.png" alt="RAGpack" className="h-8 w-8 rounded-md" />
            <div className="text-xl font-semibold">RAGpack</div>
            <span className="ml-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-xs">Local RAG · Zero Backend</span>
          </Link>
          <div className="text-xs opacity-70">Quick Start Guide</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-8">
        <section className="grid gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">RAGpack Quickstart</h1>
            <p className="text-lg opacity-80">Use your exported RAGpack data in your applications</p>
          </div>

          {/* Configuration Selection */}
          <div className="grid gap-6">
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-6">
              <h2 className="text-xl font-semibold mb-4">Configuration</h2>
              
              <div className="grid gap-4">
                <div>
                  <h3 className="font-medium mb-3">Programming Language:</h3>
                  <div className="flex gap-2">
                    {(["python", "javascript", "go"] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={`px-3 py-2 rounded-md border text-sm ${
                          selectedLanguage === lang
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                      >
                        {lang === "javascript" ? "TypeScript/JavaScript" : lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Export Type:</h3>
                  <div className="flex gap-2 flex-wrap">
                    {(["chunks", "sparse", "dense", "hybrid"] as RetrievalType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedRetrieval(type)}
                        className={`px-3 py-2 rounded-md border text-sm ${
                          selectedRetrieval === type
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs opacity-70 mt-2">
                    <strong>Chunks:</strong> Raw text only · 
                    <strong> Sparse:</strong> BM25 keyword search · 
                    <strong> Dense:</strong> Semantic embeddings · 
                    <strong> Hybrid:</strong> Both sparse + dense
                  </div>
                </div>
              </div>
            </div>

            {/* Code Implementation */}
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-6">
              <h2 className="text-xl font-semibold mb-4">
                {selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1)} Implementation - {selectedRetrieval.charAt(0).toUpperCase() + selectedRetrieval.slice(1)} Search
              </h2>
              
              <pre className="text-sm bg-black/5 dark:bg-white/5 p-4 rounded-md font-mono overflow-x-auto">
                {getCode()}
              </pre>
            </div>

            {/* Integration Tips */}
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-6">
              <h2 className="text-xl font-semibold mb-4">Integration Tips</h2>
              <div className="grid gap-4 text-sm">
                {selectedRetrieval === "dense" && (
                  <div>
                    <h3 className="font-medium mb-2">Model Consistency</h3>
                    <p className="opacity-80">Use the same embedding model specified in metadata.json. Default is <code className="bg-black/10 dark:bg-white/10 px-1 rounded">all-MiniLM-L6-v2</code> from Sentence Transformers.</p>
                  </div>
                )}
                
                {selectedRetrieval === "hybrid" && (
                  <div>
                    <h3 className="font-medium mb-2">Hybrid Search</h3>
                    <p className="opacity-80">Combine sparse + dense results using Reciprocal Rank Fusion (RRF) with k=60 for best performance:</p>
                    <pre className="mt-2 bg-black/5 dark:bg-white/5 p-2 rounded text-xs font-mono">
{`def rrf_fusion(sparse_results, dense_results, k=60):
    scores = {}
    for i, result in enumerate(sparse_results):
        scores[result.id] = scores.get(result.id, 0) + 1/(k + i + 1)
    for i, result in enumerate(dense_results):
        scores[result.id] = scores.get(result.id, 0) + 1/(k + i + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)`}
                    </pre>
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-2">Performance Notes</h3>
                  <ul className="opacity-80 space-y-1">
                    {selectedRetrieval === "chunks" && (
                      <>
                        <li>• Raw chunks are fastest to load and search</li>
                        <li>• Use for simple text matching or preprocessing</li>
                        <li>• No semantic understanding - exact keyword matching only</li>
                      </>
                    )}
                    {selectedRetrieval === "sparse" && (
                      <>
                        <li>• Fastest search method (keyword matching)</li>
                        <li>• Great for exact term matching and boolean queries</li>
                        <li>• Works well for technical documentation and code</li>
                      </>
                    )}
                    {selectedRetrieval === "dense" && (
                      <>
                        <li>• Best semantic understanding</li>
                        <li>• Finds conceptually similar content</li>
                        <li>• Requires consistent embedding model</li>
                      </>
                    )}
                    {selectedRetrieval === "hybrid" && (
                      <>
                        <li>• Best overall results combining keyword + semantic</li>
                        <li>• More computation but highest quality</li>
                        <li>• Recommended for production applications</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-10 opacity-70 text-sm">
        <div className="flex items-center gap-3">
          <div>RAGpack - Local RAG processing</div>
          <div>•</div>
          <Link href="/" className="hover:opacity-70">← Back to RAGpack</Link>
        </div>
      </footer>
    </div>
  );
}

// Code generation functions
function getPythonCode(retrieval: RetrievalType): string {
  const baseImports = `import json`;

  const loadDataFunction = `
class RAGPackLoader:
    def __init__(self, metadata_path="metadata.json", chunks_path="chunks.json"):
        self.chunks = []
        self.metadata = {}
        self.load_data(metadata_path, chunks_path)
    
    def load_data(self, metadata_path, chunks_path):
        with open(metadata_path, 'r') as f:
            self.metadata = json.load(f)
        with open(chunks_path, 'r') as f:
            self.chunks = json.load(f)`;

  if (retrieval === "chunks") {
    return `${baseImports}

${loadDataFunction}
    
    def search_text(self, query, top_k=5):
        """Simple text search in raw chunks"""
        query_lower = query.lower()
        results = []
        
        for chunk in self.chunks:
            if query_lower in chunk['text'].lower():
                results.append({
                    'chunk': chunk,
                    'score': chunk['text'].lower().count(query_lower)
                })
        
        # Sort by score (count of matches)
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

# Usage Example
rag = RAGPackLoader("metadata.json", "chunks.json")
results = rag.search_text("machine learning", top_k=3)

for result in results:
    print(f"Score: {result['score']}")
    print(f"Text: {result['chunk']['text'][:100]}...")
    print("---")`;
  }

  if (retrieval === "sparse") {
    return `${baseImports}

${loadDataFunction}
    
    def search_sparse(self, query_terms, top_k=5):
        """Search using BM25/sparse data"""
        scores = []
        for chunk in self.chunks:
            score = 0
            sparse_data = chunk.get('sparse', {})
            for term in query_terms:
                if term.lower() in sparse_data:
                    score += sparse_data[term.lower()]
            scores.append(score)
        
        # Get top k results  
        top_indices = sorted(range(len(scores)), 
                           key=lambda i: scores[i], reverse=True)[:top_k]
        
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                results.append({
                    'chunk': self.chunks[idx],
                    'score': scores[idx]
                })
        
        return results

# Usage Example  
rag = RAGPackLoader("metadata.json", "chunks.json")
results = rag.search_sparse(["machine", "learning"], top_k=3)

for result in results:
    print(f"Score: {result['score']:.3f}")
    print(f"Text: {result['chunk']['text'][:100]}...")
    print("---")`;
  }

  if (retrieval === "dense") {
    return `${baseImports}
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

${loadDataFunction}
    
    def search_dense(self, query_embedding, top_k=5):
        """Search using dense embeddings (cosine similarity)"""
        # Get embeddings
        embeddings = np.array([chunk['dense'] for chunk in self.chunks])
        query_emb = np.array(query_embedding).reshape(1, -1)
        
        # Calculate cosine similarity
        similarities = cosine_similarity(query_emb, embeddings)[0]
        
        # Get top k results
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            results.append({
                'chunk': self.chunks[idx],
                'score': float(similarities[idx])
            })
        
        return results

# Usage Example
rag = RAGPackLoader("metadata.json", "chunks.json")

# Get query embedding from same model (e.g., sentence-transformers)
# from sentence_transformers import SentenceTransformer
# model = SentenceTransformer('all-MiniLM-L6-v2')
# query_emb = model.encode("What is machine learning?")

# results = rag.search_dense(query_emb, top_k=3)
# for result in results:
#     print(f"Score: {result['score']:.3f}")
#     print(f"Text: {result['chunk']['text'][:100]}...")
#     print("---")`;
  }

  if (retrieval === "hybrid") {
    return `${baseImports}
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

${loadDataFunction}
    
    def search_sparse(self, query_terms, top_k=5):
        """Search using BM25/sparse data"""
        scores = []
        for chunk in self.chunks:
            score = 0
            sparse_data = chunk.get('sparse', {})
            for term in query_terms:
                if term.lower() in sparse_data:
                    score += sparse_data[term.lower()]
            scores.append(score)
        
        top_indices = sorted(range(len(scores)), 
                           key=lambda i: scores[i], reverse=True)[:top_k]
        
        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                results.append({
                    'chunk': self.chunks[idx],
                    'score': scores[idx]
                })
        return results
    
    def search_dense(self, query_embedding, top_k=5):
        """Search using dense embeddings"""
        embeddings = np.array([chunk['dense'] for chunk in self.chunks])
        query_emb = np.array(query_embedding).reshape(1, -1)
        similarities = cosine_similarity(query_emb, embeddings)[0]
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            results.append({
                'chunk': self.chunks[idx],
                'score': float(similarities[idx])
            })
        return results
    
    def search_hybrid(self, query_terms, query_embedding, top_k=5, rrf_k=60):
        """Hybrid search using RRF fusion"""
        sparse_results = self.search_sparse(query_terms, top_k * 2)
        dense_results = self.search_dense(query_embedding, top_k * 2)
        
        # RRF fusion
        scores = {}
        for i, result in enumerate(sparse_results):
            chunk_id = result['chunk']['id']
            scores[chunk_id] = scores.get(chunk_id, 0) + 1/(rrf_k + i + 1)
        
        for i, result in enumerate(dense_results):
            chunk_id = result['chunk']['id']
            scores[chunk_id] = scores.get(chunk_id, 0) + 1/(rrf_k + i + 1)
        
        # Get final results
        sorted_ids = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        chunk_map = {chunk['id']: chunk for chunk in self.chunks}
        
        return [{'chunk': chunk_map[chunk_id], 'score': score} 
                for chunk_id, score in sorted_ids]

# Usage Example
rag = RAGPackLoader("metadata.json", "chunks.json")

# Combine keyword and semantic search
query_terms = ["machine", "learning"]
# query_emb = model.encode("What is machine learning?")
# results = rag.search_hybrid(query_terms, query_emb, top_k=3)`;
  }

  return "";
}

function getJavaScriptCode(retrieval: RetrievalType): string {
  const baseImports = `interface RAGChunk {
  id: string;
  text: string;
  dense?: number[];
  sparse?: Record<string, number>;
  doc_id?: string;
  start?: number;
  end?: number;
}

interface RAGMetadata {
  schema_version: string;
  export_type: string;
  created_at: string;
  total_chunks: number;
  source: { path: string }[];
}`;

  const loadDataFunction = `
class RAGPackLoader {
  chunks: RAGChunk[] = [];
  metadata: RAGMetadata | null = null;

  async loadData(metadataPath = "metadata.json", chunksPath = "chunks.json") {
    // Load metadata
    const metadataResponse = await fetch(metadataPath);
    this.metadata = await metadataResponse.json();
    
    // Load chunks
    const chunksResponse = await fetch(chunksPath);
    this.chunks = await chunksResponse.json();
  }`;

  if (retrieval === "chunks") {
    return `${baseImports}

${loadDataFunction}

  searchText(query: string, topK = 5) {
    const queryLower = query.toLowerCase();
    const results = this.chunks
      .map(chunk => ({
        chunk,
        score: (chunk.text.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }
}

// Usage Example
const rag = new RAGPackLoader();
await rag.loadData("metadata.json", "chunks.json");

const results = rag.searchText('machine learning', 3);
results.forEach(result => {
  // Use results as needed
  // result.score contains the relevance score
  // result.chunk.text contains the text content
});`;
  }

  if (retrieval === "sparse") {
    return `${baseImports}

${loadDataFunction}

  searchSparse(queryTerms: string[], topK = 5) {
    const results = this.chunks
      .map(chunk => {
        let score = 0;
        const sparse = chunk.sparse || {};
        queryTerms.forEach(term => {
          if (sparse[term.toLowerCase()]) {
            score += sparse[term.toLowerCase()];
          }
        });
        return { chunk, score };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }
}

// Usage Example
const rag = new RAGPackLoader();
await rag.loadData("metadata.json", "chunks.json");

const results = rag.searchSparse(['machine', 'learning'], 3);
results.forEach(result => {
  // Use results as needed
  // result.score contains the BM25 relevance score
  // result.chunk.text contains the text content
});`;
  }

  if (retrieval === "dense") {
    return `${baseImports}

${loadDataFunction}

  searchDense(queryEmbedding: number[], topK = 5) {
    const results = this.chunks
      .map(chunk => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.dense || [])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Usage Example
const rag = new RAGPackLoader();
await rag.loadData("metadata.json", "chunks.json");

// Get query embedding from same model
// const queryEmb = await getEmbedding("What is machine learning?");
// const results = rag.searchDense(queryEmb, 3);
// results.forEach(result => {
//   // Use results as needed
//   // result.score contains the cosine similarity score
//   // result.chunk.text contains the text content
// });`;
  }

  if (retrieval === "hybrid") {
    return `${baseImports}

${loadDataFunction}

  searchSparse(queryTerms: string[], topK = 5) {
    // Sparse search implementation
    const results = this.chunks
      .map(chunk => {
        let score = 0;
        const sparse = chunk.sparse || {};
        queryTerms.forEach(term => {
          if (sparse[term.toLowerCase()]) {
            score += sparse[term.toLowerCase()];
          }
        });
        return { chunk, score };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return results;
  }

  searchDense(queryEmbedding: number[], topK = 5) {
    // Dense search implementation
    const results = this.chunks
      .map(chunk => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.dense || [])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return results;
  }

  searchHybrid(queryTerms: string[], queryEmbedding: number[], topK = 5, rrfK = 60) {
    // Get both sparse and dense results
    const sparseResults = this.searchSparse(queryTerms, topK * 2);
    const denseResults = this.searchDense(queryEmbedding, topK * 2);
    
    // RRF fusion
    const scores: Record<string, number> = {};
    
    sparseResults.forEach((result, i) => {
      scores[result.chunk.id] = (scores[result.chunk.id] || 0) + 1 / (rrfK + i + 1);
    });
    
    denseResults.forEach((result, i) => {
      scores[result.chunk.id] = (scores[result.chunk.id] || 0) + 1 / (rrfK + i + 1);
    });
    
    // Sort and return top k
    const sortedIds = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topK);
    
    const chunkMap = new Map(this.chunks.map(chunk => [chunk.id, chunk]));
    
    return sortedIds.map(([chunkId, score]) => ({
      chunk: chunkMap.get(chunkId)!,
      score
    }));
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Usage Example
const rag = new RAGPackLoader();
await rag.loadData("metadata.json", "chunks.json");

// Hybrid search
const queryTerms = ['machine', 'learning'];
// const queryEmb = await getEmbedding("What is machine learning?");
// const results = rag.searchHybrid(queryTerms, queryEmb, 3);`;
  }

  return "";
}

function getGoCode(retrieval: RetrievalType): string {
  const baseImports = `package main

import (
    "encoding/json"
    "fmt"
    "math"
    "os"
    "sort"
    "strings"
)

type RAGChunk struct {
    ID     string             \`json:"id"\`
    Text   string             \`json:"text"\`
    Dense  []float64          \`json:"dense,omitempty"\`
    Sparse map[string]float64 \`json:"sparse,omitempty"\`
    DocID  string             \`json:"doc_id,omitempty"\`
    Start  int                \`json:"start,omitempty"\`
    End    int                \`json:"end,omitempty"\`
}

type RAGMetadata struct {
    SchemaVersion string \`json:"schema_version"\`
    ExportType    string \`json:"export_type"\`
    CreatedAt     string \`json:"created_at"\`
    TotalChunks   int    \`json:"total_chunks"\`
}

type RAGPackLoader struct {
    Chunks   []RAGChunk
    Metadata RAGMetadata
}

type SearchResult struct {
    Chunk RAGChunk
    Score float64
}`;

  const loadDataFunction = `
func NewRAGPackLoader(metadataPath, chunksPath string) (*RAGPackLoader, error) {
    loader := &RAGPackLoader{}

    // Load metadata
    metadataData, err := os.ReadFile(metadataPath)
    if err != nil {
        return nil, err
    }
    err = json.Unmarshal(metadataData, &loader.Metadata)
    if err != nil {
        return nil, err
    }

    // Load chunks
    chunksData, err := os.ReadFile(chunksPath)
    if err != nil {
        return nil, err
    }
    err = json.Unmarshal(chunksData, &loader.Chunks)
    if err != nil {
        return nil, err
    }

    return loader, nil
}`;

  if (retrieval === "chunks") {
    return `${baseImports}

${loadDataFunction}

func (r *RAGPackLoader) SearchText(query string, topK int) []SearchResult {
    queryLower := strings.ToLower(query)
    var results []SearchResult
    
    for _, chunk := range r.Chunks {
        textLower := strings.ToLower(chunk.Text)
        count := strings.Count(textLower, queryLower)
        if count > 0 {
            results = append(results, SearchResult{
                Chunk: chunk,
                Score: float64(count),
            })
        }
    }
    
    // Sort by score descending
    sort.Slice(results, func(i, j int) bool {
        return results[i].Score > results[j].Score
    })
    
    if len(results) > topK {
        results = results[:topK]
    }
    
    return results
}

// Usage Example
func main() {
    rag, err := NewRAGPackLoader("metadata.json", "chunks.json")
    if err != nil {
        panic(err)
    }

    results := rag.SearchText("machine learning", 3)
    for _, result := range results {
        fmt.Printf("Score: %.0f\\n", result.Score)
        fmt.Printf("Text: %s...\\n", result.Chunk.Text[:100])
        fmt.Println("---")
    }
}`;
  }

  if (retrieval === "sparse") {
    return `${baseImports}

${loadDataFunction}

func (r *RAGPackLoader) SearchSparse(queryTerms []string, topK int) []SearchResult {
    var results []SearchResult
    for _, chunk := range r.Chunks {
        score := 0.0
        for _, term := range queryTerms {
            if val, exists := chunk.Sparse[strings.ToLower(term)]; exists {
                score += val
            }
        }
        if score > 0 {
            results = append(results, SearchResult{
                Chunk: chunk,
                Score: score,
            })
        }
    }

    // Sort by score descending
    sort.Slice(results, func(i, j int) bool {
        return results[i].Score > results[j].Score
    })

    if len(results) > topK {
        results = results[:topK]
    }

    return results
}

// Usage Example
func main() {
    rag, err := NewRAGPackLoader("metadata.json", "chunks.json")
    if err != nil {
        panic(err)
    }

    results := rag.SearchSparse([]string{"machine", "learning"}, 3)
    for _, result := range results {
        fmt.Printf("Score: %.3f\\n", result.Score)
        fmt.Printf("Text: %s...\\n", result.Chunk.Text[:100])
        fmt.Println("---")
    }
}`;
  }

  if (retrieval === "dense") {
    return `${baseImports}

${loadDataFunction}

func (r *RAGPackLoader) SearchDense(queryEmbedding []float64, topK int) []SearchResult {
    var results []SearchResult
    for _, chunk := range r.Chunks {
        if len(chunk.Dense) > 0 {
            score := cosineSimilarity(queryEmbedding, chunk.Dense)
            results = append(results, SearchResult{
                Chunk: chunk,
                Score: score,
            })
        }
    }

    // Sort by score descending
    sort.Slice(results, func(i, j int) bool {
        return results[i].Score > results[j].Score
    })

    if len(results) > topK {
        results = results[:topK]
    }

    return results
}

func cosineSimilarity(a, b []float64) float64 {
    if len(a) != len(b) {
        return 0
    }

    var dotProduct, normA, normB float64
    for i := range a {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// Usage Example
func main() {
    rag, err := NewRAGPackLoader("metadata.json", "chunks.json")
    if err != nil {
        panic(err)
    }

    // Get query embedding from same model
    // queryEmb := getEmbedding("What is machine learning?")
    // results := rag.SearchDense(queryEmb, 3)
    // for _, result := range results {
    //     fmt.Printf("Score: %.3f\\n", result.Score)
    //     fmt.Printf("Text: %s...\\n", result.Chunk.Text[:100])
    //     fmt.Println("---")
    // }
}`;
  }

  if (retrieval === "hybrid") {
    return `${baseImports}

${loadDataFunction}

func (r *RAGPackLoader) SearchSparse(queryTerms []string, topK int) []SearchResult {
    var results []SearchResult
    for _, chunk := range r.Chunks {
        score := 0.0
        for _, term := range queryTerms {
            if val, exists := chunk.Sparse[strings.ToLower(term)]; exists {
                score += val
            }
        }
        if score > 0 {
            results = append(results, SearchResult{
                Chunk: chunk,
                Score: score,
            })
        }
    }
    sort.Slice(results, func(i, j int) bool {
        return results[i].Score > results[j].Score
    })
    if len(results) > topK {
        results = results[:topK]
    }
    return results
}

func (r *RAGPackLoader) SearchDense(queryEmbedding []float64, topK int) []SearchResult {
    var results []SearchResult
    for _, chunk := range r.Chunks {
        if len(chunk.Dense) > 0 {
            score := cosineSimilarity(queryEmbedding, chunk.Dense)
            results = append(results, SearchResult{
                Chunk: chunk,
                Score: score,
            })
        }
    }
    sort.Slice(results, func(i, j int) bool {
        return results[i].Score > results[j].Score
    })
    if len(results) > topK {
        results = results[:topK]
    }
    return results
}

func (r *RAGPackLoader) SearchHybrid(queryTerms []string, queryEmbedding []float64, topK int, rrfK int) []SearchResult {
    // Get both results
    sparseResults := r.SearchSparse(queryTerms, topK*2)
    denseResults := r.SearchDense(queryEmbedding, topK*2)
    
    // RRF fusion
    scores := make(map[string]float64)
    
    for i, result := range sparseResults {
        scores[result.Chunk.ID] += 1.0 / float64(rrfK+i+1)
    }
    
    for i, result := range denseResults {
        scores[result.Chunk.ID] += 1.0 / float64(rrfK+i+1)
    }
    
    // Convert to results and sort
    var finalResults []SearchResult
    chunkMap := make(map[string]RAGChunk)
    for _, chunk := range r.Chunks {
        chunkMap[chunk.ID] = chunk
    }
    
    for chunkID, score := range scores {
        finalResults = append(finalResults, SearchResult{
            Chunk: chunkMap[chunkID],
            Score: score,
        })
    }
    
    sort.Slice(finalResults, func(i, j int) bool {
        return finalResults[i].Score > finalResults[j].Score
    })
    
    if len(finalResults) > topK {
        finalResults = finalResults[:topK]
    }
    
    return finalResults
}

func cosineSimilarity(a, b []float64) float64 {
    if len(a) != len(b) {
        return 0
    }
    var dotProduct, normA, normB float64
    for i := range a {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// Usage Example
func main() {
    rag, err := NewRAGPackLoader("metadata.json", "chunks.json")
    if err != nil {
        panic(err)
    }

    queryTerms := []string{"machine", "learning"}
    // queryEmb := getEmbedding("What is machine learning?")
    // results := rag.SearchHybrid(queryTerms, queryEmb, 3, 60)
}`;
  }

  return "";
}