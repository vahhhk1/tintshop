import { ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { centsToDollarsInput } from "@/lib/utils";
import { saveServiceAction } from "@/server/admin/catalog";

export interface ServiceFormValues {
  id?: string;
  name: string;
  slug: string;
  category: string;
  tagline: string | null;
  shortDescription: string;
  description: string;
  benefits: string[];
  features: string[];
  imageUrl: string | null;
  startingPrice: number;
  durationMinutes: number;
  durationLabel: string | null;
  warranty: string | null;
  usesFilm: boolean;
  filmTypeId: string | null;
  parentId: string | null;
  depositAmount: number | null;
  bookable: boolean;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export const emptyService: ServiceFormValues = {
  name: "",
  slug: "",
  category: "WINDOW_TINT",
  tagline: null,
  shortDescription: "",
  description: "",
  benefits: [],
  features: [],
  imageUrl: null,
  startingPrice: 0,
  durationMinutes: 120,
  durationLabel: null,
  warranty: null,
  usesFilm: false,
  filmTypeId: null,
  parentId: null,
  depositAmount: null,
  bookable: true,
  featured: false,
  active: true,
  sortOrder: 0,
  seoTitle: null,
  seoDescription: null,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-2xl border border-white/[0.07] bg-card p-6">
      <legend className="px-1 font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ServiceForm({ values, films, parents }: { values: ServiceFormValues; films: { id: string; name: string }[]; parents: { id: string; name: string }[] }) {
  const v = values;
  return (
    <ActionForm action={saveServiceAction} successRedirect={v.id ? undefined : "/admin/services/:id"} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid content-start gap-6">
        <Section title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField name="name" label="Name" required>
              <Input name="name" defaultValue={v.name} />
            </AdminField>
            <AdminField name="slug" label="URL slug" hint="Leave blank to generate from the name">
              <Input name="slug" defaultValue={v.slug} />
            </AdminField>
            <AdminField name="category" label="Category">
              <NativeSelect name="category" defaultValue={v.category}>
                <option value="WINDOW_TINT">Window film</option>
                <option value="PAINT_PROTECTION">Paint protection</option>
                <option value="COATING">Coating</option>
                <option value="LIGHTING">Lighting</option>
              </NativeSelect>
            </AdminField>
            <AdminField name="tagline" label="Tagline">
              <Input name="tagline" defaultValue={v.tagline ?? ""} />
            </AdminField>
          </div>
          <AdminField name="shortDescription" label="Short description" required hint="Shown on cards (1–2 sentences)">
            <Textarea name="shortDescription" rows={2} defaultValue={v.shortDescription} />
          </AdminField>
          <AdminField name="description" label="Full description" required hint="Separate paragraphs with a blank line">
            <Textarea name="description" rows={7} defaultValue={v.description} />
          </AdminField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField name="benefits" label="Benefits" hint="One per line">
              <Textarea name="benefits" rows={6} defaultValue={v.benefits.join("\n")} />
            </AdminField>
            <AdminField name="features" label="What’s included / features" hint="One per line">
              <Textarea name="features" rows={6} defaultValue={v.features.join("\n")} />
            </AdminField>
          </div>
        </Section>

        <Section title="Pricing & scheduling">
          <div className="grid gap-4 sm:grid-cols-3">
            <AdminField name="startingPrice" label="Fallback starting price ($)" required hint="Used when no pricing rule matches">
              <Input name="startingPrice" inputMode="decimal" defaultValue={centsToDollarsInput(v.startingPrice)} />
            </AdminField>
            <AdminField name="durationMinutes" label="Default duration (min)" required>
              <Input name="durationMinutes" inputMode="numeric" defaultValue={v.durationMinutes} />
            </AdminField>
            <AdminField name="durationLabel" label="Duration label" hint="e.g. “2–3 hours”">
              <Input name="durationLabel" defaultValue={v.durationLabel ?? ""} />
            </AdminField>
            <AdminField name="depositAmount" label="Fixed deposit ($)" hint="Blank = use the % from settings">
              <Input name="depositAmount" inputMode="decimal" defaultValue={centsToDollarsInput(v.depositAmount)} />
            </AdminField>
            <AdminField name="sortOrder" label="Sort order">
              <Input name="sortOrder" inputMode="numeric" defaultValue={v.sortOrder} />
            </AdminField>
          </div>
          <AdminField name="warranty" label="Warranty information">
            <Textarea name="warranty" rows={2} defaultValue={v.warranty ?? ""} />
          </AdminField>
        </Section>

        <Section title="SEO">
          <AdminField name="seoTitle" label="Page title" hint="≤ 70 characters">
            <Input name="seoTitle" defaultValue={v.seoTitle ?? ""} maxLength={70} />
          </AdminField>
          <AdminField name="seoDescription" label="Meta description" hint="≤ 170 characters">
            <Textarea name="seoDescription" rows={2} defaultValue={v.seoDescription ?? ""} maxLength={170} />
          </AdminField>
        </Section>
      </div>

      <div className="grid content-start gap-6">
        <Section title="Image">
          <ImageUpload name="imageUrl" defaultValue={v.imageUrl} folder="services" label="Service image" />
        </Section>
        <Section title="Film & variants">
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="usesFilm" defaultChecked={v.usesFilm} /> Customer chooses a window film
          </label>
          <AdminField name="filmTypeId" label="Lock to a film" hint="e.g. “Ceramic Window Tint” always uses ceramic">
            <NativeSelect name="filmTypeId" defaultValue={v.filmTypeId ?? ""}>
              <option value="">No — customer chooses</option>
              {films.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField name="parentId" label="Variant of" hint="Shares coverage options and prices with the parent service">
            <NativeSelect name="parentId" defaultValue={v.parentId ?? ""}>
              <option value="">— none —</option>
              {parents
                .filter((p) => p.id !== v.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </NativeSelect>
          </AdminField>
        </Section>
        <Section title="Visibility">
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="active" defaultChecked={v.active} /> Active (visible on the website)
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="bookable" defaultChecked={v.bookable} /> Bookable online (otherwise quote only)
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <Checkbox name="featured" defaultChecked={v.featured} /> Featured on the homepage
          </label>
        </Section>
        <SubmitButton size="lg">{v.id ? "Save service" : "Create service"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
