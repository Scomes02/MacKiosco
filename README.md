# Kiosco · Sistema de gestión

Sistema web para administrar un kiosco: punto de venta rápido, control de stock, caja, compras a
proveedores, clientes, reportes y usuarios con permisos. Todos los datos se guardan en **MySQL**.

Es una evolución de un sistema de escritorio para kioscos: conserva
sus módulos (Facturar, Ventas, Artículos, Clientes, Proveedores, Inventario) con una interfaz moderna,
adaptable a celular/tablet y con un flujo de venta pensado para hacerse en pocos segundos.

---

## Tecnologías

| Parte | Tecnología |
|---|---|
| Base de datos | MySQL 8.0 o superior |
| Backend (API REST) | Node.js 20+ · Express 5 · mysql2 · Zod (validaciones) · JWT en cookie httpOnly · bcrypt · Helmet |
| Frontend | React 18 · Vite · React Router |
| Administrar la base | DBeaver, MySQL Workbench o cualquier cliente MySQL |

No hay datos escritos "a mano" en el frontend: todo lo que se ve sale de la base a través de la API.

---

## Requisitos

1. **Node.js 20 o superior** → https://nodejs.org (versión LTS).
2. **MySQL 8.0 o superior** en funcionamiento (el instalador oficial "MySQL Installer", XAMPP o Laragon sirven).
3. Opcional: **DBeaver** (https://dbeaver.io) para mirar o editar la base. Si instalaste MySQL con el
   instalador oficial, **MySQL Workbench** ya viene incluido y sirve igual.

---

## Instalación paso a paso

Todos los comandos se ejecutan desde la carpeta del proyecto.

### 1. Instalar dependencias y compilar la interfaz

```bash
npm run instalar
```

(Instala `backend/`, instala `frontend/` y genera `frontend/dist`.)

### 2. Configurar la conexión a MySQL (`backend/.env`)

Copiá `backend/.env.example` como `backend/.env` y completá los valores:

```ini
NODE_ENV=development
PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña_de_mysql
DB_NAME=kiosco_db

JWT_SECRET=un_texto_largo_y_aleatorio_de_al_menos_32_caracteres
SESSION_HOURS=12
```

- `DB_PASSWORD`: la contraseña de tu usuario de MySQL.
- `JWT_SECRET`: clave con la que se firman las sesiones. Se genera con:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

El archivo `.env` **no se sube a Git** (está en `.gitignore`). Nunca escribas contraseñas en el código.

### 3. Crear la base de datos, las tablas y los datos de prueba

```bash
npm run db:setup
```

Este comando crea la base `kiosco_db`, las 15 tablas, y carga:

- 15 categorías, 8 proveedores, 10 clientes, 5 métodos de pago y **174 productos reales de kiosco**
  (gaseosas, golosinas, alfajores, cigarrillos, almacén, etc.) con código, costo, precio, stock y stock mínimo.
- Un **historial de demostración de 45 días** (unas 1.900 ventas, compras a proveedores, cajas
  abiertas y cerradas, y todos los movimientos de stock), generado con las mismas reglas del sistema
  para que el tablero y los reportes tengan datos coherentes desde el primer momento.

Si la base ya tiene tablas, `db:setup` no toca nada. Otras opciones:

| Comando | Qué hace |
|---|---|
| `npm run db:setup` | Crea todo solo si la base está vacía. |
| `npm run db:reset` | **Borra todo** y vuelve a cargar los datos de demostración. |
| `npm run db:reset:vacio --prefix backend` | **Borra todo** y deja solo el catálogo (sin ventas de demostración): ideal para empezar a usarlo de verdad. |
| `npm run db:migrar` | **Actualiza** una base ya instalada a la última versión del sistema **sin borrar datos**. Si hace falta, el sistema lo avisa al iniciar. |

#### Alternativa manual (DBeaver / MySQL Workbench)

Los scripts SQL están en `backend/database/`. Ejecutalos en este orden:

1. `00_crear_base.sql` → crea la base `kiosco_db`.
2. `01_schema.sql` → crea las tablas, claves, índices y restricciones.
3. `02_seed.sql` → inserta usuarios, categorías, proveedores, clientes, métodos de pago y productos.
4. Los archivos de `migraciones/` en orden (`001_facturacion.sql`, …) → actualizaciones del esquema.
   Si los ejecutás a mano, después corré `npm run db:migrar`: detecta lo que falta y lleva el registro.

(El historial de ventas de demostración solo se genera con `npm run db:setup` / `db:reset`.)

### 4. Iniciar el sistema

```bash
npm start
```

Abrí **http://localhost:3001** en el navegador. El mismo servidor entrega la API y la interfaz.

En Windows también podés hacer **doble clic en `iniciar.bat`**: instala lo que falte, inicia el
servidor y abre el navegador.

Para usarlo desde otra computadora, tablet o celular de la misma red, entrá a
`http://IP-DE-LA-PC:3001` (por ejemplo `http://192.168.0.10:3001`).

### Usuarios iniciales

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador (acceso total) |
| `cajero` | `cajero123` | Cajero (vende, maneja la caja y los clientes) |
| `lucas` | `cajero123` | Cajero |

**Cambiá estas contraseñas antes de usar el sistema con datos reales** (ícono de llave abajo a la
izquierda, o en *Usuarios*).

---

## Instalador para los locales (MacKiosco)

Para instalar el sistema en la PC de un kiosco no se siguen los pasos de arriba: se usa un instalador
que incluye todo (aplicación, Node.js y MySQL), deja el sistema iniciando solo con Windows y controla la
licencia de uso.

```bash
npm run instalador
```

Genera `instalador/salida/Instalar-MacKiosco.exe`. Las claves de licencia se emiten con
`Generar licencia.bat`. **Guía completa: [docs/instalacion-en-locales.md](docs/instalacion-en-locales.md).**

---

## Modo desarrollo

Para modificar el código con recarga automática se usan dos terminales:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

- `dev:api` → API en `http://localhost:3001` (se reinicia al guardar cambios).
- `dev:web` → interfaz en `http://localhost:5173`, que reenvía `/api` al backend.

Después de cambiar el frontend, `npm run build` actualiza la versión que sirve `npm start`.

---

## Funcionalidades

### Vender (punto de venta)
- Búsqueda por nombre o código; **compatible con lector de código de barras** (escanear + Enter agrega el producto).
- Filtro por categoría, carrito con cantidades, descuento porcentual y cliente opcional.
- Cobro con cualquier método de pago, **cálculo de vuelto** y **pago combinado** (dos métodos).
- Ticket imprimible. Atajos: **F2** buscar · **F9** cobrar · **Enter** confirmar · **Esc** volver.
- No permite vender sin stock, sin caja abierta, con cantidades inválidas ni con productos inactivos.
  Los precios y totales se recalculan siempre en el servidor.

### Recibos y facturación electrónica (ARCA)
- Al cobrar se elige el comprobante: **Recibo** (interno, no fiscal) o **Factura A/B** electrónica, que
  se valida en ARCA y se imprime con CAE y código QR. Por defecto sugiere recibo para efectivo y factura
  para los demás medios de pago.
- Si ARCA no responde, la venta se guarda igual y la factura queda pendiente para reintentar.
- Al anular una venta facturada se emite la nota de crédito.
- Requiere una configuración inicial (certificado digital y punto de venta). Sin ella, el sistema trabaja
  solo con recibos. **Guía completa: [docs/facturacion-arca.md](docs/facturacion-arca.md).**

### Caja
- Apertura con efectivo inicial, ingresos y egresos manuales, y cierre con arqueo (efectivo esperado
  vs. contado y diferencia). Historial de cajas con el detalle por método de pago.

### Ventas
- Historial con filtros por fecha, estado, método de pago y búsqueda por número o cliente.
- Detalle con ticket. El administrador puede **anular** una venta (devuelve el stock) mientras su caja siga abierta.

### Productos, categorías e inventario
- Alta, edición y baja de productos con cálculo de margen. Un producto con ventas no se borra
  físicamente: se archiva para conservar el historial, y su código queda libre para reutilizar.
- Inventario valorizado (capital a costo, valor de venta, ganancia potencial), alertas de stock bajo
  y sin stock, exportación a Excel (CSV).
- **Movimientos de stock**: cada venta, compra, ajuste o anulación queda registrado con stock anterior y resultante.
- Ajustes manuales de stock con motivo obligatorio.

### Compras y proveedores
- Registro de ingreso de mercadería por proveedor: suma stock y, opcionalmente, actualiza el costo.

### Inicio (tablero) y reportes
- Ventas de hoy y del mes con comparación contra el período anterior, operaciones, ticket promedio,
  ganancia bruta, productos más vendidos, métodos de pago, alertas de stock y últimas ventas.
- Reportes por rango de fechas: por día, por hora, por categoría, por método de pago, por usuario y
  ranking de productos, con exportación a CSV.

### Usuarios y configuración
- Roles **Administrador** y **Cajero**; alta, edición, desactivación y cambio de contraseña.
- Datos del comercio (se usan en el ticket) y métodos de pago configurables.

---

## Seguridad

- Contraseñas guardadas con **bcrypt**; nunca viajan ni se muestran.
- Sesión en **cookie httpOnly + SameSite=Strict** (no accesible desde JavaScript) con vencimiento configurable.
- Límite de intentos de inicio de sesión.
- **Consultas parametrizadas** en todo el backend (sin concatenar texto del usuario en el SQL).
- Validación de todas las entradas en el servidor con Zod, además de la validación del frontend.
- Control de acceso por rol en cada ruta de la API.
- Los errores nunca exponen SQL ni trazas: el usuario ve mensajes claros en español.
- Credenciales solo en `backend/.env`, fuera de Git.

---

## Estructura del proyecto

```
Kiosco/
├── package.json            Atajos: instalar, db:setup, start, dev
├── iniciar.bat             Inicio con doble clic (Windows)
├── backend/
│   ├── .env.example        Plantilla de configuración (sin contraseñas)
│   ├── database/           Scripts SQL: crear base, esquema y datos iniciales
│   ├── scripts/            db-setup.js (instalación) e historial-demo.js (datos de demostración)
│   └── src/
│       ├── server.js       Arranque del servidor
│       ├── app.js          Configuración de Express
│       ├── config/         Variables de entorno y conexión a MySQL
│       ├── routes/         Rutas de la API y permisos
│       ├── middlewares/    Autenticación, validación y manejo de errores
│       ├── validators/     Esquemas de validación (Zod)
│       ├── controllers/    Reciben el pedido y devuelven la respuesta
│       ├── services/       Reglas de negocio (ventas, stock, caja, compras…)
│       ├── repositories/   Acceso a datos: todo el SQL está acá
│       └── utils/          Errores, dinero, fechas y paginación
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx · App.jsx   Arranque y rutas de pantallas
        ├── api/            Cliente HTTP de la API
        ├── context/        Sesión del usuario y avisos
        ├── components/     Layout, modales, tablas, gráficos, ticket
        ├── pages/          Una pantalla por archivo (Vender, Caja, Productos…)
        ├── utils/          Formatos y hooks
        └── styles/         Hoja de estilos
```

### Modelo de datos (resumen)

`usuarios` · `categorias` · `proveedores` · `productos` · `clientes` · `metodos_pago` ·
`cajas` · `caja_movimientos` · `ventas` · `venta_detalles` · `venta_pagos` ·
`compras` · `compra_detalles` · `movimientos_stock` · `configuracion`

- Una **venta** pertenece a una caja y a un usuario, tiene renglones (`venta_detalles`, con el precio
  y costo del momento) y uno o más pagos (`venta_pagos`).
- El **stock** vive en `productos.stock` y cada cambio queda en `movimientos_stock`; ambos se
  escriben en la misma transacción, así nunca difieren.
- La base impide por sí misma el stock negativo, dos cajas abiertas a la vez y códigos de producto repetidos.

---

## Imágenes de productos

El sistema no depende de imágenes externas: cada producto muestra el **ícono y color de su categoría**.
Si querés una foto, cargá su dirección en el campo *Imagen (URL)* del producto; si esa imagen deja de
existir, vuelve a mostrarse el ícono automáticamente.

---

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `Usuario o contraseña de MySQL incorrectos` | Revisá `DB_USER` y `DB_PASSWORD` en `backend/.env`. |
| `No hay ningún MySQL escuchando en localhost:3306` | Iniciá el servicio de MySQL (Servicios de Windows → MySQL80) o revisá `DB_PORT`. |
| `Falta configurar JWT_SECRET` | Completá `JWT_SECRET` en `backend/.env` (mínimo 32 caracteres). |
| `El puerto 3001 ya está en uso` | Cambiá `PORT` en `backend/.env` o cerrá el otro programa. |
| Se ve la API pero no la pantalla | Falta compilar la interfaz: `npm run build`. |
