// src/components/LotacaoPicker.tsx
import React from 'react';
import { Picker } from '@react-native-picker/picker';
import { StyleSheet, View } from 'react-native';

interface Props {
  selectedValue: string;
  onValueChange: (itemValue: string, itemIndex: number) => void;
  enabled?: boolean;
}

export const lotacaoOptions = ["SEDE", "1ª DEL (Viana)", "2ª DEL (Serra)", "3ª DEL (Guarapari)", "4ª DEL (Linhares)"];

const LotacaoPicker: React.FC<Props> = ({ selectedValue, onValueChange, enabled = true }) => {
  return (
    <View style={styles.pickerContainer}>
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={styles.picker}
        enabled={enabled}
      >
        {lotacaoOptions.map((lotacao) => (
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
