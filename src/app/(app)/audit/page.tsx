import Link from "next/link";
import { getStore } from "@/lib/data/queries";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function AuditPage() {
  const store = await getStore();
  const logs = [...store.audit_logs].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Who created or edited invoices, vehicles, warranties, and maintenance — including old and new values."
      />
      <Card>
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No audit events yet. Edits to invoices, mileage, vehicles, warranties, and maintenance are recorded here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old value</TableHead>
                <TableHead>New value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const user = store.profiles.find((p) => p.id === log.user_id);
                const href =
                  log.entity_type === "invoice" && log.entity_id
                    ? `/invoices/${log.entity_id}`
                    : log.entity_type === "vehicle" && log.entity_id
                      ? `/vehicles/${log.entity_id}`
                      : null;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(log.created_at.slice(0, 10))}{" "}
                      <span className="text-muted-foreground">{log.created_at.slice(11, 19)}</span>
                    </TableCell>
                    <TableCell>{user?.full_name ?? user?.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {href ? (
                        <Link href={href} className="text-primary hover:underline">
                          {log.entity_type}
                        </Link>
                      ) : (
                        log.entity_type
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.field_name ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">{log.old_value ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">{log.new_value ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
