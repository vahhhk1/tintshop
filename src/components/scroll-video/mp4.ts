/**
 * Just enough MP4 parsing to feed the homepage film to WebCodecs: the first video track's
 * decoder config and the byte range of every frame.
 *
 * Only all-intra H.264 is accepted (every sample a sync sample, no composition offsets),
 * because the decoded film decodes frames one by one, in any order. Anything else throws,
 * and the stage falls back to seeking a <video>.
 */
export interface FilmTrack {
  /** WebCodecs codec string, e.g. `avc1.641028`. */
  codec: string;
  /** avcC record (SPS/PPS) for `VideoDecoderConfig.description`. */
  description: Uint8Array;
  width: number;
  height: number;
  /** Byte range of each frame in the file, in presentation order. */
  frames: { offset: number; size: number }[];
  /** Microseconds per frame. */
  frameDuration: number;
}

interface Box {
  type: string;
  /** Payload start (after the header) and end. */
  start: number;
  end: number;
}

export function parseFilm(bytes: Uint8Array): FilmTrack {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (p: number) => view.getUint32(p);
  const fourcc = (p: number) => String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);

  const children = (parent: Box, from = parent.start) => {
    const boxes: Box[] = [];
    for (let p = from; p + 8 <= parent.end; ) {
      let size = u32(p);
      let header = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(p + 8));
        header = 16;
      } else if (size === 0) {
        size = parent.end - p;
      }
      if (size < header || p + size > parent.end) throw new Error("Malformed MP4 box");
      boxes.push({ type: fourcc(p + 4), start: p + header, end: p + size });
      p += size;
    }
    return boxes;
  };
  const find = (parent: Box, type: string) => children(parent).find((b) => b.type === type);
  const need = (parent: Box, ...path: string[]) =>
    path.reduce((box, type) => {
      const child = find(box, type);
      if (!child) throw new Error(`MP4 is missing ${type}`);
      return child;
    }, parent);

  const moov = need({ type: "file", start: 0, end: bytes.byteLength }, "moov");
  const trak = children(moov)
    .filter((b) => b.type === "trak")
    .find((t) => fourcc(need(t, "mdia", "hdlr").start + 8) === "vide");
  if (!trak) throw new Error("MP4 has no video track");

  const mdhd = need(trak, "mdia", "mdhd").start;
  const timescale = u32(mdhd + (bytes[mdhd] === 1 ? 20 : 12));
  const stbl = need(trak, "mdia", "minf", "stbl");

  // Sample description: avc1/avc3 visual sample entry → avcC.
  const entry = children(need(stbl, "stsd"), need(stbl, "stsd").start + 8)[0];
  if (!entry || (entry.type !== "avc1" && entry.type !== "avc3")) throw new Error("Film is not H.264");
  const width = view.getUint16(entry.start + 24);
  const height = view.getUint16(entry.start + 26);
  const avcC = children(entry, entry.start + 78).find((b) => b.type === "avcC");
  if (!avcC) throw new Error("MP4 is missing avcC");
  const description = bytes.slice(avcC.start, avcC.end);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const codec = `avc1.${hex(description[1])}${hex(description[2])}${hex(description[3])}`;

  // Sample sizes.
  const stsz = need(stbl, "stsz").start;
  const uniform = u32(stsz + 4);
  const count = u32(stsz + 8);
  const sizes = Array.from({ length: count }, (_, i) => uniform || u32(stsz + 12 + i * 4));

  // Random access: every frame must decode on its own.
  const stss = find(stbl, "stss");
  if (stss && u32(stss.start + 4) !== count) throw new Error("Film is not all-intra");
  if (find(stbl, "ctts")) throw new Error("Film has reordered frames");

  // Chunk offsets and the samples-per-chunk runs → each sample's offset.
  const co64 = find(stbl, "co64");
  const stco = co64 ?? need(stbl, "stco");
  const chunkCount = u32(stco.start + 4);
  const chunkOffset = (i: number) =>
    co64 ? Number(view.getBigUint64(stco.start + 8 + i * 8)) : u32(stco.start + 8 + i * 4);
  const stsc = need(stbl, "stsc").start;
  const runs = Array.from({ length: u32(stsc + 4) }, (_, i) => ({
    firstChunk: u32(stsc + 8 + i * 12) - 1,
    perChunk: u32(stsc + 12 + i * 12),
  }));

  const frames: FilmTrack["frames"] = [];
  for (let chunk = 0, run = 0; chunk < chunkCount && frames.length < count; chunk++) {
    while (run + 1 < runs.length && runs[run + 1].firstChunk <= chunk) run++;
    let offset = chunkOffset(chunk);
    for (let s = 0; s < runs[run].perChunk && frames.length < count; s++) {
      const size = sizes[frames.length];
      if (offset + size > bytes.byteLength) throw new Error("MP4 sample out of range");
      frames.push({ offset, size });
      offset += size;
    }
  }
  if (frames.length !== count) throw new Error("MP4 sample table is incomplete");

  const delta = u32(need(stbl, "stts").start + 12);
  return { codec, description, width, height, frames, frameDuration: (delta / timescale) * 1e6 };
}
