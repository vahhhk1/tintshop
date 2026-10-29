"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/*
 * Chart palette validated for the dark surface (#121214) with the dataviz
 * validator: lightness band, chroma, CVD and contrast all pass.
 */
const SERIES = { primary: "#c4841a", secondary: "#3a7bd5" };
const GRID = "rgb(255 255 255 / 0.06)";
const AXIS = { fill: "#a1a1aa", fontSize: 12 };
const SURFACE = "#121214";

function ChartCard({ title, subtitle, legend, table, children }: { title: string; subtitle?: string; legend?: React.ReactNode; table: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="rounded-2xl border border-white/[0.07] bg-card p-5">
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {legend}
      </figcaption>
      <div className="mt-4 h-60">{children}</div>
      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">View as table</summary>
        <div className="mt-2 max-h-48 overflow-auto">{table}</div>
      </details>
    </figure>
  );
}

function TipBox({ label, rows }: { label: string; rows: { name: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 text-muted-foreground">
          {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />}
          {r.name}: <span className="font-medium text-foreground tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; label?: string | number; payload?: readonly { name?: unknown; value?: unknown; color?: string; dataKey?: unknown; payload?: unknown }[] };

const money = (v: number) => `$${v.toLocaleString("en-US")}`;

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="py-1 text-left font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="py-0.5 tabular-nums">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      title="Revenue"
      subtitle={`Payments received per week · ${money(total)} over 12 weeks`}
      table={<SimpleTable head={["Week of", "Revenue"]} rows={data.map((d) => [d.label, money(d.value)])} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} />
          <Tooltip
            cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
            content={(p: TipProps) => (p.active && p.payload?.length ? <TipBox label={`Week of ${p.label}`} rows={[{ name: "Revenue", value: money(Number(p.payload[0]!.value)), color: SERIES.primary }]} /> : null)}
          />
          <Area type="monotone" dataKey="value" name="Revenue" stroke={SERIES.primary} strokeWidth={2} fill="url(#rev-fill)" activeDot={{ r: 5, stroke: SURFACE, strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AppointmentsChart({ data }: { data: { label: string; completed: number; cancelled: number; scheduled: number }[] }) {
  const rows = data.map((d) => ({ ...d, done: d.completed + d.scheduled }));
  return (
    <ChartCard
      title="Appointments"
      subtitle="Per week, completed or scheduled vs. cancelled / no-show"
      legend={
        <ul className="flex gap-4 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES.primary }} aria-hidden /> Completed / scheduled
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES.secondary }} aria-hidden /> Cancelled / no-show
          </li>
        </ul>
      }
      table={<SimpleTable head={["Week of", "Completed", "Scheduled", "Cancelled"]} rows={data.map((d) => [d.label, d.completed, d.scheduled, d.cancelled])} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
            content={(p: TipProps) => {
              if (!p.active || !p.payload?.length) return null;
              const d = p.payload[0]!.payload as (typeof rows)[number];
              return (
                <TipBox
                  label={`Week of ${p.label}`}
                  rows={[
                    { name: "Completed", value: String(d.completed), color: SERIES.primary },
                    { name: "Scheduled", value: String(d.scheduled), color: SERIES.primary },
                    { name: "Cancelled / no-show", value: String(d.cancelled), color: SERIES.secondary },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="done" stackId="a" name="Completed / scheduled" fill={SERIES.primary} stroke={SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} />
          <Bar dataKey="cancelled" stackId="a" name="Cancelled / no-show" fill={SERIES.secondary} stroke={SURFACE} strokeWidth={2} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function PopularServicesChart({ data }: { data: { name: string; count: number }[] }) {
  return (
    <ChartCard
      title="Popular services"
      subtitle="Bookings in the last 90 days"
      table={<SimpleTable head={["Service", "Bookings"]} rows={data.map((d) => [d.name, d.count])} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
          <Tooltip
            cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
            content={(p: TipProps) => (p.active && p.payload?.length ? <TipBox label={String(p.label)} rows={[{ name: "Bookings", value: String(p.payload[0]!.value), color: SERIES.primary }]} /> : null)}
          />
          <Bar dataKey="count" name="Bookings" fill={SERIES.primary} radius={[0, 4, 4, 0]} label={{ position: "right", fill: "#a1a1aa", fontSize: 12 }} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CustomerGrowthChart({ data }: { data: { label: string; customers: number; added: number }[] }) {
  return (
    <ChartCard
      title="Customer growth"
      subtitle="Total registered customers at month end"
      table={<SimpleTable head={["Month", "Total", "New"]} rows={data.map((d) => [d.label, d.customers, d.added])} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeWidth: 1 }}
            content={(p: TipProps) => {
              if (!p.active || !p.payload?.length) return null;
              const d = p.payload[0]!.payload as (typeof data)[number];
              return (
                <TipBox
                  label={String(p.label)}
                  rows={[
                    { name: "Customers", value: String(d.customers), color: SERIES.primary },
                    { name: "New this month", value: `+${d.added}` },
                  ]}
                />
              );
            }}
          />
          <Line type="monotone" dataKey="customers" name="Customers" stroke={SERIES.primary} strokeWidth={2} dot={{ r: 4, fill: SERIES.primary, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6, stroke: SURFACE, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
