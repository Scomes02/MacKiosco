-- ============================================================
--  KIOSCO - Datos iniciales y de prueba
--  Ejecutar después de 01_schema.sql, sobre la base "kiosco_db".
--
--  Usuarios iniciales (cambiar las contraseñas al empezar a usar):
--    admin   / admin123    (Administrador)
--    cajero  / cajero123   (Cajero)
--    lucas   / cajero123   (Cajero)
--
--  El historial de ventas, cajas y compras de demostración NO está
--  en este archivo: lo genera "npm run db:setup" (backend/scripts).
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
--  Usuarios (contraseñas con hash bcrypt)
-- ------------------------------------------------------------
INSERT INTO usuarios (id, nombre, usuario, email, password_hash, rol) VALUES
  (1, 'Administrador',  'admin',  'admin@mikiosco.local',  '$2b$10$T8TnMnLe2PMk2RhMPabene8wXM5RkFFtCPbgEKMnHKbRKgjTH..mK', 'ADMIN'),
  (2, 'María González', 'cajero', 'maria@mikiosco.local',  '$2b$10$ouT44J1Rq2.Kk5aTSL/F9.KmLj/oahuxgK9ILu6JJFyrUjy6UcCU2', 'CAJERO'),
  (3, 'Lucas Pereyra',  'lucas',  'lucas@mikiosco.local',  '$2b$10$ouT44J1Rq2.Kk5aTSL/F9.KmLj/oahuxgK9ILu6JJFyrUjy6UcCU2', 'CAJERO');

-- ------------------------------------------------------------
--  Configuración del comercio
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor) VALUES
  ('nombre_comercio', 'Mi Kiosco'),
  ('razon_social',    ''),
  ('cuit',            ''),
  ('direccion',       'Av. San Martín 1234, Mendoza'),
  ('telefono',        '261 555-0123'),
  ('mensaje_ticket',  '¡Gracias por su compra!');

-- ------------------------------------------------------------
--  Métodos de pago
-- ------------------------------------------------------------
INSERT INTO metodos_pago (id, nombre, es_efectivo, activo, orden) VALUES
  (1, 'Efectivo',           1, 1, 1),
  (2, 'Mercado Pago',       0, 1, 2),
  (3, 'Tarjeta de débito',  0, 1, 3),
  (4, 'Tarjeta de crédito', 0, 1, 4),
  (5, 'Transferencia',      0, 1, 5);

-- ------------------------------------------------------------
--  Categorías
-- ------------------------------------------------------------
INSERT INTO categorias (id, nombre, descripcion, color, icono) VALUES
  (1,  'Gaseosas',            'Bebidas gaseosas en todas sus presentaciones', '#ef4444', '🥤'),
  (2,  'Aguas',               'Aguas minerales, saborizadas y sodas',         '#0ea5e9', '💧'),
  (3,  'Jugos',               'Jugos listos para tomar y en polvo',           '#f97316', '🧃'),
  (4,  'Energéticas',         'Bebidas energizantes e isotónicas',            '#65a30d', '⚡'),
  (5,  'Bebidas con alcohol', 'Cervezas, vinos y aperitivos',                 '#d97706', '🍺'),
  (6,  'Golosinas',           'Caramelos, chicles, gomitas y pastillas',      '#ec4899', '🍬'),
  (7,  'Chocolates',          'Tabletas, bombones y chocolates',              '#92400e', '🍫'),
  (8,  'Alfajores',           'Alfajores simples y triples',                  '#b45309', '🥮'),
  (9,  'Galletitas',          'Galletitas dulces y saladas',                  '#ca8a04', '🍪'),
  (10, 'Snacks',              'Papas fritas, palitos, maní y otros',          '#f59e0b', '🥨'),
  (11, 'Cigarrillos',         'Cigarrillos y tabaco (venta solo a mayores de 18)', '#64748b', '🚬'),
  (12, 'Almacén',             'Productos básicos de almacén',                 '#10b981', '🛒'),
  (13, 'Helados',             'Helados y postres helados',                    '#06b6d4', '🍦'),
  (14, 'Lácteos y frescos',   'Leches, yogures y productos de heladera',      '#3b82f6', '🥛'),
  (15, 'Varios',              'Pilas, encendedores, higiene y accesorios',    '#8b5cf6', '📦');

-- ------------------------------------------------------------
--  Proveedores (datos ficticios)
-- ------------------------------------------------------------
INSERT INTO proveedores (id, razon_social, cuit, contacto, telefono, email, direccion, notas) VALUES
  (1, 'Distribuidora Bebidas del Centro S.R.L.', '30-71234567-1', 'Jorge Molina',    '261 444-1001', 'ventas@bebidasdelcentro.example',   'Carril Rodríguez Peña 2150, Maipú',  'Reparto: lunes y jueves por la mañana'),
  (2, 'Mayorista Golosinas Don Pepe',            '30-70987654-3', 'Graciela Suárez', '261 444-1002', 'pedidos@donpepe.example',           'Av. Acceso Este 3300, Guaymallén',   'Pedido mínimo: 6 cajas'),
  (3, 'La Galletera Distribuciones S.A.',        '30-69876543-2', 'Pablo Rivas',     '261 444-1003', 'contacto@lagalletera.example',      'Mitre 1874, San José',               NULL),
  (4, 'Tabacalera Cuyo Distribuciones S.A.',     '30-68765432-9', 'Hernán Paz',      '261 444-1004', 'pedidos@tabacaleracuyo.example',    'Los Peralitos 1622, Luján de Cuyo',  'Pago contra entrega'),
  (5, 'Helados Frío Sur',                        '30-71555888-4', 'Carla Benítez',   '261 444-1005', 'ventas@friosur.example',            'Alberdi 2076, Guaymallén',           'Incluye freezer en comodato'),
  (6, 'Almacén Mayorista El Trébol',             '30-70111222-6', 'Roberto Díaz',    '261 444-1006', 'mayorista@eltrebol.example',        'Catedral 1586, Godoy Cruz',          NULL),
  (7, 'Cervecería y Bebidas Litoral S.R.L.',     '30-71999000-5', 'Sergio Luna',     '261 444-1007', 'reparto@bebidaslitoral.example',    'Julián Barraquero 394, Mendoza',     'Reparto: viernes'),
  (8, 'Lácteos La Pradera',                      '30-70444333-8', 'Mónica Ferreyra', '261 444-1008', 'pedidos@lapradera.example',         'Olegario Andrade 157, Mendoza',      'Reparto diario de frescos');

-- ------------------------------------------------------------
--  Clientes (datos ficticios)
-- ------------------------------------------------------------
INSERT INTO clientes (id, nombre, documento, condicion_iva, telefono, email, direccion, notas) VALUES
  (1,  'Rubén Ortiz',               '20-23184972-7', 'RESPONSABLE_INSCRIPTO', '261 555-2001', 'ruben.ortiz@correo.example',   'Julián Barraquero 394, Mendoza',  NULL),
  (2,  'Kiosa S.R.L.',              '30-71429381-4', 'RESPONSABLE_INSCRIPTO', '261 555-2002', 'compras@kiosa.example',        'San Lorenzo 473, Mendoza',        'Pide factura siempre'),
  (3,  'Carlos Llopiz',             '20-10272592-2', 'MONOTRIBUTISTA',        '261 555-2003', NULL,                           'Martínez de Rosas 1120, Mendoza', NULL),
  (4,  'Soraya Medina',             '27-21936074-1', 'CONSUMIDOR_FINAL',      '261 555-2004', 'soraya.medina@correo.example', 'Catedral 1586, Godoy Cruz',       'Vecina del barrio'),
  (5,  'Pablo Daniel Montivero',    '20-24232298-4', 'MONOTRIBUTISTA',        '261 555-2005', NULL,                           'Alberdi 2076, Guaymallén',        NULL),
  (6,  'Sebastián López',           '20-26959547-4', 'CONSUMIDOR_FINAL',      '261 555-2006', NULL,                           'Coni 2089, Las Heras',            NULL),
  (7,  'Transportes Rodríguez Hnos.', '30-71215569-4', 'RESPONSABLE_INSCRIPTO', '261 555-2007', 'admin@rodriguezhnos.example', 'Mitre 1874, San José',            'Compran bebidas para los choferes'),
  (8,  'Escuela N° 1-234 (Cooperadora)', '30-66778899-5', 'EXENTO',           '261 555-2008', 'cooperadora@escuela234.example', 'Paso de los Andes 850, Mendoza', NULL),
  (9,  'Valentina Giménez',         NULL,            'CONSUMIDOR_FINAL',      '261 555-2009', 'valen.gimenez@correo.example', NULL,                              NULL),
  (10, 'Taller Mecánico El Rápido', '20-18999444-3', 'MONOTRIBUTISTA',        '261 555-2010', NULL,                           'Rodríguez Peña 401, Godoy Cruz',  NULL);

-- ------------------------------------------------------------
--  Productos
--  (codigo, nombre, descripcion, categoria, proveedor, costo, venta, stock, minimo, activo)
-- ------------------------------------------------------------
INSERT INTO productos (codigo, nombre, descripcion, categoria_id, proveedor_id, precio_costo, precio_venta, stock, stock_minimo, activo) VALUES
  -- Gaseosas
  ('7790010000010', 'Coca-Cola 500 ml',                 'Gaseosa cola, botella 500 ml',          1, 1, 1150.00, 1800.00, 48, 12, 1),
  ('7790010000020', 'Coca-Cola 1,5 L',                  'Gaseosa cola, botella 1,5 L',           1, 1, 2250.00, 3400.00, 30, 8, 1),
  ('7790010000030', 'Coca-Cola 2,25 L',                 'Gaseosa cola, botella 2,25 L',          1, 1, 2900.00, 4300.00, 24, 6, 1),
  ('7790010000040', 'Coca-Cola Zero 500 ml',            'Gaseosa cola sin azúcar, 500 ml',       1, 1, 1150.00, 1800.00, 36, 10, 1),
  ('7790010000050', 'Coca-Cola Zero 1,5 L',             'Gaseosa cola sin azúcar, 1,5 L',        1, 1, 2250.00, 3400.00, 18, 6, 1),
  ('7790010000060', 'Coca-Cola lata 354 ml',            'Gaseosa cola, lata 354 ml',             1, 1,  950.00, 1500.00, 40, 12, 1),
  ('7790010000070', 'Sprite 500 ml',                    'Gaseosa lima-limón, 500 ml',            1, 1, 1100.00, 1750.00, 30, 8, 1),
  ('7790010000080', 'Sprite 1,5 L',                     'Gaseosa lima-limón, 1,5 L',             1, 1, 2150.00, 3300.00, 16, 6, 1),
  ('7790010000090', 'Fanta Naranja 500 ml',             'Gaseosa sabor naranja, 500 ml',         1, 1, 1100.00, 1750.00, 28, 8, 1),
  ('7790010000100', 'Fanta Naranja 1,5 L',              'Gaseosa sabor naranja, 1,5 L',          1, 1, 2150.00, 3300.00, 14, 6, 1),
  ('7790010000110', 'Pepsi 500 ml',                     'Gaseosa cola, 500 ml',                  1, 1, 1000.00, 1600.00, 24, 8, 1),
  ('7790010000120', 'Pepsi 1,5 L',                      'Gaseosa cola, 1,5 L',                   1, 1, 1950.00, 3000.00, 12, 6, 1),
  ('7790010000130', '7Up 500 ml',                       'Gaseosa lima-limón, 500 ml',            1, 1, 1000.00, 1600.00, 18, 6, 1),
  ('7790010000140', 'Paso de los Toros Pomelo 500 ml',  'Gaseosa sabor pomelo, 500 ml',          1, 1, 1050.00, 1700.00, 15, 6, 1),
  ('7790010000150', 'Schweppes Tónica 500 ml',          'Agua tónica, 500 ml',                   1, 1, 1100.00, 1750.00, 10, 4, 1),
  ('7790010000160', 'Manaos Cola 2,25 L',               'Gaseosa cola económica, 2,25 L',        1, 1, 1300.00, 2100.00, 20, 6, 1),

  -- Aguas
  ('7790020000010', 'Villavicencio 500 ml',             'Agua mineral sin gas, 500 ml',          2, 1,  600.00, 1100.00, 48, 12, 1),
  ('7790020000020', 'Villavicencio 1,5 L',              'Agua mineral sin gas, 1,5 L',           2, 1,  950.00, 1700.00, 30, 8, 1),
  ('7790020000030', 'Villa del Sur 500 ml',             'Agua mineral sin gas, 500 ml',          2, 1,  550.00, 1000.00, 36, 10, 1),
  ('7790020000040', 'Villa del Sur con gas 1,5 L',      'Agua mineral con gas, 1,5 L',           2, 1,  900.00, 1600.00, 18, 6, 1),
  ('7790020000050', 'Eco de los Andes 2 L',             'Agua mineral sin gas, 2 L',             2, 1, 1050.00, 1900.00, 16, 6, 1),
  ('7790020000060', 'Levité Pomelo 500 ml',             'Agua saborizada pomelo, 500 ml',        2, 1,  800.00, 1400.00, 24, 8, 1),
  ('7790020000070', 'Levité Naranja 1,5 L',             'Agua saborizada naranja, 1,5 L',        2, 1, 1400.00, 2300.00, 14, 6, 1),
  ('7790020000080', 'Aquarius Pera 500 ml',             'Agua saborizada pera, 500 ml',          2, 1,  850.00, 1450.00, 22, 8, 1),
  ('7790020000090', 'Aquarius Manzana 1,5 L',           'Agua saborizada manzana, 1,5 L',        2, 1, 1450.00, 2400.00, 12, 6, 1),
  ('7790020000100', 'Soda Sifón Ivess 1,5 L',           'Soda en sifón descartable, 1,5 L',      2, 1,  750.00, 1300.00, 10, 4, 1),

  -- Jugos
  ('7790030000010', 'Cepita Naranja 200 ml',            'Jugo de naranja, tetra 200 ml',         3, 1,  450.00,  800.00, 36, 10, 1),
  ('7790030000020', 'Cepita Naranja 1 L',               'Jugo de naranja, tetra 1 L',            3, 1, 1300.00, 2100.00, 14, 5, 1),
  ('7790030000030', 'Baggio Multifruta 200 ml',         'Jugo multifruta, tetra 200 ml',         3, 1,  380.00,  700.00, 40, 12, 1),
  ('7790030000040', 'Baggio Durazno 1 L',               'Jugo de durazno, tetra 1 L',            3, 1, 1150.00, 1900.00, 12, 5, 1),
  ('7790030000050', 'Ades Manzana 200 ml',              'Bebida de soja sabor manzana, 200 ml',  3, 1,  480.00,  850.00, 24, 8, 1),
  ('7790030000060', 'Citric Naranja 500 ml',            'Jugo exprimido de naranja, 500 ml',     3, 8, 1700.00, 2700.00, 8, 4, 1),
  ('7790030000070', 'Tang Naranja sobre 15 g',          'Jugo en polvo, rinde 1 L',              3, 6,  230.00,  450.00, 60, 15, 1),
  ('7790030000080', 'Clight Limonada sobre 8 g',        'Jugo en polvo sin azúcar, rinde 1 L',   3, 6,  280.00,  550.00, 45, 15, 1),

  -- Energéticas
  ('7790040000010', 'Speed Unlimited 250 ml',           'Bebida energizante, lata 250 ml',       4, 1, 1000.00, 1700.00, 30, 8, 1),
  ('7790040000020', 'Speed Unlimited 473 ml',           'Bebida energizante, lata 473 ml',       4, 1, 1500.00, 2500.00, 20, 6, 1),
  ('7790040000030', 'Red Bull 250 ml',                  'Bebida energizante, lata 250 ml',       4, 1, 1900.00, 3000.00, 24, 6, 1),
  ('7790040000040', 'Monster Energy 473 ml',            'Bebida energizante, lata 473 ml',       4, 1, 1800.00, 2900.00, 24, 6, 1),
  ('7790040000050', 'Monster Mango Loco 473 ml',        'Bebida energizante sabor mango, 473 ml', 4, 1, 1800.00, 2900.00, 12, 6, 1),
  ('7790040000060', 'Gatorade Manzana 500 ml',          'Bebida isotónica, 500 ml',              4, 1, 1200.00, 2000.00, 18, 6, 1),
  ('7790040000070', 'Gatorade Naranja 500 ml',          'Bebida isotónica, 500 ml',              4, 1, 1200.00, 2000.00, 16, 6, 1),
  ('7790040000080', 'Powerade Mountain Blast 500 ml',   'Bebida isotónica, 500 ml',              4, 1, 1100.00, 1850.00, 14, 6, 1),

  -- Bebidas con alcohol
  ('7790050000010', 'Quilmes Clásica lata 473 ml',      'Cerveza rubia, lata 473 ml',            5, 7, 1150.00, 1900.00, 48, 12, 1),
  ('7790050000020', 'Brahma lata 473 ml',               'Cerveza rubia, lata 473 ml',            5, 7, 1050.00, 1750.00, 36, 12, 1),
  ('7790050000030', 'Stella Artois lata 473 ml',        'Cerveza premium, lata 473 ml',          5, 7, 1500.00, 2400.00, 24, 8, 1),
  ('7790050000040', 'Heineken lata 473 ml',             'Cerveza premium, lata 473 ml',          5, 7, 1600.00, 2600.00, 24, 8, 1),
  ('7790050000050', 'Andes Origen Rubia lata 473 ml',   'Cerveza rubia mendocina, lata 473 ml',  5, 7, 1250.00, 2000.00, 30, 8, 1),
  ('7790050000060', 'Quilmes Clásica 1 L retornable',   'Cerveza rubia, botella 1 L (sin envase)', 5, 7, 1700.00, 2700.00, 18, 6, 1),
  ('7790050000070', 'Fernet Branca 750 ml',             'Aperitivo, botella 750 ml',             5, 7, 9500.00, 13500.00, 6, 2, 1),
  ('7790050000080', 'Vino Toro Tinto 1 L',              'Vino tinto, tetra 1 L',                 5, 7, 1400.00, 2300.00, 10, 4, 1),

  -- Golosinas
  ('7790060000010', 'Beldent Menta',                    'Chicles sin azúcar x 10 u',             6, 2,  450.00,  800.00, 60, 15, 1),
  ('7790060000020', 'Beldent Infinit Frutilla',         'Chicles sin azúcar x 14 u',             6, 2,  650.00, 1100.00, 36, 10, 1),
  ('7790060000030', 'Topline Strong',                   'Chicles sin azúcar mentol fuerte',      6, 2,  430.00,  750.00, 40, 12, 1),
  ('7790060000040', 'Halls Mentol',                     'Pastillas mentoladas x 9 u',            6, 2,  400.00,  700.00, 48, 12, 1),
  ('7790060000050', 'Halls Miel y Limón',               'Pastillas x 9 u',                       6, 2,  400.00,  700.00, 30, 10, 1),
  ('7790060000060', 'Mentos Menta',                     'Caramelos masticables x 14 u',          6, 2,  550.00,  950.00, 30, 8, 1),
  ('7790060000070', 'Tic Tac Menta',                    'Pastillas x 16 g',                      6, 2,  600.00, 1000.00, 24, 8, 1),
  ('7790060000080', 'Menthoplus Mentol',                'Caramelos duros mentol',                6, 2,  350.00,  600.00, 36, 10, 1),
  ('7790060000090', 'Mogul Ositos 30 g',                'Gomitas frutales',                      6, 2,  380.00,  650.00, 50, 12, 1),
  ('7790060000100', 'Mogul Moras 30 g',                 'Gomitas sabor mora',                    6, 2,  380.00,  650.00, 40, 12, 1),
  ('7790060000110', 'Flynn Paff Tutti Frutti',          'Caramelo masticable',                   6, 2,  100.00,  200.00, 120, 30, 1),
  ('7790060000120', 'Pico Dulce',                       'Chupetín clásico',                      6, 2,  130.00,  250.00, 100, 30, 1),
  ('7790060000130', 'Chupetín Pop Evolution',           'Chupetín con chicle',                   6, 2,  180.00,  350.00, 80, 20, 1),
  ('7790060000140', 'Sugus Confitados 50 g',            'Caramelos confitados',                  6, 2,  480.00,  850.00, 24, 8, 1),
  ('7790060000150', 'Butter Toffees 150 g',             'Caramelos rellenos, bolsa 150 g',       6, 2, 1300.00, 2100.00, 12, 4, 1),
  ('7790060000160', 'Mantecol 110 g',                   'Postre de maní',                        6, 2, 1400.00, 2300.00, 15, 5, 1),
  ('7790060000170', 'Turrón Arcor 25 g',                'Turrón de maní con oblea',              6, 2,  180.00,  350.00, 90, 24, 1),

  -- Chocolates
  ('7790070000010', 'Milka Leche 55 g',                 'Chocolate con leche',                   7, 2, 1150.00, 1900.00, 30, 8, 1),
  ('7790070000020', 'Milka Oreo 100 g',                 'Chocolate relleno con galletitas Oreo', 7, 2, 2300.00, 3700.00, 16, 5, 1),
  ('7790070000030', 'Cadbury Yoghurt Frutilla 82 g',    'Chocolate relleno sabor frutilla',      7, 2, 1800.00, 2900.00, 14, 5, 1),
  ('7790070000040', 'Block 38 g',                       'Chocolate con maní',                    7, 2,  750.00, 1250.00, 36, 10, 1),
  ('7790070000050', 'Block 110 g',                      'Chocolate con maní, tableta',           7, 2, 2000.00, 3200.00, 12, 4, 1),
  ('7790070000060', 'Shot 35 g',                        'Chocolate con maní',                    7, 2,  700.00, 1200.00, 30, 10, 1),
  ('7790070000070', 'Águila Taza 100 g',                'Chocolate para taza',                   7, 2, 1900.00, 3000.00, 8, 3, 1),
  ('7790070000080', 'Kinder Bueno',                     'Barra de chocolate rellena x 2',        7, 2, 1500.00, 2500.00, 20, 6, 1),
  ('7790070000090', 'Kinder Sorpresa',                  'Huevo de chocolate con sorpresa',       7, 2, 1900.00, 3100.00, 12, 4, 1),
  ('7790070000100', 'Bon o Bon',                        'Bombón relleno, unidad',                7, 2,  250.00,  450.00, 100, 30, 1),
  ('7790070000110', 'Rocklets 40 g',                    'Confites de chocolate',                 7, 2,  650.00, 1100.00, 30, 8, 1),
  ('7790070000120', 'Cofler Aireado 55 g',              'Chocolate aireado con leche',           7, 2, 1100.00, 1800.00, 18, 6, 1),
  ('7790070000130', 'Ferrero Rocher x 3',               'Bombones con avellana',                 7, 2, 2100.00, 3400.00, 9, 3, 1),
  ('7790070000140', 'Marroc',                           'Bombón de chocolate y maní',            7, 2,  280.00,  500.00, 60, 15, 1),

  -- Alfajores
  ('7790080000010', 'Jorgito Chocolate',                'Alfajor simple de dulce de leche',      8, 2,  450.00,  800.00, 48, 12, 1),
  ('7790080000020', 'Jorgito Blanco',                   'Alfajor simple glaseado',               8, 2,  450.00,  800.00, 30, 10, 1),
  ('7790080000030', 'Guaymallén Chocolate',             'Alfajor simple',                        8, 2,  250.00,  450.00, 72, 18, 1),
  ('7790080000040', 'Guaymallén Triple',                'Alfajor triple',                        8, 2,  400.00,  700.00, 48, 12, 1),
  ('7790080000050', 'Havanna Chocolate',                'Alfajor de chocolate premium',          8, 2, 1500.00, 2400.00, 18, 6, 1),
  ('7790080000060', 'Cachafaz Chocolate',               'Alfajor de chocolate premium',          8, 2, 1300.00, 2100.00, 18, 6, 1),
  ('7790080000070', 'Milka Triple Mousse',              'Alfajor triple relleno de mousse',      8, 2,  950.00, 1600.00, 30, 8, 1),
  ('7790080000080', 'Oreo Triple',                      'Alfajor triple',                        8, 2,  950.00, 1600.00, 24, 8, 1),
  ('7790080000090', 'Pepitos Triple',                   'Alfajor triple con chips',              8, 2,  900.00, 1500.00, 20, 8, 1),
  ('7790080000100', 'Terrabusi Triple Clásico',         'Alfajor triple de dulce de leche',      8, 2,  850.00, 1400.00, 24, 8, 1),
  ('7790080000110', 'Bon o Bon Alfajor',                'Alfajor con pasta de maní',             8, 2,  800.00, 1350.00, 24, 8, 1),
  ('7790080000120', 'Fantoche Triple',                  'Alfajor triple',                        8, 2,  600.00, 1000.00, 30, 10, 1),
  ('7790080000130', 'Capitán del Espacio',              'Alfajor simple de chocolate',           8, 2,  700.00, 1200.00, 12, 6, 1),
  ('7790080000140', 'Águila Minitorta Clásica',         'Alfajor minitorta',                     8, 2, 1000.00, 1700.00, 16, 6, 1),

  -- Galletitas
  ('7790090000010', 'Oreo 118 g',                       'Galletitas de chocolate rellenas',      9, 3, 1150.00, 1900.00, 24, 8, 1),
  ('7790090000020', 'Pepitos 118 g',                    'Galletitas con chips de chocolate',     9, 3, 1150.00, 1900.00, 20, 8, 1),
  ('7790090000030', 'Chocolinas 170 g',                 'Galletitas de chocolate',               9, 3, 1200.00, 2000.00, 18, 6, 1),
  ('7790090000040', 'Sonrisas 118 g',                   'Galletitas rellenas de frambuesa',      9, 3, 1000.00, 1650.00, 16, 6, 1),
  ('7790090000050', 'Rumba 112 g',                      'Galletitas rellenas de coco',           9, 3,  950.00, 1600.00, 14, 6, 1),
  ('7790090000060', 'Merengadas 93 g',                  'Galletitas rellenas de frutilla',       9, 3,  900.00, 1500.00, 14, 6, 1),
  ('7790090000070', 'Opera 92 g',                       'Obleas rellenas',                       9, 3,  850.00, 1450.00, 16, 6, 1),
  ('7790090000080', 'Melba 120 g',                      'Galletitas de chocolate rellenas de limón', 9, 3, 950.00, 1600.00, 12, 5, 1),
  ('7790090000090', 'Criollitas 3 x 100 g',             'Galletitas de agua, pack x 3',          9, 3, 1500.00, 2400.00, 12, 4, 1),
  ('7790090000100', 'Traviata 3 x 101 g',               'Galletitas crackers, pack x 3',         9, 3, 1550.00, 2500.00, 10, 4, 1),
  ('7790090000110', 'Cerealitas 212 g',                 'Galletitas con cereales',               9, 3, 1250.00, 2050.00, 10, 4, 1),
  ('7790090000120', 'Don Satur Bizcochos de Grasa 200 g', 'Bizcochos salados',                   9, 3,  800.00, 1350.00, 24, 8, 1),
  ('7790090000130', 'Don Satur Bizcochos Dulces 200 g', 'Bizcochos dulces',                      9, 3,  800.00, 1350.00, 18, 6, 1),
  ('7790090000140', '9 de Oro Agridulces 200 g',        'Bizcochos agridulces',                  9, 3,  850.00, 1400.00, 14, 6, 1),
  ('7790090000150', 'Surtido Bagley 400 g',             'Galletitas surtidas',                   9, 3, 2100.00, 3400.00, 8, 3, 1),

  -- Snacks
  ('7790100000010', 'Lay''s Clásicas 85 g',             'Papas fritas clásicas',                 10, 3, 1500.00, 2500.00, 24, 8, 1),
  ('7790100000020', 'Lay''s Clásicas 150 g',            'Papas fritas clásicas, tamaño familiar', 10, 3, 2500.00, 4000.00, 12, 4, 1),
  ('7790100000030', 'Doritos Queso 77 g',               'Nachos sabor queso',                    10, 3, 1500.00, 2500.00, 20, 6, 1),
  ('7790100000040', 'Cheetos Queso 79 g',               'Palitos de maíz sabor queso',           10, 3, 1300.00, 2200.00, 18, 6, 1),
  ('7790100000050', '3D Megaqueso 43 g',                'Conos de maíz sabor queso',             10, 3,  950.00, 1600.00, 20, 6, 1),
  ('7790100000060', 'Pringles Original 124 g',          'Papas en tubo',                         10, 3, 3500.00, 5500.00, 8, 3, 1),
  ('7790100000070', 'Twistos Jamón 95 g',               'Mini tostaditas horneadas',             10, 3, 1050.00, 1750.00, 16, 6, 1),
  ('7790100000080', 'Saladix Calabresa 30 g',           'Snack horneado',                        10, 3,  450.00,  800.00, 30, 10, 1),
  ('7790100000090', 'Pehuamar Papas Clásicas 80 g',     'Papas fritas clásicas',                 10, 3, 1100.00, 1850.00, 18, 6, 1),
  ('7790100000100', 'Maní King Salado 70 g',            'Maní frito y salado',                   10, 3,  600.00, 1000.00, 30, 10, 1),
  ('7790100000110', 'Palitos Salados Pep 110 g',        'Palitos de harina salados',             10, 3,  800.00, 1350.00, 18, 6, 1),
  ('7790100000120', 'Chizitos Pep 75 g',                'Palitos de maíz sabor queso',           10, 3,  750.00, 1250.00, 20, 6, 1),
  ('7790100000130', 'Pipas Girasol 60 g',               'Semillas de girasol saladas',           10, 3,  500.00,  850.00, 24, 8, 1),

  -- Cigarrillos
  ('7790110000010', 'Marlboro Box 20',                  'Cigarrillos, atado x 20',               11, 4, 3900.00, 4300.00, 40, 10, 1),
  ('7790110000020', 'Marlboro Gold Box 20',             'Cigarrillos, atado x 20',               11, 4, 3900.00, 4300.00, 30, 10, 1),
  ('7790110000030', 'Philip Morris Box 20',             'Cigarrillos, atado x 20',               11, 4, 3450.00, 3800.00, 40, 10, 1),
  ('7790110000040', 'Philip Morris Caps Box 20',        'Cigarrillos con cápsula, atado x 20',   11, 4, 3550.00, 3900.00, 20, 10, 1),
  ('7790110000050', 'Camel Box 20',                     'Cigarrillos, atado x 20',               11, 4, 3700.00, 4100.00, 30, 10, 1),
  ('7790110000060', 'Lucky Strike Box 20',              'Cigarrillos, atado x 20',               11, 4, 3600.00, 4000.00, 30, 10, 1),
  ('7790110000070', 'Chesterfield Box 20',              'Cigarrillos, atado x 20',               11, 4, 3100.00, 3400.00, 30, 10, 1),
  ('7790110000080', 'Red Point Box 20',                 'Cigarrillos, atado x 20',               11, 4, 2250.00, 2500.00, 20, 8, 1),

  -- Almacén
  ('7790120000010', 'Yerba Playadito 500 g',            'Yerba mate con palo',                   12, 6, 2600.00, 3900.00, 14, 5, 1),
  ('7790120000020', 'Yerba Taragüi 500 g',              'Yerba mate con palo',                   12, 6, 2500.00, 3800.00, 12, 5, 1),
  ('7790120000030', 'Azúcar Ledesma 1 kg',              'Azúcar común tipo A',                   12, 6, 1100.00, 1700.00, 15, 5, 1),
  ('7790120000040', 'Fideos Matarazzo Tirabuzón 500 g', 'Fideos secos',                          12, 6, 1200.00, 1900.00, 12, 4, 1),
  ('7790120000050', 'Arroz Gallo Oro 1 kg',             'Arroz parboil',                         12, 6, 2200.00, 3300.00, 8, 3, 1),
  ('7790120000060', 'Aceite Cocinero 900 ml',           'Aceite de girasol',                     12, 6, 2400.00, 3600.00, 9, 3, 1),
  ('7790120000070', 'Harina Pureza 000 1 kg',           'Harina de trigo 000',                   12, 6,  800.00, 1300.00, 10, 4, 1),
  ('7790120000080', 'Café La Virginia Instantáneo 50 g', 'Café instantáneo, frasco',             12, 6, 2800.00, 4200.00, 6, 3, 1),
  ('7790120000090', 'Té La Virginia x 25',              'Té en saquitos',                        12, 6,  900.00, 1500.00, 10, 4, 1),
  ('7790120000100', 'Mate Cocido Taragüi x 25',         'Mate cocido en saquitos',               12, 6,  950.00, 1550.00, 10, 4, 1),
  ('7790120000110', 'Puré de Tomate Arcor 520 g',       'Puré de tomate, tetra',                 12, 6,  750.00, 1250.00, 12, 4, 1),
  ('7790120000120', 'Sal Fina Celusal 500 g',           'Sal fina, paquete',                     12, 6,  700.00, 1150.00, 8, 3, 1),
  ('7790120000130', 'Mayonesa Hellmann''s 250 ml',      'Mayonesa clásica, doypack',             12, 6, 1300.00, 2100.00, 10, 4, 1),
  ('7790120000140', 'Atún La Campagnola 170 g',         'Atún al natural, lata',                 12, 6, 2300.00, 3500.00, 8, 3, 1),

  -- Helados
  ('7790130000010', 'Torpedo Frigor',                   'Helado de agua frutal',                 13, 5,  450.00,  900.00, 40, 10, 1),
  ('7790130000020', 'Palito Bombón Helado',             'Helado de crema bañado en chocolate',   13, 5,  800.00, 1500.00, 36, 10, 1),
  ('7790130000030', 'Epa! Frigor',                      'Helado de crema con dulce de leche',    13, 5, 1000.00, 1800.00, 24, 8, 1),
  ('7790130000040', 'Conogol',                          'Cucurucho de vainilla y chocolate',     13, 5, 1300.00, 2300.00, 24, 8, 1),
  ('7790130000050', 'Magnum Almendras',                 'Helado premium con almendras',          13, 5, 2400.00, 3900.00, 16, 6, 1),
  ('7790130000060', 'Cucurucho Frigor Dulce de Leche',  'Cucurucho de dulce de leche',           13, 5, 1300.00, 2300.00, 18, 6, 1),
  ('7790130000070', 'Helado Frigor Pote 1 L Americana', 'Pote familiar de crema americana',      13, 5, 4200.00, 6800.00, 6, 3, 1),
  ('7790130000080', 'Patalín',                          'Helado de agua bisabor',                13, 5,  400.00,  800.00, 30, 10, 1),

  -- Lácteos y frescos
  ('7790140000010', 'Leche La Serenísima Entera 1 L',   'Leche entera, sachet',                  14, 8, 1100.00, 1700.00, 20, 8, 1),
  ('7790140000020', 'Leche La Serenísima Larga Vida 1 L', 'Leche entera larga vida, tetra',      14, 8, 1350.00, 2100.00, 18, 6, 1),
  ('7790140000030', 'Yogurísimo Bebible Frutilla 185 g', 'Yogur bebible',                        14, 8,  700.00, 1200.00, 16, 6, 1),
  ('7790140000040', 'Danette Chocolate 95 g',           'Postre de chocolate',                   14, 8,  750.00, 1300.00, 12, 4, 1),
  ('7790140000050', 'Casancrem Clásico 290 g',          'Queso crema',                           14, 8, 2100.00, 3300.00, 6, 3, 1),
  ('7790140000060', 'Manteca La Serenísima 100 g',      'Manteca',                               14, 8, 1300.00, 2100.00, 8, 3, 1),
  ('7790140000070', 'Cindor 250 ml',                    'Leche chocolatada',                     14, 8,  800.00, 1350.00, 24, 8, 1),
  ('7790140000080', 'Sándwich de Miga Jamón y Queso x 3', 'Sándwiches de miga frescos',          14, 8, 1800.00, 3000.00, 10, 4, 1),

  -- Varios
  ('7790150000010', 'Encendedor BIC Maxi',              'Encendedor a gas',                      15, 6,  900.00, 1500.00, 40, 10, 1),
  ('7790150000020', 'Encendedor Candela',               'Encendedor económico',                  15, 6,  350.00,  700.00, 50, 12, 1),
  ('7790150000030', 'Fósforos 3 Patitos',               'Caja de fósforos x 40',                 15, 6,  200.00,  400.00, 30, 10, 1),
  ('7790150000040', 'Pilas Duracell AA x 2',            'Pilas alcalinas AA',                    15, 6, 1900.00, 3200.00, 16, 4, 1),
  ('7790150000050', 'Pilas Energizer AAA x 2',          'Pilas alcalinas AAA',                   15, 6, 1900.00, 3200.00, 12, 4, 1),
  ('7790150000060', 'Preservativos Prime x 3',          'Preservativos de látex',                15, 6, 1400.00, 2400.00, 20, 6, 1),
  ('7790150000070', 'Curitas x 8',                      'Apósitos adhesivos',                    15, 6,  500.00,  950.00, 20, 6, 1),
  ('7790150000080', 'Pañuelos Elite x 10',              'Pañuelos descartables',                 15, 6,  300.00,  600.00, 36, 10, 1),
  ('7790150000090', 'Cable USB-C 1 m',                  'Cable de carga y datos',                15, 6, 2200.00, 4500.00, 8, 3, 1),
  ('7790150000100', 'Cargador USB de pared',            'Cargador 5V 2A',                        15, 6, 3200.00, 6500.00, 5, 2, 1),
  ('7790150000110', 'Hielo en Rolitos 2 kg',            'Bolsa de hielo',                        15, 6,  900.00, 1800.00, 0, 4, 1),
  ('7790150000120', 'Papel para Armar OCB',             'Librillo de papel',                     15, 4,  600.00, 1100.00, 24, 8, 1),
  ('7790150000130', 'Tarjeta SUBE',                     'Tarjeta de transporte (sin carga)',     15, 6,  900.00, 1300.00, 0, 5, 0);

-- ------------------------------------------------------------
--  Movimiento de stock inicial de cada producto
-- ------------------------------------------------------------
INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_resultante, motivo, usuario_id)
SELECT id, 'INICIAL', stock, 0, stock, 'Carga inicial de inventario', 1
FROM productos
WHERE stock > 0
ORDER BY id;
