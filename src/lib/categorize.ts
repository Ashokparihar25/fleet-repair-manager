import type { RepairCategorySlug } from "@/types";

export const CATEGORY_SLUGS = [
  "brakes",
  "suspension",
  "steering",
  "engine",
  "transmission",
  "electrical",
  "cooling",
  "ac_heating",
  "exhaust",
  "tires",
  "wheel_hubs",
  "battery",
  "alternator",
  "starter",
  "fluids",
  "preventive",
  "body",
  "glass",
  "lighting",
  "other",
] as const satisfies readonly RepairCategorySlug[];

export const CATEGORY_LABELS: Record<RepairCategorySlug, string> = {
  brakes: "Brakes",
  suspension: "Suspension",
  steering: "Steering",
  engine: "Engine",
  transmission: "Transmission",
  electrical: "Electrical",
  cooling: "Cooling System",
  ac_heating: "AC/Heating",
  exhaust: "Exhaust",
  tires: "Tires",
  wheel_hubs: "Wheel/Hubs",
  battery: "Battery",
  alternator: "Alternator",
  starter: "Starter",
  fluids: "Fluids",
  preventive: "Preventive Maintenance",
  body: "Body",
  glass: "Glass",
  lighting: "Lighting",
  other: "Other",
};

const RULES: Array<{ slug: RepairCategorySlug; patterns: RegExp[] }> = [
  { slug: "alternator", patterns: [/\balternator\b/i] },
  { slug: "starter", patterns: [/\bstarter\b/i] },
  { slug: "battery", patterns: [/\bbattery\b/i] },
  { slug: "lighting", patterns: [/\b(turn\s*(light|signal)|bulb|headlight|taillight|lamp)\b/i] },
  { slug: "brakes", patterns: [/\b(brake|rotor|caliper|pads?)\b/i] },
  {
    slug: "steering",
    patterns: [/\b(tie\s*rod|steering\s*gear|steering\s*rack|electronic\s*steering)\b/i],
  },
  {
    slug: "suspension",
    patterns: [
      /\b(control\s*arm|strut|shock|sway|stabilizer|coil\s*spring|ball\s*joint)\b/i,
    ],
  },
  { slug: "wheel_hubs", patterns: [/\b(wheel\s*bearing|hub\s*assembly|\bhub\b)\b/i] },
  { slug: "transmission", patterns: [/\b(transmission|trans\s*fluid|dex-?vi)\b/i] },
  { slug: "fluids", patterns: [/\b(fluid|oil\s*change|lube)\b/i] },
  { slug: "cooling", patterns: [/\b(radiator|coolant|water\s*pump|thermostat|cooling)\b/i] },
  { slug: "ac_heating", patterns: [/\b(a\/c|air\s*condition|heater|hvac|compressor)\b/i] },
  { slug: "exhaust", patterns: [/\b(exhaust|muffler|catalytic|o2\s*sensor)\b/i] },
  { slug: "tires", patterns: [/\b(tire|tyre)\b/i] },
  { slug: "electrical", patterns: [/\b(electrical|wiring|wire\s*harness|sensor|module)\b/i] },
  { slug: "engine", patterns: [/\b(engine|timing|gasket|cylinder|piston)\b/i] },
  { slug: "glass", patterns: [/\b(windshield|glass|window)\b/i] },
  { slug: "body", patterns: [/\b(body|bumper|fender|paint)\b/i] },
  { slug: "preventive", patterns: [/\b(preventive|maintenance|inspection|tune\s*up)\b/i] },
];

export function categorizeRepair(description: string | null | undefined): RepairCategorySlug {
  if (!description) return "other";
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(description))) return rule.slug;
  }
  return "other";
}

export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "Other";
  return CATEGORY_LABELS[slug as RepairCategorySlug] ?? slug;
}

export function primaryCategoryFromLines(
  descriptions: Array<string | null | undefined>,
): RepairCategorySlug {
  const counts = new Map<RepairCategorySlug, number>();
  for (const d of descriptions) {
    const c = categorizeRepair(d);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: RepairCategorySlug = "other";
  let bestCount = 0;
  for (const [slug, count] of counts) {
    if (slug === "other") continue;
    if (count > bestCount) {
      best = slug;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : "other";
}
