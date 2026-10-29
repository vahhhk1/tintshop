import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { isSameOrigin, rateLimit } from "@/lib/rate-limit";
import { UploadError, uploadImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const FOLDERS = ["gallery", "services", "branding", "technicians", "uploads"] as const;
type Folder = (typeof FOLDERS)[number];

/** Admin image upload (multipart/form-data: file, folder). Returns { url }. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user || !(can(user.role, "gallery:manage") || can(user.role, "services:manage") || can(user.role, "settings:business"))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const limit = await rateLimit(`upload:${user.id}`, 60, 60 * 10);
  if (!limit.success) return NextResponse.json({ error: "Too many uploads — please wait a few minutes." }, { status: 429 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  const folderRaw = String(form.get("folder") ?? "uploads");
  const folder: Folder = (FOLDERS as readonly string[]).includes(folderRaw) ? (folderRaw as Folder) : "uploads";
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });

  try {
    const stored = await uploadImage(file, folder);
    return NextResponse.json({ url: stored.url });
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[upload] failed", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
