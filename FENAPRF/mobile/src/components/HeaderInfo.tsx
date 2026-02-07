// src/components/HeaderInfo.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import { normalizeSituacaoFuncional } from '../utils/filiadoUtils';
import { useAuth } from '../hooks/useAuth';
import Badge from './Badge';

interface Props {
  filiado: Filiado | null;
}

const HeaderInfo: React.FC<Props> = ({ filiado }) => {
  const { usuario } = useAuth();

  if (!filiado) {
    return null;
  }

  const situacao = normalizeSituacaoFuncional(filiado.situacao_funcional || filiado.situacao);
  const perfil = (usuario?.perfil_acesso || 'FILIADO').toUpperCase();

  const getSituacaoVariant = (s: string) => {
    switch (s) {
      case 'ATIVO': return 'success';
      case 'VETERANO': return 'warning';
      case 'PENSIONISTA': return 'pink';
      default: return 'default';
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={filiado.avatar_url ? { uri: filiado.avatar_url } : require('../../assets/logo.png')}
        style={styles.avatar}
        resizeMode="cover"
      />
      <Text style={styles.nome}>{filiado.name || '—'}</Text>
      <Text style={styles.perfil}>{perfil}</Text>

      <Badge
        label={situacao || '—'}
        variant={getSituacaoVariant(situacao)}
        style={styles.badge}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: '#f8f9fa',
  },
  nome: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#003366',
    textAlign: 'center',
    marginBottom: 4,
  },
  perfil: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 16,
    borderRadius: 99,
  }
});

export default HeaderInfo;
