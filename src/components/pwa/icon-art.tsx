/** Brand mark rendered by next/og ImageResponse for favicons and PWA icons. */
export function IconArt({ size, padding = 0.18, rounded = true }: { size: number; padding?: number; rounded?: boolean }) {
  const inner = size * (1 - padding * 2);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0b",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <svg width={inner} height={inner} viewBox="0 0 32 32">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f8cf7a" />
            <stop offset="1" stopColor="#c98a1c" />
          </linearGradient>
        </defs>
        <path d="M5 23 12 6h16L21 23H5Z" fill="url(#g)" />
        <path d="M8.6 23 14.5 9h4.1L12.7 23H8.6Z" fill="#0a0a0b" opacity="0.55" />
        <rect x="5" y="25.5" width="23" height="2" rx="1" fill="#ffffff" opacity="0.2" />
      </svg>
    </div>
  );
}
