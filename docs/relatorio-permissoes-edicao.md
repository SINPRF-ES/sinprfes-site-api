# Relatório de Auditoria: Permissões de Edição de Filiados

Este documento detalha os pontos identificados onde a permissão de edição de dados de filiados está restrita indevidamente (apenas ADMIN) ou onde há inconsistências com a nova regra de gestão (ADMIN, DIRETORIA, FUNCIONARIO).

## 1. Mapeamento de Pontos

### 1.1 Frontend Web (Site)

| Arquivo | Linha (aprox) | O que está bloqueando | Comportamento Atual | Ajuste |
|---------|---------------|-----------------------|----------------------|--------|
| `public/js/area-filiado/filiados-admin.js` | 302 | `ehAdmin` no input CPF | DIRETORIA/FUNCIONARIO não conseguem editar CPF no modal. | Trocar `ehAdmin` por `ehGestao`. |
| `public_dev/js/area-filiado/filiados-admin.js` | 304 | `ehAdmin` no input CPF | DIRETORIA/FUNCIONARIO não conseguem editar CPF no modal. | Trocar `ehAdmin` por `ehGestao`. |
| `public/js/area-filiado/filiados-admin.js` | 69, 110 | `ehGestao` hardcoded | Já define `ehGestao` como o trio correto. | Verificar se é usado consistentemente em todos os campos. |

### 1.2 Mobile App

| Arquivo | Linha (aprox) | O que está bloqueando | Comportamento Atual | Ajuste |
|---------|---------------|-----------------------|----------------------|--------|
| `mobile/src/components/DependentesCard.tsx` | - | Falta `editable={isEditing}` | Campos de dependentes podem estar editáveis mesmo para quem não deveria. | Aplicar a prop `isEditing` nos inputs de dependentes e atualizar call sites. |
| `mobile/src/components/ContatoCard.tsx` | - | Uso de `isManagement` | Já utiliza o helper `isGestao` que contempla o trio. | OK. |
| `mobile/src/components/LotacaoCard.tsx` | - | Uso de `isGestao` | Já utiliza o helper `isGestao`. | OK. |

### 1.3 Backend

| Arquivo | Linha (aprox) | O que está bloqueando | Comportamento Atual | Ajuste |
|---------|---------------|-----------------------|----------------------|--------|
| `src/controllers/filiados.controller.js` | 25 | `perfilGestao` helper | Inclui `ORGANIZADOR` no grupo de gestão. | Remover `ORGANIZADOR` para alinhar com o trio de gestão. |
| `src/services/filiados.service.js` | 306 | `perfisGestao` list | Inclui `ORGANIZADOR`. | Remover `ORGANIZADOR` para alinhar com o trio de gestão. |

---

## 2. Roteiro de Testes

Para validar as alterações, siga os passos abaixo:

### Preparação
1. Certifique-se de ter usuários de teste com os perfis: `DIRETORIA`, `FUNCIONARIO`, `ORGANIZADOR` e `FILIADO`.

### Teste 1: Edição por DIRETORIA (Web e App)
1. Faça login como `DIRETORIA`.
2. Vá para a listagem de filiados.
3. Escolha um filiado e clique em "Editar".
4. **Verifique:** O campo **CPF** deve estar editável.
5. Altere o CPF, Lotação, Situação e um Dependente.
6. Clique em Salvar.
7. **Verifique:** Os dados foram salvos com sucesso.

### Teste 2: Edição por FUNCIONARIO (Web e App)
1. Repita o Teste 1 logado como `FUNCIONARIO`.
2. **Verifique:** Todos os campos (incluindo CPF e Dependentes) devem estar editáveis e salvar corretamente.

### Teste 3: Restrição para ORGANIZADOR (Web e App)
1. Faça login como `ORGANIZADOR`.
2. Vá para a listagem de filiados.
3. **Verifique:** Não deve haver botão "Editar" (ou se houver, os campos críticos como CPF devem estar bloqueados).
4. Tente acessar o endpoint de edição via API (ex: `PUT /api/filiados/:id`).
5. **Verifique:** O backend deve retornar `403 Forbidden`.

### Teste 4: "Auto-edit" de CPF (Regra de Negócio)
1. Faça login como `DIRETORIA`.
2. Tente editar **seu próprio** cadastro.
3. **Verifique:** Se a regra de bloqueio de auto-edição de CPF existir, ela deve ser respeitada. Caso contrário, a gestão pode editar tudo (conforme a nova regra "conseguir editar TODOS os campos").

### Teste 5: Promoção para ADMIN
1. Logado como `DIRETORIA` ou `FUNCIONARIO`, tente alterar o perfil de um filiado para `ADMIN`.
2. **Verifique:** A opção `ADMIN` não deve estar disponível no select, ou o backend deve barrar a alteração. (Regra existente preservada).
