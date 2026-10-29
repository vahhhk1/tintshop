"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0a0b", color: "#f5f5f4", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p style={{ color: "#a1a1aa" }}>Please refresh the page or try again shortly.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 999, border: 0, background: "#f5b544", color: "#1a1206", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
