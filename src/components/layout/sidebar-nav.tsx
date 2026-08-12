"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Car,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ScrollText,
  Settings,
  Store,
  Tags,
  Wrench,
  BarChart3,
  Cog,
  Hammer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/vehicles", label: "Vehicles", icon: Car },
  { href: "/invoices", label: "Repair Invoices", icon: ClipboardList },
  { href: "/shops", label: "Repair Shops", icon: Store },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/parts", label: "Parts", icon: Cog },
  { href: "/labor", label: "Labor", icon: Hammer },
  { href: "/categories", label: "Repair Categories", icon: Tags },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-slate-300 hover:bg-sidebar-accent/70 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/invoices/new"
        onClick={onNavigate}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
      >
        <FileText className="h-4 w-4" />
        New Invoice
      </Link>
    </nav>
  );
}
