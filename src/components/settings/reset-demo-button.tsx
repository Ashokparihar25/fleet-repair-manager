"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetDemoData } from "@/app/actions/fleet";
import { Button } from "@/components/ui/button";

export function ResetDemoButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <Button
      variant="outline"
      className="mt-3"
      disabled={pending}
      onClick={async () => {
        if (!confirm("Reset local store to the seeded LALA invoices?")) return;
        setPending(true);
        try {
          await resetDemoData();
          toast.success("Demo data reset");
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Reset failed");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Resetting…" : "Reset seeded LALA data"}
    </Button>
  );
}
