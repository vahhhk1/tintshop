"use client";

import * as React from "react";
import { ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { GALLERY_FILTERS } from "@/components/gallery/gallery-grid";
import { saveGalleryImageAction } from "@/server/admin/gallery";

export interface GalleryFormValues {
  id?: string;
  title: string;
  caption: string | null;
  alt: string;
  imageUrl: string;
  beforeImageUrl: string | null;
  categories: string[];
  vehicle: string | null;
  serviceId: string | null;
  featured: boolean;
  published: boolean;
  width: number | null;
  height: number | null;
}

export function GalleryForm({ values, services }: { values: GalleryFormValues; services: { id: string; name: string }[] }) {
  const [size, setSize] = React.useState({ width: values.width, height: values.height });
  return (
    <ActionForm action={saveGalleryImageAction} resetOnSuccess={!values.id} className="grid gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="width" value={size.width ?? ""} />
      <input type="hidden" name="height" value={size.height ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUpload name="imageUrl" defaultValue={values.imageUrl} folder="gallery" label="Photo (after)" onUploaded={(_u, s) => s && setSize(s)} />
        <ImageUpload name="beforeImageUrl" defaultValue={values.beforeImageUrl} folder="gallery" label="Before photo (optional)" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField name="title" label="Title" required>
          <Input name="title" defaultValue={values.title} />
        </AdminField>
        <AdminField name="vehicle" label="Vehicle">
          <Input name="vehicle" defaultValue={values.vehicle ?? ""} />
        </AdminField>
        <AdminField name="alt" label="Alt text" required hint="Describe the photo for screen readers">
          <Input name="alt" defaultValue={values.alt} />
        </AdminField>
        <AdminField name="caption" label="Caption">
          <Input name="caption" defaultValue={values.caption ?? ""} />
        </AdminField>
        <AdminField name="serviceId" label="Service">
          <NativeSelect name="serviceId" defaultValue={values.serviceId ?? ""}>
            <option value="">—</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </AdminField>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Categories</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {GALLERY_FILTERS.filter((f) => f.value !== "ALL").map((f) => (
            <label key={f.value} className="flex items-center gap-2 text-sm">
              <Checkbox name="categories" value={f.value} defaultChecked={values.categories.includes(f.value)} /> {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="featured" defaultChecked={values.featured} /> Featured on homepage
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="published" defaultChecked={values.published} /> Published
        </label>
        <SubmitButton size="sm">{values.id ? "Save photo" : "Add to gallery"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
