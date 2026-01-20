# Mobile - SINPRF-ES

Aplicativo mobile desenvolvido com Expo e React Native.

## Convenções e Regras CANON (Produção 2.0)

### Hierarquia de Verdade
1. **Backend:** Postgres + Regras de Negócio + Contratos de API.
2. **Site:** Referência funcional e visual (UX).
3. **Mobile:** Adapta-se ao Backend e Site.

### Formatação e Máscaras (Shared Formatters)
O aplicativo utiliza formatadores centralizados em `mobile/src/shared/formatters.ts` (espelho do site):
* **CPF:** `000.000.000-00` (UI) / 11 dígitos (Banco).
* **CEP:** `00000-000` (UI) / 8 dígitos (Banco).
* **Telefone:** `(DD) 9XXXX-XXXX` (UI) / Somente dígitos (Banco).
* **Datas:** `DD/MM/YYYY` (UI) / `YYYY-MM-DD` (API/Banco).

### Valores Canônicos (Enums)
* **Perfis:** `ADMIN`, `DIRETORIA`, `FUNCIONARIO`, `ORGANIZADOR`, `FILIADO`.
* **Situação Funcional:** `ATIVO`, `VETERANO`, `PENSIONISTA`.
* **Parentesco:** `FILHO_ENTEADO`, `CONJUGE_COMPANHEIRO`, `PAI_MAE`, `IRMAO`, `OUTRO`.

## Regras de Interface e UX

### Visual Parity
* Seções com títulos centralizados e emojis.
* Alternância de cores de fundo entre cartões (`#ffffff` e `#f7f9fc`).
* Badges de status sem prefixos (ex: apenas `ATIVO`).
* Botões "Salvar" e "Arquivar" fixos no topo em telas de edição.

### Regras por Perfil
* **FILIADO:** Não visualiza CPF de terceiros, não visualiza arquivados e não tem campo de busca por CPF.
* **Gestão:** Visualização completa e filtros avançados.

## Desenvolvimento e Testes

### Como rodar
1. `cd mobile`
2. `npm install`
3. `npx expo start`

### Variáveis de Ambiente
Utilize o prefixo `EXPO_PUBLIC_` para variáveis acessíveis no código (ex: `EXPO_PUBLIC_API_URL`).

### Logs
Instrumentação via `logger` em fluxos críticos (Auth, API, Publicações). Logs disponíveis na tela de **Diagnóstico** para ADMINS.
