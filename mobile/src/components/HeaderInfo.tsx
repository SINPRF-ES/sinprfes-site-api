// src/components/HeaderInfo.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import { toBrazilianDate } from '../utils/date';

interface Props {
  filiado: Filiado | null;
}

const HeaderInfo: React.FC<Props> = ({ filiado }) => {
  if (!filiado) {
    return null;
  }

  const getStatusStyle = (status: string) => {
    return status === 'ATIVO' ? styles.statusAtivo : styles.statusInativo;
  };

  return (
    <View style={styles.container}>
      <Image
        source={filiado.avatar_url ? { uri: filiado.avatar_url } : require('../../assets/icon.png')}
        style={styles.avatar}
      />
      <Text style={styles.nome}>{filiado.nome}</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoText}>CPF: {filiado.cpf}</Text>
        {filiado.data_nascimento && (
          <Text style={styles.infoText}>
            Nascimento: {toBrazilianDate(filiado.data_nascimento)}
          </Text>
        )}
      </View>
      <View style={[styles.statusBadge, getStatusStyle(filiado.situacao)]}>
        <Text style={styles.statusText}>{filiado.situacao}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  nome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 5,
  },
  statusAtivo: {
    backgroundColor: '#d4edda', // Verde claro
  },
  statusInativo: {
    backgroundColor: '#f8d7da', // Vermelho claro
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default HeaderInfo;
