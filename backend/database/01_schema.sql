-- ============================================================
--  KIOSCO - Esquema de base de datos (MySQL 8.0+)
--
--  ATENCIÓN: este script ELIMINA y vuelve a crear todas las tablas.
--  Debe ejecutarse sobre la base "kiosco_db" (ver 00_crear_base.sql).
--
--  Este es el esquema BASE. Después hay que aplicar, en orden, los
--  archivos de database/migraciones (lo hace solo "npm run db:setup").
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Tablas que agregan las migraciones (database/migraciones)
DROP TABLE IF EXISTS comprobantes_fiscales;
DROP TABLE IF EXISTS arca_tickets;
DROP TABLE IF EXISTS migraciones;

DROP TABLE IF EXISTS movimientos_stock;
DROP TABLE IF EXISTS compra_detalles;
DROP TABLE IF EXISTS compras;
DROP TABLE IF EXISTS venta_pagos;
DROP TABLE IF EXISTS venta_detalles;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS caja_movimientos;
DROP TABLE IF EXISTS cajas;
DROP TABLE IF EXISTS metodos_pago;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS configuracion;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
--  Usuarios del sistema
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(80)  NOT NULL,
  usuario        VARCHAR(30)  NOT NULL,
  email          VARCHAR(120) NULL,
  password_hash  VARCHAR(100) NOT NULL,
  rol            ENUM('ADMIN','CAJERO') NOT NULL DEFAULT 'CAJERO',
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_acceso  DATETIME     NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Categorías de productos
-- ------------------------------------------------------------
CREATE TABLE categorias (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(60)  NOT NULL,
  descripcion    VARCHAR(255) NULL,
  color          CHAR(7)      NOT NULL DEFAULT '#6366f1',
  icono          VARCHAR(16)  NOT NULL DEFAULT '📦',
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Proveedores
-- ------------------------------------------------------------
CREATE TABLE proveedores (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  razon_social   VARCHAR(120) NOT NULL,
  cuit           VARCHAR(13)  NULL,
  contacto       VARCHAR(80)  NULL,
  telefono       VARCHAR(30)  NULL,
  email          VARCHAR(120) NULL,
  direccion      VARCHAR(160) NULL,
  notas          VARCHAR(255) NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_proveedores_razon_social (razon_social),
  UNIQUE KEY uq_proveedores_cuit (cuit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Productos
--  "codigo_vigente" permite reutilizar el código de un producto
--  eliminado (borrado lógico) sin perder el historial de ventas.
-- ------------------------------------------------------------
CREATE TABLE productos (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  codigo         VARCHAR(30)   NOT NULL,
  nombre         VARCHAR(120)  NOT NULL,
  descripcion    VARCHAR(255)  NULL,
  categoria_id   INT UNSIGNED  NOT NULL,
  proveedor_id   INT UNSIGNED  NULL,
  precio_costo   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  precio_venta   DECIMAL(12,2) NOT NULL,
  stock          INT           NOT NULL DEFAULT 0,
  stock_minimo   INT           NOT NULL DEFAULT 0,
  imagen_url     VARCHAR(500)  NULL,
  activo         TINYINT(1)    NOT NULL DEFAULT 1,
  eliminado_en   DATETIME      NULL,
  codigo_vigente VARCHAR(30)   GENERATED ALWAYS AS (IF(eliminado_en IS NULL, codigo, NULL)) VIRTUAL,
  creado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_productos_codigo_vigente (codigo_vigente),
  KEY idx_productos_nombre (nombre),
  KEY idx_productos_categoria (categoria_id),
  KEY idx_productos_proveedor (proveedor_id),
  KEY idx_productos_stock (activo, stock),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_productos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_productos_precio_costo CHECK (precio_costo >= 0),
  CONSTRAINT chk_productos_precio_venta CHECK (precio_venta >= 0),
  CONSTRAINT chk_productos_stock CHECK (stock >= 0),
  CONSTRAINT chk_productos_stock_minimo CHECK (stock_minimo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Clientes (opcional en la venta: sin cliente = Consumidor Final)
-- ------------------------------------------------------------
CREATE TABLE clientes (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(120) NOT NULL,
  documento      VARCHAR(13)  NULL,
  condicion_iva  ENUM('CONSUMIDOR_FINAL','MONOTRIBUTISTA','RESPONSABLE_INSCRIPTO','EXENTO')
                 NOT NULL DEFAULT 'CONSUMIDOR_FINAL',
  telefono       VARCHAR(30)  NULL,
  email          VARCHAR(120) NULL,
  direccion      VARCHAR(160) NULL,
  notas          VARCHAR(255) NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_clientes_documento (documento),
  KEY idx_clientes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Métodos de pago
-- ------------------------------------------------------------
CREATE TABLE metodos_pago (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(40)  NOT NULL,
  es_efectivo TINYINT(1)   NOT NULL DEFAULT 0,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  orden       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metodos_pago_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Cajas (turnos de caja). Solo puede haber una caja ABIERTA:
--  la columna generada "unica_abierta" lo garantiza a nivel de base.
-- ------------------------------------------------------------
CREATE TABLE cajas (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  estado              ENUM('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
  usuario_apertura_id INT UNSIGNED  NOT NULL,
  abierta_en          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  monto_inicial       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  usuario_cierre_id   INT UNSIGNED  NULL,
  cerrada_en          DATETIME      NULL,
  monto_esperado      DECIMAL(12,2) NULL,
  monto_contado       DECIMAL(12,2) NULL,
  diferencia          DECIMAL(12,2) NULL,
  observaciones       VARCHAR(255)  NULL,
  unica_abierta       TINYINT       GENERATED ALWAYS AS (IF(estado = 'ABIERTA', 1, NULL)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cajas_unica_abierta (unica_abierta),
  KEY idx_cajas_abierta_en (abierta_en),
  CONSTRAINT fk_cajas_usuario_apertura FOREIGN KEY (usuario_apertura_id) REFERENCES usuarios (id),
  CONSTRAINT fk_cajas_usuario_cierre FOREIGN KEY (usuario_cierre_id) REFERENCES usuarios (id),
  CONSTRAINT chk_cajas_monto_inicial CHECK (monto_inicial >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Ingresos y egresos manuales de efectivo de una caja
-- ------------------------------------------------------------
CREATE TABLE caja_movimientos (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  caja_id    INT UNSIGNED  NOT NULL,
  tipo       ENUM('INGRESO','EGRESO') NOT NULL,
  monto      DECIMAL(12,2) NOT NULL,
  concepto   VARCHAR(160)  NOT NULL,
  usuario_id INT UNSIGNED  NOT NULL,
  fecha      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_caja_movimientos_caja (caja_id),
  CONSTRAINT fk_caja_movimientos_caja FOREIGN KEY (caja_id) REFERENCES cajas (id) ON DELETE CASCADE,
  CONSTRAINT fk_caja_movimientos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT chk_caja_movimientos_monto CHECK (monto > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Ventas (cabecera)
-- ------------------------------------------------------------
CREATE TABLE ventas (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  fecha                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id           INT UNSIGNED  NOT NULL,
  cliente_id           INT UNSIGNED  NULL,
  caja_id              INT UNSIGNED  NOT NULL,
  subtotal             DECIMAL(12,2) NOT NULL,
  descuento_porcentaje DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  descuento_monto      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total                DECIMAL(12,2) NOT NULL,
  estado               ENUM('COMPLETADA','ANULADA') NOT NULL DEFAULT 'COMPLETADA',
  observaciones        VARCHAR(255)  NULL,
  anulada_en           DATETIME      NULL,
  anulada_por          INT UNSIGNED  NULL,
  motivo_anulacion     VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  KEY idx_ventas_fecha (fecha),
  KEY idx_ventas_estado_fecha (estado, fecha),
  KEY idx_ventas_usuario (usuario_id),
  KEY idx_ventas_cliente (cliente_id),
  KEY idx_ventas_caja (caja_id),
  CONSTRAINT fk_ventas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_ventas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id),
  CONSTRAINT fk_ventas_caja FOREIGN KEY (caja_id) REFERENCES cajas (id),
  CONSTRAINT fk_ventas_anulada_por FOREIGN KEY (anulada_por) REFERENCES usuarios (id),
  CONSTRAINT chk_ventas_total CHECK (total >= 0),
  CONSTRAINT chk_ventas_descuento CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Detalle de venta. Guarda una "foto" del código, nombre, precio
--  y costo del producto al momento de la venta.
-- ------------------------------------------------------------
CREATE TABLE venta_detalles (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venta_id        INT UNSIGNED  NOT NULL,
  producto_id     INT UNSIGNED  NOT NULL,
  producto_codigo VARCHAR(30)   NOT NULL,
  producto_nombre VARCHAR(120)  NOT NULL,
  cantidad        INT           NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  precio_costo    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  subtotal        DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_venta_detalles_venta (venta_id),
  KEY idx_venta_detalles_producto (producto_id),
  CONSTRAINT fk_venta_detalles_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
  CONSTRAINT fk_venta_detalles_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT chk_venta_detalles_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Pagos de una venta (permite pagos combinados)
-- ------------------------------------------------------------
CREATE TABLE venta_pagos (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venta_id       INT UNSIGNED  NOT NULL,
  metodo_pago_id INT UNSIGNED  NOT NULL,
  monto          DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_venta_pagos_venta (venta_id),
  KEY idx_venta_pagos_metodo (metodo_pago_id),
  CONSTRAINT fk_venta_pagos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
  CONSTRAINT fk_venta_pagos_metodo FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago (id),
  CONSTRAINT chk_venta_pagos_monto CHECK (monto > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Compras a proveedores (ingreso de mercadería)
-- ------------------------------------------------------------
CREATE TABLE compras (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  fecha              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  proveedor_id       INT UNSIGNED  NOT NULL,
  usuario_id         INT UNSIGNED  NOT NULL,
  numero_comprobante VARCHAR(40)   NULL,
  total              DECIMAL(12,2) NOT NULL,
  observaciones      VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  KEY idx_compras_fecha (fecha),
  KEY idx_compras_proveedor (proveedor_id),
  CONSTRAINT fk_compras_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores (id),
  CONSTRAINT fk_compras_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE compra_detalles (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  compra_id      INT UNSIGNED  NOT NULL,
  producto_id    INT UNSIGNED  NOT NULL,
  cantidad       INT           NOT NULL,
  costo_unitario DECIMAL(12,2) NOT NULL,
  subtotal       DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_compra_detalles_compra (compra_id),
  KEY idx_compra_detalles_producto (producto_id),
  CONSTRAINT fk_compra_detalles_compra FOREIGN KEY (compra_id) REFERENCES compras (id) ON DELETE CASCADE,
  CONSTRAINT fk_compra_detalles_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT chk_compra_detalles_cantidad CHECK (cantidad > 0),
  CONSTRAINT chk_compra_detalles_costo CHECK (costo_unitario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Movimientos de stock: historial completo de cada cambio.
--  "cantidad" es positiva para entradas y negativa para salidas.
-- ------------------------------------------------------------
CREATE TABLE movimientos_stock (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id      INT UNSIGNED NOT NULL,
  tipo             ENUM('INICIAL','VENTA','COMPRA','AJUSTE_ENTRADA','AJUSTE_SALIDA','ANULACION_VENTA') NOT NULL,
  cantidad         INT          NOT NULL,
  stock_anterior   INT          NOT NULL,
  stock_resultante INT          NOT NULL,
  motivo           VARCHAR(255) NULL,
  venta_id         INT UNSIGNED NULL,
  compra_id        INT UNSIGNED NULL,
  usuario_id       INT UNSIGNED NOT NULL,
  fecha            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movimientos_producto_fecha (producto_id, fecha),
  KEY idx_movimientos_fecha (fecha),
  KEY idx_movimientos_tipo (tipo),
  KEY idx_movimientos_venta (venta_id),
  KEY idx_movimientos_compra (compra_id),
  CONSTRAINT fk_movimientos_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT fk_movimientos_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE SET NULL,
  CONSTRAINT fk_movimientos_compra FOREIGN KEY (compra_id) REFERENCES compras (id) ON DELETE SET NULL,
  CONSTRAINT fk_movimientos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  Configuración general del comercio (clave / valor)
-- ------------------------------------------------------------
CREATE TABLE configuracion (
  clave          VARCHAR(50)  NOT NULL,
  valor          VARCHAR(500) NOT NULL DEFAULT '',
  actualizado_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
