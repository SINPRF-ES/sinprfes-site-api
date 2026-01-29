// src/components/HeaderInfo.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import { normalizeSituacaoFuncional } from '../utils/filiadoUtils';
import { useAuth } from '../hooks/useAuth';

interface Props {
  filiado: Filiado | null;
}

const HeaderInfo: React.FC<Props> = ({ filiado }) => {
  const { usuario } = useAuth();

  if (!filiado) {
    return null;
  }

  const situacaoNormalizada = normalizeSituacaoFuncional(filiado.situacao_funcional || filiado.situacao);

  const getBadgeStyle = () => {
    switch (situacaoNormalizada) {
      case 'ATIVO':
        return styles.situacaoATIVO;
      case 'VETERANO':
        return styles.situacaoVETERANO;
      case 'PENSIONISTA':
        return styles.situacaoPENSIONISTA;
      default:
        return styles.situacaoDefault;
    }
  };

  const perfilLabel = usuario?.perfil_acesso || '';

  return (
    <View style={styles.container}>
      <Image
        source={filiado.avatar_url ? { uri: filiado.avatar_url } : require('../../assets/icon.webp')}
        style={styles.avatar}
      />
      <Text style={styles.nome}>{filiado.nome}</Text>
      {perfilLabel ? <Text style={styles.perfil}>{perfilLabel}</Text> : null}

      <View style={[styles.statusBadge, getBadgeStyle()]}>
        <Text style={styles.statusText}>{situacaoNormalizada || 'NÃO INFORMADO'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
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
    textAlign: 'center',
  },
  perfil: {
    fontSize: 14,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginTop: 2,
  },
  situacaoATIVO: {
    backgroundColor: '#27ae60', // Verde
  },
  situacaoVETERANO: {
    backgroundColor: '#f39c12', // Amarelo
  },
  situacaoPENSIONISTA: {
    backgroundColor: '#e91e63', // Rosa
  },
  situacaoDefault: {
    backgroundColor: '#95a5a6', // Cinza
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default HeaderInfo;
