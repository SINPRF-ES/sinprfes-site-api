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

  return (
    <View style={[styles.card, variant === 'profile' ? styles.cardProfile : styles.cardDefault, style]}>
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <Image
            source={member.avatar_url ? { uri: member.avatar_url as string } : require('../../assets/logo.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
        </View>

        <View style={styles.info}>
          <Text style={styles.nome} numberOfLines={1} ellipsizeMode="tail">
            {nome}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.perfil} numberOfLines={1} ellipsizeMode="tail">
              {perfil}
            </Text>

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

      {/* Opcional: uma linha sutil no "profile" pra dar acabamento (sem poluir) */}
      {variant === 'profile' ? <View style={styles.divider} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // Base do card no padrão “limpo” (borda #eee + sombra leve)
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

  // Pequenas variações por contexto
  cardDefault: {
    paddingVertical: 14,
  },
  cardProfile: {
    paddingVertical: 18,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Avatar com “aro” azul (identidade) e fundo neutro
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
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#003366',
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
    marginBottom: 6,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },

  perfil: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  badge: {
    paddingHorizontal: 10,
    borderRadius: 99,
  },

  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: '#f1f3f6',
  },
});

export default MemberCard;
