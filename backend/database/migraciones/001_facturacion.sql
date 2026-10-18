-- ============================================================
--  Migración 001 - Recibos y facturación electrónica (ARCA)
--
--  Agrega a una base ya instalada lo necesario para elegir el
--  comprobante de cada venta (recibo interno o factura con CAE).
--  No borra ni modifica datos existentes: las ventas anteriores
--  quedan como RECIBO y los productos con IVA 21%.
--
--  Se aplica con:  npm run db:migrar
-- ============================================================

SET NAMES utf8mb4;

ALTER TABLE productos
  ADD COLUMN iva ENUM('21','10.5','27','EXENTO','NO_GRAVADO') NOT NULL DEFAULT '21' AFTER precio_venta;

ALTER TABLE venta_detalles
  ADD COLUMN iva ENUM('21','10.5','27','EXENTO','NO_GRAVADO') NOT NULL DEFAULT '21' AFTER precio_costo;

ALTER TABLE ventas
  ADD COLUMN comprobante ENUM('RECIBO','FACTURA') NOT NULL DEFAULT 'RECIBO' AFTER total,
  ADD KEY idx_ventas_comprobante (comprobante, fecha);

CREATE TABLE comprobantes_fiscales (
  id                      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  venta_id                INT UNSIGNED  NOT NULL,
  clase                   ENUM('FACTURA','NOTA_CREDITO') NOT NULL,
  letra                   ENUM('A','B') NOT NULL,
  codigo_arca             SMALLINT UNSIGNED NOT NULL,
  ambiente                ENUM('HOMOLOGACION','PRODUCCION') NOT NULL,
  punto_venta             INT UNSIGNED  NOT NULL,
  numero                  INT UNSIGNED  NULL,
  fecha_emision           DATE          NULL,
  cae                     VARCHAR(14)   NULL,
  cae_vencimiento         DATE          NULL,
  emisor_cuit             VARCHAR(11)   NOT NULL,
  receptor_doc_tipo       SMALLINT UNSIGNED NOT NULL,
  receptor_doc_nro        VARCHAR(11)   NOT NULL,
  receptor_condicion_iva  SMALLINT UNSIGNED NOT NULL,
  receptor_nombre         VARCHAR(120)  NULL,
  importe_neto            DECIMAL(12,2) NOT NULL,
  importe_iva             DECIMAL(12,2) NOT NULL,
  importe_exento          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  importe_no_gravado      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  importe_total           DECIMAL(12,2) NOT NULL,
  detalle_iva             JSON          NULL,
  estado                  ENUM('PENDIENTE','AUTORIZADO','RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
  mensaje                 VARCHAR(500)  NULL,
  comprobante_asociado_id INT UNSIGNED  NULL,
  usuario_id              INT UNSIGNED  NOT NULL,
  creado_en               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_comprobantes_venta_clase (venta_id, clase),
  UNIQUE KEY uq_comprobantes_numero (ambiente, codigo_arca, punto_venta, numero),
  KEY idx_comprobantes_estado (estado),
  KEY idx_comprobantes_fecha (fecha_emision),
  CONSTRAINT fk_comprobantes_venta FOREIGN KEY (venta_id) REFERENCES ventas (id) ON DELETE CASCADE,
  CONSTRAINT fk_comprobantes_asociado FOREIGN KEY (comprobante_asociado_id) REFERENCES comprobantes_fiscales (id),
  CONSTRAINT fk_comprobantes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ticket de acceso que entrega ARCA (dura 12 horas y no se puede volver a pedir mientras esté vigente).
CREATE TABLE arca_tickets (
  ambiente ENUM('HOMOLOGACION','PRODUCCION') NOT NULL,
  servicio VARCHAR(20) NOT NULL,
  cuit     VARCHAR(11) NOT NULL,
  token    TEXT        NOT NULL,
  firma    TEXT        NOT NULL,
  vence_en DATETIME    NOT NULL,
  PRIMARY KEY (ambiente, servicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO configuracion (clave, valor) VALUES
  ('arca_habilitada',     '0'),
  ('arca_ambiente',       'HOMOLOGACION'),
  ('arca_punto_venta',    ''),
  ('ingresos_brutos',     ''),
  ('inicio_actividades',  '');
