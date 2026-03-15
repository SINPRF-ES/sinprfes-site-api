# Maintenance Run Log — 2026-05-27

- **Mode:** Guardian Soft Maintenance
- **Branch:** execute-guardian-soft-maintenance-mode
- **Scope:** Sentinel Standardization, Terminology Parity, Gap B Resolution

## 🛡️ Sentinel Pass (Security & Correctness)
- Standardized `backend/src/controllers/filiados.controller.js`:
    - Updated catch blocks in `getFiliadoById`, `getMe`, `listarFiliados`, `uploadAvatarMe`, `uploadAvatarPorId`, `desativar2fa`, `removerAvatarMe`, and `removerAvatarPorId` to use `handleDbError`.
    - Ensured consistent inclusion of `requestId` and `atorId` in all `log.info` and `log.error` calls.
    - Fixed missing `atorId` in `FiliadoEmailBoasVindasErro` log.

## 🎨 Palette Pass (UX & Consistency)
- Standardized terminology from "Notícia" to "Informe" to match system-wide standard:
    - Updated labels in `site/public/js/area-filiado/noticias-admin.js`.
    - Updated CMS button label in `site/public/area-filiado.html`.

## 🔄 Parity Enforcement
- **Gap B Resolved:** Members now have integrated access to public news within the "Área do Filiado".
    - Modified `site/public/js/area-filiado/informes-admin.js` to include a new section "Informes do Site (Públicos)".
    - Implemented `carregarInformesPublicos` to fetch and display external news.
- Updated `docs/paridade-app-site.md` reflecting Wave B completion.

## ✅ Verification Results
- Backend controllers reviewed for `handleDbError` usage.
- Frontend terminology verified via grep.
- Integrated news logic verified in `informes-admin.js`.

## 🕊️ No-Surprise Declaration
All changes follow the SINPRF/ES Canon, are non-breaking, and strictly improve consistency and security standards.
