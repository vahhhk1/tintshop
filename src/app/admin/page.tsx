import Link from "next/link";
import { Ban, CalendarClock, CheckCircle2, ClipboardList, DollarSign, Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/shell";
import { AppointmentRow } from "@/components/dashboard/appointment-row";
import { AppointmentsChart, CustomerGrowthChart, PopularServicesChart, RevenueChart } from "@/components/admin/charts";
import { Button } from "@/components/ui/button";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { formatDateTime, formatLongDate } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import { getDashboardData } from "@/server/admin/reports";
import { getSettings } from "@/server/settings";
import { todayYmd } from "@/lib/time";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const [{ denied }, user, settings] = await Promise.all([searchParams, requirePermission("admin:access"), getSettings()]);
  const data = await getDashboardData(settings);
  const showMoney = can(user.role, "reports:view");
  const change = data.kpis.revenuePrev30 > 0 ? Math.round(((data.kpis.revenue30 - data.kpis.revenuePrev30) / data.kpis.revenuePrev30) * 100) : null;

  return (
    <>
      {denied && <p className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">You don’t have permission to open that page.</p>}
      <PageHeader
        title="Dashboard"
        description={formatLongDate(new Date(), settings.timezone)}
        actions={
          <Button asChild>
            <Link href="/admin/appointments/new">
              <Plus aria-hidden /> New appointment
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {showMoney && (
          <StatTile
            label="Revenue (30 days)"
            value={formatCurrency(data.kpis.revenue30)}
            icon={DollarSign}
            hint={change === null ? undefined : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs previous 30 days`}
          />
        )}
        <StatTile label="Today’s appointments" value={data.todays.length} icon={CalendarClock} />
        <StatTile label="Upcoming (7 days)" value={data.kpis.upcomingWeek} icon={CalendarClock} />
        <StatTile label="Pending quotes" value={data.kpis.pendingQuotes} icon={ClipboardList} />
        <StatTile label="New customers (30d)" value={data.kpis.newCustomers30} icon={UserPlus} />
        <StatTile label="Completed (30d)" value={data.kpis.completed30} icon={CheckCircle2} hint={`${data.kpis.cancelled30} cancelled / no-show`} />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="today-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="today-h" className="text-lg font-semibold">
              Today
            </h2>
            <Link href={`/admin/appointments?view=day&date=${todayYmd(settings.timezone)}`} className="text-sm text-muted-foreground hover:text-foreground">
              Day view
            </Link>
          </div>
          {data.todays.length ? (
            <ul className="grid gap-2">
              {data.todays.map((a) => (
                <AppointmentRow key={a.id} a={a} href={`/admin/appointments/${a.id}`} timeZone={settings.timezone} showCustomer />
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title="Nothing booked today" />
          )}
        </section>
        <section aria-labelledby="upcoming-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="upcoming-h" className="text-lg font-semibold">
              Upcoming
            </h2>
            <Link href="/admin/appointments" className="text-sm text-muted-foreground hover:text-foreground">
              All appointments
            </Link>
          </div>
          {data.upcoming.length ? (
            <ul className="grid gap-2">
              {data.upcoming.map((a) => (
                <AppointmentRow key={a.id} a={a} href={`/admin/appointments/${a.id}`} timeZone={settings.timezone} showCustomer />
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title="No upcoming appointments this week" />
          )}
        </section>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        {showMoney && <RevenueChart data={data.charts.revenue} />}
        <AppointmentsChart data={data.charts.appointments} />
        <PopularServicesChart data={data.charts.popular} />
        <CustomerGrowthChart data={data.charts.growth} />
      </div>

      {showMoney && (
        <section className="mt-10" aria-labelledby="payments-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="payments-h" className="text-lg font-semibold">
              Recent payments
            </h2>
            <Link href="/admin/payments" className="text-sm text-muted-foreground hover:text-foreground">
              All payments
            </Link>
          </div>
          {data.recentPayments.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
              <table className="w-full min-w-[640px] text-sm">
                <tbody className="divide-y divide-white/[0.05]">
                  {data.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3">
                        <Link href={`/admin/appointments/${p.appointment.id}`} className="font-medium hover:text-primary">
                          {p.appointment.customerName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {p.appointment.service.name} · {p.appointment.reference}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{p.paidAt ? formatDateTime(p.paidAt, settings.timezone) : "—"}</td>
                      <td className="px-5 py-3 capitalize text-muted-foreground">{p.type.toLowerCase()}</td>
                      <td className="px-5 py-3">
                        <StatusBadge kind="payment" status={p.status} />
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{formatCurrency(p.amount, { exact: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Ban} title="No payments yet" />
          )}
        </section>
      )}
    </>
  );
}
