import Link from "next/link";
import { getStore } from "@/lib/data/queries";
import { globalSearch } from "@/lib/search";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const store = await getStore();
  const hits = q ? globalSearch(store, q, 80) : [];

  return (
    <div>
      <PageHeader title="Search" description={q ? `Results for “${q}”` : "Search VIN, fleet ID, invoice #, parts, labor, shop."} />
      <Card>
        <CardContent className="divide-y p-0">
          {hits.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No results.</p>
          ) : (
            hits.map((h) => (
              <Link key={`${h.type}-${h.id}`} href={h.href} className="block px-5 py-3 hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{h.type}</Badge>
                  <span className="font-medium">{h.title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{h.subtitle}</div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
