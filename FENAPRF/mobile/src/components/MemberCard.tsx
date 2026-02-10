// src/components/MemberCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { User } from '../types/user';
import { getBandeiraUF, tituloCargoUf } from '../utils/user';
import { calculateMandateTime, toBrazilianDate } from '../utils/date';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface MemberCardProps {
  member: User | null;
  onPress?: () => void;
  variant?: 'drawer' | 'profile' | 'list';
}

const MemberCard: React.FC<MemberCardProps> = ({ member, onPress, variant = 'list' }) => {
  if (!member) return null;

  const { elapsed, remaining } = calculateMandateTime(member.cargo_mandato_inicio, member.cargo_mandato_fim);

  const isDrawer = variant === 'drawer';
  const isProfile = variant === 'profile';

  // Determinando UF e Bandeira
  const isNacional = ['ADMIN', 'DIRETORIA', 'COLABORADOR'].includes((member.perfil_acesso || '').toUpperCase());
  const displayUf = isNacional ? 'BR' : (member.uf || '—');
  const flagUrl = getBandeiraUF(member.uf, member.perfil_acesso);

  const mandateStart = toBrazilianDate(member.cargo_mandato_inicio) || 'não informado';
  const mandateEnd = toBrazilianDate(member.cargo_mandato_fim) || 'não informado';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDrawer && styles.cardDrawer,
        isProfile && styles.cardProfile
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      {/* PARTE SUPERIOR (DIVIDIDA HORIZONTALMENTE) */}
      <View style={styles.topSection}>
        {/* ESQUERDA: AVATAR CIRCULAR */}
        <View style={styles.avatarContainer}>
          <Image
            source={member.avatar_url ? { uri: member.avatar_url } : require('../../assets/logo.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
        </View>

        {/* CENTRO: NOME E CARGO (PROTEÇÃO CONTRA TRUNCAMENTO) */}
        <View style={styles.centerInfo}>
          <Text
            style={[styles.name, isDrawer && styles.textWhite]}
          >
            {member.name || member.nome || 'Membro'}
          </Text>
          <Text
            style={[styles.cargo, isDrawer && styles.textLight]}
          >
            {tituloCargoUf(member)}
          </Text>
        </View>

        {/* DIREITA: UF E BANDEIRA (CONTRASTE OBRIGATÓRIO) */}
        <View style={styles.rightStack}>
          <Text style={[styles.ufText, isDrawer && styles.textWhite]}>{displayUf}</Text>
          {flagUrl ? (
            <View style={styles.flagContainer}>
              <Image source={{ uri: flagUrl }} style={styles.flag} resizeMode="contain" />
            </View>
          ) : (
             <MaterialCommunityIcons name="flag-variant" size={24} color={isDrawer ? "#fff" : "#ccc"} />
          )}
        </View>
      </View>

      {/* PARTE INFERIOR (MANDATOS OU METADADOS DE ARQUIVAMENTO) */}
      <View style={[styles.bottomSection, isDrawer && styles.bottomSectionDrawer]}>
        {member.arquivado_em ? (
          <View style={styles.archiveInfo}>
            <Text style={styles.archiveLabel}>Membro Arquivado</Text>
            <Text style={styles.archiveText}>
              Arquivado por <Text style={styles.archiveBold}>{member.arquivado_por_nome || '(usuário não encontrado)'}</Text>
            </Text>
            <Text style={styles.archiveText}>
              Em <Text style={styles.archiveBold}>{toBrazilianDate(member.arquivado_em)}</Text>
            </Text>
            <Text style={styles.archiveText}>
              Motivo: <Text style={styles.archiveItalic}>{member.arquivado_motivo || 'Não informado'}</Text>
            </Text>
          </View>
        ) : !['ADMIN', 'COLABORADOR'].includes((member.perfil_acesso || '').toUpperCase()) && (
          <>
            <View style={styles.mandateRow}>
              <View style={styles.mandateCol}>
                <Text style={[styles.mandateLabel, isDrawer && styles.textLight]}>Início do mandato</Text>
                <Text style={[styles.mandateValue, isDrawer && styles.textWhite]}>{mandateStart}</Text>
              </View>
              <View style={styles.mandateCol}>
                <Text style={[styles.mandateLabel, isDrawer && styles.textLight]}>Fim do mandato</Text>
                <Text style={[styles.mandateValue, isDrawer && styles.textWhite]}>{mandateEnd}</Text>
              </View>
            </View>

            <View style={styles.auxInfo}>
              <Text style={[styles.auxText, isDrawer && styles.textWhite]}>
                <Text style={[styles.auxLabel, isDrawer && styles.textLight]}>Tempo decorrido: </Text>
                {elapsed}
              </Text>
              <Text style={[styles.auxText, isDrawer && styles.textWhite]}>
                <Text style={[styles.auxLabel, isDrawer && styles.textLight]}>Tempo restante: </Text>
                {remaining}
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardDrawer: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    elevation: 0,
    borderWidth: 0,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cardProfile: {
    // Negative margin removed to prevent overlap in screens other than Home
    marginBottom: 20,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#003366',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  centerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
    flex: 1,
    flexWrap: 'wrap',
  },
  textWhite: {
    color: '#fff',
  },
  textLight: {
    color: 'rgba(255,255,255,0.7)',
  },
  cargo: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    flex: 1,
    flexWrap: 'wrap',
  },
  rightStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  ufText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
  },
  flagContainer: {
    width: 36,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#f5f5f5', // Fundo neutro (cinza muito claro) para contraste
    borderWidth: 1,
    borderColor: '#ddd', // Borda suave
    justifyContent: 'center',
    alignItems: 'center',
    // Sombra leve
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
    overflow: 'hidden',
  },
  flag: {
    width: '100%',
    height: '100%',
  },
  bottomSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  bottomSectionDrawer: {
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  mandateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  mandateCol: {
    flex: 1,
  },
  mandateLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  mandateValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  auxInfo: {
    gap: 4,
  },
  auxText: {
    fontSize: 12,
    color: '#555',
  },
  auxLabel: {
    fontWeight: 'bold',
    color: '#666',
  },
  archiveInfo: {
    padding: 10,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#feb2b2',
  },
  archiveLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c53030',
    marginBottom: 4,
  },
  archiveText: {
    fontSize: 12,
    color: '#742a2a',
    marginBottom: 2,
  },
  archiveBold: {
    fontWeight: 'bold',
  },
  archiveItalic: {
    fontStyle: 'italic',
  },
});

export default MemberCard;
