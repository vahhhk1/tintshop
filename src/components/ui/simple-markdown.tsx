import * as React from "react";

/**
 * Renders a small, safe subset of Markdown (## headings, - lists, **bold**, paragraphs)
 * as React elements. No raw HTML is ever injected, so admin-edited content is safe.
 */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>));
}

export function SimpleMarkdown({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="grid gap-5 text-[16px] leading-relaxed text-foreground/80">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (!lines.length) return null;
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={i} className="grid list-disc gap-2 pl-5 marker:text-primary">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        const first = lines[0]!;
        const heading = first.match(/^(#{2,3})\s+(.*)$/);
        if (heading) {
          const rest = lines.slice(1);
          const Tag = heading[1] === "##" ? "h2" : "h3";
          return (
            <React.Fragment key={i}>
              <Tag className="mt-4 text-xl font-semibold text-foreground">{heading[2]}</Tag>
              {rest.length > 0 &&
                (rest.every((l) => /^\s*[-*]\s+/.test(l)) ? (
                  <ul className="grid list-disc gap-2 pl-5 marker:text-primary">
                    {rest.map((l, j) => (
                      <li key={j}>{inline(l.replace(/^\s*[-*]\s+/, ""))}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{inline(rest.join(" "))}</p>
                ))}
            </React.Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
