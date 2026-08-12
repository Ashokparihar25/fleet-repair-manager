"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function PartsSearch() {
  const router = useRouter();
  const sp = useSearchParams();
  return (
    <form
      className="mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        router.push(`/parts?q=${encodeURIComponent(String(q || ""))}`);
      }}
    >
      <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="Search alternator, ES801110, brake rotor…" />
    </form>
  );
}
