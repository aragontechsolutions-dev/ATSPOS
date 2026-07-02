import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { List, TextInput } from 'react-native-paper';

import { listarProductos, type Producto } from '@/db/repositories/productos';
import { formatMoney } from '@/lib/money';

interface Props {
  onSelect: (producto: Producto) => void;
  placeholder?: string;
}

/** Inline search box that lists matching products and calls onSelect on tap. */
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
      {resultados.length > 0 && (
        <FlatList
          data={resultados}
          keyExtractor={(p) => p.id}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <List.Item
              title={item.nombre}
              description={`Stock: ${item.stockActual} · ${formatMoney(item.precioVenta)}`}
              onPress={() => {
                onSelect(item);
                setTexto('');
                setResultados([]);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 220 },
});
