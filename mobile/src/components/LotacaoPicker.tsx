// src/components/LotacaoPicker.tsx
import React from 'react';
import { Picker } from '@react-native-picker/picker';
import { StyleSheet, View } from 'react-native';
import * as Canon from '../utils/canon';

interface Props {
  selectedValue: string;
  onValueChange: (itemValue: string, itemIndex: number) => void;
  enabled?: boolean;
}

const LotacaoPicker: React.FC<Props> = ({ selectedValue, onValueChange, enabled = true }) => {
  return (
    <View style={styles.pickerContainer}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={styles.picker}
        enabled={enabled}
      >
        {Canon.LOTACOES.map((lotacao) => (
          <Picker.Item key={lotacao} label={lotacao} value={lotacao} />
        ))}
      </Picker>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerContainer: {
    // A borda e o estilo do container agora são controlados pelo componente pai (LotacaoCard)
  },
  picker: {
    // Estilos podem ser necessários para Android/iOS
  },
});

export default LotacaoPicker;
