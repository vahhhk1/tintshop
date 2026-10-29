import { PageHeader } from "@/components/dashboard/shell";
import { VehicleManager } from "@/components/dashboard/vehicle-manager";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export const metadata = { title: "Vehicles" };

export default async function MyVehiclesPage() {
  const user = await requireUser("/dashboard/vehicles");
  const [vehicles, types, sizes] = await Promise.all([
    prisma.vehicle.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { vehicleType: { select: { name: true } }, vehicleSize: { select: { name: true } } },
    }),
    prisma.vehicleType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.vehicleSize.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Vehicles" description="Your saved vehicles prefill bookings and quotes." />
      <VehicleManager
        vehicles={vehicles.map((v) => ({
          id: v.id,
          year: v.year,
          make: v.make,
          model: v.model,
          color: v.color,
          vin: v.vin,
          notes: v.notes,
          vehicleTypeId: v.vehicleTypeId,
          vehicleSizeId: v.vehicleSizeId,
          typeName: v.vehicleType?.name ?? null,
          sizeName: v.vehicleSize?.name ?? null,
        }))}
        types={types}
        sizes={sizes}
      />
    </>
  );
}
