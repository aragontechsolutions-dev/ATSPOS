import { create } from 'zustand';

import type { Producto } from '@/db/repositories/productos';

export interface CartItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
  stockDisponible: number;
  unidadMedida: string; // 'unidad' | 'kg'
}

interface CartState {
  items: CartItem[];
  descuento: number;
  addProducto: (producto: Producto) => void;
  incrementar: (productoId: string) => void;
  decrementar: (productoId: string) => void;
  setCantidad: (productoId: string, cantidad: number) => void;
  quitar: (productoId: string) => void;
  setDescuento: (descuento: number) => void;
  clear: () => void;
  subtotal: () => number;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  descuento: 0,

  addProducto: (producto) =>
    set((state) => {
      const existente = state.items.find((i) => i.productoId === producto.id);
      if (existente) {
        return {
          items: state.items.map((i) =>
            i.productoId === producto.id && i.cantidad < i.stockDisponible
              ? { ...i, cantidad: i.cantidad + 1 }
              : i,
          ),
        };
      }
      if (producto.stockActual <= 0) return state;
      return {
        items: [
          ...state.items,
          {
            productoId: producto.id,
            nombre: producto.nombre,
            cantidad: 1,
            precioUnitario: producto.precioVenta,
            costoUnitario: producto.precioCosto,
            stockDisponible: producto.stockActual,
            unidadMedida: producto.unidadMedida,
          },
        ],
      };
    }),

  incrementar: (productoId) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productoId === productoId && i.cantidad < i.stockDisponible ? { ...i, cantidad: i.cantidad + 1 } : i,
      ),
    })),

  decrementar: (productoId) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.productoId === productoId ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0),
    })),

  setCantidad: (productoId, cantidad) =>
    set((state) => ({
      // Acepta decimales (venta por peso). Ignora valores no positivos.
      items: state.items.map((i) =>
        i.productoId === productoId && cantidad > 0
          ? { ...i, cantidad: Math.min(cantidad, i.stockDisponible) }
          : i,
      ),
    })),

  quitar: (productoId) =>
    set((state) => ({ items: state.items.filter((i) => i.productoId !== productoId) })),

  setDescuento: (descuento) => set({ descuento }),

  clear: () => set({ items: [], descuento: 0 }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0),

  total: () => get().subtotal() - get().descuento,
}));
