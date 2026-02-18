// src/components/LotacaoPicker.tsx
import React from 'react';
import { PickerSafe } from './PickerSafe';
import * as Canon from '../utils/canon';

interface Props {
  selectedValue: string;
  onValueChange: (itemValue: string, itemIndex: number) => void;
  enabled?: boolean;
  label?: string;
}

const LotacaoPicker: React.FC<Props> = ({ selectedValue, onValueChange, enabled = true, label }) => {
  return (
    <PickerSafe
      label={label}
      selectedValue={selectedValue}
      onValueChange={onValueChange}
      enabled={enabled}
      items={Canon.LOTACOES.map(l => ({ label: l, value: l }))}
      pickerBoxStyle={!enabled ? { backgroundColor: '#f0f0f0' } : undefined}
    />
  );
};

export default LotacaoPicker;
