// mobile/src/components/FiliadoCard.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Button } from 'react-native';
import { Filiado } from '../types/filiado';
import { UserProfile } from '../hooks/useAuth';
import { formatCPF, formatPhone } from '../utils/masks';

// Adicionando situacaoFuncional para refletir o modelo de dados completo.
interface FiliadoCardProps {
  filiado: Filiado & { situacaoFuncional?: string };
  currentUserProfile: UserProfile;
  onEdit: (filiado: Filiado) => void;
}

const FiliadoCard: React.FC<FiliadoCardProps> = ({ filiado, currentUserProfile, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(currentUserProfile);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <TouchableOpacity style={styles.card} onPress={toggleExpand} activeOpacity={0.7}>
      <View style={styles.headerContainer}>
        <Image
          source={{ uri: filiado.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.infoContainer}>
          <View style={styles.nameAndBadgeContainer}>
            <Text style={styles.nome}>{filiado.nome}</Text>
            {/* O Badge de situacaoFuncional só aparece se o dado existir. */}
            {filiado.situacaoFuncional && (
              <Text style={[styles.situacao, styles.situacaoFuncional]}>
                {filiado.situacaoFuncional}
              </Text>
            )}
          </View>
          <Text style={styles.lotacao}>Lotação: {filiado.lotacao || 'Não informada'}</Text>
          <Text style={styles.detalhe}>Telefone: {formatPhone(filiado.telefone1 || 'Não informado')}</Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.expandedContent}>
          {isGestao && (
            <>
              <Text style={styles.detalhe}>CPF: {formatCPF(filiado.cpf || '')}</Text>
              <Text style={styles.detalhe}>Email: {filiado.email1}</Text>
            </>
          )}

          <View style={styles.footer}>
            {filiado.situacao && (
              <Text style={[styles.situacao, styles[`situacao${filiado.situacao.replace(/\s+/g, '')}`]]}>
                {filiado.situacao}
              </Text>
            )}
            <View style={styles.buttonContainerSpacer} />
            {isGestao && (
              <View style={styles.editButtonContainer}>
                <Button title="Editar" onPress={() => onEdit(filiado)} color="#003366" />
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(FiliadoCard);

const styles = StyleSheet.create({
  card: {
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Garante alinhamento vertical
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  infoContainer: {
    flex: 1, // Permite que o container de info ocupe o espaço restante
  },
  nameAndBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap', // Permite que o badge quebre a linha se não houver espaço
  },
  nome: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1, // Faz o nome ocupar o espaço e quebrar a linha
    marginRight: 8, // Espaçamento entre o nome e o badge
  },
  lotacao: {
    fontSize: 14,
    color: '#666',
  },
  detalhe: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  expandedContent: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  editButtonContainer: {
    // Adicionado para alinhar o botão
  },
  buttonContainerSpacer: {
    flex: 1,
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
  situacaoFuncional: {
    backgroundColor: '#cce5ff',
    color: '#004085',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
