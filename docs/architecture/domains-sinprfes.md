# Canonical Domain Architecture - SINPRF/ES

This document establishes the canonical domain architecture and repository separation for the SINPRF/ES system.

## 1. Canonical Domain Architecture

### Frontend Institucional (Site Público)
- **Canonical Domains:**
  - `https://sinprfes.org.br`
  - `https://www.sinprfes.org.br`
- **Function:** Institutional site, public content, CMS, and web interface.
- **Infrastructure:**
  - **Cloudflare:** Proxied (Orange cloud)
  - **Railway:** Web content service.
- **Restriction:** Never use as the API base for the mobile app.

### Backend API (Single Source of Truth)
- **Canonical Domain:** `https://api.sinprfes.org.br`
- **Function:** REST API, authentication, data, integrations, push registration, assemblies, publications, reports, etc.
- **Infrastructure:**
  - **Cloudflare:** DNS Only (Gray cloud)
  - **Railway:** Backend service.
- **Requirement:** This is the ONLY domain the mobile app must use for API calls.

### Mobile App (Expo / React Native)
- **Function:** Consumes the Backend API exclusively.
- **Requirement:** All axios/fetch calls must use `https://api.sinprfes.org.br`.

## 2. Canonical Repository Separation

The monorepo consists of three independent projects:
- `/backend` -> REST API
- `/site` -> Institutional web frontend
- `/mobile` -> React Native application

### Mandatory Rules:
1. Backend never depends on mobile.
2. Mobile never depends on site.
3. Site never depends on mobile.
4. Mobile and site consume the backend exclusively via `https://api.sinprfes.org.br`.

## 3. Infrastructure (Railway Services)
- **Backend Service:** mapped to `api.sinprfes.org.br`.
- **Site Service:** mapped to `sinprfes.org.br`.
