# SINPRF/ES App

Aplicativo móvel para filiados do Sindicato dos Policiais Rodoviários Federais no Estado do Espírito Santo (SINPRF/ES).

Este aplicativo serve como um cliente para a API do [sinprfes-site-api](https://github.com/SINPRF-ES/sinprfes-site-api) e espelha as funcionalidades do site.

## 1. Como Rodar o Projeto

### Pré-requisitos
- Node.js (versão LTS recomendada)
- Git
- Celular com o app Expo Go instalado (para testes em dispositivo físico)

### Passos
1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SINPRF-ES/sinprfes-app.git
   cd sinprfes-app
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Crie um arquivo `.env` na raiz do projeto (use `.env.example` como modelo).
   - Preencha a `API_BASE_URL` conforme explicado na seção "Configuração para Desenvolvimento Local".

4. **Inicie o ambiente de desenvolvimento:**
   ```bash
   npm start
   ```
   - Escaneie o QR code com o app Expo Go no seu celular.

## 2. Configuração para Desenvolvimento Local

Para conectar o aplicativo a um servidor de API rodando na sua máquina, é crucial usar o endereço de IP correto.

### 2.1. Por que `localhost` não funciona?
Quando o app roda no seu celular, `localhost` se refere ao próprio celular, não ao seu computador. Para que o app possa se comunicar com a API na sua máquina, você deve usar o endereço de IP do seu computador na rede Wi-Fi.

### 2.2. Encontrando seu Endereço de IP Local
- **No Windows:**
  - Abra o PowerShell ou CMD e digite `ipconfig`.
  - Procure pelo "Endereço IPv4" do seu adaptador de rede Wi-Fi.

- **No macOS ou Linux:**
  - Abra o terminal e digite `ifconfig | grep inet`.
  - Procure pelo endereço que se parece com `192.168.x.x`.

### 2.3. Configurando o Arquivo `.env`
No seu arquivo `.env`, a variável `API_BASE_URL` deve ser configurada da seguinte forma (substitua `SEU_IP_AQUI` pelo IP encontrado):

```
# Exemplo para teste em dispositivo físico
API_BASE_URL=http://192.168.1.5:3000
```
**Importante:** Seu computador e seu celular devem estar conectados à mesma rede Wi-Fi.

## 3. Features e Permissões
... (seções 3, 4, 5 e 6 permanecem as mesmas)
...

## 4. Matriz de Paridade com o Site

| Recurso                 | Status    | Observações                                                                        |
|-------------------------|-----------|------------------------------------------------------------------------------------|
| Autenticação (JWT)      | `OK`      | Fluxo de login, 2FA e armazenamento de sessão implementados.                       |
| Meus Dados (GET/PUT)    | `OK`      | Tela implementada para visualização e edição dos próprios dados.                   |
| Listagem de Filiados    | `OK`      | Busca em tempo real na API com diferenciação de dados por perfil.                  |
| Gestão de Filiados      | `Parcial` | Telas de criação/edição criadas; lógica de arquivar/desarquivar pendente.        |
| Dependentes (até 5)     | `OK`      | Campos adicionados nos formulários de criação e edição.                            |
| Avatar Upload           | `Pendente`| Lógica de upload de imagem (`multipart/form-data`) precisa ser implementada.         |
| Fluxo de Primeiro Acesso| `Pendente`| Requer análise do fluxo exato no backend/site.                                     |

## 5. Roadmap Técnico: Módulo de Votação
...

## 6. Checklist de Testes Manuais
...
