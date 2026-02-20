import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DrawerScreenProps } from '@react-navigation/drawer';

import SafeScreen from '../components/SafeScreen';
import MemberCard from '../components/MemberCard';
import JogosBanner from '../components/JogosBanner';

import { ENABLE_JOGOS } from '../config/features';
import { useAuth } from '../hooks/useAuth';
import { logNavigation } from '../infra/logger';
import { isGestao } from '../utils/filiadoUtils';

import type { DrawerParamList } from '../navigation/types';

type Props = DrawerScreenProps<DrawerParamList, 'Início'>;

type NavItem = {
  label: string;
  subtitle?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  screen: keyof DrawerParamList;
  requireGestao?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Meus Dados', subtitle: 'Atualize seu cadastro', icon: 'account-details-outline', screen: 'MeusDados' },
  { label: 'Listar Filiados', subtitle: 'Consulte o quadro', icon: 'account-group-outline', screen: 'Filiados' },
  { label: 'Assembleias', subtitle: 'Votações e sessões', icon: 'vote-outline', screen: 'Votacao' },
  { label: 'Notícias', subtitle: 'Avisos e comunicados', icon: 'newspaper-variant-outline', screen: 'Noticias' },
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
        <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
          <View style={styles.headerTop}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerBrand}>SINPRF/ES</Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
              Página Inicial
            </Text>
          </View>
        </View>

        <View style={styles.memberCardContainer}>
          <MemberCard member={usuario} variant="default" />
        </View>

        {ENABLE_JOGOS && (
          <View style={styles.banners}>
            <JogosBanner />
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ações rápidas</Text>
        </View>

        <View style={styles.grid}>
          {displayedItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                logNavigation(String(item.screen));
                navigation.navigate(item.screen);
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.iconChip}>
                <MaterialCommunityIcons name={item.icon} size={26} color="#003366" />
              </View>

              <Text style={styles.cardLabel} numberOfLines={2}>
                {item.label}
              </Text>

              {!!item.subtitle && (
                <Text style={styles.cardSubtitle} numberOfLines={2}>
                  {item.subtitle}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: Math.max(14, insets.bottom) }} />
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
    paddingBottom: 110,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  headerLogo: {
    width: 32,
    height: 32,
    tintColor: '#FFFFFF',
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerText: {
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  memberCardContainer: {
    marginTop: -80,
    paddingHorizontal: 16,
  },

  banners: {
    paddingHorizontal: 16,
    marginTop: 8,
  },

  sectionHeader: {
    paddingHorizontal: 18,
    marginTop: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f2a37',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 16,
  },

  // Inspirado no padrão do FENAPRF MemberCard (borda #eee + sombra leve)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    margin: 8,
    width: '44%',
    minHeight: 148,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',

    borderWidth: 1,
    borderColor: '#eee',

    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef3fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  cardLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
});
