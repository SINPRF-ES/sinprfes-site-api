// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import JogosBanner from '../components/JogosBanner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { logNavigation } from '../infra/logger';
import type { RootStackParamList } from '../navigation';

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
    label: 'Buscar Filiados',
    icon: 'account-search-outline',
    screen: 'Filiados',
  },
   {
    label: 'Assembleias e Votações',
    icon: 'vote-outline',
    screen: 'Votacao',
  },
];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { usuario } = useAuth();

  return (
    <SafeScreen style={styles.container}>
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.welcomeTitle}>Bem-vindo,</Text>
        <Text style={styles.userName}>{usuario?.nome ?? 'Filiado'}</Text>

<Text style={styles.otaTest}>
  123 teste de atualização OTA
</Text>

        {usuario?.situacao && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{usuario.situacao}</Text>
          </View>
        )}
      </View>

      <JogosBanner />

      <View style={styles.grid}>
        {NAV_ITEMS.map((item) => (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  header: {
    backgroundColor: '#003366',
    padding: 24,
    paddingBottom: 48,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  welcomeTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  userName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
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
  otaTest: {
  marginTop: 8,
  color: '#FFD54F',
  fontWeight: 'bold',
  fontSize: 14,
},

});
