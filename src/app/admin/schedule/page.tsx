import { Trash2 } from "lucide-react";
import { ActionButton, ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { DAY_NAMES, dateOnlyToYmd, daysAgo, formatHm, formatYmd } from "@/lib/time";
import { addBreakAction, addHolidayAction, deleteBreakAction, deleteHolidayAction, saveBookingRulesAction, saveBusinessHoursAction } from "@/server/admin/business";
import { getBusinessHours, getSettings } from "@/server/settings";

export const metadata = { title: "Hours & booking" };

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AdminSchedulePage() {
  await requirePermission("schedule:manage", "/admin/schedule");
  const [hours, settings, holidays, breaks] = await Promise.all([
    getBusinessHours(),
    getSettings(),
    prisma.holiday.findMany({ where: { date: { gte: daysAgo(1) } }, orderBy: { date: "asc" } }),
    prisma.breakPeriod.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
  ]);

  return (
    <>
      <PageHeader title="Hours & booking" description="Controls which appointment times customers can book online." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Business hours">
          <ActionForm action={saveBusinessHoursAction} className="grid gap-2">
            {hours.map((h) => (
              <div key={h.dayOfWeek} className="grid grid-cols-[110px_auto_1fr_1fr] items-center gap-2 text-sm">
                <span>{h.day}</span>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox name={`day-${h.dayOfWeek}-open`} defaultChecked={h.isOpen} /> Open
                </label>
                <Input type="time" name={`day-${h.dayOfWeek}-start`} defaultValue={h.openTime} className="h-9" aria-label={`${h.day} opening`} />
                <Input type="time" name={`day-${h.dayOfWeek}-end`} defaultValue={h.closeTime} className="h-9" aria-label={`${h.day} closing`} />
              </div>
            ))}
            <SubmitButton size="sm" className="mt-2 justify-self-start">
              Save hours
            </SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Booking rules">
          <ActionForm action={saveBookingRulesAction} className="grid gap-4 sm:grid-cols-2">
            <AdminField name="slotIntervalMinutes" label="Start-time interval (min)" hint="Offer a start time every N minutes">
              <Input name="slotIntervalMinutes" inputMode="numeric" defaultValue={settings.slotIntervalMinutes} />
            </AdminField>
            <AdminField name="bufferMinutes" label="Buffer between jobs (min)">
              <Input name="bufferMinutes" inputMode="numeric" defaultValue={settings.bufferMinutes} />
            </AdminField>
            <AdminField name="minNoticeHours" label="Minimum notice (hours)">
              <Input name="minNoticeHours" inputMode="numeric" defaultValue={settings.minNoticeHours} />
            </AdminField>
            <AdminField name="maxAdvanceDays" label="Book up to (days ahead)">
              <Input name="maxAdvanceDays" inputMode="numeric" defaultValue={settings.maxAdvanceDays} />
            </AdminField>
            <AdminField name="holdMinutes" label="Hold unpaid slot (min)" hint="While the customer is paying (min 30)">
              <Input name="holdMinutes" inputMode="numeric" defaultValue={settings.holdMinutes} />
            </AdminField>
            <AdminField name="reminderHoursBefore" label="Reminder (hours before)">
              <Input name="reminderHoursBefore" inputMode="numeric" defaultValue={settings.reminderHoursBefore} />
            </AdminField>
            <AdminField name="cancellationWindowHours" label="Online changes close (hours before)">
              <Input name="cancellationWindowHours" inputMode="numeric" defaultValue={settings.cancellationWindowHours} />
            </AdminField>
            <AdminField name="shopCapacity" label="Parallel bays" hint="Used when no technicians are set up">
              <Input name="shopCapacity" inputMode="numeric" defaultValue={settings.shopCapacity} />
            </AdminField>
            <SubmitButton size="sm" className="justify-self-start">
              Save rules
            </SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Holidays & special hours" description="Closed days or shortened hours override the weekly schedule.">
          {holidays.length > 0 && (
            <ul className="mb-5 grid gap-2 text-sm">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2">
                  <span>
                    {formatYmd(dateOnlyToYmd(h.date), { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {h.name} ·{" "}
                    {h.closed ? "Closed" : `${formatHm(h.openTime!)}–${formatHm(h.closeTime!)}`}
                  </span>
                  <ActionButton size="icon-sm" variant="ghost" action={deleteHolidayAction} args={[h.id]} aria-label={`Remove ${h.name}`}>
                    <Trash2 className="size-4 text-red-300" />
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addHolidayAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <AdminField name="date" label="Date" required>
              <Input type="date" name="date" />
            </AdminField>
            <AdminField name="name" label="Name" required>
              <Input name="name" placeholder="Independence Day" />
            </AdminField>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox name="closed" defaultChecked /> Closed all day (untick to set special hours)
            </label>
            <AdminField name="openTime" label="Special opening">
              <Input type="time" name="openTime" />
            </AdminField>
            <AdminField name="closeTime" label="Special closing">
              <Input type="time" name="closeTime" />
            </AdminField>
            <SubmitButton size="sm" variant="outline" className="justify-self-start">
              Add holiday
            </SubmitButton>
          </ActionForm>
        </Panel>

        <Panel title="Breaks" description="No appointment can overlap a break (e.g. a daily lunch).">
          {breaks.length > 0 && (
            <ul className="mb-5 grid gap-2 text-sm">
              {breaks.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2">
                  <span>
                    {b.dayOfWeek == null ? "Every day" : DAY_NAMES[b.dayOfWeek]} · {formatHm(b.startTime)}–{formatHm(b.endTime)} {b.label ? `· ${b.label}` : ""}
                  </span>
                  <ActionButton size="icon-sm" variant="ghost" action={deleteBreakAction} args={[b.id]} aria-label="Remove break">
                    <Trash2 className="size-4 text-red-300" />
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addBreakAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <AdminField name="dayOfWeek" label="Day">
              <NativeSelect name="dayOfWeek" defaultValue="all">
                <option value="all">Every open day</option>
                {DAY_NAMES.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </AdminField>
            <AdminField name="label" label="Label">
              <Input name="label" placeholder="Lunch" />
            </AdminField>
            <AdminField name="startTime" label="Start" required>
              <Input type="time" name="startTime" defaultValue="12:00" />
            </AdminField>
            <AdminField name="endTime" label="End" required>
              <Input type="time" name="endTime" defaultValue="12:30" />
            </AdminField>
            <SubmitButton size="sm" variant="outline" className="justify-self-start">
              Add break
            </SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
