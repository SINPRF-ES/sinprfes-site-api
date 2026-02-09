// src/components/MemberCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { User } from '../types/user';
import { getBandeiraUF } from '../utils/userUtils';
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

  // Determinando UF e Bandeira
  const isNacional = ['ADMIN', 'DIRETORIA', 'COLABORADOR'].includes((member.perfil_acesso || '').toUpperCase());
  const displayUf = isNacional ? 'BR' : (member.uf || '—');
  const flagUrl = getBandeiraUF(member.uf, member.perfil_acesso);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isDrawer && styles.cardDrawer,
        variant === 'profile' && styles.cardProfile
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      {/* PARTE SUPERIOR */}
      <View style={styles.topSection}>
        <View style={styles.avatarContainer}>
          <Image
            source={member.avatar_url ? { uri: member.avatar_url } : require('../../assets/logo.png')}
            style={[styles.avatar, isDrawer && styles.avatarSmall]}
            resizeMode="cover"
          />
        </View>

        <View style={styles.centerInfo}>
          <Text style={[styles.name, isDrawer && styles.nameSmall]} numberOfLines={1}>
            {member.name || member.nome || 'Membro'}
          </Text>
          <Text style={styles.cargo} numberOfLines={2}>
            {member.cargo || (isNacional ? 'Diretoria Nacional' : 'Conselheiro Federal')}
          </Text>
        </View>

        <View style={styles.rightStack}>
          <Text style={styles.ufText}>{displayUf}</Text>
          {flagUrl ? (
            <View style={styles.flagContainer}>
              <Image source={{ uri: flagUrl }} style={styles.flag} resizeMode="contain" />
            </View>
          ) : (
             <MaterialCommunityIcons name="flag-variant" size={24} color="#ccc" />
          )}
        </View>
      </View>

      {/* PARTE INFERIOR (Omitida no drawer se necessário, mas o requisito pede o componente padronizado) */}
      {!isDrawer && (
        <View style={styles.bottomSection}>
          <View style={styles.mandateRow}>
            <View style={styles.mandateCol}>
              <Text style={styles.mandateLabel}>Início</Text>
              <Text style={styles.mandateValue}>{toBrazilianDate(member.cargo_mandato_inicio) || '—'}</Text>
            </View>
            <View style={styles.mandateCol}>
              <Text style={styles.mandateLabel}>Fim</Text>
              <Text style={styles.mandateValue}>{toBrazilianDate(member.cargo_mandato_fim) || '—'}</Text>
            </View>
          </View>

          <View style={styles.auxInfo}>
            <Text style={styles.auxText}>
              <Text style={styles.auxLabel}>Tempo decorrido: </Text>
              {elapsed}
            </Text>
            <Text style={styles.auxText}>
              <Text style={styles.auxLabel}>Tempo restante: </Text>
              {remaining}
            </Text>
          </View>
        </View>
      )}
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
    marginTop: -30, // Efeito de sobreposição
    marginBottom: 20,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#003366',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarSmall: {
    // estilos menores se for drawer? O container ja limita.
  },
  centerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  nameSmall: {
    fontSize: 16,
    color: '#fff', // No drawer o fundo é azul
  },
  cargo: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  rightStack: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 45,
  },
  ufText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
  },
  flagContainer: {
    width: 32,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#fff', // Fundo branco para contraste
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    // Sombra suave para destacar em fundos claros
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
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
  mandateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    fontSize: 14,
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
});

export default MemberCard;
