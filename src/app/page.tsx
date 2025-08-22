"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type IngestFile = { path: string; text: string };
type SearchResult = { chunk: { id: string; docId: string; text: string; charStart: number; charEnd: number }; score: number };
type ChunkingMethod =
	| { kind: "fixed_tokens"; maxTokens: number }
	| { kind: "sliding_tokens"; maxTokens: number; overlapTokens: number }
	| { kind: "sent_paragraph"; targetChars: number; sentenceOverlap?: number }
	| { kind: "recursive"; targetChars: number }
	| { kind: "semantic" }
	| { kind: "pdf_layout" }
	| { kind: "ocr_tables" };

export default function Home() {
	const workerRef = useRef<Worker | null>(null);
	const folderInputRef = useRef<HTMLInputElement | null>(null);
	const filesInputRef = useRef<HTMLInputElement | null>(null);

	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [isIngesting, setIsIngesting] = useState(false);
	const [ingestStats, setIngestStats] = useState<{ docs: number; chunks: number } | null>(null);
	const [totalChunks, setTotalChunks] = useState(0);
	const [query, setQuery] = useState("");
	const [topK, setTopK] = useState(8);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [statusMsg, setStatusMsg] = useState<string | null>(null);
	const [mode, setMode] = useState<"sparse" | "dense" | "hybrid">("sparse");
	const [chunkMethod, setChunkMethod] = useState<ChunkingMethod>({ kind: "sliding_tokens", maxTokens: 220, overlapTokens: 40 });
	const [embedderState, setEmbedderState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
	const [embeddingPlanned, setEmbeddingPlanned] = useState(0);
	const [embeddingBuilt, setEmbeddingBuilt] = useState(0);
	const [completedIngestions, setCompletedIngestions] = useState<Set<"sparse" | "dense" | "hybrid">>(new Set());
	const [currentlyProcessing, setCurrentlyProcessing] = useState<"sparse" | "dense" | "hybrid" | null>(null);
	const currentlyProcessingRef = useRef<"sparse" | "dense" | "hybrid" | null>(null);

	useEffect(() => {
		// Ensure folder selection supports directories without TypeScript JSX attributes
		if (folderInputRef.current) {
			folderInputRef.current.setAttribute("webkitdirectory", "");
			folderInputRef.current.setAttribute("directory", "");
			folderInputRef.current.multiple = true;
		}
	}, []);

	useEffect(() => {
		const w = new Worker(new URL("../workers/rag.worker.ts", import.meta.url), { type: "module" });
		workerRef.current = w;
		w.onmessage = (ev: MessageEvent) => {
			const data = ev.data as
				| { type: "ingested"; stats: { docs: number; chunks: number } }
				| { type: "searchResults"; results: SearchResult[] }
				| { type: "exported"; blob: Blob; filename?: string }
				| { type: "status"; message: string }
				| { type: "embedderLoading" }
				| { type: "embedderReady" }
				| { type: "embedderFailed"; message?: string }
				| { type: "embeddingStarted"; total: number }
				| { type: "embeddingsBuilt"; count: number };
			if (data.type === "ingested") {
				setIsIngesting(false);
				setIngestStats(data.stats);
				setStatusMsg(`Ingested ${data.stats.docs} docs → ${data.stats.chunks} chunks`);
				setTotalChunks((c) => c + data.stats.chunks);

				// Only mark sparse-only ingestions as complete immediately
				// Dense/hybrid will be completed when embeddings finish
				const currentProcessing = currentlyProcessingRef.current;
				if (currentProcessing === "sparse") {
					setCompletedIngestions(prev => new Set([...prev, currentProcessing]));
					setCurrentlyProcessing(null);
					currentlyProcessingRef.current = null;
				}
			} else if (data.type === "searchResults") {
				setResults(data.results);
			} else if (data.type === "exported") {
				const url = URL.createObjectURL(data.blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = data.filename || "dataset.ragpkg";
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			} else if (data.type === "status") {
				setStatusMsg(data.message);
			} else if (data.type === "embedderLoading") {
				setEmbedderState((s) => (s === "idle" ? "loading" : s));
				setStatusMsg("Downloading embedding model… (first time takes ~30-60 seconds)");
			} else if (data.type === "embedderReady") {
				setEmbedderState("ready");
				setStatusMsg("Embedding model loaded! Now building dense embeddings for your documents…");
			} else if (data.type === "embedderFailed") {
				setEmbedderState("failed");
				setStatusMsg(data.message || "Embedding model failed to load.");
			} else if (data.type === "embeddingStarted") {
				setEmbeddingPlanned(data.total);
				setStatusMsg("Building dense embeddings… This enables semantic search!");
			} else if (data.type === "embeddingsBuilt") {
				setEmbeddingBuilt((prevCount) => prevCount + data.count);
			}
		};
		return () => {
			w.terminate();
		};
	}, []);

	// Update status when embedding progress changes
	useEffect(() => {
		if (embeddingPlanned > 0 && embeddingBuilt > 0) {
			if (embeddingBuilt >= embeddingPlanned) {
				setStatusMsg("Dense embeddings complete! You can now use Dense and Hybrid search modes.");
				// Mark dense/hybrid ingestions as complete when embeddings finish
				const currentProcessing = currentlyProcessingRef.current;
				if (currentProcessing === "dense" || currentProcessing === "hybrid") {
					setCompletedIngestions(prev => new Set([...prev, currentProcessing]));
					setCurrentlyProcessing(null);
					currentlyProcessingRef.current = null;
				}
			} else {
				setStatusMsg(`Building dense embeddings… ${embeddingBuilt}/${embeddingPlanned} complete`);
			}
		}
	}, [embeddingBuilt, embeddingPlanned]);

	const onFileInputChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const files = ev.target.files ? Array.from(ev.target.files) : [];
		setSelectedFiles(files);
	}, []);

	const onDrop = useCallback((ev: React.DragEvent<HTMLDivElement>) => {
		ev.preventDefault();
		const files = ev.dataTransfer.files ? Array.from(ev.dataTransfer.files) : [];
		setSelectedFiles(files);
	}, []);

	const onDragOver = useCallback((ev: React.DragEvent<HTMLDivElement>) => {
		ev.preventDefault();
	}, []);

	const selectedPreview = useMemo(() => {
		if (!selectedFiles.length) return "No files selected";
		const names = selectedFiles.slice(0, 5).map((f) => f.webkitRelativePath || f.name);
		const more = selectedFiles.length > 5 ? ` +${selectedFiles.length - 5} more` : "";
		return names.join(", ") + more;
	}, [selectedFiles]);

	const readAllowedTextFiles = useCallback(async (files: File[]): Promise<IngestFile[]> => {
		const allowed = new Set(["text/plain", "text/markdown", "text/x-markdown", "application/json"]);
		const picked = files.filter((f) => allowed.has(f.type) || f.name.endsWith(".md") || f.name.endsWith(".txt") || f.name.endsWith(".json"));
		const results: IngestFile[] = [];
		for (const f of picked) {
			try {
				const text = await f.text();
				const withRel = f as File & { webkitRelativePath?: string };
				const path = withRel.webkitRelativePath ?? f.name;
				results.push({ path, text });
			} catch {
				// skip unreadable
			}
		}
		return results;
	}, []);

	const handleIngest = useCallback(async () => {
		if (!workerRef.current) return;
		setIsIngesting(true);
		setCurrentlyProcessing(mode);
		currentlyProcessingRef.current = mode;
		// Reset embedding counters for new ingestion
		setEmbeddingPlanned(0);
		setEmbeddingBuilt(0);
		setStatusMsg("Parsing and chunking...");
		const files = await readAllowedTextFiles(selectedFiles);
		if (!files.length) {
			setIsIngesting(false);
			setStatusMsg("No supported files found. Supported: .txt, .md, .json");
			return;
		}
		const allowed: Extract<ChunkingMethod, { kind: "fixed_tokens" | "sliding_tokens" | "sent_paragraph" | "recursive" }> =
			chunkMethod.kind === "fixed_tokens" || chunkMethod.kind === "sliding_tokens" || chunkMethod.kind === "sent_paragraph" || chunkMethod.kind === "recursive"
				? (chunkMethod as Extract<ChunkingMethod, { kind: "fixed_tokens" | "sliding_tokens" | "sent_paragraph" | "recursive" }>)
				: { kind: "sliding_tokens", maxTokens: 220, overlapTokens: 40 };
		workerRef.current.postMessage({ type: "ingest", files, chunking: allowed, retrieval: mode });
	}, [readAllowedTextFiles, selectedFiles, chunkMethod, mode]);

	const handleSearch = useCallback((ev: React.FormEvent) => {
		ev.preventDefault();
		if (!workerRef.current) return;
		if (!query.trim()) return;
		if ((mode === "dense" || mode === "hybrid") && (embedderState !== "ready" || embeddingBuilt < embeddingPlanned)) {
			const reason = embedderState !== "ready"
				? "embedding model is loading"
				: "embeddings are still being processed";
			setStatusMsg(`Dense/Hybrid unavailable while ${reason}. Switching to Sparse search...`);
			setMode("sparse");
			return;
		}
		workerRef.current.postMessage({ type: "search", query: query.trim(), topK, mode });
	}, [query, topK, mode, embedderState, embeddingBuilt, embeddingPlanned]);

	const handleExport = useCallback((kind: "sparse" | "dense" | "hybrid" | "chunks") => {
		if (!workerRef.current) return;
		workerRef.current.postMessage({ type: "export", kind });
	}, []);

	return (
		<div className="min-h-screen w-full">
			<header className="border-b border-black/10 dark:border-white/10">
				<div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<img src="/ragpack.png" alt="RAGpack" className="h-8 w-8 rounded-md" />
						<div className="text-xl font-semibold">RAGpack</div>
						<span className="ml-2 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 text-xs">Local RAG · Zero Backend</span>
					</div>
					<div className="text-xs opacity-70">All processing happens in your browser</div>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-6 py-8 grid gap-8">
				<section className="grid gap-4">
					<h2 className="text-lg font-semibold">1) Ingest documents</h2>
					<div className="flex flex-wrap items-center gap-2">
						<div className="text-sm opacity-70">Chunking:</div>
						<button
							className={`px-2 py-1 rounded-md border text-sm ${chunkMethod.kind === "fixed_tokens" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
							onClick={() => setChunkMethod({ kind: "fixed_tokens", maxTokens: 220 })}
						>
							Fixed length
						</button>
						<button
							className={`px-2 py-1 rounded-md border text-sm ${chunkMethod.kind === "sliding_tokens" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
							onClick={() => setChunkMethod({ kind: "sliding_tokens", maxTokens: 220, overlapTokens: 40 })}
						>
							Sliding window
						</button>
						<button
							className={`px-2 py-1 rounded-md border text-sm ${chunkMethod.kind === "sent_paragraph" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
							onClick={() => setChunkMethod({ kind: "sent_paragraph", targetChars: 800, sentenceOverlap: 1 })}
						>
							Sentence/paragraph
						</button>
						<button
							className={`px-2 py-1 rounded-md border text-sm ${chunkMethod.kind === "recursive" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
							onClick={() => setChunkMethod({ kind: "recursive", targetChars: 800 })}
						>
							Recursive
						</button>
						<button className="px-2 py-1 rounded-md border text-sm border-black/10 dark:border-white/10 opacity-60 cursor-not-allowed">
							Semantic split
							<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-500/20">Experimental</span>
						</button>
						<button className="px-2 py-1 rounded-md border text-sm border-black/10 dark:border-white/10 opacity-60 cursor-not-allowed">
							PDF layout-aware
							<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">Pro</span>
						</button>
						<button className="px-2 py-1 rounded-md border text-sm border-black/10 dark:border-white/10 opacity-60 cursor-not-allowed">
							OCR / tables
							<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">Pro</span>
						</button>
					</div>
					{chunkMethod.kind === "fixed_tokens" && (
						<div className="flex flex-wrap items-end gap-3 mt-2">
							<label className="text-sm">
								<div className="opacity-70 mb-1">Max tokens</div>
								<input
									type="number"
									min={1}
									value={chunkMethod.maxTokens}
									onChange={(e) => {
										const v = Math.max(1, Number(e.target.value || 0));
										setChunkMethod({ kind: "fixed_tokens", maxTokens: v });
									}}
									className="w-28 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
								/>
							</label>
							<button
								type="button"
								className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-sm"
								onClick={() => setChunkMethod({ kind: "fixed_tokens", maxTokens: 220 })}
							>
								Reset to recommended
							</button>
						</div>
					)}
					{chunkMethod.kind === "sliding_tokens" && (
						<div className="flex flex-wrap items-end gap-3 mt-2">
							<label className="text-sm">
								<div className="opacity-70 mb-1">Max tokens</div>
								<input
									type="number"
									min={1}
									value={chunkMethod.maxTokens}
									onChange={(e) => {
										const v = Math.max(1, Number(e.target.value || 0));
										const ov = Math.min(chunkMethod.overlapTokens, Math.max(0, v - 1));
										setChunkMethod({ kind: "sliding_tokens", maxTokens: v, overlapTokens: ov });
									}}
									className="w-28 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
								/>
							</label>
							<label className="text-sm">
								<div className="opacity-70 mb-1">Overlap tokens</div>
								<input
									type="number"
									min={0}
									max={Math.max(0, chunkMethod.maxTokens - 1)}
									value={chunkMethod.overlapTokens}
									onChange={(e) => {
										const v = Math.max(0, Number(e.target.value || 0));
										const capped = Math.min(v, Math.max(0, chunkMethod.maxTokens - 1));
										setChunkMethod({ kind: "sliding_tokens", maxTokens: chunkMethod.maxTokens, overlapTokens: capped });
									}}
									className="w-28 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
								/>
							</label>
							<button
								type="button"
								className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-sm"
								onClick={() => setChunkMethod({ kind: "sliding_tokens", maxTokens: 220, overlapTokens: 40 })}
							>
								Reset to recommended
							</button>
						</div>
					)}
					{chunkMethod.kind === "sent_paragraph" && (
						<div className="flex flex-wrap items-end gap-3 mt-2">
							<label className="text-sm">
								<div className="opacity-70 mb-1">Target chars</div>
								<input
									type="number"
									min={100}
									value={chunkMethod.targetChars}
									onChange={(e) => setChunkMethod({ kind: "sent_paragraph", targetChars: Math.max(100, Number(e.target.value || 0)), sentenceOverlap: chunkMethod.sentenceOverlap ?? 0 })}
									className="w-32 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
								/>
							</label>
							<label className="text-sm">
								<div className="opacity-70 mb-1">Sentence overlap</div>
								<input
									type="number"
									min={0}
									max={3}
									value={chunkMethod.sentenceOverlap ?? 0}
									onChange={(e) => setChunkMethod({ kind: "sent_paragraph", targetChars: chunkMethod.targetChars, sentenceOverlap: Math.max(0, Math.min(3, Number(e.target.value || 0))) })}
									className="w-28 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
								/>
							</label>
							<button
								type="button"
								className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-sm"
								onClick={() => setChunkMethod({ kind: "sent_paragraph", targetChars: 800, sentenceOverlap: 1 })}
							>
								Reset to recommended
							</button>
						</div>
					)}
					{chunkMethod.kind === "recursive" && (
						<div className="flex flex-wrap items-end gap-3 mt-2">
							<label className="text-sm">
								<div className="opacity-70 mb-1">Target chars</div>
								<input
									type="number"
									min={100}
									value={chunkMethod.targetChars}
									onChange={(e) => setChunkMethod({ kind: "recursive", targetChars: Math.max(100, Number(e.target.value || 0)) })}
									className="w-32 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
								/>
							</label>
							<button
								type="button"
								className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-sm"
								onClick={() => setChunkMethod({ kind: "recursive", targetChars: 800 })}
							>
								Reset to recommended
							</button>
						</div>
					)}

					<div className="border-t border-black/10 dark:border-white/10 pt-4 mt-4">
						<div className="flex flex-wrap items-center gap-2 mb-3">
							<div className="text-sm font-medium">Retrieval Method:</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<button
								className={`px-2 py-1 rounded-md border text-sm ${mode === "sparse" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
								onClick={() => setMode("sparse")}
							>
								Sparse (BM25)
							</button>
							<button
								className={`px-2 py-1 rounded-md border text-sm ${mode === "dense" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
								onClick={() => setMode("dense")}
							>
								Dense
								<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">Free</span>
							</button>
							<button
								className={`px-2 py-1 rounded-md border text-sm ${mode === "hybrid" ? "bg-black text-white dark:bg-white dark:text-black" : "border-black/10 dark:border-white/10"}`}
								onClick={() => setMode("hybrid")}
							>
								Hybrid
								<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">Free</span>
							</button>

							<button className="px-2 py-1 rounded-md border text-sm border-black/10 dark:border-white/10 opacity-60 cursor-not-allowed">
								Cross-encoder reranking
								<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-500/20">Experimental</span>
							</button>
							<button className="px-2 py-1 rounded-md border text-sm border-black/10 dark:border-white/10 opacity-60 cursor-not-allowed">
								Large-scale ANN (HNSW/IVF)
								<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">Pro</span>
							</button>
							<button className="px-2 py-1 rounded-md border text-sm border-black/10 dark:border-white/10 opacity-60 cursor-not-allowed">
								Learning-to-rank / advanced fusion
								<span className="ml-2 rounded-full text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">Pro</span>
							</button>
						</div>
					</div>

					<div
						onDrop={onDrop}
						onDragOver={onDragOver}
						className="rounded-lg border border-dashed border-black/20 dark:border-white/20 p-6 text-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
					>
						<div className="font-medium">Drag & drop files here</div>
						<div className="text-sm opacity-70 mt-1">or choose a folder</div>
						<div className="mt-4 flex items-center justify-center gap-3">
							<label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
								<input ref={folderInputRef} type="file" onChange={onFileInputChange} className="hidden" />
								<span className="text-sm">Choose folder</span>
							</label>
							<label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5">
								<input ref={filesInputRef} type="file" multiple onChange={onFileInputChange} className="hidden" />
								<span className="text-sm">Choose files</span>
							</label>
							<button
								className="px-3 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
								disabled={!selectedFiles.length || isIngesting || !chunkMethod || !mode}
								onClick={handleIngest}
							>
								{isIngesting ? "Ingesting..." : "Ingest"}
							</button>
						</div>
						<div className="mt-3 text-xs opacity-70">{selectedPreview}</div>
						{statusMsg && <div className="mt-2 text-sm">{statusMsg}</div>}
						{ingestStats && (
							<div className="mt-2 text-sm">
								<span className="font-mono">{ingestStats.docs}</span> docs · <span className="font-mono">{ingestStats.chunks}</span> chunks
							</div>
						)}
					</div>
				</section>

				<section className="grid gap-4">
					<h2 className="text-lg font-semibold">2) Search & Export</h2>
					<form onSubmit={handleSearch} className="flex items-center gap-2">
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Ask or search..."
							className="flex-1 px-3 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
						/>
						<input
							type="number"
							min={1}
							max={50}
							value={topK}
							onChange={(e) => setTopK(Number(e.target.value))}
							className="w-20 px-2 py-2 rounded-md border border-black/10 dark:border-white/10 bg-transparent"
							title="Top K"
						/>
						<button className="px-3 py-2 rounded-md bg-black text-white dark:bg-white dark:text-black" disabled={(mode !== "sparse" && (embedderState !== "ready" || embeddingBuilt < embeddingPlanned))}>Search</button>
					</form>

					<div className="grid gap-3">
						{results.length === 0 && (
							<div className="text-sm opacity-70">
								{embedderState === "loading" ? "Downloading embedding model… Dense/Hybrid search will be available soon!" :
									embedderState === "ready" && embeddingBuilt < embeddingPlanned ? "Building embeddings… Dense/Hybrid search will be ready shortly!" :
										"No results yet. Try searching for something!"}
							</div>
						)}
						{(embeddingPlanned > 0 || embeddingBuilt > 0) && (
							<div className="text-xs opacity-70">
								{embeddingBuilt < embeddingPlanned ? (
									<span>Processing embeddings: {embeddingBuilt}/{embeddingPlanned} chunks</span>
								) : embeddingBuilt > 0 ? (
									<span>Dense embeddings ready: {embeddingBuilt} chunks</span>
								) : (
									<span>Preparing embeddings…</span>
								)}
							</div>
						)}
						{results.map((r) => (
							<div key={r.chunk.id} className="rounded-md border border-black/10 dark:border-white/10 p-3">
								<div className="text-xs opacity-70 mb-1">{r.chunk.docId} · score {r.score.toFixed(3)}</div>
								<div className="whitespace-pre-wrap text-sm">{r.chunk.text}</div>
							</div>
						))}
					</div>
				</section>

				{(completedIngestions.size > 0 || ingestStats) && (
					<section className="grid gap-4">
						<h2 className="text-lg font-semibold">3) Export</h2>
						<div className="flex items-center gap-3 flex-wrap">
							{/* Always show chunks export if we have any ingested data */}
							{ingestStats && (
								<button
									className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
									onClick={() => handleExport("chunks")}
								>
									Export Chunks (.zip)
								</button>
							)}

							{/* Show processed data exports */}
							{Array.from(completedIngestions).map((type) => (
								<button
									key={type}
									className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
									onClick={() => handleExport(type)}
								>
									Export {type.charAt(0).toUpperCase() + type.slice(1)} (.zip)
								</button>
							))}
							<div className="text-xs opacity-70">Export your data as ZIP files with metadata.json and chunks.json. Chunks = raw text, others include processed embeddings/indices.</div>
						</div>
					</section>
				)}

				{/* Quickstart Section */}
				{(completedIngestions.size > 0 || ingestStats) && (
					<section className="grid gap-4">
						<h2 className="text-lg font-semibold">4) Quickstart</h2>
						<div className="flex items-center gap-3 flex-wrap">
							<a
								href="/quickstart"
								target="_blank"
								rel="noopener noreferrer"
								className="px-3 py-2 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 inline-flex items-center gap-2"
							>
								<span>View Code Examples</span>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
							</a>
							<div className="text-xs opacity-70">
								Python, TypeScript, and Go examples for using your exported RAGpack data in your applications.
							</div>
						</div>
					</section>
				)}
			</main>

			<footer className="mx-auto max-w-5xl px-6 py-10 opacity-70 text-sm">
				<div className="flex items-center gap-3">
					<div>
						<a href="https://github.com/sehnsucht-nach-einer-ehefrau/ragpack" target="_blank" rel="noopener noreferrer">GitHub</a>
						<span className="mx-2">·</span>
						<a href="https://buymeacoffee.com/sehnsucht" target="_blank" rel="noopener noreferrer">Buy me a coffee</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
