import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { Usuario } from '../types/usuario';
import Badge from './Badge';
import { normalizeSituacaoFuncional } from '../utils/filiadoUtils';

interface MemberCardProps {
  member: Usuario | null;
  variant?: 'profile' | 'default';
  style?: ViewStyle;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, variant = 'default', style }) => {
  if (!member) return null;

  // No contexto do SINPRF/ES, o usuário logado costuma ter esses campos
  // vindos do backend /api/filiados/me
  const situacao = normalizeSituacaoFuncional((member.situacao_funcional || member.situacao) as string);
  const perfil = (member.perfil_acesso || 'MEMBRO').toUpperCase();

  const getSituacaoVariant = (s: string) => {
    switch (s) {
      case 'ATIVO': return 'success';
      case 'VETERANO': return 'warning';
      case 'PENSIONISTA': return 'pink';
      default: return 'default';
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.row}>
        <Image
          source={member.avatar_url ? { uri: member.avatar_url as string } : require('../../assets/logo.png')}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.info}>
          <Text style={styles.nome} numberOfLines={1}>
            {String(member.nome || member.name || 'Membro')}
          </Text>
          <Text style={styles.perfil}>{perfil}</Text>
          {situacao ? (
            <Badge
              label={situacao}
              variant={getSituacaoVariant(situacao)}
              style={styles.badge}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f0f0f0',
    marginRight: 20,
    borderWidth: 2,
    borderColor: '#f8f9fa',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  nome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 2,
  },
  perfil: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 12,
    borderRadius: 99,
  },
});

export default MemberCard;
