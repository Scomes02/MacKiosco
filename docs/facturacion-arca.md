# Recibos y facturación electrónica (ARCA)

Cada venta se registra con uno de dos comprobantes, que se elige al cobrar:

| Comprobante | Qué es | Cuándo se sugiere |
|---|---|---|
| **Recibo** | Comprobante interno del kiosco. No se informa a ARCA y se imprime con la leyenda "Comprobante no válido como factura". | Cobros en efectivo. |
| **Factura** | Factura electrónica A o B. Se envía a ARCA en el momento, que la autoriza y devuelve el **CAE**. Se imprime con CAE, vencimiento y código QR. | Tarjetas, Mercado Pago, transferencias y pagos combinados. |

El sistema solo sugiere: el cajero puede cambiar el comprobante en cada venta con un clic, y un recibo se
puede convertir en factura más tarde desde el detalle de la venta ("Emitir factura").

> Qué operaciones corresponde facturar es una obligación fiscal del comercio. Consultalo con tu contador:
> el sistema registra y emite lo que el usuario elige, no decide por él.

## Cómo funciona

- El kiosco factura como **Responsable Inscripto**:
  - **Factura A** si el cliente tiene CUIT y es Responsable Inscripto o Monotributista.
  - **Factura B** en los demás casos (consumidor final, exentos, cliente sin identificar).
- Los precios del sistema son finales (IVA incluido). Al facturar se separa el neto y el IVA según el
  **IVA de cada producto** (21%, 10,5%, 27%, exento o no gravado), que se configura en la ficha del producto.
  Todos los productos vienen con 21%: **revisá con tu contador los que tengan otro tratamiento**
  (por ejemplo cigarrillos, leche o pan).
- Si ARCA no responde o rechaza la factura, **la venta igual queda guardada** y la factura queda
  "pendiente", con el motivo a la vista y un botón para reintentar. En *Ventas* se pueden filtrar las
  "Facturas pendientes".
- Si se corta la conexión justo después de que ARCA autorizó, al reintentar el sistema recupera ese mismo
  CAE en lugar de emitir una factura duplicada.
- Al **anular** una venta facturada se emite automáticamente la **nota de crédito** asociada. Si ARCA no
  la autoriza, la venta no se anula.
- En *Reportes* hay un resumen de comprobantes del período: facturas A y B, notas de crédito (con neto,
  IVA y total) y recibos.

## Puesta en marcha (una sola vez)

Todo se hace desde **Configuración → Facturación electrónica (ARCA)**, entrando como administrador.
Conviene hacerlo primero en el ambiente de **Pruebas (homologación)** y recién después en **Producción**.

### 1. Datos del comercio
En "Datos del comercio" cargá el **CUIT** (11 dígitos), la **razón social**, la dirección, Ingresos Brutos y
la fecha de inicio de actividades. Guardá.

### 2. Pedido de certificado
Tocá **"Generar y descargar el pedido"**. Se descarga un archivo `.csr`.
La clave privada se genera en ese momento y queda guardada solo en esta computadora
(`backend/certs/clave.key`). **Hacé una copia de seguridad de la carpeta `backend/certs`**: si se pierde la
clave hay que repetir el trámite del certificado.

### 3. Obtener el certificado en la web de ARCA
Se entra a https://www.arca.gob.ar con CUIT y clave fiscal (nivel 3). Los nombres de los menús pueden
variar levemente.

**Para pruebas (homologación):**
1. Si no aparece, agregá el servicio **"WSASS - Autogestión Certificados Homologación"** desde
   "Administrador de Relaciones de Clave Fiscal" → "Adherir servicio".
2. En WSASS → **"Nuevo Certificado"**: escribí un nombre (por ejemplo `kiosco`), pegá el contenido del
   archivo `.csr` y tocá "Crear DN y obtener certificado". Copiá el certificado que devuelve.
3. En WSASS → **"Crear autorización a servicio"**: elegí el nombre creado, tu CUIT como representado y el
   servicio **`wsfe` (Facturación Electrónica)**.

**Para producción:**
1. Servicio **"Administración de Certificados Digitales"** → "Agregar alias" → nombre `kiosco` → subí el
   archivo `.csr` → descargá el certificado `.crt`.
2. **"Administrador de Relaciones de Clave Fiscal"** → "Nueva Relación" → Buscar → ARCA → WebServices →
   **"Facturación Electrónica"** → en "Representante" elegí el computador fiscal `kiosco` → Confirmar.
3. **"Administración de puntos de venta y domicilios"** → "A/B/M de puntos de venta" → Agregar: elegí un
   número, y en sistema **"RECE para aplicativo y web services"**. (El punto de venta de "Comprobantes en
   línea" no sirve para web services.)

### 4. Cargar el certificado y el punto de venta
De vuelta en el sistema: elegí el ambiente, cargá el archivo `.crt` (o pegá su contenido), escribí el
**número de punto de venta** y tocá **"Probar conexión con ARCA"**. La prueba revisa los servidores, el
certificado y el punto de venta sin emitir ningún comprobante.

### 5. Habilitar
Con la prueba en verde, tocá **"Habilitar la facturación"**. Desde ese momento, al cobrar aparece la opción
Recibo / Factura.

En homologación las facturas se imprimen con la leyenda "COMPROBANTE DE PRUEBA · SIN VALIDEZ FISCAL".
Cuando todo funcione, repetí los pasos 3 a 5 con el ambiente **Producción**.

## Mensajes frecuentes

| Mensaje | Qué hacer |
|---|---|
| "ARCA no reconoce el certificado cargado" | El certificado no es de ese ambiente (pruebas/producción) o está vencido. |
| "El certificado no está autorizado a usar la facturación electrónica" | Falta asociar el certificado al servicio `wsfe` (paso 3). |
| "ARCA ya entregó un acceso vigente…" | Esperá unos minutos y volvé a probar. |
| "ARCA rechazó el pedido por la fecha y hora" | Poné en hora el reloj de la computadora. |
| "No se pudo conectar con ARCA" | Sin internet o ARCA fuera de servicio. La venta quedó guardada: reintentá la factura más tarde. |
| Rechazo con código 10015 / 10013 | Revisá el CUIT o DNI y la condición de IVA del cliente. |

## Detalles técnicos

- Servicios usados: **WSAA** (autenticación con certificado, firma CMS) y **WSFEv1** (`FECAESolicitar`,
  `FECompUltimoAutorizado`, `FECompConsultar`, `FEDummy`).
- Código: `backend/src/services/arca/` (comunicación) y `backend/src/services/facturacion.service.js` (reglas).
- Datos: tabla `comprobantes_fiscales` (factura y nota de crédito de cada venta, con CAE e importes) y
  `arca_tickets` (acceso vigente de ARCA, dura 12 horas).
- La clave privada y los certificados están en `backend/certs/`, fuera de Git y nunca se envían al navegador.
