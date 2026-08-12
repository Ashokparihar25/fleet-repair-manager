import { PageHeader } from "@/components/layout/page-header";
import { ShopForm } from "@/components/shops/shop-form";

export default function NewShopPage() {
  return (
    <div>
      <PageHeader crumbs={[{ href: "/shops", label: "Shops" }, { label: "New" }]} title="Add repair shop" />
      <ShopForm />
    </div>
  );
}
