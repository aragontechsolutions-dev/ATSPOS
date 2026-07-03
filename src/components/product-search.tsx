import { useState } from 'react';
import { View } from 'react-native';
import { Divider, List, TextInput } from 'react-native-paper';

import { listarProductos, type Producto } from '@/db/repositories/productos';
import { formatMoney } from '@/lib/money';

interface Props {
  onSelect: (producto: Producto) => void;
  placeholder?: string;
}

const MAX_RESULTADOS = 12;

/**
 * Inline search box that lists matching products and calls onSelect on tap.
 * Renders results with a plain map (not a FlatList) so it can live inside a
 * parent ScrollView without the nested-VirtualizedList warning; result sets
 * are small, so virtualization isn't needed.
 */
export function ProductSearch({ onSelect, placeholder }: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);

  async function buscar(value: string) {
    setTexto(value);
    if (!value.trim()) {
      setResultados([]);
      return;
    }
    setResultados(await listarProductos(value));
  }

  return (
    <View>
      <TextInput
        placeholder={placeholder ?? 'Buscar producto'}
        value={texto}
        onChangeText={buscar}
        mode="outlined"
        right={<TextInput.Icon icon="magnify" />}
      />
      {resultados.slice(0, MAX_RESULTADOS).map((item, index) => (
        <View key={item.id}>
          {index > 0 && <Divider />}
          <List.Item
            title={item.nombre}
            description={`Stock: ${item.stockActual} · ${formatMoney(item.precioVenta)}`}
            onPress={() => {
              onSelect(item);
              setTexto('');
              setResultados([]);
            }}
          />
        </View>
      ))}
    </View>
  );
}
