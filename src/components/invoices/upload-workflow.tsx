"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload, AlertTriangle, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { createVehicleFromVin, saveInvoice } from "@/app/actions/fleet";
import { findOcrDuplicate, type InvoiceDupCandidate } from "@/lib/duplicates";
import { isEmptyExtraction } from "@/lib/ocr/quality";
import { normalizeVin, isValidVin, vinValidationError } from "@/lib/vin";
import type { OcrExtractionResult, RepairShop, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type ItemStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "review"
  | "duplicate"
  | "saving"
  | "saved"
  | "skipped"
  | "error";

type QueueItem = {
  id: string;
  file: File;
  status: ItemStatus;
  page?: number;
  message?: string;
  upload?: { file_name: string; file_path: string; file_type: string; file_size: number };
  extraction?: OcrExtractionResult;
  warning?: string;
  duplicateOf?: InvoiceDupCandidate | null;
};

function confClass(n: number | undefined) {
  if (n == null) return "";
  if (n < 50) return "field-bad";
  if (n < 80) return "field-low";
  return "";
}

function matchShop(extraction: OcrExtractionResult | undefined, shops: RepairShop[]) {
  const name = extraction?.repair_shop.name?.toLowerCase();
  if (!name) return shops[0] ?? null;
  return shops.find((s) => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase())) ?? shops[0] ?? null;
}

function detectDuplicate(
  extraction: OcrExtractionResult | undefined,
  shops: RepairShop[],
  known: InvoiceDupCandidate[],
): InvoiceDupCandidate | null {
  if (!extraction) return null;
  const shop = matchShop(extraction, shops);
  return findOcrDuplicate({
    invoiceNumber: extraction.invoice.invoice_number,
    vin: normalizeVin(extraction.invoice.vin || extraction.vehicle.vin || ""),
    repairShopId: shop?.id ?? null,
    invoiceDate: extraction.invoice.printed_date || extraction.invoice.work_completed_date,
    invoiceTotal: extraction.invoice.total,
    existing: known,
  });
}

export function UploadWorkflow({
  vehicles,
  shops,
  existingInvoices,
}: {
  vehicles: Vehicle[];
  shops: RepairShop[];
  existingInvoices: InvoiceDupCandidate[];
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createNewVehicle, setCreateNewVehicle] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [fleetId, setFleetId] = useState("");
  const [sessionSaved, setSessionSaved] = useState<InvoiceDupCandidate[]>(existingInvoices);
  const [forceSaveDuplicate, setForceSaveDuplicate] = useState(false);

  const active = queue.find((q) => q.id === activeId) ?? null;
  const extraction = active?.extraction;

  const vinMatch = useMemo(() => {
    const vin = normalizeVin(extraction?.invoice.vin || extraction?.vehicle.vin || "");
    if (!vin) return null;
    return vehicles.find((v) => v.vin === vin) ?? null;
  }, [extraction, vehicles]);

  const extractedVin = useMemo(
    () => normalizeVin(extraction?.invoice.vin || extraction?.vehicle.vin || ""),
    [extraction],
  );

  const shopMatch = useMemo(() => matchShop(extraction, shops), [extraction, shops]);

  const activeDuplicate = useMemo(() => {
    if (active?.duplicateOf) return active.duplicateOf;
    return detectDuplicate(extraction, shops, sessionSaved);
  }, [active, extraction, shops, sessionSaved]);

  useEffect(() => {
    setForceSaveDuplicate(false);
    const vin = normalizeVin(extraction?.invoice.vin || extraction?.vehicle.vin || "");
    const match = vin ? vehicles.find((v) => v.vin === vin) : null;
    if (match) {
      setSelectedVehicleId(match.id);
      setCreateNewVehicle(false);
    } else if (vin && isValidVin(vin)) {
      setSelectedVehicleId("");
      setCreateNewVehicle(true);
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

  function buildReviewItem(
    base: Pick<QueueItem, "id" | "file" | "upload" | "page">,
    extraction: OcrExtractionResult | undefined,
    warning: string | undefined,
    known: InvoiceDupCandidate[],
    seenInBatch: InvoiceDupCandidate[],
  ): QueueItem {
    const empty = isEmptyExtraction(extraction);
    const dup = detectDuplicate(extraction, shops, [...known, ...seenInBatch]);
    const invoiceNo = extraction?.invoice.invoice_number;
    if (dup) {
      return {
        ...base,
        status: "duplicate",
        extraction,
        warning,
        duplicateOf: dup,
        message: invoiceNo
          ? `#${invoiceNo} already saved — skip`
          : `Already saved as #${dup.invoice_number ?? dup.id.slice(0, 8)} — skip`,
      };
    }
    return {
      ...base,
      status: "review",
      extraction,
      warning:
        warning ||
        (empty
          ? "OCR returned little/no data for this page. Fill fields manually or re-upload a clearer scan."
          : undefined),
      duplicateOf: null,
      message: invoiceNo
        ? `#${invoiceNo}${base.page ? ` · page ${base.page}` : ""}`
        : empty
          ? `${base.page ? `Page ${base.page} · ` : ""}empty`
          : base.page
            ? `Page ${base.page} · needs review`
            : "Needs review",
    };
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
      const extractions: OcrExtractionResult[] =
        Array.isArray(ocr.extractions) && ocr.extractions.length
          ? ocr.extractions
          : ocr.extraction
            ? [ocr.extraction]
            : [];

      if (extractions.length <= 1) {
        const item = buildReviewItem(
          { id, file, upload: up },
          extractions[0],
          ocr.warning,
          sessionSaved,
          [],
        );
        update(id, item);
        setActiveId((current) => current ?? id);
        return;
      }

      setQueue((q) => {
        const idx = q.findIndex((i) => i.id === id);
        if (idx < 0) return q;
        const base = q[idx];
        const batchSeen: InvoiceDupCandidate[] = [];
        const expanded: QueueItem[] = extractions.map((extraction, i) => {
          const item = buildReviewItem(
            {
              id: `${id}-p${i + 1}`,
              file: base.file,
              upload: base.upload ?? up,
              page: i + 1,
            },
            extraction,
            ocr.warnings?.[i] || (i === 0 ? ocr.warning : undefined),
            sessionSaved,
            batchSeen,
          );
          if (extraction?.invoice.invoice_number && item.status !== "duplicate") {
            batchSeen.push({
              id: item.id,
              invoice_number: extraction.invoice.invoice_number,
              vehicle_id: null,
              repair_shop_id: matchShop(extraction, shops)?.id ?? null,
              invoice_date: extraction.invoice.printed_date || extraction.invoice.work_completed_date,
              invoice_total: extraction.invoice.total,
              vin: normalizeVin(extraction.invoice.vin || extraction.vehicle.vin || ""),
            });
          }
          return item;
        });
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

  function goNext(fromId: string) {
    setQueue((q) => {
      const next = q.find((item) => (item.status === "review" || item.status === "duplicate") && item.id !== fromId);
      if (next) setActiveId(next.id);
      return q;
    });
  }

  function skipItem(id: string, reason = "Skipped — already in system") {
    update(id, { status: "skipped", message: reason });
    toast.message(reason);
    goNext(id);
  }

  function skipAllDuplicates() {
    let nextId: string | null = null;
    let count = 0;
    setQueue((q) => {
      count = q.filter((item) => item.status === "duplicate").length;
      const updated = q.map((item) =>
        item.status === "duplicate"
          ? {
              ...item,
              status: "skipped" as const,
              message: `Skipped duplicate #${item.duplicateOf?.invoice_number ?? item.extraction?.invoice.invoice_number ?? ""}`,
            }
          : item,
      );
      nextId = updated.find((item) => item.status === "review")?.id ?? null;
      return updated;
    });
    if (!count) {
      toast.message("No duplicate invoices to skip");
      return;
    }
    toast.success(`Skipped ${count} duplicate invoice${count === 1 ? "" : "s"}`);
    if (nextId) setActiveId(nextId);
  }

  async function confirmSave(form: HTMLFormElement) {
    if (!active?.extraction || !active.upload) return;
    const fd = new FormData(form);
    const invoiceNumber = String(fd.get("invoice_number") || "") || null;
    const liveDup =
      activeDuplicate ||
      findOcrDuplicate({
        invoiceNumber,
        vin: normalizeVin(String(fd.get("vin") || "")),
        repairShopId: String(fd.get("repair_shop_id") || "") || null,
        invoiceDate: String(fd.get("printed_date") || fd.get("work_completed_date") || "") || null,
        invoiceTotal: String(fd.get("total") || "") || null,
        existing: sessionSaved,
      });

    if (liveDup && !forceSaveDuplicate) {
      update(active.id, {
        status: "duplicate",
        duplicateOf: liveDup,
        message: `#${invoiceNumber ?? liveDup.invoice_number} already saved — skip`,
      });
      toast.error(`Invoice #${invoiceNumber ?? "—"} is already saved. Skip it, or choose Save anyway.`);
      return;
    }

    update(active.id, { status: "saving" });
    try {
      let vehicleId = String(fd.get("vehicle_id") || selectedVehicleId || "");
      const vin = normalizeVin(String(fd.get("vin") || "")) || "";
      if (!vehicleId && vin) {
        const match = vehicles.find((v) => v.vin === vin);
        if (match) vehicleId = match.id;
      }
      if (!vehicleId && vin && (createNewVehicle || isValidVin(vin))) {
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
        throw new Error(
          vin
            ? "Vehicle not found — enable “Create new vehicle from extracted VIN” or select an existing vehicle."
            : "No VIN extracted. Enter a VIN, create a new vehicle, or select an existing vehicle.",
        );
      }

      const parts = collectRepeating(fd, "part_description", ["part_number", "quantity", "unit_price", "extended_price"]);
      const labor = collectLabor(fd);

      const res = await saveInvoice({
        invoice_number: invoiceNumber,
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
        allow_duplicate: forceSaveDuplicate,
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

      const savedMeta: InvoiceDupCandidate = {
        id: res.id,
        invoice_number: invoiceNumber,
        vehicle_id: vehicleId,
        repair_shop_id: String(fd.get("repair_shop_id") || "") || null,
        invoice_date: String(fd.get("printed_date") || fd.get("work_completed_date") || "") || null,
        invoice_total: String(fd.get("total") || "") || null,
        vin: vin || null,
      };
      setSessionSaved((prev) => [...prev, savedMeta]);
      // Mark any other queue items with the same invoice # as duplicates.
      setQueue((q) =>
        q.map((item) => {
          if (item.id === active.id) {
            return { ...item, status: "saved", message: `Saved #${invoiceNumber || res.id.slice(0, 8)}` };
          }
          if (item.status !== "review" && item.status !== "duplicate") return item;
          const otherDup = detectDuplicate(item.extraction, shops, [...sessionSaved, savedMeta]);
          if (!otherDup) return item;
          return {
            ...item,
            status: "duplicate",
            duplicateOf: otherDup,
            message: `#${item.extraction?.invoice.invoice_number ?? otherDup.invoice_number} already saved — skip`,
          };
        }),
      );
      toast.success("Invoice saved");
      setForceSaveDuplicate(false);
      const next = queue.find((q) => (q.status === "review" || q.status === "duplicate") && q.id !== active.id);
      if (next) setActiveId(next.id);
      else router.push(`/invoices/${res.id}`);
      router.refresh();
    } catch (e) {
      update(active.id, { status: activeDuplicate ? "duplicate" : "review", message: e instanceof Error ? e.message : "Save failed" });
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  const done = queue.filter((q) => q.status === "saved" || q.status === "skipped").length;
  const review = queue.filter((q) => q.status === "review" || q.status === "duplicate").length;
  const dupCount = queue.filter((q) => q.status === "duplicate").length;

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
            <div className="text-xs text-muted-foreground">Already-saved invoice #s are flagged to skip</div>
            <input type="file" className="hidden" multiple accept="application/pdf,image/*" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {queue.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">
                Done {done} · left {review} · of {queue.length}
              </div>
              {dupCount > 0 && (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={skipAllDuplicates}>
                  <SkipForward className="mr-1 h-3.5 w-3.5" />
                  Skip all {dupCount} duplicates
                </Button>
              )}
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
                    item.status === "duplicate" && "border-amber-300",
                    item.status === "skipped" && "opacity-70",
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
              verification. If an invoice number is already in the system, you can skip it instead of saving again.
            </CardContent>
          </Card>
        ) : active.status === "skipped" ? (
          <Card>
            <CardContent className="space-y-3 p-8">
              <p className="text-sm">{active.message ?? "Skipped"}</p>
              <Button type="button" variant="outline" onClick={() => goNext(active.id)}>
                Next invoice
              </Button>
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
            {(active.status === "duplicate" || activeDuplicate) && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Already in the system</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Invoice #{extraction.invoice.invoice_number ?? "—"} matches existing{" "}
                    <Link
                      href={`/invoices/${(activeDuplicate ?? active.duplicateOf)?.id}`}
                      className="font-medium underline"
                    >
                      #{(activeDuplicate ?? active.duplicateOf)?.invoice_number ?? "invoice"}
                    </Link>
                    . Skip it to avoid a duplicate, or save anyway if this really is a new record.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() =>
                        skipItem(
                          active.id,
                          `Skipped duplicate #${extraction.invoice.invoice_number ?? (activeDuplicate ?? active.duplicateOf)?.invoice_number}`,
                        )
                      }
                    >
                      Skip this invoice
                    </Button>
                    {(activeDuplicate ?? active.duplicateOf)?.id && (
                      <Button type="button" variant="outline" asChild>
                        <Link href={`/invoices/${(activeDuplicate ?? active.duplicateOf)!.id}`}>Open existing</Link>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setForceSaveDuplicate(true);
                        update(active.id, { status: "review" });
                        toast.message("Duplicate override on — Confirm & save will create another record.");
                      }}
                    >
                      Save anyway
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

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
            ) : extractedVin && isValidVin(extractedVin) ? (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>New VIN ready to save</AlertTitle>
                <AlertDescription>
                  VIN {extractedVin} was not in the fleet. “Create new vehicle” is checked — Confirm & save will add it automatically.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No VIN matched — enter VIN or select a vehicle</AlertTitle>
                <AlertDescription>
                  OCR did not find a usable VIN on this page. Paste the VIN from the PDF, then save (a new vehicle will be created automatically).
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

            <div className="flex flex-wrap gap-2">
              {(active.status === "duplicate" || activeDuplicate) && !forceSaveDuplicate ? (
                <Button
                  type="button"
                  onClick={() =>
                    skipItem(
                      active.id,
                      `Skipped duplicate #${extraction.invoice.invoice_number ?? (activeDuplicate ?? active.duplicateOf)?.invoice_number}`,
                    )
                  }
                >
                  Skip this invoice
                </Button>
              ) : (
                <Button type="submit" disabled={active.status === "saving"}>
                  {active.status === "saving" ? "Saving…" : forceSaveDuplicate ? "Save duplicate anyway" : "Confirm & save"}
                </Button>
              )}
              <Badge variant="secondary">OCR confidence {extraction.overall_confidence}%</Badge>
              {forceSaveDuplicate && <Badge variant="destructive">Duplicate override</Badge>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "saved" || status === "skipped") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "duplicate" || status === "error" || status === "review") {
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  }
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
