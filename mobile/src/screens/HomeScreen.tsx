import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DrawerScreenProps } from '@react-navigation/drawer';

import SafeScreen from '../components/SafeScreen';
import MemberCard from '../components/MemberCard';
import JogosBanner from '../components/JogosBanner';
import OtaUpdateBanner from '../components/OtaUpdateBanner';

import { ENABLE_JOGOS } from '../config/features';
import { useAuth } from '../hooks/useAuth';
import { logNavigation } from '../infra/logger';
import { isGestao } from '../utils/filiadoUtils';

/**
 * Canon do Drawer (ideal: extrair para src/navigation/types.ts para evitar duplicação).
 * Mantido aqui para não criar dependência circular com DrawerNavigator (que importa HomeScreen).
 */
export type DrawerParamList = {
  'Início': undefined;
  Noticias: undefined;
  MeusDados: undefined;
  Filiados: undefined;
  Publicacoes: undefined;
  Ressarcimento: undefined;
  Jogos2026: undefined;
  Votacao: undefined;
  Estatuto: undefined;
  Seguranca: undefined;
  Atualizacoes: undefined;
  Logs: undefined;
  Repasse: undefined;
  Relatorios: undefined;
  NotificacoesPush: undefined;
  CriarFiliado: undefined;
};

type Props = DrawerScreenProps<DrawerParamList, 'Início'>;

type NavItem = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  screen: keyof DrawerParamList;
  requireGestao?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Meus Dados', icon: 'account-details-outline', screen: 'MeusDados' },
  { label: 'Listar Filiados', icon: 'account-group-outline', screen: 'Filiados' },
  { label: 'Assembleias e Votações', icon: 'vote-outline', screen: 'Votacao' },
  { label: 'Notícias', icon: 'newspaper-variant-outline', screen: 'Noticias' },
];

export default function HomeScreen({ navigation }: Props) {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const ehGestaoUsuario = isGestao(usuario?.perfil_acesso);

  const displayedItems = NAV_ITEMS.filter((i) => !i.requireGestao || ehGestaoUsuario);

  const primeiroNome = String(usuario?.nome || 'Filiado').trim().split(' ')[0];

  return (
    <SafeScreen style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { paddingTop: 20 + insets.top }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.welcomeTitle}>Olá,</Text>
              <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                {primeiroNome}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.memberCardContainer}>
          <MemberCard member={usuario} variant="profile" />
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
                logNavigation(String(item.screen));
                navigation.navigate(item.screen);
              }}
              accessibilityRole="link"
              accessibilityLabel={item.label}
            >
              <MaterialCommunityIcons name={item.icon} size={40} color="#003366" />
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
    paddingBottom: 140,
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
    marginTop: -90,
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
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    margin: 8,
    width: '42%',
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
