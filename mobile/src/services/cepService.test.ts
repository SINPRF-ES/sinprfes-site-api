import axios from 'axios';
import { buscarCep } from './cepService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('cepService - buscarCep', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('CASO A — CEP válido que retorna logradouro e bairro completos', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        logradouro: 'Avenida Edízio Cirne',
        bairro: 'Praia do Morro',
        localidade: 'Guarapari',
        uf: 'ES',
      },
    });

    const result = await buscarCep('29200080');

    expect(result).toEqual({
      logradouro_bairro: 'Avenida Edízio Cirne, Praia do Morro',
      cidade: 'Guarapari',
      uf: 'ES',
      isEnderecoEditable: false,
    });
  });

  test('CASO B — CEP válido sem logradouro', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        logradouro: '',
        bairro: 'Centro',
        localidade: 'Zona Rural',
        uf: 'ES',
      },
    });

    const result = await buscarCep('29000000');

    expect(result).toEqual({
      logradouro_bairro: 'Centro',
      cidade: 'Zona Rural',
      uf: 'ES',
      isEnderecoEditable: true,
    });
  });

  test('CASO C — CEP válido sem bairro', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        logradouro: 'Rodovia BR-101',
        bairro: '   ',
        localidade: 'Linhares',
        uf: 'ES',
      },
    });

    const result = await buscarCep('29900000');

    expect(result).toEqual({
      logradouro_bairro: 'Rodovia BR-101',
      cidade: 'Linhares',
      uf: 'ES',
      isEnderecoEditable: true,
    });
  });

  test('CASO D — CEP válido sem logradouro E sem bairro', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        logradouro: '',
        bairro: null,
        localidade: 'Pequena Vila',
        uf: 'ES',
      },
    });

    const result = await buscarCep('29800000');

    expect(result).toEqual({
      logradouro_bairro: '',
      cidade: 'Pequena Vila',
      uf: 'ES',
      isEnderecoEditable: true,
    });
  });

  test('CEP inválido / inexistente (API retorna erro)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        erro: true,
      },
    });

    const result = await buscarCep('00000000');

    expect(result).toBeNull();
  });

  test('Falha na requisição da API (rede / HTTP status)', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

    await expect(buscarCep('29200080')).rejects.toThrow('Não foi possível buscar o CEP. Verifique sua conexão.');
  });
});
