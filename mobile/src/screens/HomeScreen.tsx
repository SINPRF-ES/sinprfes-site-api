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
import { isDiretoria, isGestao } from '../utils/filiadoUtils';

import type { DrawerParamList } from '../navigation/types';
import { COLORS } from '../theme/colors';

type Props = DrawerScreenProps<DrawerParamList, 'Início'>;

type NavItem = {
  label: string;
  subtitle?: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  screen: keyof DrawerParamList;
  requireGestao?: boolean;
  requireDiretoria?: boolean;
  requiredPermission?: string;
  hiddenForComunicador?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Meus Dados', subtitle: 'Atualize seu cadastro', icon: 'account-details-outline', screen: 'MeusDados' },
  { label: 'Listar Filiados', subtitle: 'Consulte o quadro', icon: 'account-group-outline', screen: 'Filiados', hiddenForComunicador: true },
  { label: 'Informes', subtitle: 'Avisos e comunicados', icon: 'newspaper-variant-outline', screen: 'Noticias' },
  { label: 'Aniversários', subtitle: 'Mural de aniversariantes', icon: 'cake-variant', screen: 'Aniversarios' },
  { label: 'Convênios', subtitle: 'Benefícios e parceiros', icon: 'handshake-outline', screen: 'Convenios' },
  { label: 'Ressarcimento', subtitle: 'Solicite seu reembolso', icon: 'cash-refund', screen: 'Ressarcimento' },
  { label: 'Assembleias', subtitle: 'Votações e sessões', icon: 'vote-outline', screen: 'Votacao', hiddenForComunicador: true },
  { label: 'Publicações', subtitle: 'Biblioteca e Atos', icon: 'book-open-variant', screen: 'Publicacoes', hiddenForComunicador: true },
  { label: 'Repasse', subtitle: 'Apoio e alocações', icon: 'swap-horizontal', screen: 'Repasse', hiddenForComunicador: true },
  { label: 'Relatórios', subtitle: 'Dossiês e PDFs', icon: 'chart-bar', screen: 'Relatorios', requireGestao: true },
  { label: 'Estatísticas', subtitle: 'Acessos do site', icon: 'chart-line', screen: 'Estatisticas', requireGestao: true },
  { label: 'Consulta Processual', subtitle: 'PJe e Tribunais', icon: 'scale-balance', screen: 'ConsultaProcessual', hiddenForComunicador: true },
  { label: 'Site (CMS)', subtitle: 'Notícias e Convênios', icon: 'web', screen: 'CMSSite', requireGestao: true, requiredPermission: 'EDIT_CONTENT' },
];

export default function HomeScreen({ navigation }: Props) {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const ehGestaoUsuario = isGestao(usuario?.perfil_acesso);
  const ehDiretoriaUsuario = isDiretoria(usuario?.perfil_acesso);
  const isComunicador = (usuario?.perfil_acesso || '').toUpperCase() === 'COMUNICADOR';
  const permissions = Array.isArray((usuario as any)?.permissions) ? (usuario as any).permissions : [];
  const hasPerm = (perm?: string) => !perm || permissions.includes('*') || permissions.includes(perm);
  const displayedItems = NAV_ITEMS.filter(
    (i) => (!i.requireGestao || ehGestaoUsuario)
      && (!i.requireDiretoria || ehDiretoriaUsuario)
      && hasPerm(i.requiredPermission)
      && !(isComunicador && i.hiddenForComunicador)
  );

  const primeiroNome = String(usuario?.nome || 'Filiado').trim().split(' ')[0];

  return (
    <SafeScreen style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { paddingTop: 12 }]} />

        <View style={styles.memberCardContainer}>
          <MemberCard member={usuario} variant="default" />
        </View>

        {ENABLE_JOGOS && !isComunicador && (
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
                <MaterialCommunityIcons name={item.icon} size={26} color={COLORS.prfBlue} />
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
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  header: {
    backgroundColor: COLORS.prfBlue,
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
    color: COLORS.white,
    letterSpacing: 1,
  },
  headerText: {
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
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
    color: COLORS.text,
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
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    margin: 8,
    width: '44%',
    minHeight: 148,
    alignItems: 'center',
    justifyContent: 'flex-start',

    borderWidth: 1,
    borderColor: COLORS.border,

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
    backgroundColor: '#eaf3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  cardLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.prfBlue,
    marginBottom: 6,
    textAlign: 'center',
    width: '100%',
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
  },
});
