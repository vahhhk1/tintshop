import { Trash2, Wrench } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { ImageUpload } from "@/components/admin/image-upload";
import { PageHeader } from "@/components/dashboard/shell";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { DAY_NAMES, formatDate } from "@/lib/time";
import { addTimeOffAction, deleteTechnicianAction, deleteTimeOffAction, saveTechnicianAction, saveTechnicianScheduleAction } from "@/server/admin/business";
import { getBusinessHours, getSettings } from "@/server/settings";

export const metadata = { title: "Technicians" };

const loadTechs = () =>
  prisma.technician.findMany({
    orderBy: { sortOrder: "asc" },
    include: { services: { select: { id: true } }, schedules: true, timeOff: { where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } } },
  });
type Tech = Awaited<ReturnType<typeof loadTechs>>[number];

function TechForm({ t, services, staff }: { t: Tech | null; services: { id: string; name: string }[]; staff: { id: string; name: string | null; email: string }[] }) {
  return (
    <ActionForm action={saveTechnicianAction} resetOnSuccess={!t} className="grid gap-4 md:grid-cols-[200px_1fr]">
      {t && <input type="hidden" name="id" value={t.id} />}
      <ImageUpload name="avatarUrl" defaultValue={t?.avatarUrl} folder="technicians" label="Photo" aspect="aspect-square" />
      <div className="grid content-start gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminField name="name" label="Name" required>
            <Input name="name" defaultValue={t?.name ?? ""} />
          </AdminField>
          <AdminField name="title" label="Title">
            <Input name="title" defaultValue={t?.title ?? ""} />
          </AdminField>
          <AdminField name="color" label="Calendar color">
            <Input type="color" name="color" defaultValue={t?.color ?? "#3b82f6"} className="h-11 p-1" />
          </AdminField>
          <AdminField name="userId" label="Linked staff login">
            <NativeSelect name="userId" defaultValue={t?.userId ?? ""}>
              <option value="">—</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.email}
                </option>
              ))}
            </NativeSelect>
          </AdminField>
          <AdminField name="sortOrder" label="Order">
            <Input name="sortOrder" inputMode="numeric" defaultValue={t?.sortOrder ?? 0} />
          </AdminField>
        </div>
        <AdminField name="bio" label="Bio" hint="Shown on the About page">
          <Textarea name="bio" rows={2} defaultValue={t?.bio ?? ""} />
        </AdminField>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Services they perform (none = all)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-1.5 text-xs">
                <Checkbox name="serviceIds" value={s.id} defaultChecked={t?.services.some((x) => x.id === s.id)} /> {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <Checkbox name="active" defaultChecked={t?.active ?? true} /> Active (bookable)
          </label>
          <SubmitButton size="sm">{t ? "Save technician" : "Add technician"}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

export default async function AdminTechniciansPage() {
  await requirePermission("technicians:manage", "/admin/technicians");
  const [techs, services, staff, hours, settings] = await Promise.all([
    loadTechs(),
    prisma.service.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } }, select: { id: true, name: true, email: true } }),
    getBusinessHours(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader title="Technicians" description="Who can be booked, which services they perform, their weekly hours and time off." />
      <section className="mb-8 rounded-2xl border border-white/[0.07] bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Add technician</h2>
        <TechForm t={null} services={services} staff={staff} />
      </section>
      {techs.length === 0 ? (
        <EmptyState icon={Wrench} title="No technicians" description={`Without technicians, bookings use a shop capacity of ${settings.shopCapacity} parallel bays.`} />
      ) : (
        <div className="grid gap-6">
          {techs.map((t) => (
            <section key={t.id} className="rounded-2xl border border-white/[0.07] bg-card p-6" aria-label={t.name}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <span className="size-3 rounded-full" style={{ background: t.color }} aria-hidden /> {t.name}
                  {!t.active && <span className="text-xs font-normal text-muted-foreground">(inactive)</span>}
                </h2>
                <ActionButton size="sm" variant="ghost" className="text-red-300" action={deleteTechnicianAction} args={[t.id]} confirm={`Remove ${t.name}?`}>
                  <Trash2 aria-hidden /> Remove
                </ActionButton>
              </div>
              <TechForm t={t} services={services} staff={staff} />

              <div className="mt-6 grid gap-6 border-t border-white/[0.06] pt-6 xl:grid-cols-2">
                <ActionForm action={saveTechnicianScheduleAction} className="grid gap-3">
                  <input type="hidden" name="technicianId" value={t.id} />
                  <h3 className="font-semibold">Weekly hours</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox name="useBusinessHours" defaultChecked={t.schedules.length === 0} /> Follow business hours (ignore the table below)
                  </label>
                  <div className="grid gap-2">
                    {DAY_NAMES.map((day, d) => {
                      const s = t.schedules.find((x) => x.dayOfWeek === d);
                      const h = hours[d]!;
                      return (
                        <div key={d} className="grid grid-cols-[110px_auto_1fr_1fr] items-center gap-2 text-sm">
                          <span>{day}</span>
                          <Checkbox name={`day-${d}-working`} defaultChecked={s ? true : t.schedules.length === 0 && h.isOpen} aria-label={`Works ${day}`} />
                          <Input type="time" name={`day-${d}-start`} defaultValue={s?.startTime ?? h.openTime} className="h-9" aria-label={`${day} start`} />
                          <Input type="time" name={`day-${d}-end`} defaultValue={s?.endTime ?? h.closeTime} className="h-9" aria-label={`${day} end`} />
                        </div>
                      );
                    })}
                  </div>
                  <SubmitButton size="sm" variant="outline" className="justify-self-start">
                    Save hours
                  </SubmitButton>
                </ActionForm>

                <div className="grid content-start gap-3">
                  <h3 className="font-semibold">Time off</h3>
                  {t.timeOff.length ? (
                    <ul className="grid gap-2 text-sm">
                      {t.timeOff.map((o) => (
                        <li key={o.id} className="flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2">
                          <span>
                            {formatDate(o.startsAt, settings.timezone)} → {formatDate(new Date(o.endsAt.getTime() - 1), settings.timezone)} {o.reason ? `· ${o.reason}` : ""}
                          </span>
                          <ActionButton size="icon-sm" variant="ghost" action={deleteTimeOffAction} args={[o.id]} aria-label="Remove time off">
                            <Trash2 className="size-4 text-red-300" />
                          </ActionButton>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming time off.</p>
                  )}
                  <ActionForm action={addTimeOffAction} resetOnSuccess className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                    <input type="hidden" name="technicianId" value={t.id} />
                    <AdminField name="startDate" label="From" required>
                      <Input type="date" name="startDate" />
                    </AdminField>
                    <AdminField name="endDate" label="To" required>
                      <Input type="date" name="endDate" />
                    </AdminField>
                    <AdminField name="reason" label="Reason">
                      <Input name="reason" placeholder="Vacation" />
                    </AdminField>
                    <SubmitButton size="sm" variant="outline" className="h-11">
                      Add
                    </SubmitButton>
                  </ActionForm>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
