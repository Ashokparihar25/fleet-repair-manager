"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { importClientVehicles, type ImportVehicleRow } from "@/app/actions/fleet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Row = {
  fleet_id: string;
  vin: string;
  license_plate: string;
  state: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  mileage: string;
  color: string;
};

const emptyRow = (): Row => ({
  fleet_id: "",
  vin: "",
  license_plate: "",
  state: "MI",
  year: "",
  make: "",
  model: "",
  trim: "",
  engine: "",
  mileage: "",
  color: "",
});

function toImport(row: Row): ImportVehicleRow | null {
  if (
    !row.fleet_id.trim() &&
    !row.vin.trim() &&
    !row.license_plate.trim() &&
    !row.make.trim() &&
    !row.model.trim()
  ) {
    return null;
  }
  return {
    fleet_id: row.fleet_id.trim() || null,
    vin: row.vin.trim() || null,
    license_plate: row.license_plate.trim() || null,
    state: row.state.trim() || null,
    year: row.year ? Number(row.year) : null,
    make: row.make.trim() || null,
    model: row.model.trim() || null,
    trim: row.trim.trim() || null,
    engine: row.engine.trim() || null,
    mileage: row.mileage ? Number(row.mileage) : null,
    color: row.color.trim() || null,
  };
}

function parseCsv(text: string): ImportVehicleRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = (line: string) =>
    line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const hasHeader = header.some((h) =>
    ["vin", "fleet_id", "vehicle_id", "license_plate", "plate", "make", "model", "year"].includes(h),
  );
  const rows = (hasHeader ? lines.slice(1) : lines).map((line) => split(line));
  const idx = (names: string[]) => header.findIndex((h) => names.includes(h));
  const col = (r: string[], names: string[], fallback: number) => {
    const i = hasHeader ? idx(names) : fallback;
    return i >= 0 ? r[i] ?? "" : "";
  };

  return rows
    .map((r) => ({
      fleet_id: col(r, ["fleet_id", "vehicle_id", "fleet", "unit"], 0) || null,
      vin: col(r, ["vin"], hasHeader ? -1 : 1) || null,
      license_plate: col(r, ["license_plate", "plate", "lic", "tag"], hasHeader ? -1 : 2) || null,
      state: col(r, ["state"], hasHeader ? -1 : 3) || "MI",
      year: Number(col(r, ["year"], hasHeader ? -1 : 4)) || null,
      make: col(r, ["make"], hasHeader ? -1 : 5) || null,
      model: col(r, ["model"], hasHeader ? -1 : 6) || null,
      trim: col(r, ["trim"], hasHeader ? -1 : 7) || null,
      engine: col(r, ["engine"], hasHeader ? -1 : 8) || null,
      mileage: Number(col(r, ["mileage", "odometer", "miles"], hasHeader ? -1 : 9)) || null,
      color: col(r, ["color", "colour"], hasHeader ? -1 : 10) || null,
    }))
    .filter((r) => r.vin || r.fleet_id || r.license_plate || r.make || r.model)
    .map((r) => ({
      ...r,
      fleet_id: r.fleet_id || null,
      vin: r.vin || null,
      license_plate: r.license_plate || null,
      state: r.state || null,
      make: r.make || null,
      model: r.model || null,
      trim: r.trim || null,
      engine: r.engine || null,
      color: r.color || null,
    }));
}

export function ClientVehiclesImport({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [csv, setCsv] = useState("");
  const [pending, setPending] = useState(false);

  const gridCount = useMemo(() => rows.filter((r) => toImport(r)).length, [rows]);

  function update(i: number, key: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  async function submit(vehicles: ImportVehicleRow[]) {
    if (!vehicles.length) {
      toast.error("Add at least one vehicle row.");
      return;
    }
    setPending(true);
    try {
      const res = await importClientVehicles({ client_id: clientId, vehicles });
      toast.success(
        `${clientName}: ${res.created} added, ${res.updated} updated` +
          (res.skipped ? `, ${res.skipped} skipped` : ""),
      );
      if (res.errors.length) toast.warning(res.errors.slice(0, 4).join(" · "));
      setRows([emptyRow(), emptyRow(), emptyRow()]);
      setCsv("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add cars for {clientName}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="grid">
          <TabsList>
            <TabsTrigger value="grid">Spreadsheet</TabsTrigger>
            <TabsTrigger value="csv">Paste CSV / Excel</TabsTrigger>
          </TabsList>
          <TabsContent value="grid" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              VIN is the matching key. Fleet ID (A010) and plate are optional labels. Existing VINs update instead of
              duplicating.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-2 font-medium">Fleet ID</th>
                    <th className="pb-2 pr-2 font-medium">VIN</th>
                    <th className="pb-2 pr-2 font-medium">Plate</th>
                    <th className="pb-2 pr-2 font-medium">St</th>
                    <th className="pb-2 pr-2 font-medium">Year</th>
                    <th className="pb-2 pr-2 font-medium">Make</th>
                    <th className="pb-2 pr-2 font-medium">Model</th>
                    <th className="pb-2 pr-2 font-medium">Trim</th>
                    <th className="pb-2 pr-2 font-medium">Engine</th>
                    <th className="pb-2 pr-2 font-medium">Miles</th>
                    <th className="pb-2 pr-2 font-medium">Color</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {(
                        [
                          ["fleet_id", "A010"],
                          ["vin", "17-char VIN"],
                          ["license_plate", "DE6014"],
                          ["state", "MI"],
                          ["year", "2016"],
                          ["make", "Ford"],
                          ["model", "Fusion"],
                          ["trim", "SE"],
                          ["engine", "2.5L"],
                          ["mileage", "168700"],
                          ["color", "White"],
                        ] as Array<[keyof Row, string]>
                      ).map(([key, ph]) => (
                        <td key={key} className="pr-2 pb-2">
                          <Input
                            value={row[key]}
                            placeholder={ph}
                            className={key === "vin" ? "font-mono uppercase" : undefined}
                            onChange={(e) => update(i, key, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="pb-2">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setRows((r) => [...r, emptyRow()])}>
                <Plus className="mr-1 h-4 w-4" />
                Add row
              </Button>
              <Button type="button" disabled={pending || gridCount === 0} onClick={() => void submit(rows.map(toImport).filter((x): x is ImportVehicleRow => Boolean(x)))}>
                {pending ? "Saving…" : `Save ${gridCount} car${gridCount === 1 ? "" : "s"}`}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="csv" className="space-y-3 pt-4">
            <Label htmlFor="csv">Paste from Excel or CSV</Label>
            <p className="text-xs text-muted-foreground">
              Header row optional. Recognized columns: vin, fleet_id / vehicle_id, license_plate / plate, state, year,
              make, model, trim, engine, mileage, color.
            </p>
            <Textarea
              id="csv"
              rows={10}
              className="font-mono text-xs"
              placeholder={"fleet_id,vin,license_plate,state,year,make,model,trim,engine,mileage,color\nA010,1FA6P0H74G5132219,DE6014,MI,2016,Ford,Fusion,SE,2.5L,168710,White"}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            <Button type="button" disabled={pending || !csv.trim()} onClick={() => void submit(parseCsv(csv))}>
              {pending ? "Saving…" : "Import pasted cars"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
