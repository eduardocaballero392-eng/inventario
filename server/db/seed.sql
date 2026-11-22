-- =====================================================================
--  DATOS DE EJEMPLO: categorías, proveedores y catálogo de productos
--  (los usuarios y el historial de ventas los genera seed.js)
--  El stock aquí es el stock FINAL deseado; seed.js reconstruye el kardex.
-- =====================================================================

INSERT INTO categories (id, name, color) VALUES
  (1, 'Gaseosas',     '#2563eb'),
  (2, 'Cervezas',     '#d97706'),
  (3, 'Aguas',        '#0891b2'),
  (4, 'Energizantes', '#7c3aed'),
  (5, 'Jugos',        '#16a34a'),
  (6, 'Snacks',       '#db2777'),
  (7, 'Otros',        '#64748b');

INSERT INTO suppliers (id, name, ruc, phone, email, address, contact) VALUES
  (1, 'Distribuidora Andina de Bebidas S.A.C.', '20601234561', '01 456 7788', 'ventas@andinabebidas.pe', 'Av. Argentina 2450, Callao',          'Carlos Ramírez'),
  (2, 'Cervecera Distribuciones del Norte E.I.R.L.', '20509876542', '987 654 321', 'pedidos@cervenorte.pe', 'Jr. Los Pinos 120, Los Olivos, Lima', 'María Torres'),
  (3, 'Comercial Aguas y Más S.R.L.',           '20481112223', '01 334 5566', 'contacto@aguasymas.pe',   'Av. Universitaria 880, San Miguel',  'Luis Paredes'),
  (4, 'Snacks Mayorista Lima S.A.C.',           '20554443334', '945 112 233', 'ventas@snacksmayorista.pe', 'Mercado Central Pto. 45, Cercado de Lima', 'Rosa Quispe');

-- code, name, category, brand, presentation, purchase, sale, stock, min, supplier, expiry
INSERT INTO products (code, name, category_id, brand, presentation, purchase_price, sale_price, stock, min_stock, supplier_id, expiry_date) VALUES
  ('7751271001019', 'Inca Kola 500 ml',            1, 'Inca Kola',   'Botella 500 ml',  1.70,  2.50,  96, 24, 1, DATE_ADD(CURDATE(), INTERVAL 160 DAY)),
  ('7751271001026', 'Inca Kola 1.5 L',             1, 'Inca Kola',   'Botella 1.5 L',   4.20,  6.00,  40, 12, 1, DATE_ADD(CURDATE(), INTERVAL 150 DAY)),
  ('7751271001033', 'Inca Kola 3 L',               1, 'Inca Kola',   'Botella 3 L',     7.80, 11.00,  18,  8, 1, DATE_ADD(CURDATE(), INTERVAL 140 DAY)),
  ('7751271001040', 'Inca Kola Lata 355 ml',       1, 'Inca Kola',   'Lata 355 ml',     1.80,  2.80,  60, 24, 1, DATE_ADD(CURDATE(), INTERVAL 200 DAY)),
  ('7750182001017', 'Coca-Cola 500 ml',            1, 'Coca-Cola',   'Botella 500 ml',  1.70,  2.50,  88, 24, 1, DATE_ADD(CURDATE(), INTERVAL 170 DAY)),
  ('7750182001024', 'Coca-Cola 1.5 L',             1, 'Coca-Cola',   'Botella 1.5 L',   4.20,  6.00,   9, 12, 1, DATE_ADD(CURDATE(), INTERVAL 155 DAY)),
  ('7750182001031', 'Coca-Cola 3 L',               1, 'Coca-Cola',   'Botella 3 L',     7.80, 11.00,  14,  8, 1, DATE_ADD(CURDATE(), INTERVAL 145 DAY)),
  ('7750182001048', 'Coca-Cola Sin Azúcar 500 ml', 1, 'Coca-Cola',   'Botella 500 ml',  1.80,  2.70,  30, 12, 1, DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
  ('7750182002014', 'Sprite 500 ml',               1, 'Sprite',      'Botella 500 ml',  1.60,  2.30,  36, 12, 1, DATE_ADD(CURDATE(), INTERVAL 175 DAY)),
  ('7750182003011', 'Fanta Naranja 500 ml',        1, 'Fanta',       'Botella 500 ml',  1.60,  2.30,   0, 12, 1, NULL),
  ('7750670001012', 'Pepsi 500 ml',                1, 'Pepsi',       'Botella 500 ml',  1.40,  2.20,  42, 12, 1, DATE_ADD(CURDATE(), INTERVAL 165 DAY)),
  ('7750670001029', 'Pepsi 3 L',                   1, 'Pepsi',       'Botella 3 L',     6.50,  9.50,  10,  6, 1, DATE_ADD(CURDATE(), INTERVAL 135 DAY)),
  ('7750885001015', 'Guaraná 500 ml',              1, 'Guaraná',     'Botella 500 ml',  1.40,  2.20,  28, 12, 1, DATE_ADD(CURDATE(), INTERVAL 160 DAY)),
  ('7750885002012', 'Kola Real 3 L',               1, 'Kola Real',   'Botella 3 L',     4.80,  7.00,  16,  6, 1, DATE_ADD(CURDATE(), INTERVAL 120 DAY)),

  ('7750243001015', 'Pilsen Callao 630 ml',        2, 'Pilsen',      'Botella 630 ml',  4.60,  6.50, 120, 48, 2, DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
  ('7750243001022', 'Pilsen Callao Lata 355 ml',   2, 'Pilsen',      'Lata 355 ml',     3.00,  4.20,  72, 24, 2, DATE_ADD(CURDATE(), INTERVAL 110 DAY)),
  ('7750243002012', 'Cristal 650 ml',              2, 'Cristal',     'Botella 650 ml',  4.50,  6.50, 104, 48, 2, DATE_ADD(CURDATE(), INTERVAL 85 DAY)),
  ('7750243002029', 'Cristal Lata 355 ml',         2, 'Cristal',     'Lata 355 ml',     2.90,  4.00,  20, 24, 2, DATE_ADD(CURDATE(), INTERVAL 100 DAY)),
  ('7750243003019', 'Cusqueña Dorada 620 ml',      2, 'Cusqueña',    'Botella 620 ml',  5.40,  7.50,  60, 24, 2, DATE_ADD(CURDATE(), INTERVAL 95 DAY)),
  ('7750243003026', 'Cusqueña Negra 620 ml',       2, 'Cusqueña',    'Botella 620 ml',  5.60,  8.00,  22, 12, 2, DATE_ADD(CURDATE(), INTERVAL 20 DAY)),
  ('7750243003033', 'Cusqueña Trigo 310 ml',       2, 'Cusqueña',    'Botella 310 ml',  3.60,  5.00,   6, 12, 2, DATE_ADD(CURDATE(), INTERVAL 12 DAY)),
  ('7750243004016', 'Arequipeña 620 ml',           2, 'Arequipeña',  'Botella 620 ml',  4.40,  6.00,  30, 12, 2, DATE_ADD(CURDATE(), INTERVAL 80 DAY)),
  ('7501064191015', 'Corona 355 ml',               2, 'Corona',      'Botella 355 ml',  4.80,  7.00,  48, 24, 2, DATE_ADD(CURDATE(), INTERVAL 130 DAY)),
  ('8714800001015', 'Heineken Lata 355 ml',        2, 'Heineken',    'Lata 355 ml',     4.20,  6.00,  36, 24, 2, DATE_ADD(CURDATE(), INTERVAL 125 DAY)),
  ('7750243005013', 'Pilsen Six Pack Lata',        2, 'Pilsen',      'Pack 6 latas',   17.00, 23.00,  12,  6, 2, DATE_ADD(CURDATE(), INTERVAL 110 DAY)),

  ('7750885101012', 'San Luis Sin Gas 625 ml',     3, 'San Luis',    'Botella 625 ml',  0.90,  1.50,  80, 24, 3, DATE_ADD(CURDATE(), INTERVAL 300 DAY)),
  ('7750885101029', 'San Luis Con Gas 625 ml',     3, 'San Luis',    'Botella 625 ml',  0.95,  1.60,  24, 12, 3, DATE_ADD(CURDATE(), INTERVAL 300 DAY)),
  ('7750885101036', 'San Luis 2.5 L',              3, 'San Luis',    'Bidón 2.5 L',     2.40,  3.80,  18,  8, 3, DATE_ADD(CURDATE(), INTERVAL 300 DAY)),
  ('7751493001014', 'Cielo 625 ml',                3, 'Cielo',       'Botella 625 ml',  0.70,  1.20,  64, 24, 3, DATE_ADD(CURDATE(), INTERVAL 280 DAY)),
  ('7751493001021', 'San Mateo 600 ml',            3, 'San Mateo',   'Botella 600 ml',  1.00,  1.80,  11, 12, 3, DATE_ADD(CURDATE(), INTERVAL 290 DAY)),

  ('7751493101011', 'Volt Maca 300 ml',            4, 'Volt',        'Botella 300 ml',  1.20,  2.00,  50, 24, 1, DATE_ADD(CURDATE(), INTERVAL 190 DAY)),
  ('7751493101028', 'Volt Ginseng 300 ml',         4, 'Volt',        'Botella 300 ml',  1.20,  2.00,  44, 24, 1, DATE_ADD(CURDATE(), INTERVAL 190 DAY)),
  ('9002490100070', 'Red Bull 250 ml',             4, 'Red Bull',    'Lata 250 ml',     4.50,  6.50,  15, 12, 1, DATE_ADD(CURDATE(), INTERVAL 240 DAY)),
  ('7750182501012', 'Monster Energy 473 ml',       4, 'Monster',     'Lata 473 ml',     5.20,  7.50,   4, 10, 1, DATE_ADD(CURDATE(), INTERVAL 230 DAY)),

  ('7750182601013', 'Frugos Durazno 1 L',          5, 'Frugos',      'Caja 1 L',        3.20,  4.80,  20,  8, 1, DATE_ADD(CURDATE(), INTERVAL 25 DAY)),
  ('7750182601020', 'Pulp Durazno 315 ml',         5, 'Pulp',        'Botella 315 ml',  1.10,  1.80,  36, 12, 1, DATE_ADD(CURDATE(), INTERVAL 60 DAY)),
  ('7751271201013', 'Cifrut Citrus 500 ml',        5, 'Cifrut',      'Botella 500 ml',  1.00,  1.70,  30, 12, 1, DATE_ADD(CURDATE(), INTERVAL 70 DAY)),

  ('7750168001015', 'Papas Lays Clásicas 42 g',    6, 'Lays',        'Bolsa 42 g',      1.40,  2.20,  40, 15, 4, DATE_ADD(CURDATE(), INTERVAL 75 DAY)),
  ('7750168002012', 'Doritos Queso 42 g',          6, 'Doritos',     'Bolsa 42 g',      1.40,  2.20,  35, 15, 4, DATE_ADD(CURDATE(), INTERVAL 75 DAY)),
  ('7750168003019', 'Cuates Picantes 70 g',        6, 'Cuates',      'Bolsa 70 g',      1.00,  1.50,  28, 10, 4, DATE_ADD(CURDATE(), INTERVAL 60 DAY)),
  ('7750168004016', 'Maní Salado 100 g',           6, 'Karinto',     'Bolsa 100 g',     1.80,  3.00,  18,  8, 4, DATE_ADD(CURDATE(), INTERVAL 120 DAY)),
  ('7750168005013', 'Chifles Piuranos 90 g',       6, 'Inka Chips',  'Bolsa 90 g',      2.20,  3.50,   7,  8, 4, DATE_ADD(CURDATE(), INTERVAL 45 DAY)),

  ('PRD-HIELO-5K',  'Hielo en Bolsa 5 kg',         7, 'Genérico',    'Bolsa 5 kg',      2.50,  5.00,  15,  5, NULL, NULL),
  ('PRD-VASOS-50',  'Vasos Descartables x50',      7, 'Genérico',    'Paquete x50',     3.00,  5.00,  12,  4, 4, NULL),
  ('PRD-CARBON-3K', 'Carbón Vegetal 3 kg',         7, 'Genérico',    'Bolsa 3 kg',      6.00, 10.00,   8,  4, NULL, NULL);
