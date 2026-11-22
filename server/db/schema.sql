
-- =====================================================================
--  SISTEMA DE INVENTARIO Y PUNTO DE VENTA - Esquema de base de datos
--  Motor: MySQL 8.0+ (compatible con TiDB, Aiven, Railway, PlanetScale-MySQL, WAMP/XAMPP)
--  Las fechas se guardan en la hora local del negocio (ver TZ_OFFSET).
--  Ejecutar con:  npm run db:setup   (o importar este archivo en phpMyAdmin)
-- =====================================================================

SET NAMES utf8mb4;

-- Usuarios del sistema y su rol
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(30)   NOT NULL,
  password_hash  VARCHAR(100)  NOT NULL,
  full_name      VARCHAR(100)  NOT NULL,
  role           ENUM('admin','cajero','almacenero') NOT NULL,
  active         TINYINT(1)    NOT NULL DEFAULT 1,
  last_login     DATETIME      NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorías de productos (Gaseosas, Cervezas, ...)
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(60)  NOT NULL,
  color       CHAR(7)      NOT NULL DEFAULT '#2563eb',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Proveedores / distribuidores
CREATE TABLE IF NOT EXISTS suppliers (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  ruc         VARCHAR(11)  NULL,
  phone       VARCHAR(30)  NULL,
  email       VARCHAR(120) NULL,
  address     VARCHAR(200) NULL,
  contact     VARCHAR(120) NULL,
  notes       VARCHAR(500) NULL,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catálogo de productos. El stock solo cambia a través de stock_movements.
-- La imagen se guarda en la base (data URL reducida en el navegador) porque
-- Vercel no conserva archivos subidos al disco.
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(60)   NOT NULL,
  name            VARCHAR(120)  NOT NULL,
  category_id     INT UNSIGNED  NULL,
  brand           VARCHAR(60)   NULL,
  presentation    VARCHAR(60)   NULL,
  purchase_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  sale_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock           INT           NOT NULL DEFAULT 0,
  min_stock       INT           NOT NULL DEFAULT 0,
  supplier_id     INT UNSIGNED  NULL,
  image           MEDIUMTEXT    NULL,
  expiry_date     DATE          NULL,
  active          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_code (code),
  KEY idx_products_name (name),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT chk_products_prices CHECK (purchase_price >= 0 AND sale_price >= 0 AND min_stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kardex: cada cambio de stock queda registrado con usuario y motivo
CREATE TABLE IF NOT EXISTS stock_movements (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id    INT UNSIGNED NOT NULL,
  type          ENUM('entrada','salida','venta','merma','ajuste','anulacion') NOT NULL,
  quantity      INT          NOT NULL,          -- positivo suma, negativo resta
  stock_before  INT          NOT NULL,
  stock_after   INT          NOT NULL,
  unit_cost     DECIMAL(10,2) NULL,
  reason        VARCHAR(200) NULL,
  reference     VARCHAR(60)  NULL,              -- N° de factura, N° de venta, etc.
  supplier_id   INT UNSIGNED NULL,
  user_id       INT UNSIGNED NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_movements_product (product_id),
  KEY idx_movements_date (created_at),
  CONSTRAINT fk_mov_product  FOREIGN KEY (product_id)  REFERENCES products(id),
  CONSTRAINT fk_mov_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_mov_user     FOREIGN KEY (user_id)     REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cabecera de ventas
CREATE TABLE IF NOT EXISTS sales (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  number           VARCHAR(20)   NOT NULL,      -- Ej: B001-00000123
  subtotal         DECIMAL(12,2) NOT NULL,      -- base imponible
  tax              DECIMAL(12,2) NOT NULL,      -- impuesto (IGV)
  discount         DECIMAL(12,2) NOT NULL DEFAULT 0,
  total            DECIMAL(12,2) NOT NULL,
  payment_method   ENUM('efectivo','tarjeta','transferencia','yape','plin') NOT NULL,
  amount_received  DECIMAL(12,2) NOT NULL DEFAULT 0,
  change_given     DECIMAL(12,2) NOT NULL DEFAULT 0,
  customer_name    VARCHAR(120)  NULL,
  customer_doc     VARCHAR(15)   NULL,
  notes            VARCHAR(200)  NULL,
  status           ENUM('completada','anulada') NOT NULL DEFAULT 'completada',
  user_id          INT UNSIGNED  NULL,
  cancelled_by     INT UNSIGNED  NULL,
  cancel_reason    VARCHAR(200)  NULL,
  cancelled_at     DATETIME      NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sales_number (number),
  KEY idx_sales_date (created_at),
  CONSTRAINT fk_sales_user      FOREIGN KEY (user_id)      REFERENCES users(id),
  CONSTRAINT fk_sales_cancelled FOREIGN KEY (cancelled_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de ventas (se guarda nombre y precio del momento de la venta)
CREATE TABLE IF NOT EXISTS sale_items (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sale_id       INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NOT NULL,
  product_code  VARCHAR(60)   NOT NULL,
  product_name  VARCHAR(120)  NOT NULL,
  quantity      INT           NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  unit_cost     DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal      DECIMAL(12,2) NOT NULL,
  KEY idx_items_sale (sale_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_sale    FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_items_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración clave/valor (datos del negocio, impuestos, ticket, logo...)
CREATE TABLE IF NOT EXISTS settings (
  name   VARCHAR(60) NOT NULL PRIMARY KEY,
  value  MEDIUMTEXT  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
