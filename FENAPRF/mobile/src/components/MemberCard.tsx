// mobile/src/components/MemberCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { User } from '../types/user';
import { getBandeiraUF, ROLES, tituloCargoUf } from '../utils/userUtils';
import { formatISOToBR, calculateDuration } from '../utils/date';

interface MemberCardProps {
  member: User;
  containerStyle?: any;
}

const MemberCard: React.FC<MemberCardProps> = ({ member, containerStyle }) => {
  const mandateStart = member.cargo_mandato_inicio;
  const mandateEnd = member.cargo_mandato_fim;
  const today = new Date().toISOString();

  const elapsed = calculateDuration(mandateStart, today);
  const remaining = calculateDuration(today, mandateEnd);

  let flagUrl = '';
  let isWhiteFlag = false;
  let cargo1 = '';

  try {
    flagUrl = getBandeiraUF(member.uf, member.perfil_acesso);
    isWhiteFlag = member.uf === 'ES' || member.uf === 'PR' || member.uf === 'SC' || member.uf === 'SP';
    cargo1 = tituloCargoUf({ perfil_acesso: member.perfil_acesso, cargo: member.cargo, uf: member.uf });
  } catch (err) {
    console.error('[MemberCard] Error calculating initial fields:', err);
  }

  const hasSecondLink = !!(member.perfil_acesso2 && member.cargo2);
  let cargo2 = null;
  if (hasSecondLink) {
    try {
      cargo2 = tituloCargoUf({ perfil_acesso: member.perfil_acesso2!, cargo: member.cargo2!, uf: member.uf2 });
    } catch (err) {
      console.error('[MemberCard] Error calculating cargo2:', err);
    }
  }

  return (
    <View style={[styles.card, containerStyle]}>
      {/* Parte Superior */}
      <View style={styles.topSection}>
        <Image
          source={{ uri: (typeof member.avatar_url === 'string' && member.avatar_url) ? member.avatar_url : 'https://via.placeholder.com/60' }}
          style={styles.avatar}
        />
        <View style={styles.centerInfo}>
          <Text style={styles.name} numberOfLines={2}>{String(member.name || '—')}</Text>
          <Text style={styles.cargo}>{cargo1}</Text>
          {cargo2 && (
            <Text style={styles.cargo2}>
              <Text style={styles.bold}>2º Vínculo:</Text> {cargo2}
            </Text>
          )}
        </View>
        <View style={styles.rightStack}>
          <Text style={styles.ufText}>{member.perfil_acesso === ROLES.DIRETORIA || member.perfil_acesso === ROLES.COLABORADOR ? 'BR' : (member.uf || '—')}</Text>
          {flagUrl ? (
            <View style={[styles.flagContainer, isWhiteFlag && styles.flagContrast]}>
              <Image source={{ uri: flagUrl }} style={styles.flag} />
            </View>
          ) : null}
        </View>
      </View>

      {/* Parte Inferior */}
      <View style={styles.bottomSection}>
        <View style={styles.mandateRow}>
          <View style={styles.mandateCol}>
            <Text style={styles.mandateLabel}>Início do Mandato</Text>
            <Text style={styles.mandateValue}>{formatISOToBR(mandateStart) || '—'}</Text>
          </View>
          <View style={styles.mandateCol}>
            <Text style={styles.mandateLabel}>Fim do Mandato</Text>
            <Text style={styles.mandateValue}>{formatISOToBR(mandateEnd) || '—'}</Text>
          </View>
        </View>

        <View style={styles.timeInfo}>
          <Text style={styles.timeLabel}>
            <Text style={styles.bold}>Tempo decorrido:</Text> {elapsed}
          </Text>
          <Text style={styles.timeLabel}>
            <Text style={styles.bold}>Tempo restante:</Text> {remaining}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default MemberCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  centerInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  cargo: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cargo2: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  rightStack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  ufText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
  },
  flagContainer: {
    padding: 2,
    borderRadius: 3,
  },
  flagContrast: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  flag: {
    width: 32,
    height: 22,
    borderRadius: 2,
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  mandateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mandateCol: {
    flex: 1,
  },
  mandateLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
  },
  mandateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  timeInfo: {
    gap: 4,
  },
  timeLabel: {
    fontSize: 13,
    color: '#444',
  },
  bold: {
    fontWeight: 'bold',
    color: '#003366',
  },
});
