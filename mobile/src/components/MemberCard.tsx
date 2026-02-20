import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { Usuario } from '../types/usuario';
import Badge from './Badge';
import { normalizeSituacaoFuncional } from '../utils/filiadoUtils';

interface MemberCardProps {
  member: Usuario | null;
  variant?: 'default' | 'compact' | 'list' | 'profile'; // profile mantido por retrocompatibilidade temporária
  style?: ViewStyle;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, variant = 'default', style }) => {
  if (!member) return null;

  const situacao = normalizeSituacaoFuncional((member.situacao_funcional || member.situacao) as string);
  const perfil = String(member.perfil_acesso || 'FILIADO').toUpperCase();

  const getSituacaoVariant = (s: string) => {
    switch (s) {
      case 'ATIVO':
        return 'success';
      case 'VETERANO':
        return 'warning';
      case 'PENSIONISTA':
        return 'pink';
      default:
        return 'default';
    }
  };

  const nome = String(member.nome || (member as any).name || 'Filiado');

  const isCompact = variant === 'compact';
  const isList = variant === 'list';

  return (
    <View style={[
      styles.card,
      isCompact ? styles.cardCompact : (isList ? styles.cardList : styles.cardDefault),
      style
    ]}>
      <View style={styles.row}>
        <View style={[styles.avatarWrap, isCompact && styles.avatarWrapCompact]}>
          <Image
            source={member.avatar_url ? { uri: member.avatar_url as string } : require('../../assets/logo.png')}
            style={[styles.avatar, isCompact && styles.avatarCompact]}
            resizeMode="cover"
          />
        </View>

        <View style={styles.info}>
          <Text style={[styles.nome, isCompact && styles.nomeCompact]} numberOfLines={2} ellipsizeMode="tail">
            {nome}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.perfil, isCompact && styles.perfilCompact]} numberOfLines={1} ellipsizeMode="tail">
              {perfil}
            </Text>

            {situacao && !isCompact ? (
              <Badge
                label={situacao}
                variant={getSituacaoVariant(situacao)}
                style={styles.badge}
              />
            ) : null}
          </View>
        </View>

        {isCompact && situacao ? (
          <Badge
            label={situacao}
            variant={getSituacaoVariant(situacao)}
            style={styles.badgeCompact}
          />
        ) : null}
      </View>

      {variant === 'profile' || variant === 'default' ? <View style={styles.divider} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardDefault: {
    paddingVertical: 18,
  },
  cardCompact: {
    padding: 12,
    borderRadius: 12,
    elevation: 2,
  },
  cardList: {
    paddingVertical: 12,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eef3fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#dbe6f7',
  },
  avatarWrapCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#003366',
  },
  avatarCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  nome: {
    fontSize: 18,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 4,
    flexShrink: 1,
  },
  nomeCompact: {
    fontSize: 15,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  perfil: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  perfilCompact: {
    fontSize: 10,
  },
  badge: {
    paddingHorizontal: 10,
    borderRadius: 99,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#f1f3f6',
  },
});

export default MemberCard;
