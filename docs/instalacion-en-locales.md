# Instalar MacKiosco en un local

Todo lo que hace falta llevar al local es **un solo archivo**:

```
instalador\salida\Instalar-MacKiosco.exe
```

Incluye la aplicación, Node.js y MySQL. La PC del local no necesita tener nada instalado ni conexión a
internet para instalar.

## Requisitos de la PC del local

- Windows 10 u 11 de 64 bits, 4 GB de RAM y unos 600 MB libres en disco.
- Permisos de administrador para instalar (Windows pide confirmación una vez).
- Para imprimir tickets: impresora configurada como predeterminada en Windows.
- Internet solo si el local va a facturar con ARCA.

## Instalación (unos 2 minutos)

1. Doble clic en `Instalar-MacKiosco.exe` y aceptar el aviso de Windows.
2. El asistente pregunta:
   - **Nombre del kiosco**: aparece en la pantalla de ingreso, el menú, los tickets y el acceso directo.
     Si se deja como está, queda "MacKiosco". Se puede cambiar después en *Configuración*.
   - **Clave del usuario `admin`**: mínimo 6 caracteres. No hay claves por defecto.
   - **Datos iniciales**: catálogo de ejemplo (174 productos con precios de referencia y stock en cero)
     o empezar sin productos. Las categorías y los métodos de pago se cargan siempre.
   - **Uso en red**: si otras PC, tablets o celulares del local van a usar el sistema.
3. Al terminar queda un acceso directo en el escritorio con el nombre del kiosco.

Qué hace el instalador por su cuenta:

- Crea una base de datos propia para MacKiosco (MySQL incluido, en el puerto 3311, accesible solo desde esa
  PC). No toca ningún otro MySQL que la computadora ya tenga.
- Genera claves únicas para esa PC (base de datos y sesiones).
- Deja el sistema iniciándose solo al encender la computadora, sin ventanas a la vista.
- Si el puerto 3001 está ocupado por otro programa, usa el siguiente libre.

Dónde queda cada cosa:

| Carpeta | Contenido |
|---|---|
| `C:\Program Files\MacKiosco` | El programa. Se reemplaza al actualizar. |
| `C:\ProgramData\MacKiosco` | Los datos del local: base de datos, configuración, certificados de ARCA, copias de seguridad y registros. **Nunca se toca al actualizar ni al desinstalar.** |

## Uso desde otros equipos del local

Si se activó el uso en red, desde cualquier equipo conectado a la misma red se entra con el navegador a
`http://IP-DE-LA-PC:3001` (por ejemplo `http://192.168.0.10:3001`). La IP se ve en la PC principal con el
comando `ipconfig`.

## Licencias

Cada instalación funciona **15 días de prueba** sin clave. Después hace falta una clave de licencia, que
vale solo para esa PC y tiene fecha de vencimiento.

**Cómo dar de alta o renovar un local:**

1. El cliente entra a *Configuración → Licencia* y te envía su **código de equipo** (16 caracteres).
2. En tu PC, doble clic en **`Generar licencia.bat`** (en la raíz del proyecto). Pide el código de equipo,
   el titular y la duración en meses (o una fecha de vencimiento) y muestra la clave.
3. Le enviás la clave; el cliente la pega en *Configuración → Licencia → Activar licencia*.

Cada clave emitida queda anotada en `licencias\emitidas.csv`.

**Qué ve el local:**

| Situación | Comportamiento |
|---|---|
| Prueba o licencia vigente | Funciona normal. Faltando 10 días o menos aparece un aviso en todas las pantallas. |
| Vencida hace 5 días o menos | Sigue funcionando, con aviso (días de gracia). |
| Vencida hace más de 5 días | Modo **solo consulta**: se puede entrar, ver, exportar, hacer copias y cargar la clave nueva, pero no vender ni modificar datos. No se pierde nada. |

**Importante sobre la clave privada.** Las licencias se firman con `licencias\clave-privada.pem`, que está
solo en tu PC y no va en el instalador. Hacé una copia de esa carpeta en un lugar seguro:

- Si la perdés, no vas a poder generar claves para los instaladores ya entregados.
- Si alguien la obtiene, puede generar licencias.
- En la PC donde está esa clave el sistema no pide licencia (aparece como "Equipo del fabricante").

Límite a tener en cuenta: el programa se entrega como código JavaScript legible, así que una persona con
conocimientos técnicos podría modificarlo para saltear el control. La licencia frena el uso indebido común
(copiar la carpeta a otra PC, seguir usándolo vencido, atrasar el reloj), no a un programador decidido.

## Copias de seguridad

- El sistema hace **una copia automática por día** y conserva las últimas 30 en
  `C:\ProgramData\MacKiosco\backups`.
- En *Configuración → Copias de seguridad* se puede hacer una copia en el momento, descargarla y definir una
  **carpeta extra** (pendrive, carpeta de OneDrive o Google Drive) donde se duplica cada copia. Conviene
  configurarla en todos los locales: es lo que salva los datos si se rompe el disco.
- La carpeta extra no puede ser una unidad de red mapeada (Z:, etc.).

**Restaurar una copia:** menú Inicio → MacKiosco → Herramientas → *Restaurar copia de seguridad* (clic derecho →
Ejecutar como administrador). Pide el archivo, confirma, guarda antes una copia de los datos actuales y
reinicia el sistema. Sirve también para pasar un local a una PC nueva: se instala MacKiosco, se copia el
archivo `.sql.gz` y se restaura.

## Actualizar un local

Se ejecuta el instalador nuevo sobre la instalación existente. No pregunta nada: detiene el sistema,
reemplaza el programa, actualiza la estructura de la base si hace falta y lo vuelve a iniciar. Productos,
ventas, usuarios, licencia, certificados y configuración se conservan.

Para armar una versión nueva, en tu PC:

1. Subir el número de versión en `backend\package.json`.
2. Ejecutar:

```bash
npm run instalador
```

El resultado queda en `instalador\salida\Instalar-MacKiosco.exe`.

## Desinstalar

Desde "Agregar o quitar programas" de Windows. Quita el programa, el arranque automático y el servicio de
la base de datos, pero **conserva los datos** en `C:\ProgramData\MacKiosco`. Si se vuelve a instalar, el
sistema los recupera. Para borrar todo definitivamente hay que eliminar esa carpeta a mano.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| El acceso directo dice "MacKiosco todavía no responde" | Esperar un minuto si la PC recién enciende. Si sigue: Inicio → MacKiosco → Herramientas → *Reiniciar MacKiosco* (como administrador). |
| La instalación quedó incompleta | Volver a ejecutar el instalador: retoma donde quedó. El detalle está en `C:\ProgramData\MacKiosco\logs\instalacion.log`. |
| Errores durante el uso | Revisar `C:\ProgramData\MacKiosco\logs\kiosco.log`. |
| Olvidaron la clave de `admin` | No se puede recuperar desde la pantalla de ingreso; hay que restablecerla en la base de datos. |
| Windows muestra "Editor desconocido" al instalar | Es normal: el instalador no está firmado digitalmente. Elegir "Más información" → "Ejecutar de todas formas". |

## Facturación con ARCA

No se configura en la instalación. Cada local la habilita después desde *Configuración → Facturación
electrónica (ARCA)* con su propio CUIT y certificado. Ver [facturacion-arca.md](facturacion-arca.md).
