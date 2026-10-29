import Link from "next/link";
import { addDaysYmd, formatYmd, hmToMinutes, toHm, toYmd, weekdayOfYmd } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface CalendarAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  customerName: string;
  service: { name: string };
  technician: { name: string; color: string } | null;
}

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_PX = 56;

function chipClasses(status: string) {
  if (status === "CANCELLED" || status === "NO_SHOW") return "opacity-45 line-through";
  if (status === "PENDING") return "border-dashed";
  return "";
}

/** Time-grid calendar for one or more days (day/week views). */
export function TimeGrid({ days, appointments, timeZone, today }: { days: string[]; appointments: CalendarAppointment[]; timeZone: string; today: string }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const byDay = new Map(days.map((d) => [d, [] as CalendarAppointment[]]));
  for (const a of appointments) byDay.get(toYmd(a.startsAt, timeZone))?.push(a);

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-card">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-white/[0.07]" />
        {days.map((d) => (
          <div key={d} className={cn("border-b border-l border-white/[0.07] px-3 py-2 text-sm", d === today && "bg-primary/[0.06]")}>
            <span className="text-muted-foreground">{formatYmd(d, { weekday: "short" })}</span>{" "}
            <span className={cn("font-semibold", d === today && "text-primary")}>{formatYmd(d, { month: "short", day: "numeric" })}</span>
          </div>
        ))}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: i * HOUR_PX }}>
              {i === 0 ? "" : `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className={cn("relative border-l border-white/[0.07]", d === today && "bg-primary/[0.03]")} style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-white/[0.05]" style={{ top: i * HOUR_PX }} aria-hidden />
            ))}
            {(byDay.get(d) ?? []).map((a, _idx, list) => {
              const start = Math.max(hmToMinutes(toHm(a.startsAt, timeZone)) - START_HOUR * 60, 0);
              const end = Math.min(hmToMinutes(toHm(a.endsAt, timeZone)) - START_HOUR * 60, (END_HOUR - START_HOUR) * 60);
              // Side-by-side placement for overlaps.
              const overlapping = list.filter((o) => o.startsAt < a.endsAt && a.startsAt < o.endsAt);
              const lane = overlapping.indexOf(a);
              const lanes = overlapping.length;
              return (
                <Link
                  key={a.id}
                  href={`/admin/appointments/${a.id}`}
                  className={cn(
                    "absolute overflow-hidden rounded-lg border border-white/10 px-2 py-1 text-[11px] leading-tight transition-[filter] hover:brightness-125",
                    chipClasses(a.status),
                  )}
                  style={{
                    top: (start / 60) * HOUR_PX + 1,
                    height: Math.max(((end - start) / 60) * HOUR_PX - 2, 22),
                    left: `calc(${(lane / lanes) * 100}% + 3px)`,
                    width: `calc(${100 / lanes}% - 6px)`,
                    background: `color-mix(in oklab, ${a.technician?.color ?? "#71717a"} 22%, #141416)`,
                    borderLeft: `3px solid ${a.technician?.color ?? "#71717a"}`,
                  }}
                  title={`${a.customerName} · ${a.service.name}`}
                >
                  <span className="block font-semibold text-foreground">
                    {toHm(a.startsAt, timeZone)} {a.customerName}
                  </span>
                  <span className="block truncate text-foreground/70">{a.service.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthGrid({ month, appointments, timeZone, today }: { month: string; appointments: CalendarAppointment[]; timeZone: string; today: string }) {
  const first = `${month}-01`;
  const gridStart = addDaysYmd(first, -((weekdayOfYmd(first) + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDaysYmd(gridStart, i));
  const byDay = new Map<string, CalendarAppointment[]>();
  for (const a of appointments) {
    const k = toYmd(a.startsAt, timeZone);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-card">
      <div className="grid min-w-[720px] grid-cols-7">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="border-b border-white/[0.07] px-3 py-2 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((d) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.startsWith(month);
          return (
            <div key={d} className={cn("min-h-28 border-b border-l border-white/[0.05] p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0", !inMonth && "bg-black/20", d === today && "bg-primary/[0.06]")}>
              <Link href={`/admin/appointments?view=day&date=${d}`} className={cn("mb-1 inline-block rounded px-1.5 text-xs", inMonth ? "text-foreground/80" : "text-foreground/30", d === today && "bg-primary font-semibold text-primary-foreground")}>
                {Number(d.slice(8))}
              </Link>
              <ul className="grid gap-0.5">
                {list.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/appointments/${a.id}`}
                      className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] hover:bg-white/[0.06]", chipClasses(a.status))}
                      style={{ borderLeft: `2px solid ${a.technician?.color ?? "#71717a"}` }}
                    >
                      <span className="text-muted-foreground tabular-nums">{toHm(a.startsAt, timeZone)}</span> {a.customerName}
                    </Link>
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <Link href={`/admin/appointments?view=day&date=${d}`} className="px-1.5 text-[11px] text-primary">
                      +{list.length - 3} more
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
