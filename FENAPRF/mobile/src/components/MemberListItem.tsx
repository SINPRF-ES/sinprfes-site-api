// mobile/src/components/MemberListItem.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { User } from '../types/user';
import { formatTelefone } from '../shared/format/formatters';
import { getBandeiraUF, ROLES } from '../utils/userUtils';

interface MemberListItemProps {
  member: User;
  onPress: (member: User) => void;
}

const MemberListItem: React.FC<MemberListItemProps> = ({ member, onPress }) => {
  const isArquivado = !!member.arquivado_em;

  return (
    <TouchableOpacity
      style={[styles.card, isArquivado && styles.cardArquivado]}
      onPress={() => onPress(member)}
      activeOpacity={0.7}
    >
      <View style={styles.headerContainer}>
        <Image
          source={{ uri: member.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.infoContainer}>
          <Text style={styles.nome} numberOfLines={1}>{member.name}</Text>
          <Text style={styles.cargo} numberOfLines={1}>{member.cargo || 'Membro'}</Text>
          <Text style={styles.detalhe}>Telefone: {formatTelefone(member.telefone1) || '—'}</Text>
        </View>
        <View style={styles.ufStack}>
          <Text style={styles.ufText}>{member.perfil_acesso === ROLES.DIRETORIA || member.perfil_acesso === ROLES.COLABORADOR ? 'BR' : (member.uf || '—')}</Text>
          {getBandeiraUF(member.uf, member.perfil_acesso) ? (
            <Image source={{ uri: getBandeiraUF(member.uf, member.perfil_acesso) }} style={styles.flagIcon} />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(MemberListItem);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardArquivado: {
    backgroundColor: '#f1f3f5',
    opacity: 0.8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  nome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
  },
  cargo: {
    fontSize: 13,
    color: '#666',
    marginTop: 1,
  },
  detalhe: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  ufStack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 35,
  },
  ufText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 2,
  },
  flagIcon: {
    width: 22,
    height: 14,
    borderRadius: 1,
  },
});
