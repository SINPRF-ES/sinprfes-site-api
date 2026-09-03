// mobile/src/services/cepService.ts
import axios from 'axios';

interface ViaCepResponse {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Busca um endereço a partir de um CEP na API do ViaCEP.
 * @param cep O CEP a ser consultado (apenas dígitos).
 * @returns Um objeto com os dados do endereço ou null se não for encontrado.
 */
export const buscarCep = async (cep: string) => {
  try {
    const { data } = await axios.get<ViaCepResponse>(`https://viacep.com.br/ws/${cep}/json/`);
    if (data.erro) {
      return null; // CEP não encontrado
    }
    const temLog = Boolean(data.logradouro && data.logradouro.trim());
    const temBai = Boolean(data.bairro && data.bairro.trim());

    let logradouro_bairro = '';
    if (temLog && temBai) {
      logradouro_bairro = `${data.logradouro}, ${data.bairro}`;
    } else if (temLog) {
      logradouro_bairro = data.logradouro;
    } else if (temBai) {
      logradouro_bairro = data.bairro;
    }

    return {
      logradouro_bairro,
      cidade: data.localidade || '',
      uf: data.uf || '',
      isEnderecoEditable: !temLog || !temBai,
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    throw new Error('Não foi possível buscar o CEP. Verifique sua conexão.');
  }
};
