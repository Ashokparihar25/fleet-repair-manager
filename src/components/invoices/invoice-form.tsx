"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveInvoice, type SaveInvoiceInput } from "@/app/actions/fleet";
import { addMoney, money } from "@/lib/money";
import type { InvoiceWithRelations, RepairShop, Vehicle } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PartRow = { description: string; part_number: string; quantity: string; unit_price: string; extended_price: string; notes: string };
type LaborRow = { description: string; amount: string; notes: string };

export function InvoiceForm({
  invoice,
  vehicles,
  shops,
  defaultVehicleId,
}: {
  invoice?: InvoiceWithRelations;
  vehicles: Vehicle[];
  shops: RepairShop[];
  defaultVehicleId?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [parts, setParts] = useState<PartRow[]>(
    invoice?.parts.map((p) => ({
      description: p.part_description,
      part_number: p.part_number ?? "",
      quantity: p.quantity ?? "",
      unit_price: p.unit_price ?? "",
      extended_price: p.extended_price ?? "",
      notes: p.notes ?? "",
    })) ?? [{ description: "", part_number: "", quantity: "1", unit_price: "", extended_price: "", notes: "" }],
  );
  const [labor, setLabor] = useState<LaborRow[]>(
    invoice?.labor.map((l) => ({
      description: l.labor_description,
      amount: l.extended_amount ?? "",
      notes: l.notes ?? "",
    })) ?? [{ description: "", amount: "", notes: "" }],
  );

  const [partsTotal, setPartsTotal] = useState(invoice?.parts_total ?? "");
  const [laborTotal, setLaborTotal] = useState(invoice?.labor_total ?? "");
  const [tax, setTax] = useState(invoice?.tax ?? "");
  const [invoiceTotal, setInvoiceTotal] = useState(invoice?.invoice_total ?? "");
  const [paymentAmount, setPaymentAmount] = useState(invoice?.payments[0]?.amount ?? "");
  const [balanceDue, setBalanceDue] = useState(invoice?.balance_due ?? "0.00");

  const calculated = useMemo(() => addMoney(partsTotal || sumParts(), laborTotal || sumLabor(), tax), [parts, labor, partsTotal, laborTotal, tax]);

  function sumParts() {
    return addMoney(...parts.map((p) => p.extended_price || money(Number(p.quantity || 0) * Number(p.unit_price || 0))));
  }
  function sumLabor() {
    return addMoney(...labor.map((l) => l.amount));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const payload: SaveInvoiceInput = {
        id: invoice?.id,
        invoice_number: String(fd.get("invoice_number") || "").trim() || null,
        vehicle_id: String(fd.get("vehicle_id") || "") || null,
        repair_shop_id: String(fd.get("repair_shop_id") || "") || null,
        invoice_date: String(fd.get("invoice_date") || "") || null,
        printed_date: String(fd.get("printed_date") || "") || null,
        proposed_completion_date: String(fd.get("proposed_completion_date") || "") || null,
        work_completed_date: String(fd.get("work_completed_date") || "") || null,
        customer_name: String(fd.get("customer_name") || "").trim() || null,
        customer_id: String(fd.get("customer_id") || "").trim() || null,
        license_number: String(fd.get("license_number") || "").trim() || null,
        license_state: String(fd.get("license_state") || "").trim() || null,
        odometer_in: fd.get("odometer_in") ? Number(fd.get("odometer_in")) : null,
        technician_name: String(fd.get("technician_name") || "").trim() || null,
        technician_certification_number: String(fd.get("technician_certification_number") || "").trim() || null,
        parts_total: partsTotal || sumParts(),
        labor_total: laborTotal || sumLabor(),
        tax: tax || "0.00",
        invoice_total: invoiceTotal || null,
        balance_due: balanceDue || "0.00",
        payment_status: String(fd.get("payment_status") || "unpaid") as SaveInvoiceInput["payment_status"],
        payment_method: (String(fd.get("payment_method") || "") || null) as SaveInvoiceInput["payment_method"],
        original_estimate_amount: String(fd.get("original_estimate_amount") || "") || null,
        notes: String(fd.get("notes") || "") || null,
        manually_verified: true,
        ocr_status: invoice?.ocr_status ?? "skipped",
        parts: parts.filter((p) => p.description.trim()),
        labor: labor.filter((l) => l.description.trim()),
        payments: paymentAmount
          ? [
              {
                amount: paymentAmount,
                payment_method: (String(fd.get("payment_method") || "") || null) as SaveInvoiceInput["payment_method"],
                payment_date: String(fd.get("work_completed_date") || fd.get("invoice_date") || "") || null,
              },
            ]
          : [],
      };
      const res = await saveInvoice(payload);
      toast.success("Invoice saved");
      router.push(`/invoices/${res.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save invoice");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Invoice #" name="invoice_number" defaultValue={invoice?.invoice_number ?? ""} required />
          <div className="space-y-1.5">
            <Label>Vehicle (VIN / fleet ID)</Label>
            <select name="vehicle_id" defaultValue={invoice?.vehicle_id ?? defaultVehicleId ?? ""} className="h-9 w-full rounded-md border bg-card px-3 text-sm" required>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {(v.vehicle_id ?? "No fleet ID") + " · " + [v.year, v.make, v.model].filter(Boolean).join(" ") + (v.vin ? ` · ${v.vin}` : "")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Repair shop</Label>
            <select name="repair_shop_id" defaultValue={invoice?.repair_shop_id ?? shops[0]?.id ?? ""} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
              <option value="">Select shop…</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Field label="Invoice date" name="invoice_date" type="date" defaultValue={invoice?.invoice_date ?? ""} />
          <Field label="Printed date" name="printed_date" type="date" defaultValue={invoice?.printed_date ?? ""} />
          <Field label="Proposed completion" name="proposed_completion_date" type="date" defaultValue={invoice?.proposed_completion_date ?? ""} />
          <Field label="Work completed" name="work_completed_date" type="date" defaultValue={invoice?.work_completed_date ?? ""} />
          <Field label="Odometer in" name="odometer_in" type="number" defaultValue={invoice?.odometer_in?.toString() ?? ""} />
          <Field label="Customer name" name="customer_name" defaultValue={invoice?.customer_name ?? ""} />
          <Field label="Customer ID" name="customer_id" defaultValue={invoice?.customer_id ?? ""} />
          <Field label="License #" name="license_number" defaultValue={invoice?.license_number ?? ""} />
          <Field label="License state" name="license_state" defaultValue={invoice?.license_state ?? ""} />
          <Field label="Technician" name="technician_name" defaultValue={invoice?.technician_name ?? ""} />
          <Field label="Tech certification #" name="technician_certification_number" defaultValue={invoice?.technician_certification_number ?? ""} />
          <Field label="Original estimate" name="original_estimate_amount" defaultValue={invoice?.original_estimate_amount ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Parts</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setParts([...parts, { description: "", part_number: "", quantity: "1", unit_price: "", extended_price: "", notes: "" }])}>
            <Plus className="h-4 w-4" /> Add part
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {parts.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12">
              <Input className="md:col-span-4" placeholder="Description" value={p.description} onChange={(e) => updatePart(i, { description: e.target.value })} />
              <Input className="md:col-span-2" placeholder="Part #" value={p.part_number} onChange={(e) => updatePart(i, { part_number: e.target.value })} />
              <Input className="md:col-span-1" placeholder="Qty" value={p.quantity} onChange={(e) => updatePart(i, { quantity: e.target.value })} />
              <Input className="md:col-span-2" placeholder="Unit" value={p.unit_price} onChange={(e) => updatePart(i, { unit_price: e.target.value })} />
              <Input className="md:col-span-2" placeholder="Extended" value={p.extended_price} onChange={(e) => updatePart(i, { extended_price: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setParts(parts.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Labor</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => setLabor([...labor, { description: "", amount: "", notes: "" }])}>
            <Plus className="h-4 w-4" /> Add labor
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Labor is independent of parts. Do not force a 1-to-1 match.</p>
          {labor.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-12">
              <Textarea className="md:col-span-8 min-h-[60px]" placeholder="Labor description" value={l.description} onChange={(e) => updateLabor(i, { description: e.target.value })} />
              <Input className="md:col-span-3" placeholder="Amount" value={l.amount} onChange={(e) => updateLabor(i, { amount: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" onClick={() => setLabor(labor.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals & payment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Parts total (source)" value={partsTotal} onChange={(e) => setPartsTotal(e.target.value)} hint={`Line sum ${sumParts()}`} />
          <Field label="Labor total (source)" value={laborTotal} onChange={(e) => setLaborTotal(e.target.value)} hint={`Line sum ${sumLabor()}`} />
          <Field label="Tax" value={tax} onChange={(e) => setTax(e.target.value)} />
          <Field label="Invoice total (source — never overwrite)" value={invoiceTotal} onChange={(e) => setInvoiceTotal(e.target.value)} hint={`Calculated ${calculated}`} />
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <select name="payment_method" defaultValue={invoice?.payment_method ?? "visa"} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
              {["visa", "mastercard", "amex", "discover", "cash", "check", "ach", "other"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment status</Label>
            <select name="payment_status" defaultValue={invoice?.payment_status ?? "paid"} className="h-9 w-full rounded-md border bg-card px-3 text-sm">
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="voided">Voided</option>
            </select>
          </div>
          <Field label="Payment amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          <Field label="Balance due" value={balanceDue} onChange={(e) => setBalanceDue(e.target.value)} />
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={invoice?.notes ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save invoice"}</Button>
    </form>
  );

  function updatePart(i: number, patch: Partial<PartRow>) {
    setParts(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function updateLabor(i: number, patch: Partial<LaborRow>) {
    setLabor(labor.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
}

function Field({
  label,
  hint,
  name,
  defaultValue,
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, "defaultValue"> & {
  label: string;
  hint?: string;
  name?: string;
  defaultValue?: string | number | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        {...(value !== undefined ? { value } : { defaultValue: defaultValue ?? "" })}
        {...props}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
