// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeScreen from '../components/SafeScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { logNavigation } from '../infra/logger';
import type { RootStackParamList } from '../navigation';
import { Image } from 'react-native';
import MemberCard from '../components/MemberCard';
import { EMOJIS } from '../utils/emoji';
import { getGlobalTokenAtivo } from '../services/assembleiaService';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

const NAV_ITEMS = [
  {
    label: 'Meus Dados',
    emoji: EMOJIS.MEUS_DADOS,
    screen: 'MeusDados',
  },
  {
    label: 'Buscar Membros',
    emoji: EMOJIS.MEMBROS,
    screen: 'Users',
  },
   {
    label: 'Assembleias e Votações',
    emoji: EMOJIS.VOTACOES,
    screen: 'Votacao',
  },
  {
    label: 'Logística',
    emoji: EMOJIS.LOGISTICA,
    screen: 'Logistica',
  },
];

const GESTAO_ITEMS: any[] = [];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const ehGestao = ['ADMIN', 'DIRETORIA', 'COLABORADOR'].includes((user?.perfil_acesso || '').toUpperCase());
  const [globalToken, setGlobalToken] = useState<any>(null);

  useEffect(() => {
    if (ehGestao) {
      getGlobalTokenAtivo().then(setGlobalToken).catch(() => setGlobalToken(null));
    }
  }, [ehGestao]);

  const displayedItems = [...NAV_ITEMS];
  if (ehGestao) {
    displayedItems.push(...GESTAO_ITEMS);
  }

  const perfil = (user?.perfil_acesso || 'CONSELHEIRO').toUpperCase();

  return (
    <SafeScreen style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={styles.headerContent}>
           <View style={styles.headerText}>
            <Text style={styles.welcomeTitle}>Olá,</Text>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
              {String(user?.name || user?.nome || 'Membro').split(' ')[0]}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.memberCardContainer}>
        <MemberCard member={user} variant="profile" />
      </View>

      {ehGestao && globalToken && (
        <TouchableOpacity
          style={styles.globalTokenCard}
          onPress={() => {
            logNavigation('AssembleiaDetalhe (via GlobalTokenAtivo)');
            navigation.navigate('AssembleiaDetalhe', { id: globalToken.assembleia_id });
          }}
          accessibilityRole="button"
          accessibilityLabel="Visualizar QR Code de Check-in Ativo"
        >
          <View style={styles.globalTokenIcon}>
            <MaterialCommunityIcons name="qrcode-scan" size={32} color="#003366" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.globalTokenTitle}>QR Code de Check-in Ativo</Text>
            <Text style={styles.globalTokenSubtitle} numberOfLines={1}>{globalToken.assembleia_titulo}</Text>
            <Text style={styles.globalTokenAction}>Clique aqui para visualizar</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#003366" />
        </TouchableOpacity>
      )}

      <View style={styles.grid}>
        {displayedItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.card}
            onPress={() => {
              logNavigation(item.screen);
              navigation.navigate(item.screen as any);
            }}
            accessibilityRole="link"
            accessibilityLabel={item.label}
          >
            <Text style={{ fontSize: 40 }}>{item.emoji}</Text>
            <Text style={styles.cardLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  header: {
    backgroundColor: '#003366',
    paddingHorizontal: 20,
    paddingBottom: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  memberCardContainer: {
    marginTop: -60, // Increased to compensate for removal of negative margin in MemberCard
  },
  headerText: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: -2,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userProfile: {
    fontSize: 12,
    color: '#FFC300',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 0,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 16,
    marginTop: -30, // Puxa os cards para cima do header
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 8,
    width: '42%', // Aproximadamente 2 colunas
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  globalTokenCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 6,
    borderLeftColor: '#f1c40f',
  },
  globalTokenIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#fffdf0',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  globalTokenTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
  },
  globalTokenSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  globalTokenAction: {
    fontSize: 11,
    color: '#856404',
    fontWeight: 'bold',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
