# ATSPOS

POS (punto de venta) offline-first para un almacén de barrio, pensado para correr en un único
Samsung A14 sin depender de internet. Construido con Expo (development build, no Expo Go),
expo-sqlite + Drizzle ORM, y React Native Paper.

## Estado actual (Etapa 0 + Etapa 1)

- Esquema de base de datos completo (categorías, productos, proveedores, compras, ventas,
  movimientos de stock, turnos de caja, usuarios/roles) con UUIDs y columnas `updated_at`/
  `deleted_at` preparadas para una futura sincronización multi-dispositivo.
- Login local con contraseña hasheada (bcryptjs) y RBAC por rol (`admin`, `cajero`,
  `supervisor`).
- Catálogo de productos con alta y generación/escaneo de código QR por producto
  (imprimible como etiqueta con nombre y precio, exportable como imagen).
- Pantalla de venta (POS): búsqueda/escaneo, carrito, método de pago, cálculo de vuelto,
  descuento de stock transaccional vía event-sourcing (`movimientos_stock`).
- Gestión de caja: apertura de turno con fondo inicial, ingresos/egresos, cierre con arqueo
  (efectivo esperado vs. contado).

### Etapa 2 — Inventario avanzado y reportes

- Proveedores, compras (con costo promedio ponderado), ajustes de stock y traspaso
  depósito↔tienda.
- Dashboard de KPIs (ventas, ticket promedio, margen, rotación, valor de inventario) y
  exportación a Excel de ventas e inventario.

### Etapa 3 — Seguridad reforzada

- **Base de datos cifrada con SQLCipher (AES-256).** La clave se genera al primer arranque y
  se guarda en `expo-secure-store` (Android Keystore); nunca está en el código.
- **Log de auditoría** de acciones sensibles (caja, ajustes de stock, compras, alta de
  usuarios, cambios de contraseña, backups).
- **Backups exportables cifrados con contraseña** (AES-GCM). Se exportan/restauran desde
  Ajustes → Seguridad (solo admin). Sin la contraseña no se pueden restaurar.

> **Importante al activar SQLCipher:** la base pasa a estar cifrada. Si ya tenías la app
> instalada con datos sin cifrar, **desinstalá y reinstalá** (o borrá los datos de la app)
> para que se cree una base nueva cifrada; una base plana previa no se puede abrir con clave.

### Operación de mostrador

- **Anulación de ventas** (con reposición de stock) y su exclusión de KPIs y del
  efectivo esperado; historial de ventas con detalle, reimpresión y anulación.
- **Ticket/recibo** imprimible o compartible (PDF) al cobrar y desde el detalle.
- **Descuento** por venta en el cobro.
- **Editar y eliminar productos** desde el detalle del producto.
- **Auto-logout por inactividad** (5 min): cierra la sesión aunque la app esté en
  segundo plano o se haya cerrado; al volver obliga a iniciar sesión de nuevo.
- **Fiado / cuenta corriente de clientes**: método de pago "fiado" que carga la venta a
  la cuenta del cliente; pantalla de Clientes con saldo, movimientos y registro de pagos
  (que ingresan a la caja si hay turno abierto).
- **Venta por peso (kg)**: productos por unidad o por peso, con cantidades decimales.
- **Gestión de categorías** y **gestión completa de usuarios** (editar rol, resetear
  contraseña, activar/desactivar, con protección del último administrador).
- **Linterna** en el escáner de QR.
- **Importación masiva de productos desde Excel/CSV**: planilla de ejemplo descargable,
  carga guiada en 3 pasos, revisión previa con errores y alta/actualización (crea
  categorías y stock inicial de los productos nuevos).
- **Hoja de etiquetas QR**: PDF imprimible con el QR, nombre y precio de todos los
  productos en grilla (ideal tras una importación masiva).
- **Manual de uso embebido por rol**: guía paso a paso según el rol; cada usuario ve la de
  su rol y el admin puede ver la de todos (accesible desde Ajustes).

Pendiente para etapas siguientes: sincronización multi-dispositivo.

## Usuario por defecto

Al iniciar la app por primera vez se crea un usuario administrador:

- Usuario: `admin`
- Contraseña: `admin123`

La app fuerza el cambio de contraseña en el primer ingreso.

## Correr en desarrollo (Expo Go, solo para prototipar UI)

```bash
npm install
npm start
```

Expo Go **no alcanza** para probar la app real: no soporta el escaneo de código de barras
nativo con permisos completos ni módulos nativos futuros (SQLCipher). Usalo solo para
iterar rápido en pantallas que no dependen de eso.

## Development build local con Android Studio (recomendado)

Como tenés Android Studio instalado, el camino recomendado es compilar localmente en tu PC
en vez de depender de EAS Build en la nube:

```bash
npm install
npx expo prebuild --platform android   # genera la carpeta android/ (no se versiona)
```

Luego abrí la carpeta `android/` con Android Studio y compilá/instalá normalmente (Run ▶),
o desde la terminal:

```bash
npx expo run:android
```

Esto instala un development build (`dev-client`) en tu Samsung A14 conectado por USB (con
depuración USB habilitada) o en un emulador. A partir de ahí, `npm start` conecta Metro al
build instalado sin necesidad de recompilar en cada cambio de JS.

Cuando cambies algo nativo (por ejemplo, si más adelante activás SQLCipher), volvé a correr
`npx expo prebuild --platform android` y recompilá.

## Generar un APK instalable (para WhatsApp / sideload)

> **Clave:** firmá siempre el APK con **tu propia clave (keystore)** y **guardá ese
> archivo para siempre**. Android sólo permite instalar una actualización encima de otra
> si ambas están firmadas con la misma clave. Si perdés el keystore, para actualizar vas a
> tener que **desinstalar** la app — y eso **borra la base de datos** del negocio. Como la
> base está cifrada con SQLCipher, no hay forma de recuperarla sin backup.

### 1. Generar el keystore (una sola vez)

```bash
keytool -genkeypair -v -keystore atspos-release.keystore \
  -alias atspos -keyalg RSA -keysize 2048 -validity 10000
```

Te pide una contraseña y algunos datos. Guardá el archivo `atspos-release.keystore` y la
contraseña en un lugar seguro (y en el backup). Esta es la identidad de la app para siempre.

### 2. Regenerar la carpeta nativa y compilar

```bash
npm install
npx expo prebuild --platform android   # regenera android/ (SQLCipher, íconos, permisos)
```

### 3. Firmar y construir el APK con Android Studio (camino recomendado)

Abrí la carpeta `android/` en Android Studio y usá el asistente:

**Build → Generate Signed Bundle / APK… → APK → elegí `atspos-release.keystore` (alias
`atspos`) → Build type: `release` → Finish.**

El asistente firma con tu keystore sin tocar la configuración de Gradle (útil porque
`npx expo prebuild` regenera `android/` y borraría cambios manuales). El APK queda en
`android/app/build/outputs/apk/release/app-release.apk`.

### 4. Enviar e instalar

Pasá ese `.apk` al teléfono (WhatsApp, cable, Drive). En el Samsung A14, al abrirlo, aceptá
**"Instalar apps de orígenes desconocidos"** para esa app y confirmá la instalación.

### Publicar una actualización más adelante

1. Subí el número en `app.json`: `expo.version` (ej. `1.0.1`) y `expo.android.versionCode`
   (ej. `2`; **siempre mayor** al anterior).
2. Repetí los pasos 2 y 3 **con el mismo keystore**.
3. Instalá el nuevo APK encima del anterior: los datos se conservan.

> Alternativa por línea de comandos: `cd android && ./gradlew assembleRelease`. Sin
> configurar la firma, Gradle usa la **clave de debug** (sirve para probar, pero **no**
> para actualizar sin desinstalar). Por eso, para la app "de verdad" usá el asistente con
> tu keystore.

## Base de datos y migraciones

El esquema vive en `src/db/schema.ts`. Después de modificarlo, generá la migración:

```bash
npm run db:generate
```

Esto crea un archivo `.sql` en `src/db/migrations/` que se aplica automáticamente al iniciar
la app (`src/db/provider.tsx`, vía `useMigrations`).
