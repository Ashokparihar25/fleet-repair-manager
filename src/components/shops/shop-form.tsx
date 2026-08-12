"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveShop } from "@/app/actions/fleet";
import type { RepairShop } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ShopForm({ shop }: { shop?: RepairShop }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    try {
      const res = await saveShop(formData);
      toast.success("Shop saved");
      router.push(`/shops/${res.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save shop");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-4 p-5 md:grid-cols-2">
        <form action={action} className="contents">
          {shop && <input type="hidden" name="id" value={shop.id} />}
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={shop?.name} required />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={shop?.address ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={shop?.city ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" defaultValue={shop?.state ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" name="zip" defaultValue={shop?.zip ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={shop?.phone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fax">Fax</Label>
            <Input id="fax" name="fax" defaultValue={shop?.fax ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="registration_number">Registration #</Label>
            <Input id="registration_number" name="registration_number" defaultValue={shop?.registration_number ?? ""} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={shop?.notes ?? ""} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save shop"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
