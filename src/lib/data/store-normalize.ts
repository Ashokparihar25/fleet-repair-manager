import { CARDEED_CLIENT } from "@/lib/data/seed";
import type { FleetStore } from "@/types";

export function normalizeStore(store: FleetStore): FleetStore {
  store.clients = Array.isArray(store.clients) ? store.clients : [];
  const cardeed =
    store.clients.find((c) => c.id === CARDEED_CLIENT.id || c.slug === "cardeed" || /cardeed/i.test(c.name)) ?? null;
  if (!cardeed) store.clients.unshift({ ...CARDEED_CLIENT });
  const clientId = (cardeed ?? CARDEED_CLIENT).id;
  store.vehicles = (store.vehicles ?? []).map((v) => ({
    ...v,
    client_id: v.client_id ?? clientId,
  }));
  return store;
}
