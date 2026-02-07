// src/components/HeaderInfo.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { User } from '../types/user';
import { normalizeSituacaoFuncional, getBandeiraUF } from '../utils/userUtils';
import { useAuth } from '../hooks/useAuth';
import Badge from './Badge';

interface Props {
  user: User | null;
}

const HeaderInfo: React.FC<Props> = ({ user: userProp }) => {
  const { user: authUser } = useAuth();
  const user = userProp || authUser;

  if (!user) {
    return null;
  }

  const situacao = normalizeSituacaoFuncional(user.situacao_funcional || user.situacao);
  const perfil = (user?.perfil_acesso || 'USER').toUpperCase();

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
      <View style={styles.avatarRow}>
        <Image
          source={user.avatar_url ? { uri: user.avatar_url } : require('../../assets/logo.png')}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.ufStack}>
          <Text style={styles.ufText}>{user.perfil_acesso === 'DIRETORIA' || user.perfil_acesso === 'COLABORADOR' ? 'BR' : (user.uf || '—')}</Text>
          {getBandeiraUF(user.uf, user.perfil_acesso) ? (
            <Image source={{ uri: getBandeiraUF(user.uf, user.perfil_acesso) }} style={styles.flagIcon} />
          ) : null}
        </View>
      </View>
      <Text style={styles.nome}>{user.name || '—'}</Text>
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    borderColor: '#f8f9fa',
  },
  ufStack: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  ufText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
  },
  flagIcon: {
    width: 24,
    height: 16,
    borderRadius: 2,
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
