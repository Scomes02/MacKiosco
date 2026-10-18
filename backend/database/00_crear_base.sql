-- ============================================================
--  KIOSCO - Creación de la base de datos
--  Ejecutar primero (solo si se instala manualmente desde DBeaver
--  o MySQL Workbench). El comando "npm run db:setup" ya lo hace solo.
-- ============================================================

CREATE DATABASE IF NOT EXISTS kiosco_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE kiosco_db;
