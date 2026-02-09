// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import JogosBanner from '../components/JogosBanner';
import OtaUpdateBanner from '../components/OtaUpdateBanner';
import { ENABLE_JOGOS } from '../config/features';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { logNavigation } from '../infra/logger';
import type { RootStackParamList } from '../navigation';
import MemberCard from '../components/MemberCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

const NAV_ITEMS = [
  {
    label: 'Meus Dados',
    icon: 'account-details-outline',
    screen: 'MeusDados',
  },
  {
    label: 'Buscar Membros',
    icon: 'account-search-outline',
    screen: 'Users',
  },
  {
    label: 'Assembleias e Votações',
    icon: 'vote-outline',
    screen: 'Votacao',
  },
];

const GESTAO_ITEMS: any[] = [];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const ehGestao = ['ADMIN', 'DIRETORIA', 'COLABORADOR'].includes((user?.perfil_acesso || '').toUpperCase());

  const displayedItems = [...NAV_ITEMS];
  if (ehGestao) {
    displayedItems.push(...GESTAO_ITEMS);
  }

  // Mantido (mesmo sem uso) para compatibilidade/telemetria futura
  // const perfil = (user?.perfil_acesso || 'CONSELHEIRO').toUpperCase();

  return (
    <SafeScreen style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { paddingTop: 20 + insets.top }]}>
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

        <View style={styles.banners}>
          <OtaUpdateBanner />
          {ENABLE_JOGOS && <JogosBanner />}
        </View>

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
              <MaterialCommunityIcons name={item.icon as any} size={40} color="#003366" />
              <Text style={styles.cardLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* espaço extra no final para não “colar” no gesto de navegação/home bar */}
        <View style={{ height: Math.max(12, insets.bottom) }} />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  header: {
    backgroundColor: '#003366',
    paddingHorizontal: 20,
    paddingBottom: 140, // dá espaço real para o MemberCard “entrar” sem invadir o topo
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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

  memberCardContainer: {
    marginTop: -90, // sobe o card, mas o header já reservou espaço suficiente
    paddingHorizontal: 16,
  },

  banners: {
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 10,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    marginTop: 0, // remove o “puxão” que causava sobreposição em telas menores
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 8,
    width: '42%', // ~2 colunas
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
});
