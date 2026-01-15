// mobile/src/components/FiliadoCard.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Filiado } from '../types/filiado';
import { UserProfile } from '../hooks/useAuth';
import { formatCPF, formatPhone } from '../utils/masks';

interface FiliadoCardProps {
  filiado: Filiado;
  currentUserProfile: UserProfile;
  onPress: () => void;
}

const FiliadoCard: React.FC<FiliadoCardProps> = ({ filiado, currentUserProfile, onPress }) => {
  const podeVerDetalhes = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(currentUserProfile);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image
        source={{ uri: filiado.avatar_url || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.nome}>{filiado.nome}</Text>
        <Text style={styles.lotacao}>Lotação: {filiado.lotacao || 'Não informada'}</Text>

        {/* Campos visíveis apenas para perfis de GESTÃO */}
        {podeVerDetalhes && (
          <>
            <Text style={styles.detalhe}>CPF: {formatCPF(filiado.cpf || '')}</Text>
            <Text style={styles.detalhe}>Email: {filiado.email1}</Text>
          </>
        )}

        {/* Campo visível para todos, conforme regra */}
        <Text style={styles.detalhe}>Telefone: {formatPhone(filiado.telefone1 || 'Não informado')}</Text>

        <View style={styles.footer}>
            <Text style={[styles.situacao, styles[`situacao${filiado.situacao?.replace(/\s+/g, '')}`]]}>
                {filiado.situacao || 'ATIVO'}
            </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(FiliadoCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  infoContainer: {
    flex: 1,
  },
  nome: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lotacao: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  detalhe: {
    fontSize: 14,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  situacao: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  situacaoATIVO: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  situacaoVETERANO: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  situacaoPENSIONISTA: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
});
