import { formatCurrency } from "@/lib/utils";

interface PriceTableProps {
  vehicleTypes: string[];
  rows: { id: string; name: string; description: string | null; prices: (number | null)[] }[];
  addOns: { id: string; name: string; description: string | null; price: number }[];
  filmNote?: boolean;
}

export function PriceTable({ vehicleTypes, rows, addOns, filmNote }: PriceTableProps) {
  return (
    <div className="grid gap-6">
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Starting prices by vehicle type</caption>
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.02] text-left">
              <th scope="col" className="px-5 py-4 font-medium text-muted-foreground">
                Coverage
              </th>
              {vehicleTypes.map((v) => (
                <th key={v} scope="col" className="px-4 py-4 text-right font-medium text-muted-foreground">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-white/[0.05] last:border-0">
                <th scope="row" className="px-5 py-4 text-left font-medium">
                  {row.name}
                  {row.description && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{row.description}</span>}
                </th>
                {row.prices.map((p, i) => (
                  <td key={i} className="px-4 py-4 text-right tabular-nums">
                    {p != null ? formatCurrency(p) : <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {addOns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Optional add-ons</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {addOns.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] px-4 py-3 text-sm">
                <span>
                  {a.name}
                  {a.description && <span className="block text-xs text-muted-foreground">{a.description}</span>}
                </span>
                <span className="font-medium tabular-nums">+{formatCurrency(a.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Starting prices for standard-size vehicles{filmNote ? " with our most affordable film" : ""}. Vehicle size, film upgrades and add-ons adjust the final price — get your exact
        price in the online quote tool.
      </p>
    </div>
  );
}
