import { resetStore } from "../src/lib/data/store";

resetStore().then(() => {
  console.log("Local store reset to seeded LALA invoices.");
});
