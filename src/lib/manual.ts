import { ROLES, type RolNombre } from '@/lib/roles';

export interface SeccionManual {
  titulo: string;
  icono: string;
  pasos: string[];
}

export interface ManualRol {
  titulo: string;
  intro: string;
  secciones: SeccionManual[];
}

// --- Secciones reutilizables (el cajero es la base; supervisor y admin suman) ---

const ingresar: SeccionManual = {
  titulo: 'Ingresar a la app',
  icono: 'login',
  pasos: [
    'Abrí ATSPOS y escribí tu usuario y contraseña.',
    'Si es tu primer ingreso, la app te va a pedir que cambies la contraseña por una tuya.',
    'Por seguridad, la sesión se cierra sola después de 5 minutos sin uso. Si pasó, volvé a ingresar.',
    'Antes de cerrarse te avisa con una cuenta regresiva de 30 segundos: tocá "Seguir conectado" (o cualquier parte de la pantalla) para no perder la sesión.',
  ],
};

const abrirCaja: SeccionManual = {
  titulo: 'Abrir la caja (empezar el turno)',
  icono: 'lock-open-variant',
  pasos: [
    'Andá a la pestaña "Caja".',
    'Escribí el "Fondo inicial": la plata en efectivo con la que arrancás el cajón.',
    'Tocá "Abrir turno". Recién con el turno abierto vas a poder vender.',
  ],
};

const vender: SeccionManual = {
  titulo: 'Hacer una venta',
  icono: 'cash-register',
  pasos: [
    'Andá a la pestaña "Venta".',
    'Buscá el producto por nombre, o tocá el ícono de la cámara para escanear su código QR.',
    'Tocá el producto de la lista para agregarlo al carrito.',
    'Para cambiar la cantidad, tocá el número y escribilo directo (ej. 100). Para productos por peso, poné los kilos (ej. 1.250).',
    'Si te equivocaste, tocá el tacho de basura de esa línea para quitarla.',
    'Cuando esté todo, tocá "Cobrar".',
    'Elegí el medio de pago. Si es efectivo, escribí cuánto te pagó el cliente y la app te muestra el vuelto (no deja confirmar si el monto es menor al total).',
    'Tocá "Confirmar". Podés tocar "Imprimir ticket" para darle el comprobante al cliente.',
  ],
};

const fiado: SeccionManual = {
  titulo: 'Vender fiado y cobrar deudas',
  icono: 'account-cash',
  pasos: [
    'Para fiar: en la pantalla de cobro elegí el medio de pago "fiado".',
    'Buscá el cliente y tocalo. Si es nuevo, escribí su nombre y tocá "Crear cliente".',
    'Confirmá la venta: queda anotada en la cuenta del cliente.',
    'Para cobrar una deuda: andá a la pestaña "Clientes", tocá el cliente y luego "Registrar pago".',
    'Escribí el monto que te pagó. Si tenés la caja abierta, ese pago entra como ingreso a la caja.',
  ],
};

const movimientosCaja: SeccionManual = {
  titulo: 'Ingresos y egresos de caja',
  icono: 'swap-vertical',
  pasos: [
    'En la pestaña "Caja", tocá "Ingreso / egreso".',
    'Elegí "Egreso" si sacás plata (pago a proveedor, retiro) o "Ingreso" si agregás.',
    'Escribí el monto y el motivo, y guardá. Queda registrado en el turno.',
  ],
};

const cerrarCaja: SeccionManual = {
  titulo: 'Cerrar la caja (arqueo)',
  icono: 'lock-check',
  pasos: [
    'En la pestaña "Caja", tocá "Cerrar turno".',
    'La app te muestra el "Efectivo esperado". Contá la plata real del cajón y escribila en "Efectivo contado".',
    'Si hay diferencia (sobrante o faltante), la app NO deja cerrar: recontá o tocá "Registrar ajuste" para dejar la caja cuadrada.',
    'Cuando la diferencia sea cero, tocá "Confirmar cierre".',
  ],
};

const productos: SeccionManual = {
  titulo: 'Cargar y editar productos',
  icono: 'package-variant',
  pasos: [
    'Andá a la pestaña "Productos" y tocá el botón "+".',
    'Completá nombre y precio de venta (lo mínimo). Elegí si se vende "Por unidad" o "Por peso (kg)".',
    'Para editar o borrar un producto, tocalo en la lista: ahí ves su QR y los botones "Editar producto" y "Eliminar producto".',
    'Para crear/editar categorías, tocá el ícono de etiquetas arriba en Productos.',
  ],
};

const qr: SeccionManual = {
  titulo: 'Códigos QR de productos',
  icono: 'qrcode',
  pasos: [
    'Cada producto tiene su QR: tocá el producto en la lista para verlo.',
    'Tocá "Imprimir etiqueta" para imprimir (o guardar PDF) la etiqueta con QR, nombre y precio.',
    'Para imprimir muchas de una vez: Inventario → "Imprimir hoja de etiquetas QR".',
    'Después, en la venta, escaneás ese QR y el producto se agrega solo al carrito.',
  ],
};

const importar: SeccionManual = {
  titulo: 'Cargar muchos productos desde Excel',
  icono: 'file-import',
  pasos: [
    'Andá a Inventario → "Importar productos desde Excel".',
    'Paso 1: tocá "Descargar planilla" (baja un archivo Excel de ejemplo).',
    'Paso 2: abrila en Excel o Google Sheets y cargá tus productos, una fila por producto. Guardala.',
    'Paso 3: tocá "Elegir archivo", seleccioná la planilla y revisá el resumen antes de importar.',
  ],
};

const inventario: SeccionManual = {
  titulo: 'Compras, stock y proveedores',
  icono: 'warehouse',
  pasos: [
    'Compras: Inventario → "Nueva compra". Elegí proveedor, agregá productos con cantidad y costo, y confirmá (sube el stock y actualiza el costo).',
    'Ajustes de stock: Inventario → "Ajuste de stock" para merma, rotura, corrección o traspaso depósito↔tienda.',
    'Proveedores: Inventario → "Proveedores" para cargarlos.',
    'La pantalla de Inventario te avisa qué productos están por debajo del stock mínimo.',
  ],
};

const conteoInventario: SeccionManual = {
  titulo: 'Conteo de inventario (cierre del día)',
  icono: 'clipboard-list',
  pasos: [
    'Andá a Inventario → "Conteo de inventario".',
    'Recorré los productos (podés buscarlos por nombre) y escribí en "Contado" cuántas unidades tenés realmente en la góndola/depósito. Para productos por peso, poné los kilos.',
    'Los que dejes en blanco NO se tocan: solo se ajustan los que anotes.',
    'A medida que escribís, la app te muestra la diferencia contra el stock del sistema (verde = sobra, rojo = falta).',
    'Tocá "Aplicar conteo", revisá el resumen de diferencias y el impacto en el valor del inventario, y confirmá.',
    'El sistema corrige el stock a lo que contaste y deja el ajuste registrado en el historial y la auditoría.',
    'Al terminar, podés tocar "Exportar a Excel" para guardar o compartir la planilla del conteo (diferencias e impacto en valor) como constancia del cierre.',
  ],
};

const reportes: SeccionManual = {
  titulo: 'Reportes y ventas',
  icono: 'chart-box',
  pasos: [
    'En la pestaña "Reportes" ves las ventas del día/semana/mes, ticket promedio, margen, más vendidos y más.',
    'Con "Exportar" generás un Excel de ventas o de inventario para compartir.',
    'En "Historial de ventas" podés ver cada venta, reimprimir su ticket o anularla.',
  ],
};

const anular: SeccionManual = {
  titulo: 'Anular una venta',
  icono: 'cancel',
  pasos: [
    'Andá a Reportes → "Historial de ventas" y tocá la venta.',
    'Tocá "Anular venta" y escribí el motivo.',
    'Al anular, el stock de los productos vuelve a subir y la venta deja de contar en los reportes.',
  ],
};

const usuarios: SeccionManual = {
  titulo: 'Gestionar usuarios',
  icono: 'account-group',
  pasos: [
    'Andá a Ajustes (ícono de engranaje arriba a la derecha) → sección "Usuarios".',
    'Para crear un usuario, completá nombre, usuario, contraseña y elegí el rol (cajero, supervisor o admin).',
    'Tocá un usuario existente para cambiarle el rol, resetear su contraseña o activarlo/desactivarlo.',
  ],
};

const seguridad: SeccionManual = {
  titulo: 'Backups y seguridad',
  icono: 'shield-lock',
  pasos: [
    'Andá a Ajustes → "Backups y auditoría" → "Exportar backup cifrado".',
    'Elegí una contraseña para el backup y guardala en un lugar seguro: sin ella NO se puede restaurar.',
    'Tenés dos opciones para el archivo: "Guardar en el teléfono" (te deja elegir una carpeta, ideal "Descargas", y así lo encontrás fácil para restaurar) o "Compartir" (para mandarlo por WhatsApp, Drive o mail).',
    'El backup incluye todos tus datos: productos, ventas, caja, clientes y fiados. Hacé uno seguido (por ejemplo al cerrar el día).',
    'Para restaurar: "Restaurar backup" → "Elegir archivo", buscá el .atsbak (en Descargas, Drive o el recibido por WhatsApp) y escribí su contraseña. Ojo: restaurar REEMPLAZA todos los datos actuales por los del backup.',
    'En "Ver log de auditoría" queda registrado quién hizo cada acción importante.',
  ],
};

export const MANUALES: Record<RolNombre, ManualRol> = {
  [ROLES.CAJERO]: {
    titulo: 'Manual del Cajero',
    intro: 'Todo lo que necesitás para atender el mostrador: abrir caja, vender, cobrar y cerrar.',
    secciones: [ingresar, abrirCaja, vender, fiado, movimientosCaja, cerrarCaja],
  },
  [ROLES.SUPERVISOR]: {
    titulo: 'Manual del Supervisor',
    intro: 'Incluye la atención al público más la gestión de productos, inventario y reportes.',
    secciones: [
      ingresar,
      abrirCaja,
      vender,
      fiado,
      movimientosCaja,
      cerrarCaja,
      productos,
      qr,
      importar,
      inventario,
      conteoInventario,
      reportes,
      anular,
    ],
  },
  [ROLES.ADMIN]: {
    titulo: 'Manual del Administrador',
    intro: 'Acceso completo: además de todo lo operativo, la gestión de usuarios y la seguridad.',
    secciones: [
      ingresar,
      abrirCaja,
      vender,
      fiado,
      movimientosCaja,
      cerrarCaja,
      productos,
      qr,
      importar,
      inventario,
      conteoInventario,
      reportes,
      anular,
      usuarios,
      seguridad,
    ],
  },
};
