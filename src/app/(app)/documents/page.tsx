import Link from "next/link";
import { getStore } from "@/lib/data/queries";
import { vehicleLabel } from "@/lib/analytics";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function DocumentsPage() {
  const store = await getStore();
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Original invoice PDFs/images are preserved. Editing OCR data never deletes the source file."
        actions={
          <Link href="/invoices/upload">
            <Button>Upload invoice</Button>
          </Link>
        }
      />
      <Card>
        {store.documents.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No documents uploaded yet. Seeded LALA invoices were entered from printed values without attaching the
            scanned files. Use Upload Invoice to store originals going forward.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>OCR</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.documents.map((d) => {
                const inv = store.invoices.find((i) => i.id === d.invoice_id);
                const v = store.vehicles.find((x) => x.id === (d.vehicle_id ?? inv?.vehicle_id));
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.file_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{d.document_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {inv ? (
                        <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                          #{inv.invoice_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{vehicleLabel(v)}</TableCell>
                    <TableCell>{formatDate(d.uploaded_at.slice(0, 10))}</TableCell>
                    <TableCell>{d.ocr_processed ? `${d.ocr_confidence ?? "—"}%` : "Not processed"}</TableCell>
                    <TableCell>
                      <a href={`/api/documents/${d.id}/file`} target="_blank" className="text-sm text-primary hover:underline">
                        View original
                      </a>
                    </TableCell>
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
