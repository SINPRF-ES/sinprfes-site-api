# FENAPRF - Sistema Híbrido (Mobile + Backend)

Este diretório contém uma cópia isolada do sistema do SINPRF-ES, adaptada para o projeto FENAPRF.

## Estrutura
- `mobile/`: Aplicativo React Native (Expo/EAS).
- `backend/`: API Node.js/Express e Frontend Web.

---

## 📱 Mobile

### Como rodar localmente
1. Entre na pasta: `cd mobile`
2. Instale as dependências: `npm install` ou `pnpm install` (Novos arquivos de lock serão gerados).
3. Configure o ambiente:
   - Copie `.env.example` para `.env`
   - Ajuste `API_BASE_URL` para apontar para seu backend local ou de dev.
4. Inicie o Expo: `npx expo start`

### Build e OTA (EAS)
- O projeto está configurado com placeholders em `app.json`.
- Para rodar builds ou updates, você deve primeiro configurar seu próprio `projectId` no EAS:
  ```bash
  eas project:init
  ```
- E atualizar o `projectId` em `app.json` e `eas.json`.

---

## ⚙️ Backend

### Como rodar localmente
1. Entre na pasta: `cd backend`
2. Instale as dependências: `npm install` ou `pnpm install`.
3. Configure o ambiente:
   - Copie `.env.example` para `.env`
   - Preencha as variáveis obrigatórias (DATABASE_URL, JWT_SECRET, RESEND_API_KEY, etc.).
4. Inicie o servidor: `npm run dev`

---

## 🛡️ Regras de Isolamento
- Este projeto é independente da pasta `mobile/` na raiz do repositório.
- **Não** utilize imports que subam além da pasta `FENAPRF/`.
- O mobile consome o código compartilhado em `FENAPRF/backend/shared/`.
