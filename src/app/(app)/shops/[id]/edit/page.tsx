import { notFound } from "next/navigation";
import { getStore } from "@/lib/data/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ShopForm } from "@/components/shops/shop-form";

export default async function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const shop = store.repair_shops.find((s) => s.id === id);
  if (!shop) notFound();
  return (
    <div>
      <PageHeader crumbs={[{ href: "/shops", label: "Shops" }, { href: `/shops/${id}`, label: shop.name }, { label: "Edit" }]} title="Edit shop" />
      <ShopForm shop={shop} />
    </div>
  );
}
