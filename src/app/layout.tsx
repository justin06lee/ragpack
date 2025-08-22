import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }],
  colorScheme: "light dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://ragpack.top"),
  title: {
    default: "RAGpack - FREE, FULLY PRIVATE + LOCAL document chunking / ingestion for RAG",
    template: "%s · RAGpack",
  },
  description:
    "Drag & drop docs → parse, chunk, embed, and retrieve locally in your browser. (FREE, FULLY LOCAL)",
  applicationName: "RAGpack",
  authors: [{ name: "RAGpack" }],
  keywords: [
    "RAG document ingestion",
    "RAG document chunking",
    "RAG indexing",
    "RAG data pipeline",
    "dense retrieval",
    "sparse retrieval",
    "hybrid search",
    "text splitting",
    "document embedding",
    "vector database ingestion",
    "LLM knowledge base",
    "AI document preprocessor",
    "LangChain ingestion",
    "LlamaIndex chunking",
    "ragpack",
    "rag chunker"
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "RAGpack",
    title: "RAGpack — FREE, FULLY PRIVATE + LOCAL document chunking / ingestion for RAG",
    description:
      "Drag & drop docs → parse, chunk, embed, and retrieve locally in your browser. (FREE, FULLY LOCAL)",
    images: [{ url: "/opengraph-image" }],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "RAGpack — FREE, FULLY PRIVATE + LOCAL document chunking / ingestion for RAG",
    description:
      "Drag & drop docs → parse, chunk, embed, and retrieve locally in your browser. (FREE, FULLY LOCAL)",
    images: ["/twitter-image"],
    creator: "@ragpack",
  },
  category: "technology",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/ragpack.ico" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "RAGpack",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              url: "https://ragpack.top",
              description:
                "Client-only app to parse, chunk, embed, and retrieve documents locally in the browser.",
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
