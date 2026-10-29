"use client";

import * as React from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import { addDaysYmd, formatYmd } from "@/lib/time";
import { cn } from "@/lib/utils";

interface DaySummary {
  date: string;
  count: number;
  closedReason: string | null;
}
interface SlotView {
  time: string;
  label: string;
}

const WINDOW = 14;

export function SlotPicker({
  serviceId,
  duration,
  technicianId,
  today,
  maxAdvanceDays,
  value,
  onChange,
  exclude,
}: {
  serviceId: string;
  duration: number;
  technicianId?: string | null;
  today: string;
  maxAdvanceDays: number;
  value: { date: string | null; time: string | null };
  onChange: (v: { date: string | null; time: string | null }) => void;
  exclude?: { id: string; token: string };
}) {
  const [offset, setOffset] = React.useState(0);
  // Responses are stored with the request URL they answer, so stale data is never shown
  // and no state needs resetting when the inputs change.
  const [daysRes, setDaysRes] = React.useState<{ url: string; days?: DaySummary[]; error?: boolean } | null>(null);
  const [slotsRes, setSlotsRes] = React.useState<{ url: string; slots?: SlotView[]; closedReason?: string | null; error?: boolean } | null>(null);

  const common = React.useMemo(() => {
    const p = new URLSearchParams({ serviceId, duration: String(duration) });
    if (technicianId) p.set("technicianId", technicianId);
    if (exclude) {
      p.set("exclude", exclude.id);
      p.set("token", exclude.token);
    }
    return p.toString();
  }, [serviceId, duration, technicianId, exclude]);

  const from = addDaysYmd(today, offset);
  const daysUrl = `/api/availability?${common}&from=${from}&days=${WINDOW}`;
  const slotsUrl = value.date ? `/api/availability?${common}&date=${value.date}` : null;

  const onDaysLoaded = React.useEffectEvent((loaded: DaySummary[]) => {
    const current = value.date;
    const stillValid = current && loaded.some((d) => d.date === current && d.count > 0);
    if (!stillValid && offset === 0 && (!current || (current >= from && current <= addDaysYmd(from, WINDOW - 1)))) {
      const first = loaded.find((d) => d.count > 0);
      if (first) onChange({ date: first.date, time: null });
    }
  });

  const onSlotsLoaded = React.useEffectEvent((loaded: SlotView[]) => {
    if (value.time && !loaded.some((sl) => sl.time === value.time)) onChange({ date: value.date, time: null });
  });

  // Day summaries for the visible window.
  React.useEffect(() => {
    const controller = new AbortController();
    fetch(daysUrl, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { days: DaySummary[] }) => {
        setDaysRes({ url: daysUrl, days: data.days });
        onDaysLoaded(data.days);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setDaysRes({ url: daysUrl, error: true });
      });
    return () => controller.abort();
  }, [daysUrl]);

  // Slots for the chosen day.
  React.useEffect(() => {
    if (!slotsUrl) return;
    const controller = new AbortController();
    fetch(slotsUrl, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { slots: SlotView[]; closedReason?: string }) => {
        setSlotsRes({ url: slotsUrl, slots: data.slots, closedReason: data.closedReason ?? null });
        onSlotsLoaded(data.slots);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setSlotsRes({ url: slotsUrl, error: true });
      });
    return () => controller.abort();
  }, [slotsUrl]);

  const days = daysRes?.url === daysUrl ? (daysRes.days ?? null) : null;
  const daysError = daysRes?.url === daysUrl && Boolean(daysRes.error);
  const currentSlots = slotsUrl && slotsRes?.url === slotsUrl ? slotsRes : null;
  const slots = currentSlots?.slots ?? null;
  const closedReason = currentSlots?.closedReason ?? null;
  const slotsState: "idle" | "loading" | "error" = !slotsUrl ? "idle" : !currentSlots ? "loading" : currentSlots.error ? "error" : "idle";

  const morning = slots?.filter((sl) => sl.time < "12:00") ?? [];
  const afternoon = slots?.filter((sl) => sl.time >= "12:00") ?? [];
  const canGoBack = offset > 0;
  const canGoForward = offset + WINDOW < maxAdvanceDays;

  return (
    <div className="grid gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">{days?.[0] ? formatYmd(days[0].date, { month: "long", year: "numeric" }) : "Choose a date"}</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - WINDOW))}
              disabled={!canGoBack}
              className="grid size-9 place-items-center rounded-full border border-white/10 disabled:opacity-30"
              aria-label="Earlier dates"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => o + WINDOW)}
              disabled={!canGoForward}
              className="grid size-9 place-items-center rounded-full border border-white/10 disabled:opacity-30"
              aria-label="Later dates"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        {daysError ? (
          <p className="text-sm text-red-400">Couldn’t load availability. Check your connection and try again.</p>
        ) : !days ? (
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-16 shrink-0" />
            ))}
          </div>
        ) : (
          <div role="radiogroup" aria-label="Date" className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const selected = value.date === d.date;
              const disabled = d.count === 0;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  title={d.closedReason ?? `${d.count} times available`}
                  aria-label={`${formatYmd(d.date, { weekday: "long", month: "long", day: "numeric" })}: ${disabled ? (d.closedReason ?? "unavailable") : `${d.count} times available`}`}
                  onClick={() => onChange({ date: d.date, time: null })}
                  className={cn(
                    "flex w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-2xl border py-3 transition-colors",
                    selected ? "border-primary bg-primary text-primary-foreground" : disabled ? "border-white/5 text-foreground/25" : "border-white/10 hover:border-white/30",
                  )}
                >
                  <span className={cn("text-[11px] font-medium uppercase", selected ? "text-primary-foreground/80" : "text-muted-foreground", disabled && "text-foreground/25")}>
                    {formatYmd(d.date, { weekday: "short" })}
                  </span>
                  <span className="font-display text-xl font-semibold">{formatYmd(d.date, { day: "numeric" })}</span>
                  <span className={cn("text-[10px]", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{disabled ? "—" : `${d.count} open`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div aria-live="polite">
        {value.date && <p className="mb-3 text-sm font-medium">{formatYmd(value.date, { weekday: "long", month: "long", day: "numeric" })}</p>}
        {slotsState === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Checking live availability…
          </div>
        ) : slotsState === "error" ? (
          <p className="text-sm text-red-400">Couldn’t load times. Please try again.</p>
        ) : slots && slots.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">
            <CalendarX2 className="size-5" aria-hidden /> {closedReason ?? "No times left on this day."} Try another date.
          </div>
        ) : slots ? (
          <div className="grid gap-5">
            {[
              ["Morning", morning],
              ["Afternoon", afternoon],
            ].map(([label, list]) =>
              (list as SlotView[]).length ? (
                <div key={label as string}>
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label as string}</p>
                  <div role="radiogroup" aria-label={`${label} times`} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {(list as SlotView[]).map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        role="radio"
                        aria-checked={value.time === s.time}
                        onClick={() => onChange({ date: value.date, time: s.time })}
                        className={cn(
                          "h-12 rounded-xl border text-sm font-medium tabular-nums transition-colors",
                          value.time === s.time ? "border-primary bg-primary text-primary-foreground" : "border-white/10 hover:border-white/30",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
