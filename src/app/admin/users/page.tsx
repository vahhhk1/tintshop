import { ShieldCheck } from "lucide-react";
import { ActionForm, AdminField, SubmitButton } from "@/components/admin/action-form";
import { PageHeader } from "@/components/dashboard/shell";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { ROLES, ROLE_LABELS, PERMISSIONS, type RoleName } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/time";
import { saveStaffUserAction } from "@/server/admin/business";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Staff accounts" };

type StaffRow = { id: string; name: string | null; email: string; phone: string | null; role: RoleName; isActive: boolean; lastLoginAt: Date | null };

function UserForm({ u }: { u: StaffRow | null }) {
  return (
    <ActionForm action={saveStaffUserAction} resetOnSuccess={!u} className="grid gap-3 md:grid-cols-[1fr_1.3fr_1fr_150px_1fr_auto] md:items-end">
      {u && <input type="hidden" name="id" value={u.id} />}
      <AdminField name="name" label="Name" required>
        <Input name="name" defaultValue={u?.name ?? ""} />
      </AdminField>
      <AdminField name="email" label="Email" required>
        <Input name="email" type="email" defaultValue={u?.email ?? ""} />
      </AdminField>
      <AdminField name="phone" label="Phone">
        <Input name="phone" defaultValue={u?.phone ?? ""} />
      </AdminField>
      <AdminField name="role" label="Role">
        <NativeSelect name="role" defaultValue={u?.role ?? "STAFF"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </NativeSelect>
      </AdminField>
      <AdminField name="password" label={u ? "New password" : "Password"} required={!u} hint={u ? "Leave blank to keep" : undefined}>
        <Input name="password" type="password" autoComplete="new-password" />
      </AdminField>
      <div className="flex items-center gap-3 pb-1">
        <label className="flex items-center gap-1.5 text-xs">
          <Checkbox name="isActive" defaultChecked={u?.isActive ?? true} /> Active
        </label>
        <SubmitButton size="sm" variant={u ? "outline" : "default"}>
          {u ? "Save" : "Create"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function AdminUsersPage() {
  await requirePermission("users:manage", "/admin/users");
  const [settings, staff] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } },
      orderBy: [{ role: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLoginAt: true },
    }),
  ]);
  const matrix = Object.entries(PERMISSIONS) as [string, readonly RoleName[]][];

  return (
    <>
      <PageHeader title="Staff accounts" description="Only super admins can create staff accounts and change roles. To promote an existing customer, enter their email with the new role." />
      <section className="mb-8 rounded-2xl border border-white/[0.07] bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Add staff member</h2>
        <UserForm u={null} />
      </section>
      <section className="mb-8 grid gap-4">
        {staff.map((u) => (
          <div key={u.id} className="rounded-2xl border border-white/[0.07] bg-card p-5">
            <p className="mb-3 text-xs text-muted-foreground">
              {ROLE_LABELS[u.role]} · last sign-in {u.lastLoginAt ? formatDateTime(u.lastLoginAt, settings.timezone) : "never"}
            </p>
            <UserForm u={u} />
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-white/[0.07] bg-card p-6" aria-labelledby="perm-h">
        <h2 id="perm-h" className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden /> Role permissions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Permission</th>
                {ROLES.filter((r) => r !== "CUSTOMER").map((r) => (
                  <th key={r} className="py-2 text-center font-medium">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {matrix.map(([perm, roles]) => (
                <tr key={perm}>
                  <td className="py-2 font-mono text-xs">{perm}</td>
                  {ROLES.filter((r) => r !== "CUSTOMER").map((r) => (
                    <td key={r} className="py-2 text-center">
                      {roles.includes(r) ? <span className="text-emerald-400">✓</span> : <span className="text-white/20">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
