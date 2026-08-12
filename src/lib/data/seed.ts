import { IDS } from "@/lib/ids";
import { categorizeRepair } from "@/lib/categorize";
import { addMoney } from "@/lib/money";
import type {
  FleetClient,
  FleetStore,
  Invoice,
  InvoiceLabor,
  InvoicePart,
  MileageHistory,
  Payment,
  RepairCategory,
  RepairShop,
  Vehicle,
} from "@/types";

const NOW = "2026-08-11T12:00:00.000Z";

const CATEGORIES: RepairCategory[] = [
  ["brakes", "Brakes", "Brake pads, rotors, calipers, hardware", ["brake", "rotor", "pad", "caliper"]],
  ["suspension", "Suspension", "Control arms, struts, sway bars, bushings", ["control arm", "strut", "shock", "sway", "stabilizer"]],
  ["steering", "Steering", "Tie rods, steering gear, rack", ["tie rod", "steering gear", "electronic steering"]],
  ["engine", "Engine", "Engine mechanical repairs", ["engine"]],
  ["transmission", "Transmission", "Transmission and drivetrain fluid/service", ["transmission", "dex-vi"]],
  ["electrical", "Electrical", "General electrical systems", ["electrical", "wiring", "wire harness"]],
  ["cooling", "Cooling System", "Radiator, water pump, hoses", ["radiator", "coolant"]],
  ["ac_heating", "AC/Heating", "HVAC, compressor, condenser", ["a/c", "heater", "hvac"]],
  ["exhaust", "Exhaust", "Muffler, catalytic converter, pipes", ["exhaust", "muffler"]],
  ["tires", "Tires", "Tire replacement and repair", ["tire"]],
  ["wheel_hubs", "Wheel/Hubs", "Wheel bearings and hub assemblies", ["wheel bearing", "hub"]],
  ["battery", "Battery", "Battery replacement and testing", ["battery"]],
  ["alternator", "Alternator", "Alternator replacement and testing", ["alternator"]],
  ["starter", "Starter", "Starter motor", ["starter"]],
  ["fluids", "Fluids", "Fluid changes not otherwise categorized", ["fluid", "oil change"]],
  ["preventive", "Preventive Maintenance", "Scheduled service", ["preventive", "maintenance"]],
  ["body", "Body", "Body and cosmetic", ["body", "bumper"]],
  ["glass", "Glass", "Windshield and glass", ["windshield", "glass"]],
  ["lighting", "Lighting", "Bulbs, lamps, lighting wiring", ["bulb", "turn signal", "light"]],
  ["other", "Other", "Uncategorized repairs", []],
].map(([slug, name, description, keywords], i) => ({
  id: `44444444-4444-4444-4444-${String(i + 1).padStart(12, "0")}`,
  slug,
  name,
  description,
  keywords,
  created_at: NOW,
  updated_at: NOW,
})) as RepairCategory[];

export const CARDEED_CLIENT: FleetClient = {
  id: IDS.client.cardeed,
  name: "Cardeed",
  legal_name: "Cardeed LLC",
  slug: "cardeed",
  email: "info@cardeed.com",
  phone: "+1 (734) 888-9595",
  website: "https://cardeed.com",
  address: "38099 Schoolcraft Rd, Suite 182",
  city: "Livonia",
  state: "MI",
  zip: "48150",
  notes: "Rental / host fleet. Vehicles are repaired at LALA AUTO REPAIR LLC.",
  created_at: NOW,
  updated_at: NOW,
};

const LALA: RepairShop = {
  id: IDS.shop.lala,
  name: "LALA AUTO REPAIR LLC",
  address: "39137 Michigan Ave",
  city: "Wayne",
  state: "MI",
  zip: "48186",
  phone: "734-844-1900",
  fax: "734-895-9115",
  registration_number: "F171029",
  notes: "Primary repair shop for the fleet.",
  created_at: NOW,
  updated_at: NOW,
};

function vehicle(partial: Partial<Vehicle> & Pick<Vehicle, "id" | "vin">): Vehicle {
  return {
    client_id: IDS.client.cardeed,
    vehicle_id: null,
    year: null,
    make: null,
    model: null,
    trim: null,
    engine: null,
    body_style: "Sedan",
    license_plate: null,
    state: "MI",
    current_mileage: null,
    purchase_date: null,
    purchase_price: null,
    acquisition_source: null,
    status: "available",
    color: null,
    notes: null,
    rental_revenue_total: null,
    created_at: NOW,
    updated_at: NOW,
    ...partial,
  };
}

const VEHICLES: Vehicle[] = [
  vehicle({
    id: IDS.vehicle.a010,
    vehicle_id: "A010",
    vin: "1FA6P0H74G5132219",
    year: 2016,
    make: "Ford",
    model: "Fusion",
    trim: "SE",
    engine: "2.5L",
    current_mileage: 168710,
    license_plate: "DE6014",
  }),
  vehicle({
    id: IDS.vehicle.a009,
    vehicle_id: "A009",
    vin: "3FA6P0H79DR155374",
    year: 2013,
    make: "Ford",
    model: "Fusion",
    trim: "SE",
    engine: "2.5L",
    current_mileage: 77830,
  }),
  vehicle({
    id: IDS.vehicle.a042,
    vehicle_id: "A042",
    vin: "3FA6P0H72DR176065",
    year: 2013,
    make: "Ford",
    model: "Fusion",
    trim: "SE",
    engine: "2.5L",
    current_mileage: 179000,
  }),
  vehicle({
    id: IDS.vehicle.a013,
    vehicle_id: "A013",
    vin: "3FA6P0H74ER375619",
    year: 2014,
    make: "Ford",
    model: "Fusion",
    trim: "SE",
    engine: "2.5L",
    current_mileage: 171000,
  }),
  vehicle({
    id: IDS.vehicle.a022,
    vehicle_id: "A022",
    vin: "3FA6P0H70GR142405",
    year: 2016,
    make: "Ford",
    model: "Fusion",
    trim: "SE",
    engine: "2.5L",
    current_mileage: 172300,
  }),
  vehicle({
    id: IDS.vehicle.a016,
    vehicle_id: "A016",
    vin: "3FA6P0G79HR189936",
    year: 2017,
    make: "Ford",
    model: "Fusion",
    trim: "S",
    engine: "2.5L",
    current_mileage: 159700,
    license_plate: "DF60257",
  }),
  vehicle({
    id: IDS.vehicle.a001,
    vehicle_id: "A001",
    vin: "3FA6P0H70GR371389",
    year: 2017,
    make: "Ford",
    model: "Fusion",
    trim: "SE",
    engine: "2.5L",
    current_mileage: 192200,
    license_plate: "AD8762",
  }),
  vehicle({
    id: IDS.vehicle.inv1813,
    vehicle_id: null,
    vin: "3FA6P0D91JR168736",
    year: 2018,
    make: "Ford",
    model: "Fusion",
    trim: "Titanium",
    engine: "2.0L",
    current_mileage: 123544,
    notes: "Handwritten fleet ID on invoice 1813 was not clearly readable. VIN is the matching key.",
  }),
  vehicle({
    id: IDS.vehicle.inv1803,
    vehicle_id: null,
    vin: "3FA6P0D9XKR152486",
    year: 2019,
    make: "Ford",
    model: "Fusion",
    trim: "Titanium",
    engine: "2.0L",
    current_mileage: 126700,
    notes: "Customer name on invoice: U&A Auto Sale LLC. Fleet ID not clearly shown.",
  }),
  vehicle({
    id: IDS.vehicle.inv1781,
    vehicle_id: null,
    vin: "1FMCU9G95FUC72115",
    year: 2015,
    make: "Ford",
    model: "Escape",
    trim: "SE",
    engine: "2.0L",
    body_style: "SUV",
    current_mileage: 162300,
    notes: "Customer name on invoice: CAR DEED LLC. Handwritten fleet label unclear.",
  }),
];

type PartInput = {
  description: string;
  partNumber?: string | null;
  mfr?: string | null;
  qty?: string | number | null;
  unit?: string | null;
  ext?: string | null;
  notes?: string | null;
  side?: string | null;
  position?: string | null;
};

type LaborInput = {
  description: string;
  amount?: string | null;
  notes?: string | null;
};

type InvoiceSeed = {
  id: string;
  number: string;
  vehicleId: string;
  printed?: string | null;
  proposed?: string | null;
  completed?: string | null;
  invoiceDate?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  odometer?: number | null;
  technicianName?: string | null;
  technicianCert?: string | null;
  originalEstimate?: string | null;
  partsTotal: string;
  laborTotal: string;
  tax: string;
  total: string;
  balance?: string;
  paymentMethod?: Invoice["payment_method"];
  paymentAmount?: string;
  notes?: string | null;
  parts: PartInput[];
  labor: LaborInput[];
};

const LALA_TECH = { technicianName: "Ali Muhammad", technicianCert: "M286179" } as const;

function part(
  invoiceId: string,
  index: number,
  input: PartInput,
): InvoicePart {
  const qty = input.qty === undefined || input.qty === null ? null : String(input.qty);
  return {
    id: `55555555-5555-5555-5555-${invoiceId.slice(-8)}${String(index).padStart(4, "0")}`,
    invoice_id: invoiceId,
    part_description: input.description,
    part_number: input.partNumber ?? null,
    manufacturer_part_number: input.mfr ?? null,
    quantity: qty,
    unit_price: input.unit ?? null,
    extended_price: input.ext ?? input.unit ?? null,
    category: categorizeRepair(input.description),
    side: input.side ?? null,
    position: input.position ?? null,
    notes: input.notes ?? null,
    created_at: NOW,
  };
}

function labor(
  invoiceId: string,
  index: number,
  input: LaborInput,
): InvoiceLabor {
  return {
    id: `66666666-6666-6666-6666-${invoiceId.slice(-8)}${String(index).padStart(4, "0")}`,
    invoice_id: invoiceId,
    labor_description: input.description,
    labor_category: categorizeRepair(input.description),
    extended_amount: input.amount ?? null,
    technician: null,
    notes: input.notes ?? null,
    created_at: NOW,
  };
}

const INVOICE_SEEDS: InvoiceSeed[] = [
  {
    id: IDS.invoice["1797"],
    number: "1797",
    vehicleId: IDS.vehicle.a010,
    printed: "2026-08-02",
    proposed: "2026-07-28",
    completed: "2026-08-02",
    invoiceDate: "2026-08-02",
    customerName: "cardeed llc",
    customerId: "110",
    licenseNumber: "DE6014",
    licenseState: "MI",
    odometer: 168700,
    ...LALA_TECH,
    originalEstimate: "272.30",
    partsTotal: "115.38",
    laborTotal: "150.00",
    tax: "6.92",
    total: "272.30",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "272.30",
    parts: [
      {
        description: "Alternator Assembly",
        partNumber: "A321",
        qty: 1,
        unit: "115.38",
        ext: "115.38",
      },
    ],
    labor: [
      {
        description:
          "ALTERNATOR ASSEMBLY - Remove & Replace - 2.5L Eng - [Includes: Test.]",
        amount: "150.00",
      },
    ],
  },
  {
    id: IDS.invoice["1813"],
    number: "1813",
    vehicleId: IDS.vehicle.inv1813,
    printed: "2026-08-05",
    proposed: "2026-08-04",
    completed: "2026-08-05",
    invoiceDate: "2026-08-05",
    customerName: "cardeed",
    customerId: "658",
    licenseState: "MI",
    odometer: 123544,
    ...LALA_TECH,
    originalEstimate: "791.52",
    partsTotal: "528.79",
    laborTotal: "231.00",
    tax: "31.73",
    total: "791.52",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "791.52",
    notes: "Handwritten fleet ID on the invoice was not clearly readable.",
    parts: [
      {
        description: "Sway/Stabilizer Bar Link Kit",
        partNumber: "K80252",
        qty: 1,
        unit: "85.95",
        ext: "85.95",
      },
      {
        description: "Control Arm and Ball Joint Assembly",
        partNumber: "5CB40602",
        qty: 1,
        unit: "221.42",
        ext: "221.42",
      },
      {
        description: "Control Arm and Ball Joint Assembly",
        partNumber: "5CB40604",
        qty: 1,
        unit: "221.42",
        ext: "221.42",
      },
    ],
    labor: [
      {
        description: "Sway/Stabilizer Bar Link Kit - Remove and Replace",
        amount: "50.00",
      },
      {
        description:
          "Control Arm - Remove & Replace - Lower, Both - w/Vehicle Dynamic Suspension - Does not include alignment",
        amount: "181.00",
      },
    ],
  },
  {
    id: IDS.invoice["1814"],
    number: "1814",
    vehicleId: IDS.vehicle.a016,
    printed: "2026-08-05",
    proposed: "2026-08-04",
    completed: "2026-08-05",
    invoiceDate: "2026-08-05",
    customerName: "cardeed llc",
    customerId: "536",
    licenseNumber: "DF60257",
    licenseState: "MI",
    odometer: 159700,
    ...LALA_TECH,
    originalEstimate: "608.05",
    partsTotal: "403.82",
    laborTotal: "180.00",
    tax: "24.23",
    total: "608.05",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "608.05",
    parts: [
      {
        description: "Brake Rotor",
        partNumber: "KitId=52230935",
        qty: 2,
        unit: "75.00",
        ext: "150.00",
        notes: "KitId=52230935",
      },
      {
        description: "Brake Pads",
        partNumber: "SC1653",
        mfr: "KitId=52230935",
        qty: 1,
        unit: "46.14",
        ext: "46.14",
        notes: "KitId=52230935",
      },
      {
        description: "Brake Rotor",
        partNumber: "KitId=52230968",
        qty: 2,
        unit: "80.77",
        ext: "161.54",
        notes: "KitId=52230968",
      },
      {
        description: "Brake Pads",
        partNumber: "SC1833",
        mfr: "KitId=52230968",
        qty: 1,
        unit: "46.14",
        ext: "46.14",
        notes: "KitId=52230968",
      },
    ],
    labor: [
      {
        description: "Front Brake Pads and Rotors / Rear Brake Pads and Rotors - Remove and Replace",
        amount: "180.00",
      },
    ],
  },
  {
    id: IDS.invoice["1812"],
    number: "1812",
    vehicleId: IDS.vehicle.a010,
    printed: "2026-08-05",
    proposed: "2026-08-04",
    completed: "2026-08-05",
    invoiceDate: "2026-08-05",
    customerName: "cardeed llc",
    customerId: "110",
    licenseNumber: "DE6014",
    licenseState: "MI",
    odometer: 168710,
    ...LALA_TECH,
    originalEstimate: "273.69",
    partsTotal: "107.25",
    laborTotal: "160.00",
    tax: "6.44",
    total: "273.69",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "273.69",
    notes:
      "Parts list contains a tie rod only. Labor also includes brake-related operations. Parts and labor are stored independently.",
    parts: [
      {
        description: "Tie Rod End",
        partNumber: "ES801110",
        qty: 1,
        unit: "107.25",
        ext: "107.25",
      },
    ],
    labor: [
      {
        description: "FRONT BRAKE PADS AND ROTORS / FRONT BRAKE PADS AND ROTORS REMOVE AND REPLACE",
        amount: "100.00",
      },
      {
        description: "Tie Rod End / Left Side Tie Rod End Remove and Replace",
        amount: "60.00",
      },
    ],
  },
  {
    id: IDS.invoice["1792"],
    number: "1792",
    vehicleId: IDS.vehicle.a009,
    printed: "2026-07-24",
    proposed: "2026-07-24",
    completed: "2026-07-24",
    invoiceDate: "2026-07-24",
    customerName: "cardeed",
    customerId: "536",
    licenseState: "MI",
    odometer: 77830,
    ...LALA_TECH,
    originalEstimate: "98.25",
    partsTotal: "26.65",
    laborTotal: "70.00",
    tax: "1.60",
    total: "98.25",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "98.25",
    parts: [
      {
        description: "Turn Light Signal Bulb",
        partNumber: "33123",
        qty: 1,
        unit: "26.65",
        ext: "26.65",
      },
    ],
    labor: [
      {
        description: "Turn Light Signal Bulb - Remove and Replace - Wire Harness Repair",
        amount: "70.00",
      },
    ],
  },
  {
    id: IDS.invoice["1789"],
    number: "1789",
    vehicleId: IDS.vehicle.a042,
    printed: "2026-07-23",
    proposed: "2026-07-22",
    completed: "2026-07-23",
    invoiceDate: "2026-07-23",
    customerName: "CARDEED LLC",
    customerId: "447",
    licenseState: "MI",
    odometer: 179000,
    ...LALA_TECH,
    originalEstimate: "771.84",
    partsTotal: "492.30",
    laborTotal: "250.00",
    tax: "29.54",
    total: "771.84",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "771.84",
    parts: [
      {
        description: "Strut and Coil Spring Assembly",
        partNumber: "33FD1145",
        qty: 1,
        unit: "246.15",
        ext: "246.15",
      },
      {
        description: "Strut and Coil Spring Assembly",
        partNumber: "33FD1146",
        qty: 1,
        unit: "246.15",
        ext: "246.15",
      },
    ],
    labor: [
      {
        description:
          "Shock and/or Strut Assembly - Remove & Install or Remove & Replace - Front, Both",
        amount: "250.00",
      },
    ],
  },
  {
    id: IDS.invoice["1791"],
    number: "1791",
    vehicleId: IDS.vehicle.a013,
    printed: "2026-07-24",
    proposed: "2026-07-23",
    completed: "2026-07-24",
    invoiceDate: "2026-07-24",
    customerName: "CARDEED LLC",
    customerId: "149",
    licenseState: "MI",
    odometer: 171000,
    ...LALA_TECH,
    originalEstimate: "1049.19",
    partsTotal: "419.99",
    laborTotal: "604.00",
    tax: "25.20",
    total: "1049.19",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "1049.19",
    notes:
      "Stabilizer/Sway Bar Link Kit appears in labor only — no corresponding part line. Labor-only operations are supported.",
    parts: [
      {
        description: "Electronic Steering Gear Assembly",
        partNumber: "125478",
        qty: 1,
        unit: "198.57",
        ext: "198.57",
      },
      {
        description: "Control Arm and Ball Joint Assembly",
        partNumber: "5CB40602",
        qty: 1,
        unit: "221.42",
        ext: "221.42",
      },
    ],
    labor: [
      {
        description:
          "Electronic Steering Gear Assembly - Remove & Replace - Includes lowering subframe - Includes programming",
        amount: "330.00",
      },
      {
        description:
          "Control Arm - Remove & Replace - Lower, Both - Vehicle Dynamic Suspension - Does not include alignment",
        amount: "234.00",
      },
      {
        description: "Stabilizer/Sway Bar Link Kit - Remove and Replace",
        amount: "40.00",
      },
    ],
  },
  {
    id: IDS.invoice["1782"],
    number: "1782",
    vehicleId: IDS.vehicle.a022,
    printed: "2026-07-22",
    proposed: "2026-07-17",
    completed: "2026-07-22",
    invoiceDate: "2026-07-22",
    customerName: "cardeed llc",
    customerId: "188",
    licenseState: "MI",
    odometer: 172300,
    ...LALA_TECH,
    originalEstimate: "974.64",
    partsTotal: "604.38",
    laborTotal: "334.00",
    tax: "36.26",
    total: "974.64",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "974.64",
    parts: [
      {
        description: "Brake Rotor",
        partNumber: "KitId=51793928",
        qty: 2,
        unit: "80.77",
        ext: "161.54",
        notes: "KitId=51793928",
      },
      {
        description: "Control Arm and Ball Joint Assembly",
        partNumber: "5CB40602",
        qty: 1,
        unit: "221.42",
        ext: "221.42",
      },
      {
        description: "Control Arm and Ball Joint Assembly",
        partNumber: "5CB40604",
        qty: 1,
        unit: "221.42",
        ext: "221.42",
      },
    ],
    labor: [
      {
        description: "Rear Brake Pads and Rotors / Rear Brake Pads and Rotors Remove and Replace",
        amount: "100.00",
      },
      {
        description:
          "Control Arm - Remove & Replace - Lower, Both - Vehicle Dynamic Suspension - Does not include alignment",
        amount: "234.00",
      },
    ],
  },
  {
    id: IDS.invoice["1788"],
    number: "1788",
    vehicleId: IDS.vehicle.a016,
    printed: "2026-07-22",
    proposed: "2026-07-21",
    completed: "2026-07-22",
    invoiceDate: "2026-07-22",
    customerName: "cardeed llc",
    customerId: "536",
    licenseNumber: "DF60257",
    licenseState: "MI",
    odometer: 159000,
    ...LALA_TECH,
    originalEstimate: "111.39",
    partsTotal: "48.48",
    laborTotal: "60.00",
    tax: "2.91",
    total: "111.39",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "111.39",
    parts: [
      {
        description: "Tie Rod End",
        partNumber: "ES801110",
        qty: 1,
        unit: "48.48",
        ext: "48.48",
      },
    ],
    labor: [
      {
        description: "Left Side Outer Tie Rod End - Remove and Replace",
        amount: "60.00",
      },
    ],
  },
  {
    id: IDS.invoice["1796"],
    number: "1796",
    vehicleId: IDS.vehicle.a001,
    printed: "2026-07-29",
    proposed: "2026-07-27",
    completed: "2026-07-29",
    invoiceDate: "2026-07-29",
    customerName: "CARDEED LLC",
    customerId: "494",
    licenseNumber: "AD8762",
    licenseState: "MI",
    odometer: 192200,
    ...LALA_TECH,
    originalEstimate: "550.70",
    partsTotal: "260.09",
    laborTotal: "275.00",
    tax: "15.61",
    total: "550.70",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "550.70",
    parts: [
      {
        description: "Electronic Steering Gear Assembly",
        qty: 1,
        unit: "198.57",
        ext: "198.57",
      },
      {
        description: "Automatic Transmission Fluid",
        partNumber: "DEX-VI",
        qty: 1,
        unit: "61.52",
        ext: "61.52",
      },
    ],
    labor: [
      {
        description: "Electronic Steering Gear Assembly - Remove & Replace",
        amount: "220.00",
      },
      {
        description: "Automatic Transmission Fluid Change",
        amount: "55.00",
      },
    ],
  },
  {
    id: IDS.invoice["1803"],
    number: "1803",
    vehicleId: IDS.vehicle.inv1803,
    printed: "2026-07-31",
    proposed: "2026-07-30",
    completed: "2026-07-31",
    invoiceDate: "2026-07-31",
    customerName: "U&A Auto Sale LLC",
    customerId: "656",
    licenseState: "MI",
    odometer: 126700,
    ...LALA_TECH,
    originalEstimate: "247.32",
    partsTotal: "138.96",
    laborTotal: "100.00",
    tax: "8.34",
    total: "247.32",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "247.32",
    notes: "Customer name preserved exactly as printed. Customer ID was not clearly shown.",
    parts: [
      {
        description: "Wheel Bearing and Hub Assembly",
        partNumber: "512498",
        qty: 1,
        unit: "138.96",
        ext: "138.96",
      },
    ],
    labor: [
      {
        description: "Wheel Bearing and Hub Assembly - Remove and Replace",
        amount: "100.00",
      },
    ],
  },
  {
    id: IDS.invoice["1781"],
    number: "1781",
    vehicleId: IDS.vehicle.inv1781,
    printed: "2026-08-02",
    proposed: "2026-07-16",
    completed: "2026-08-02",
    invoiceDate: "2026-08-02",
    customerName: "CAR DEED LLC",
    customerId: "647",
    licenseState: "MI",
    odometer: 162300,
    ...LALA_TECH,
    originalEstimate: "1068.47",
    partsTotal: "545.73",
    laborTotal: "490.00",
    tax: "32.74",
    total: "1068.47",
    balance: "0.00",
    paymentMethod: "visa",
    paymentAmount: "1068.47",
    notes: "Handwritten fleet label appears unclear (possibly “Blue…”). Not stored as a fleet ID.",
    parts: [
      {
        description: "Brake Rotor",
        partNumber: "680601RGS",
        mfr: "KitId=51766919",
        qty: 2,
        unit: "80.77",
        ext: "161.54",
        notes: "KitId=51766919",
      },
      {
        description: "Brake Pads",
        partNumber: "SC1645",
        mfr: "KitId=51766919",
        qty: 1,
        unit: "46.14",
        ext: "46.14",
        notes: "KitId=51766919",
      },
      {
        description: "Cam Bolt",
        partNumber: "86131",
        qty: 1,
        unit: "45.09",
        ext: "45.09",
      },
      {
        description: "Control Arm",
        partNumber: "5CB40497",
        qty: 1,
        unit: "108.40",
        ext: "108.40",
      },
      {
        description: "Tie Rod End",
        partNumber: "ES800954",
        qty: 1,
        unit: "46.66",
        ext: "46.66",
      },
      {
        description: "Tie Rod End",
        partNumber: "ES800955",
        qty: 1,
        unit: "46.66",
        ext: "46.66",
      },
      {
        description: "Tie Rod End",
        partNumber: "EV800898",
        qty: 2,
        unit: "45.62",
        ext: "91.24",
      },
    ],
    labor: [
      {
        description: "Front Brake Pads and Rotors / Front Brake Pads and Rotors Remove and Replace",
        amount: "100.00",
      },
      {
        description: "Rear Right Side Control Arm / Rear Right Side Control Arm Remove and Replace",
        amount: "80.00",
      },
      {
        description: "Rear Control Arm / Rear Control Arm Remove and Replace",
        amount: "90.00",
      },
      {
        description:
          "Tie Rod / Outer End - Remove & Replace - Inner, Both - Includes R&I Outer Tie Rod Ends - Includes adjust toe-in - Deduct 4-wheel alignment if performed",
        amount: "220.00",
      },
    ],
  },
];

function buildInvoices(): {
  invoices: Invoice[];
  parts: InvoicePart[];
  labor: InvoiceLabor[];
  payments: Payment[];
  mileage: MileageHistory[];
} {
  const invoices: Invoice[] = [];
  const parts: InvoicePart[] = [];
  const laborItems: InvoiceLabor[] = [];
  const payments: Payment[] = [];
  const mileage: MileageHistory[] = [];

  for (const seed of INVOICE_SEEDS) {
    const calculated = addMoney(seed.partsTotal, seed.laborTotal, seed.tax);
    invoices.push({
      id: seed.id,
      invoice_number: seed.number,
      vehicle_id: seed.vehicleId,
      repair_shop_id: LALA.id,
      invoice_date: seed.invoiceDate ?? seed.printed ?? null,
      printed_date: seed.printed ?? null,
      proposed_completion_date: seed.proposed ?? null,
      work_completed_date: seed.completed ?? null,
      customer_name: seed.customerName ?? null,
      customer_id: seed.customerId ?? null,
      license_number: seed.licenseNumber ?? null,
      license_state: seed.licenseState ?? null,
      odometer_in: seed.odometer ?? null,
      technician_name: seed.technicianName ?? null,
      technician_certification_number: seed.technicianCert ?? null,
      labor_total: seed.laborTotal,
      parts_total: seed.partsTotal,
      subtotal: addMoney(seed.partsTotal, seed.laborTotal),
      tax: seed.tax,
      invoice_total: seed.total,
      calculated_total: calculated,
      balance_due: seed.balance ?? "0.00",
      payment_status: "paid",
      payment_method: seed.paymentMethod ?? "visa",
      original_estimate_amount: seed.originalEstimate ?? seed.total,
      notes: seed.notes ?? null,
      source_document_id: null,
      ocr_status: "skipped",
      ocr_confidence: null,
      ocr_payload: null,
      manually_verified: true,
      verified_by: null,
      verified_at: NOW,
      created_by: null,
      created_at: NOW,
      updated_at: NOW,
    });

    seed.parts.forEach((p, i) => parts.push(part(seed.id, i + 1, p)));
    seed.labor.forEach((l, i) => laborItems.push(labor(seed.id, i + 1, l)));

    if (seed.paymentAmount) {
      payments.push({
        id: `77777777-7777-7777-7777-${seed.id.slice(-12)}`,
        invoice_id: seed.id,
        payment_date: seed.completed ?? seed.printed ?? null,
        amount: seed.paymentAmount,
        payment_method: seed.paymentMethod ?? "visa",
        reference_number: null,
        notes: null,
        created_at: NOW,
      });
    }

    if (seed.odometer != null && (seed.completed || seed.printed)) {
      mileage.push({
        id: `88888888-8888-8888-8888-${seed.id.slice(-12)}`,
        vehicle_id: seed.vehicleId,
        invoice_id: seed.id,
        recorded_at: seed.completed ?? seed.printed!,
        mileage: seed.odometer,
        source: "invoice",
        anomaly: false,
        anomaly_note: null,
        notes: null,
        created_at: NOW,
      });
    }
  }

  return { invoices, parts, labor: laborItems, payments, mileage };
}

export function createSeedStore(): FleetStore {
  const built = buildInvoices();
  return {
    profiles: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        full_name: "Admin",
        email: "admin@fleet.local",
        role: "admin",
        created_at: NOW,
        updated_at: NOW,
      },
    ],
    repair_categories: CATEGORIES,
    clients: [CARDEED_CLIENT],
    vehicles: VEHICLES,
    repair_shops: [LALA],
    invoices: built.invoices,
    invoice_parts: built.parts,
    invoice_labor: built.labor,
    payments: built.payments,
    documents: [],
    mileage_history: built.mileage,
    maintenance_records: [],
    warranty_records: [],
    audit_logs: [],
  };
}
