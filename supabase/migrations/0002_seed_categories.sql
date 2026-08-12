-- Repair categories used for automatic classification.
-- Keywords drive matching; users can override per part/labor line.

INSERT INTO public.repair_categories (slug, name, description, keywords) VALUES
  ('brakes', 'Brakes', 'Brake pads, rotors, calipers, hardware', ARRAY['brake', 'rotor', 'pad', 'caliper', 'abs']),
  ('suspension', 'Suspension', 'Control arms, struts, sway bars, bushings', ARRAY['control arm', 'strut', 'shock', 'sway', 'stabilizer', 'coil spring', 'ball joint']),
  ('steering', 'Steering', 'Tie rods, steering gear, rack', ARRAY['tie rod', 'steering gear', 'steering rack', 'electronic steering']),
  ('engine', 'Engine', 'Engine mechanical repairs', ARRAY['engine', 'timing', 'gasket', 'cylinder', 'piston']),
  ('transmission', 'Transmission', 'Transmission and drivetrain fluid/service', ARRAY['transmission', 'trans fluid', 'dex-vi', 'torque converter']),
  ('electrical', 'Electrical', 'General electrical systems', ARRAY['electrical', 'wiring', 'wire harness', 'sensor', 'module']),
  ('cooling', 'Cooling System', 'Radiator, water pump, hoses', ARRAY['radiator', 'coolant', 'water pump', 'thermostat', 'cooling']),
  ('ac_heating', 'AC/Heating', 'HVAC, compressor, condenser', ARRAY['a/c', 'ac ', 'air condition', 'heater', 'hvac', 'compressor']),
  ('exhaust', 'Exhaust', 'Muffler, catalytic converter, pipes', ARRAY['exhaust', 'muffler', 'catalytic', 'o2 sensor']),
  ('tires', 'Tires', 'Tire replacement and repair', ARRAY['tire', 'tyre']),
  ('wheel_hubs', 'Wheel/Hubs', 'Wheel bearings and hub assemblies', ARRAY['wheel bearing', 'hub assembly', 'hub']),
  ('battery', 'Battery', 'Battery replacement and testing', ARRAY['battery']),
  ('alternator', 'Alternator', 'Alternator replacement and testing', ARRAY['alternator']),
  ('starter', 'Starter', 'Starter motor', ARRAY['starter']),
  ('fluids', 'Fluids', 'Fluid changes not otherwise categorized', ARRAY['fluid', 'oil change', 'lube']),
  ('preventive', 'Preventive Maintenance', 'Scheduled service', ARRAY['preventive', 'maintenance', 'inspection', 'tune up']),
  ('body', 'Body', 'Body and cosmetic', ARRAY['body', 'bumper', 'fender', 'paint']),
  ('glass', 'Glass', 'Windshield and glass', ARRAY['windshield', 'glass', 'window']),
  ('lighting', 'Lighting', 'Bulbs, lamps, lighting wiring', ARRAY['bulb', 'lamp', 'light', 'turn signal', 'headlight', 'taillight']),
  ('other', 'Other', 'Uncategorized repairs', ARRAY[]::TEXT[]);
