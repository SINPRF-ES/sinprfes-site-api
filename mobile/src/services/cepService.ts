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
    return {
      logradouro_bairro: `${data.logradouro}, ${data.bairro}`,
      cidade: data.localidade,
      uf: data.uf,
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    throw new Error('Não foi possível buscar o CEP. Verifique sua conexão.');
  }
};
