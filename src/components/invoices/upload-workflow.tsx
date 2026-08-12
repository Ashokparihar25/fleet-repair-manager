"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createVehicleFromVin, saveInvoice } from "@/app/actions/fleet";
import { normalizeVin, isValidVin, vinValidationError } from "@/lib/vin";
import type { OcrExtractionResult, RepairShop, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ItemStatus = "queued" | "uploading" | "extracting" | "review" | "saving" | "saved" | "error";

type QueueItem = {
  id: string;
  file: File;
  status: ItemStatus;
  page?: number;
  message?: string;
  upload?: { file_name: string; file_path: string; file_type: string; file_size: number };
  extraction?: OcrExtractionResult;
  warning?: string;
};

function confClass(n: number | undefined) {
  if (n == null) return "";
  if (n < 50) return "field-bad";
  if (n < 80) return "field-low";
  return "";
}

export function UploadWorkflow({ vehicles, shops }: { vehicles: Vehicle[]; shops: RepairShop[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createNewVehicle, setCreateNewVehicle] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [fleetId, setFleetId] = useState("");

  const active = queue.find((q) => q.id === activeId) ?? null;
  const extraction = active?.extraction;

  const vinMatch = useMemo(() => {
    const vin = normalizeVin(extraction?.invoice.vin || extraction?.vehicle.vin || "");
    if (!vin) return null;
    return vehicles.find((v) => v.vin === vin) ?? null;
  }, [extraction, vehicles]);

  const shopMatch = useMemo(() => {
    const name = extraction?.repair_shop.name?.toLowerCase();
    if (!name) return shops[0] ?? null;
    return shops.find((s) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase())) ?? shops[0] ?? null;
  }, [extraction, shops]);

  useEffect(() => {
    const vin = normalizeVin(extraction?.invoice.vin || extraction?.vehicle.vin || "");
    const match = vin ? vehicles.find((v) => v.vin === vin) : null;
    if (match) {
      setSelectedVehicleId(match.id);
      setCreateNewVehicle(false);
    } else {
      setSelectedVehicleId("");
      setCreateNewVehicle(false);
    }
  }, [activeId, extraction, vehicles]);

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const items: QueueItem[] = [...files].map((file) => ({
      id: `${file.name}-${file.size}-${Math.random()}`,
      file,
      status: "queued",
    }));
    setQueue((q) => [...q, ...items]);
    void processAll([...queue, ...items]);
  }

  async function processAll(items: QueueItem[]) {
    for (const item of items.filter((i) => i.status === "queued")) {
      await processOne(item.id, item.file);
    }
  }

  async function processOne(id: string, file: File) {
    update(id, { status: "uploading" });
    try {
      const fd = new FormData();
      fd.set("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error || "Upload failed");
      update(id, { status: "extracting", upload: up });

      const ocrFd = new FormData();
      ocrFd.set("file", file);
      const ocrRes = await fetch("/api/ocr", { method: "POST", body: ocrFd });
      const ocr = await ocrRes.json();
      const extractions: OcrExtractionResult[] = Array.isArray(ocr.extractions) && ocr.extractions.length
        ? ocr.extractions
        : ocr.extraction
          ? [ocr.extraction]
          : [];

      if (extractions.length <= 1) {
        const extraction = extractions[0];
        update(id, {
          status: "review",
          extraction,
          warning: ocr.warning,
          message: extraction?.invoice.invoice_number
            ? `#${extraction.invoice.invoice_number}`
            : ocr.needs_review
              ? "Needs review"
              : "Extracted",
        });
        setActiveId((current) => current ?? id);
        return;
      }

      setQueue((q) => {
        const idx = q.findIndex((i) => i.id === id);
        if (idx < 0) return q;
        const base = q[idx];
        const expanded: QueueItem[] = extractions.map((extraction, i) => ({
          id: `${id}-p${i + 1}`,
          file: base.file,
          status: "review",
          page: i + 1,
          upload: base.upload ?? up,
          extraction,
          warning: ocr.warnings?.[i] || (i === 0 ? ocr.warning : undefined),
          message: extraction.invoice.invoice_number
            ? `#${extraction.invoice.invoice_number} · page ${i + 1}`
            : `Page ${i + 1} · needs review`,
        }));
        return [...q.slice(0, idx), ...expanded, ...q.slice(idx + 1)];
      });
      setActiveId(`${id}-p1`);
    } catch (e) {
      update(id, { status: "error", message: e instanceof Error ? e.message : "Failed" });
    }
  }

  function update(id: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function confirmSave(form: HTMLFormElement) {
    if (!active?.extraction || !active.upload) return;
    const fd = new FormData(form);
    update(active.id, { status: "saving" });
    try {
      let vehicleId = String(fd.get("vehicle_id") || selectedVehicleId || "");
      const vin = normalizeVin(String(fd.get("vin") || "")) || "";
      if (!vehicleId && createNewVehicle) {
        if (!vin) throw new Error("VIN is required to create a new vehicle.");
        if (!isValidVin(vin)) {
          throw new Error(vinValidationError(vin) || "Invalid VIN.");
        }
        const created = await createVehicleFromVin({
          vin,
          year: fd.get("year") ? Number(fd.get("year")) : null,
          make: String(fd.get("make") || "") || null,
          model: String(fd.get("model") || "") || null,
          trim: String(fd.get("trim") || "") || null,
          engine: String(fd.get("engine") || "") || null,
          fleetId: fleetId || null,
          mileage: fd.get("odometer_in") ? Number(fd.get("odometer_in")) : null,
        });
        vehicleId = created.id;
      }
      if (!vehicleId) {
        // Last chance: match normalized VIN against loaded vehicles
        const match = vin ? vehicles.find((v) => v.vin === vin) : null;
        if (match) vehicleId = match.id;
      }
      if (!vehicleId) {
        throw new Error("Vehicle not found — create a new vehicle or select an existing vehicle.");
      }

      const parts = collectRepeating(fd, "part_description", ["part_number", "quantity", "unit_price", "extended_price"]);
      const labor = collectLabor(fd);

      const res = await saveInvoice({
        invoice_number: String(fd.get("invoice_number") || "") || null,
        vehicle_id: vehicleId,
        repair_shop_id: String(fd.get("repair_shop_id") || "") || null,
        invoice_date: String(fd.get("printed_date") || fd.get("work_completed_date") || "") || null,
        printed_date: String(fd.get("printed_date") || "") || null,
        proposed_completion_date: String(fd.get("proposed_completion_date") || "") || null,
        work_completed_date: String(fd.get("work_completed_date") || "") || null,
        customer_name: String(fd.get("customer_name") || "") || null,
        customer_id: String(fd.get("customer_id") || "") || null,
        odometer_in: fd.get("odometer_in") ? Number(fd.get("odometer_in")) : null,
        technician_name: String(fd.get("technician_name") || "") || null,
        technician_certification_number: String(fd.get("technician_certification_number") || "") || null,
        parts_total: String(fd.get("parts_total") || "") || null,
        labor_total: String(fd.get("labor_total") || "") || null,
        tax: String(fd.get("tax") || "") || null,
        invoice_total: String(fd.get("total") || "") || null,
        balance_due: String(fd.get("balance_due") || "") || "0.00",
        payment_method: (String(fd.get("payment_method") || "visa").toLowerCase() as never) || "visa",
        notes: null,
        ocr_status: active.extraction.overall_confidence < 80 ? "needs_review" : "processed",
        ocr_confidence: active.extraction.overall_confidence,
        ocr_payload: active.extraction.ocr_payload,
        manually_verified: true,
        parts: parts.map((p) => ({
          description: p.part_description,
          part_number: p.part_number,
          quantity: p.quantity,
          unit_price: p.unit_price,
          extended_price: p.extended_price,
        })),
        labor: labor.map((l) => ({ description: l.description, amount: l.amount })),
        payments: fd.get("payment_amount")
          ? [
              {
                amount: String(fd.get("payment_amount")),
                payment_method: (String(fd.get("payment_method") || "visa").toLowerCase() as never) || "visa",
                payment_date: String(fd.get("work_completed_date") || fd.get("printed_date") || "") || null,
              },
            ]
          : [],
        document: {
          file_name: active.upload.file_name,
          file_path: active.upload.file_path,
          file_type: active.upload.file_type,
          file_size: active.upload.file_size,
          document_type: "invoice",
          ocr_processed: true,
          ocr_confidence: active.extraction.overall_confidence,
        },
      });
      update(active.id, { status: "saved", message: `Saved #${String(fd.get("invoice_number") || res.id.slice(0, 8))}` });
      toast.success("Invoice saved");
      const next = queue.find((q) => q.status === "review" && q.id !== active.id);
      if (next) setActiveId(next.id);
      else router.push(`/invoices/${res.id}`);
      router.refresh();
    } catch (e) {
      update(active.id, { status: "review", message: e instanceof Error ? e.message : "Save failed" });
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  const done = queue.filter((q) => q.status === "saved").length;
  const review = queue.filter((q) => q.status === "review").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/50">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">Drop PDFs/images or click</div>
            <div className="text-xs text-muted-foreground">Multiple files supported</div>
            <input type="file" className="hidden" multiple accept="application/pdf,image/*" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {queue.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              Processing {Math.min(done + review + 1, queue.length)} of {queue.length}
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {queue.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-xs",
                    activeId === item.id ? "border-primary bg-secondary" : "bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {item.extraction?.invoice.invoice_number
                        ? `#${item.extraction.invoice.invoice_number}`
                        : item.file.name}
                    </span>
                    <StatusIcon status={item.status} />
                  </div>
                  <div className="text-muted-foreground">{item.message ?? item.status}</div>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div>
        {!active || !extraction ? (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">
              Upload one or more LALA invoices. The original document is stored first, then OCR extraction is shown for
              verification. Nothing is saved until you confirm.
            </CardContent>
          </Card>
        ) : (
          <form
            key={active.id}
            onSubmit={(e) => {
              e.preventDefault();
              void confirmSave(e.currentTarget);
            }}
            className="space-y-4"
          >
            {active.warning && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Needs verification</AlertTitle>
                <AlertDescription>{active.warning}</AlertDescription>
              </Alert>
            )}
            {vinMatch ? (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Vehicle matched by VIN</AlertTitle>
                <AlertDescription>
                  {vinMatch.vehicle_id ?? "No fleet ID"} · {vinMatch.year} {vinMatch.make} {vinMatch.model} · {vinMatch.vin}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Vehicle not found — create new vehicle or select existing vehicle.</AlertTitle>
                <AlertDescription>
                  VIN is the matching key. A duplicate vehicle will never be created if the VIN already exists.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Verification</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Field label="Shop name" name="shop_name" defaultValue={extraction.repair_shop.name} conf={extraction.field_confidence["repair_shop.name"] ?? extraction.overall_confidence} />
                <div className="space-y-1.5">
                  <Label>Repair shop record</Label>
                  <select name="repair_shop_id" defaultValue={shopMatch?.id ?? ""} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <Field label="Invoice #" name="invoice_number" defaultValue={extraction.invoice.invoice_number} conf={extraction.field_confidence["invoice.invoice_number"] ?? extraction.overall_confidence} />
                <Field label="VIN" name="vin" defaultValue={extraction.invoice.vin ?? extraction.vehicle.vin} className="font-mono uppercase" conf={extraction.field_confidence["invoice.vin"] ?? extraction.overall_confidence} />
                <Field label="Year" name="year" defaultValue={extraction.vehicle.year?.toString()} />
                <Field label="Make" name="make" defaultValue={extraction.vehicle.make} />
                <Field label="Model" name="model" defaultValue={extraction.vehicle.model} />
                <Field label="Trim" name="trim" defaultValue={extraction.vehicle.trim} />
                <Field label="Engine" name="engine" defaultValue={extraction.vehicle.engine} />
                <Field label="Odometer" name="odometer_in" defaultValue={extraction.invoice.odometer_in?.toString()} conf={extraction.field_confidence["invoice.odometer_in"] ?? extraction.overall_confidence} />
                <Field label="Printed date" name="printed_date" type="date" defaultValue={extraction.invoice.printed_date ?? ""} />
                <Field label="Proposed completion" name="proposed_completion_date" type="date" defaultValue={extraction.invoice.proposed_completion_date ?? ""} />
                <Field label="Work completed" name="work_completed_date" type="date" defaultValue={extraction.invoice.work_completed_date ?? ""} />
                <Field label="Customer name" name="customer_name" defaultValue={extraction.invoice.customer_name} />
                <Field label="Customer ID" name="customer_id" defaultValue={extraction.invoice.customer_id} />
                <Field label="Parts total" name="parts_total" defaultValue={extraction.invoice.parts_total ?? ""} />
                <Field label="Labor total" name="labor_total" defaultValue={extraction.invoice.labor_total ?? ""} />
                <Field label="Tax" name="tax" defaultValue={extraction.invoice.tax ?? ""} />
                <Field label="Invoice total" name="total" defaultValue={extraction.invoice.total ?? ""} conf={extraction.field_confidence["invoice.total"] ?? extraction.overall_confidence} />
                <Field label="Balance due" name="balance_due" defaultValue={extraction.invoice.balance_due ?? "0.00"} />
                <Field label="Payment method" name="payment_method" defaultValue={extraction.invoice.payment_method ?? "Visa"} />
                <Field label="Payment amount" name="payment_amount" defaultValue={extraction.invoice.payment_amount ?? ""} />
                <Field label="Technician" name="technician_name" defaultValue={extraction.technician.name} />
                <Field label="Certification #" name="technician_certification_number" defaultValue={extraction.technician.certification_number} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vehicle mapping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  name="vehicle_id"
                  value={selectedVehicleId}
                  onChange={(e) => {
                    setSelectedVehicleId(e.target.value);
                    setCreateNewVehicle(false);
                  }}
                  className="h-9 w-full rounded-md border bg-card px-3 text-sm"
                >
                  <option value="">Select existing vehicle…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {(v.vehicle_id ?? "No fleet ID") + " · " + [v.year, v.make, v.model].filter(Boolean).join(" ") + (v.vin ? ` · ${v.vin}` : "")}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={createNewVehicle} onChange={(e) => setCreateNewVehicle(e.target.checked)} />
                  Create new vehicle from extracted VIN
                </label>
                {createNewVehicle && (
                  <div className="space-y-1.5">
                    <Label>Optional fleet ID mapping</Label>
                    <Input value={fleetId} onChange={(e) => setFleetId(e.target.value)} placeholder="A010" />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Parts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(extraction.parts.length ? extraction.parts : [{ description: "", part_number: "", quantity: null, unit_price: "", extended_price: "" }]).map((p, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-5">
                    <Input name="part_description" defaultValue={p.description ?? ""} placeholder="Description" />
                    <Input name="part_number" defaultValue={p.part_number ?? ""} placeholder="Part #" />
                    <Input name="quantity" defaultValue={p.quantity?.toString() ?? ""} placeholder="Qty" />
                    <Input name="unit_price" defaultValue={p.unit_price ?? ""} placeholder="Unit" />
                    <Input name="extended_price" defaultValue={p.extended_price ?? ""} placeholder="Ext" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Labor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(extraction.labor.length ? extraction.labor : [{ description: "", amount: "" }]).map((l, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-4">
                    <Input className="md:col-span-3" name="labor_description" defaultValue={l.description ?? ""} placeholder="Labor description" />
                    <Input name="labor_amount" defaultValue={l.amount ?? ""} placeholder="Amount" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button type="submit" disabled={active.status === "saving"}>
                {active.status === "saving" ? "Saving…" : "Confirm & save"}
              </Button>
              <Badge variant="secondary">OCR confidence {extraction.overall_confidence}%</Badge>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "saved") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "error" || status === "review") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (status === "queued") return <span className="text-muted-foreground">Queued</span>;
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
}

function Field({
  label,
  name,
  conf,
  defaultValue,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue"> & {
  label: string;
  name: string;
  conf?: number;
  defaultValue?: string | number | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {conf != null && <span className="ml-2 text-[10px] text-muted-foreground">{conf}%</span>}
      </Label>
      <Input id={name} name={name} className={confClass(conf)} defaultValue={defaultValue ?? ""} {...props} />
    </div>
  );
}

function collectRepeating(fd: FormData, primary: string, extras: string[]) {
  const primaries = fd.getAll(primary).map(String);
  const extraVals = Object.fromEntries(extras.map((k) => [k, fd.getAll(k).map(String)]));
  return primaries.map((description, i) => ({
    part_description: description,
    part_number: extraVals.part_number?.[i],
    quantity: extraVals.quantity?.[i],
    unit_price: extraVals.unit_price?.[i],
    extended_price: extraVals.extended_price?.[i],
  }));
}

function collectLabor(fd: FormData) {
  const descriptions = fd.getAll("labor_description").map(String);
  const amounts = fd.getAll("labor_amount").map(String);
  return descriptions.map((description, i) => ({ description, amount: amounts[i] }));
}
