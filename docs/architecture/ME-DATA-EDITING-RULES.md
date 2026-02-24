# Regras de Edição de Meus Dados (/api/filiados/me)

Este documento descreve as permissões de edição para o endpoint `/api/filiados/me`, diferenciando o que um usuário comum (`FILIADO`) pode alterar em comparação com perfis de gestão.

## 1. Whitelist por Perfil

O sistema implementa uma estratégia de "Defesa em Profundidade", onde tanto o Frontend quanto o Backend aplicam whitelists rigorosas.

### 1.1 Perfil FILIADO
O usuário comum tem autonomia para manter seus dados de contato, endereço e dependentes atualizados.

**Campos Permitidos:**
- **Contatos:** `telefone1`, `telefone2`, `email1`, `email2`
- **Lotação:** `lotacao` (Permitido para que o filiado informe sua unidade atual)
- **Endereço:** `cep`, `logradouro_bairro`, `numero`, `complemento`, `cidade`, `uf` (Nota Técnica: `logradouro_bairro`, `cidade` e `uf` só são aceitos se o `cep` estiver presente no payload para garantir a integridade do fluxo `buscaCEP` no backend)
- **Dependentes:** Todos os campos de `dep1` até `dep5` (`nome`, `cpf`, `data_nascimento`, `parentesco`, `parentesco_outro`)

**Campos Proibidos (Bloqueados no Backend):**
- `nome`, `cpf`, `siape`, `sexo`, `data_nascimento`, `situacao` (Estes requerem alteração via Gestão).

### 1.2 Perfis de GESTÃO (ADMIN, DIRETORIA, FUNCIONARIO)
Usuários com perfil de gestão podem editar todos os campos acima e também os campos biográficos e funcionais.

**Campos Adicionais Permitidos:**
- `nome`, `cpf`, `siape`, `sexo`, `data_nascimento`, `situacao`

---

## 2. Implementação Técnica

### 2.1 Frontend (Site)
O módulo `meus-dados.js` constrói o payload baseando-se na constante `Canon.ME_EDITABLE_FIELDS_FILIADO`.
Além disso, aplica um "Assert Final" removendo explicitamente chaves como `sexo` e `siape` antes do envio.

### 2.2 Backend
O controller `atualizarMeusDados` no `filiados.controller.js` utiliza a mesma constante canônica.
- Se um campo proibido for enviado por um `FILIADO`, o backend **registra um aviso (warn log)** mas **não rejeita a requisição**, apenas remove o campo proibido e processa o restante (UX Resiliente).
- A validação final é feita via **Zod** (partial schema).

## 3. Fluxo de Dependentes
- O sistema aceita até 5 dependentes.
- Em cada salvamento, o backend realiza a **compactação**, movendo dependentes válidos para os primeiros slots e limpando os demais.
- A regra de `parentesco_outro` é obrigatória quando o tipo for `OUTRO`.
