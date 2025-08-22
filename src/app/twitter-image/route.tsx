import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          color: "#171717",
          fontSize: 64,
          fontWeight: 700,
        }}
      >
        RAGpack
        <div style={{ fontSize: 28, marginTop: 12, fontWeight: 400 }}>
          Local RAG, Zero Backend
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}


