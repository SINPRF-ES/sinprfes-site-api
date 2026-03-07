# Guia de Deploy no Railway - SINPRF-ES

> Documento consolidado: para evitar divergência de **Root Directory**, **Build Command** e **Start Command** entre serviços, toda a configuração operacional do Railway foi centralizada em:
>
> - `docs/ops/railway.md`

## Canon de uso

- Use **somente** `docs/ops/railway.md` como fonte de verdade para configurar SITE e API no Railway.
- Não replique parâmetros de deploy em múltiplos `.md`.

## Domínios canônicos (referência rápida)

- **SITE_BASE_URL (Produção):** `https://sinprfes.org.br`
- **API_BASE_URL (Produção):** `https://api.sinprfes.org.br`
