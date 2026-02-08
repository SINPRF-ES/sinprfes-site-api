// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import JogosBanner from '../components/JogosBanner';
import OtaUpdateBanner from '../components/OtaUpdateBanner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { logNavigation } from '../infra/logger';
import type { RootStackParamList } from '../navigation';
import Badge from '../components/Badge';
import { normalizeSituacaoFuncional } from '../utils/userUtils';
import { Image } from 'react-native';
import ErrorBoundary from '../components/ErrorBoundary';

type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

const NAV_ITEMS = [
  {
    label: 'Meus Dados',
    icon: 'account-details-outline',
    screen: 'MeusDados',
  },
  {
    label: 'Notícias e Comunicados',
    icon: 'newspaper-variant-outline',
    screen: 'Noticias', // Tela a ser criada
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

function HomeScreenComponent({ navigation }: HomeScreenProps) {
  const { user } = useAuth();

  const displayedItems = [...NAV_ITEMS];

  let situacao = '';
  let perfil = 'CONSELHEIRO';

  try {
    situacao = normalizeSituacaoFuncional(user?.situacao || '');
    perfil = String(user?.perfil_acesso || 'CONSELHEIRO').toUpperCase();
  } catch (err) {
    console.error('[HomeScreen] Error calculating profile/status:', err);
  }

  const getSituacaoVariant = (s: string) => {
    switch (s) {
      case 'ATIVO': return 'success';
      case 'VETERANO': return 'warning';
      case 'PENSIONISTA': return 'pink';
      default: return 'default';
    }
  };

  return (
    <SafeScreen style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image
            source={typeof user?.avatar_url === 'string' && user.avatar_url.startsWith('http')
              ? { uri: user.avatar_url }
              : require('../../assets/logo.png')}
            style={styles.avatar}
            resizeMode="cover"
          />
          <View style={styles.headerText}>
            <Text style={styles.welcomeTitle}>Olá,</Text>
            <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
              {String(user?.name || 'Membro').split(' ')[0]}
            </Text>
            <Text style={styles.userProfile}>{String(perfil)}</Text>

            {situacao && (
              <Badge
                label={situacao}
                variant={getSituacaoVariant(situacao)}
                style={styles.headerBadge}
                textStyle={styles.headerBadgeText}
              />
            )}
          </View>
        </View>
      </View>

      <OtaUpdateBanner />
      <JogosBanner />

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
    </ScrollView>
    </SafeScreen>
  );
}

export default function HomeScreen(props: HomeScreenProps) {
  return (
    <ErrorBoundary>
      <HomeScreenComponent {...props} />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  header: {
    backgroundColor: '#003366',
    padding: 20,
    paddingBottom: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: '#f0f0f0',
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
});
