-- Seed: LALA AUTO REPAIR LLC + sample invoices from printed values.
-- Do not invent missing fields. VIN is the vehicle matching key.

INSERT INTO public.repair_shops (
  id, name, address, city, state, zip, phone, fax, registration_number, notes
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'LALA AUTO REPAIR LLC',
  '39137 Michigan Ave',
  'Wayne',
  'MI',
  '48186',
  '734-844-1900',
  '734-895-9115',
  'F171029',
  'Primary repair shop for the fleet.'
);

INSERT INTO public.vehicles (
  id, vehicle_id, vin, year, make, model, trim, engine, body_style, state, current_mileage, status, notes
) VALUES
  ('22222222-2222-2222-2222-000000000010', 'A010', '1FA6P0H74G5132219', 2016, 'Ford', 'Fusion', 'SE', '2.5L', 'Sedan', 'MI', 168710, 'available', NULL),
  ('22222222-2222-2222-2222-000000000009', 'A009', '3FA6P0H79DR155374', 2013, 'Ford', 'Fusion', 'SE', '2.5L', 'Sedan', 'MI', 77830, 'available', NULL),
  ('22222222-2222-2222-2222-000000000042', 'A042', '3FA6P0H72DR176065', 2013, 'Ford', 'Fusion', 'SE', '2.5L', 'Sedan', 'MI', 179000, 'available', NULL),
  ('22222222-2222-2222-2222-000000000013', 'A013', '3FA6P0H74ER375619', 2014, 'Ford', 'Fusion', 'SE', '2.5L', 'Sedan', 'MI', 171000, 'available', NULL),
  ('22222222-2222-2222-2222-000000000022', 'A022', '3FA6P0H70GR142405', 2016, 'Ford', 'Fusion', 'SE', '2.5L', 'Sedan', 'MI', 172300, 'available', NULL),
  ('22222222-2222-2222-2222-000000000016', 'A016', '3FA6P0G79HR189936', 2017, 'Ford', 'Fusion', 'S', '2.5L', 'Sedan', 'MI', 159700, 'available', NULL),
  ('22222222-2222-2222-2222-000000000001', 'A001', '3FA6P0H70GR371389', 2017, 'Ford', 'Fusion', 'SE', '2.5L', 'Sedan', 'MI', 192200, 'available', NULL),
  ('22222222-2222-2222-2222-000000001813', NULL, '3FA6P0D91JR168736', 2018, 'Ford', 'Fusion', 'Titanium', '2.0L', 'Sedan', 'MI', 123544, 'available', 'Handwritten fleet ID on invoice 1813 was not clearly readable. VIN is the matching key.'),
  ('22222222-2222-2222-2222-000000001803', NULL, '3FA6P0D9XKR152486', 2019, 'Ford', 'Fusion', 'Titanium', '2.0L', 'Sedan', 'MI', 126700, 'available', 'Customer name on invoice: U&A Auto Sale LLC. Fleet ID not clearly shown.'),
  ('22222222-2222-2222-2222-000000001781', NULL, '1FMCU9G95FUC72115', 2015, 'Ford', 'Escape', 'SE', '2.0L', 'SUV', 'MI', 162300, 'available', 'Customer name on invoice: CAR DEED LLC. Handwritten fleet label unclear.');

-- Invoice 1797
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, proposed_completion_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001797', '1797', '22222222-2222-2222-2222-000000000010', '11111111-1111-1111-1111-111111111111',
  '2026-08-02', '2026-08-02', '2026-07-28', '2026-08-02', '110', 168700,
  150.00, 115.38, 265.38, 6.92, 272.30, 272.30, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category)
VALUES ('33333333-3333-3333-3333-000000001797', 'Alternator Assembly', 'A321', 1, 115.38, 115.38, 'alternator');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount)
VALUES ('33333333-3333-3333-3333-000000001797', 'ALTERNATOR ASSEMBLY - Remove & Replace - 2.5L Eng - [Includes: Test.]', 'alternator', 150.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001797', '2026-08-02', 272.30, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000010', '33333333-3333-3333-3333-000000001797', '2026-08-02', 168700, 'invoice');

-- Invoice 1813
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, proposed_completion_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, notes, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001813', '1813', '22222222-2222-2222-2222-000000001813', '11111111-1111-1111-1111-111111111111',
  '2026-08-05', '2026-08-05', '2026-08-04', '2026-08-05', '658', 123544,
  231.00, 528.79, 759.79, 31.73, 791.52, 791.52, 0.00, 'paid', 'visa',
  'Handwritten fleet ID on the invoice was not clearly readable.', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category) VALUES
  ('33333333-3333-3333-3333-000000001813', 'Sway/Stabilizer Bar Link Kit', 'K80252', 1, 85.95, 85.95, 'suspension'),
  ('33333333-3333-3333-3333-000000001813', 'Control Arm and Ball Joint Assembly', '5CB40602', 1, 221.42, 221.42, 'suspension'),
  ('33333333-3333-3333-3333-000000001813', 'Control Arm and Ball Joint Assembly', '5CB40604', 1, 221.42, 221.42, 'suspension');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount) VALUES
  ('33333333-3333-3333-3333-000000001813', 'Sway/Stabilizer Bar Link Kit - Remove and Replace', 'suspension', 50.00),
  ('33333333-3333-3333-3333-000000001813', 'Control Arm - Remove & Replace - Lower, Both - w/Vehicle Dynamic Suspension - Does not include alignment', 'suspension', 181.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001813', '2026-08-05', 791.52, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000001813', '33333333-3333-3333-3333-000000001813', '2026-08-05', 123544, 'invoice');

-- Invoice 1814
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001814', '1814', '22222222-2222-2222-2222-000000000016', '11111111-1111-1111-1111-111111111111',
  '2026-08-05', '2026-08-05', '2026-08-05', '536', 159700,
  180.00, 403.82, 583.82, 24.23, 608.05, 608.05, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, manufacturer_part_number, quantity, unit_price, extended_price, category, notes) VALUES
  ('33333333-3333-3333-3333-000000001814', 'Brake Rotor', 'KitId=52230935', NULL, 2, 75.00, 150.00, 'brakes', 'KitId=52230935'),
  ('33333333-3333-3333-3333-000000001814', 'Brake Pads', 'SC1653', 'KitId=52230935', 1, 46.14, 46.14, 'brakes', 'KitId=52230935'),
  ('33333333-3333-3333-3333-000000001814', 'Brake Rotor', 'KitId=52230968', NULL, 2, 80.77, 161.54, 'brakes', 'KitId=52230968'),
  ('33333333-3333-3333-3333-000000001814', 'Brake Pads', 'SC1833', 'KitId=52230968', 1, 46.14, 46.14, 'brakes', 'KitId=52230968');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount)
VALUES ('33333333-3333-3333-3333-000000001814', 'Front Brake Pads and Rotors / Rear Brake Pads and Rotors - Remove and Replace', 'brakes', 180.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001814', '2026-08-05', 608.05, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000016', '33333333-3333-3333-3333-000000001814', '2026-08-05', 159700, 'invoice');

-- Invoice 1812 (parts/labor mismatch example)
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, notes, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001812', '1812', '22222222-2222-2222-2222-000000000010', '11111111-1111-1111-1111-111111111111',
  '2026-08-05', '2026-08-05', '2026-08-05', '110', 168710,
  160.00, 107.25, 267.25, 6.44, 273.69, 273.69, 0.00, 'paid', 'visa',
  'Parts list contains a tie rod only. Labor also includes brake-related operations. Parts and labor are stored independently.',
  'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category)
VALUES ('33333333-3333-3333-3333-000000001812', 'Tie Rod End', 'ES801110', 1, 107.25, 107.25, 'steering');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount) VALUES
  ('33333333-3333-3333-3333-000000001812', 'FRONT BRAKE PADS AND ROTORS / FRONT BRAKE PADS AND ROTORS REMOVE AND REPLACE', 'brakes', 100.00),
  ('33333333-3333-3333-3333-000000001812', 'Tie Rod End / Left Side Tie Rod End Remove and Replace', 'steering', 60.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001812', '2026-08-05', 273.69, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000010', '33333333-3333-3333-3333-000000001812', '2026-08-05', 168710, 'invoice');

-- Invoice 1792
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001792', '1792', '22222222-2222-2222-2222-000000000009', '11111111-1111-1111-1111-111111111111',
  '2026-07-24', '2026-07-24', '2026-07-24', '536', 77830,
  70.00, 26.65, 96.65, 1.60, 98.25, 98.25, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category)
VALUES ('33333333-3333-3333-3333-000000001792', 'Turn Light Signal Bulb', '33123', 1, 26.65, 26.65, 'lighting');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount)
VALUES ('33333333-3333-3333-3333-000000001792', 'Turn Light Signal Bulb - Remove and Replace - Wire Harness Repair', 'lighting', 70.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001792', '2026-07-24', 98.25, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000009', '33333333-3333-3333-3333-000000001792', '2026-07-24', 77830, 'invoice');

-- Invoice 1789
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001789', '1789', '22222222-2222-2222-2222-000000000042', '11111111-1111-1111-1111-111111111111',
  '2026-07-23', '2026-07-23', '2026-07-23', '447', 179000,
  250.00, 492.30, 742.30, 29.54, 771.84, 771.84, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category) VALUES
  ('33333333-3333-3333-3333-000000001789', 'Strut and Coil Spring Assembly', '33FD1145', 1, 246.15, 246.15, 'suspension'),
  ('33333333-3333-3333-3333-000000001789', 'Strut and Coil Spring Assembly', '33FD1146', 1, 246.15, 246.15, 'suspension');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount)
VALUES ('33333333-3333-3333-3333-000000001789', 'Shock and/or Strut Assembly - Remove & Install or Remove & Replace - Front, Both', 'suspension', 250.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001789', '2026-07-23', 771.84, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000042', '33333333-3333-3333-3333-000000001789', '2026-07-23', 179000, 'invoice');

-- Invoice 1791 (labor-only sway bar)
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, notes, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001791', '1791', '22222222-2222-2222-2222-000000000013', '11111111-1111-1111-1111-111111111111',
  '2026-07-24', '2026-07-24', '2026-07-24', '149', 171000,
  604.00, 419.99, 1023.99, 25.20, 1049.19, 1049.19, 0.00, 'paid', 'visa',
  'Stabilizer/Sway Bar Link Kit appears in labor only — no corresponding part line.', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category) VALUES
  ('33333333-3333-3333-3333-000000001791', 'Electronic Steering Gear Assembly', '125478', 1, 198.57, 198.57, 'steering'),
  ('33333333-3333-3333-3333-000000001791', 'Control Arm and Ball Joint Assembly', '5CB40602', 1, 221.42, 221.42, 'suspension');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount) VALUES
  ('33333333-3333-3333-3333-000000001791', 'Electronic Steering Gear Assembly - Remove & Replace - Includes lowering subframe - Includes programming', 'steering', 330.00),
  ('33333333-3333-3333-3333-000000001791', 'Control Arm - Remove & Replace - Lower, Both - Vehicle Dynamic Suspension - Does not include alignment', 'suspension', 234.00),
  ('33333333-3333-3333-3333-000000001791', 'Stabilizer/Sway Bar Link Kit - Remove and Replace', 'suspension', 40.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001791', '2026-07-24', 1049.19, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000013', '33333333-3333-3333-3333-000000001791', '2026-07-24', 171000, 'invoice');

-- Invoice 1782
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001782', '1782', '22222222-2222-2222-2222-000000000022', '11111111-1111-1111-1111-111111111111',
  '2026-07-22', '2026-07-22', '2026-07-22', '188', 172300,
  334.00, 604.38, 938.38, 36.26, 974.64, 974.64, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category, notes) VALUES
  ('33333333-3333-3333-3333-000000001782', 'Brake Rotor', 'KitId=51793928', 2, 80.77, 161.54, 'brakes', 'KitId=51793928'),
  ('33333333-3333-3333-3333-000000001782', 'Control Arm and Ball Joint Assembly', '5CB40602', 1, 221.42, 221.42, 'suspension', NULL),
  ('33333333-3333-3333-3333-000000001782', 'Control Arm and Ball Joint Assembly', '5CB40604', 1, 221.42, 221.42, 'suspension', NULL);
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount) VALUES
  ('33333333-3333-3333-3333-000000001782', 'Rear Brake Pads and Rotors / Rear Brake Pads and Rotors Remove and Replace', 'brakes', 100.00),
  ('33333333-3333-3333-3333-000000001782', 'Control Arm - Remove & Replace - Lower, Both - Vehicle Dynamic Suspension - Does not include alignment', 'suspension', 234.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001782', '2026-07-22', 974.64, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000022', '33333333-3333-3333-3333-000000001782', '2026-07-22', 172300, 'invoice');

-- Invoice 1788 (A016 earlier mileage 159000)
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001788', '1788', '22222222-2222-2222-2222-000000000016', '11111111-1111-1111-1111-111111111111',
  '2026-07-22', '2026-07-22', '2026-07-22', '536', 159000,
  60.00, 48.48, 108.48, 2.91, 111.39, 111.39, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category)
VALUES ('33333333-3333-3333-3333-000000001788', 'Tie Rod End', 'ES801110', 1, 48.48, 48.48, 'steering');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount)
VALUES ('33333333-3333-3333-3333-000000001788', 'Left Side Outer Tie Rod End - Remove and Replace', 'steering', 60.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001788', '2026-07-22', 111.39, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000016', '33333333-3333-3333-3333-000000001788', '2026-07-22', 159000, 'invoice');

-- Invoice 1796
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001796', '1796', '22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-111111111111',
  '2026-07-29', '2026-07-29', '2026-07-29', '494', 192200,
  275.00, 260.09, 535.09, 15.61, 550.70, 550.70, 0.00, 'paid', 'visa', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category) VALUES
  ('33333333-3333-3333-3333-000000001796', 'Electronic Steering Gear Assembly', NULL, 1, 198.57, 198.57, 'steering'),
  ('33333333-3333-3333-3333-000000001796', 'Automatic Transmission Fluid', 'DEX-VI', 1, 61.52, 61.52, 'transmission');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount) VALUES
  ('33333333-3333-3333-3333-000000001796', 'Electronic Steering Gear Assembly - Remove & Replace', 'steering', 220.00),
  ('33333333-3333-3333-3333-000000001796', 'Automatic Transmission Fluid Change', 'transmission', 55.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001796', '2026-07-29', 550.70, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000000001', '33333333-3333-3333-3333-000000001796', '2026-07-29', 192200, 'invoice');

-- Invoice 1803
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_name, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, notes, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001803', '1803', '22222222-2222-2222-2222-000000001803', '11111111-1111-1111-1111-111111111111',
  '2026-07-31', '2026-07-31', '2026-07-31', 'U&A Auto Sale LLC', 126700,
  100.00, 138.96, 238.96, 8.34, 247.32, 247.32, 0.00, 'paid', 'visa',
  'Customer name preserved exactly as printed. Customer ID was not clearly shown.', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, quantity, unit_price, extended_price, category)
VALUES ('33333333-3333-3333-3333-000000001803', 'Wheel Bearing and Hub Assembly', '512498', 1, 138.96, 138.96, 'wheel_hubs');
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount)
VALUES ('33333333-3333-3333-3333-000000001803', 'Wheel Bearing and Hub Assembly - Remove and Replace', 'wheel_hubs', 100.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001803', '2026-07-31', 247.32, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000001803', '33333333-3333-3333-3333-000000001803', '2026-07-31', 126700, 'invoice');

-- Invoice 1781
INSERT INTO public.invoices (
  id, invoice_number, vehicle_id, repair_shop_id, invoice_date, printed_date, work_completed_date,
  customer_name, customer_id, odometer_in, labor_total, parts_total, subtotal, tax, invoice_total, calculated_total, balance_due,
  payment_status, payment_method, notes, ocr_status, manually_verified
) VALUES (
  '33333333-3333-3333-3333-000000001781', '1781', '22222222-2222-2222-2222-000000001781', '11111111-1111-1111-1111-111111111111',
  '2026-08-02', '2026-08-02', '2026-08-02', 'CAR DEED LLC', '647', 162300,
  490.00, 545.73, 1035.73, 32.74, 1068.47, 1068.47, 0.00, 'paid', 'visa',
  'Handwritten fleet label appears unclear (possibly “Blue…”). Not stored as a fleet ID.', 'skipped', true
);
INSERT INTO public.invoice_parts (invoice_id, part_description, part_number, manufacturer_part_number, quantity, unit_price, extended_price, category, notes) VALUES
  ('33333333-3333-3333-3333-000000001781', 'Brake Rotor', '680601RGS', 'KitId=51766919', 2, 80.77, 161.54, 'brakes', 'KitId=51766919'),
  ('33333333-3333-3333-3333-000000001781', 'Brake Pads', 'SC1645', 'KitId=51766919', 1, 46.14, 46.14, 'brakes', 'KitId=51766919'),
  ('33333333-3333-3333-3333-000000001781', 'Cam Bolt', '86131', NULL, 1, 45.09, 45.09, 'other', NULL),
  ('33333333-3333-3333-3333-000000001781', 'Control Arm', '5CB40497', NULL, 1, 108.40, 108.40, 'suspension', NULL),
  ('33333333-3333-3333-3333-000000001781', 'Tie Rod End', 'ES800954', NULL, 1, 46.66, 46.66, 'steering', NULL),
  ('33333333-3333-3333-3333-000000001781', 'Tie Rod End', 'ES800955', NULL, 1, 46.66, 46.66, 'steering', NULL),
  ('33333333-3333-3333-3333-000000001781', 'Tie Rod End', 'EV800898', NULL, 2, 45.62, 91.24, 'steering', NULL);
INSERT INTO public.invoice_labor (invoice_id, labor_description, labor_category, extended_amount) VALUES
  ('33333333-3333-3333-3333-000000001781', 'Front Brake Pads and Rotors / Front Brake Pads and Rotors Remove and Replace', 'brakes', 100.00),
  ('33333333-3333-3333-3333-000000001781', 'Rear Right Side Control Arm / Rear Right Side Control Arm Remove and Replace', 'suspension', 80.00),
  ('33333333-3333-3333-3333-000000001781', 'Rear Control Arm / Rear Control Arm Remove and Replace', 'suspension', 90.00),
  ('33333333-3333-3333-3333-000000001781', 'Tie Rod / Outer End - Remove & Replace - Inner, Both - Includes R&I Outer Tie Rod Ends - Includes adjust toe-in - Deduct 4-wheel alignment if performed', 'steering', 220.00);
INSERT INTO public.payments (invoice_id, payment_date, amount, payment_method)
VALUES ('33333333-3333-3333-3333-000000001781', '2026-08-02', 1068.47, 'visa');
INSERT INTO public.mileage_history (vehicle_id, invoice_id, recorded_at, mileage, source)
VALUES ('22222222-2222-2222-2222-000000001781', '33333333-3333-3333-3333-000000001781', '2026-08-02', 162300, 'invoice');
