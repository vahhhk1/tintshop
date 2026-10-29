"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Uploads an image to /api/upload and stores the resulting URL in a hidden
 * input named `name`, so it submits with the surrounding form. The URL can
 * also be typed/pasted directly.
 */
export function ImageUpload({
  name,
  defaultValue,
  folder,
  label = "Image",
  onUploaded,
  aspect = "aspect-[16/10]",
}: {
  name: string;
  defaultValue?: string | null;
  folder: "gallery" | "services" | "branding" | "technicians";
  label?: string;
  onUploaded?: (url: string, size: { width: number; height: number } | null) => void;
  aspect?: string;
}) {
  const [url, setUrl] = React.useState(defaultValue ?? "");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(file);
      });
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
      setUrl(json.url);
      onUploaded?.(json.url, size);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-foreground/90">{label}</span>
      <div
        className={cn("relative overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.02]", aspect)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
      >
        {url ? (
          <>
            <Image src={url} alt="" fill sizes="400px" unoptimized className="object-cover" />
            <button
              type="button"
              onClick={() => setUrl("")}
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/70 hover:bg-black"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            {busy ? "Uploading…" : "Click or drop an image (JPEG, PNG, WebP, AVIF · 8 MB)"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} tabIndex={-1} />
      <div className="flex gap-2">
        <Input name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/images/… or https://…" className="h-9 text-xs" aria-label={`${label} URL`} />
        <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 rounded-lg border border-white/10 px-3 text-xs hover:border-white/25" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}
