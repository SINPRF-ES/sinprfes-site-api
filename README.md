# SINPRF-ES – Sistema de Filiação + Área Restrita + API

Backend oficial do Sindicato dos Policiais Rodoviários Federais do Espírito Santo.

## Visão Geral do Projeto

Este repositório contém a aplicação full-stack do SINPRF-ES, que inclui:

- **Frontend**: Um site institucional estático construído com HTML, CSS e JavaScript, servido diretamente pelo diretório `/public`.
- **Backend**: Uma API RESTful desenvolvida em Node.js com o framework Express, responsável por toda a lógica de negócio e comunicação com o banco de dados.
- **Banco de Dados**: Utiliza PostgreSQL para persistência dos dados.

O sistema gerencia o cadastro de filiados, autenticação, área restrita para acesso a dados e serviços, e funcionalidades administrativas para a gestão de usuários.

## Requisitos

- **Node.js**: Versão 18.0.0 ou superior.
- **PostgreSQL**: Uma instância do PostgreSQL em execução.
- **NPM**: Gerenciador de pacotes do Node.js.

## Setup Local

1.  **Instalar dependências**:
    ```bash
    npm install
    ```

2.  **Criar arquivo `.env`**:
    Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis de ambiente:

    ```env
    PORT=3000
    DATABASE_URL=postgres://USUARIO:SENHA@HOST:PORTA/DATABASE
    JWT_SECRET=sua-chave-secreta-jwt-aqui
    ```

3.  **Rodar o servidor**:
    ```bash
    npm start
    ```
    O servidor estará disponível em `http://localhost:3000`.

## Rotas Principais (API)

A API segue um padrão RESTful e as principais rotas são:

-   `POST /api/login`: Autentica um usuário e retorna um token JWT.
-   `GET /api/filiados/me`: Retorna os dados do usuário autenticado.
-   `PUT /api/filiados/me`: Permite que o usuário autenticado atualize seus próprios dados.
-   `GET /api/filiados`: (Gestão) Lista todos os filiados.
-   `POST /api/filiados`: (Gestão) Cria um novo filiado.
-   `PUT /api/filiados/:id`: (Gestão) Atualiza os dados de um filiado específico.

## Dependentes (até 5)

O sistema permite que cada filiado cadastre até 5 dependentes.

### Campos por Dependente

Para cada dependente (de 1 a 5), os seguintes campos estão disponíveis:

-   `depN_nome`: Nome completo do dependente.
-   `depN_cpf`: CPF do dependente (armazenado sem formatação).
-   `depN_data_nascimento`: Data de nascimento (formato `YYYY-MM-DD`).
-   `depN_parentesco`: Grau de parentesco (ex: Filho, Cônjuge).

### Regras de Validação

-   **Consistência**: Se `depN_nome` for preenchido, `depN_cpf` é obrigatório, e vice-versa.
-   **CPF**: Deve ser um CPF válido com 11 dígitos.
-   **Data de Nascimento**: Deve ser uma data válida.
-   **Opcional**: O preenchimento de dependentes é opcional. Um filiado pode não ter nenhum dependente cadastrado.

### Permissões

-   **Perfil "FILIADO"**: Pode cadastrar, visualizar e editar seus próprios dependentes através da rota `PUT /api/filiados/me`.
-   **Perfis de Gestão (ADMIN, DIRETORIA, etc.)**: Podem cadastrar, visualizar e editar os dependentes de qualquer filiado através das rotas `POST /api/filiados` (criação) e `PUT /api/filiados/:id` (edição).
-   **Visualização Pública**: A lista de filiados retornada para o perfil "FILIADO" (`GET /api/filiados`) **não** inclui os dados dos dependentes, apenas nome e telefone, para proteger a privacidade.
