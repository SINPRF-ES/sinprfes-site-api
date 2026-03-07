FROM node:20-bookworm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json ./
COPY scripts/check-root-deps.js ./scripts/check-root-deps.js

RUN pnpm install --prod --no-frozen-lockfile
RUN pnpm exec playwright install --with-deps chromium
RUN pnpm store prune

COPY . .

EXPOSE 8080

# Forçamos a variável de ambiente no runtime para garantir que o Playwright
# use o caminho canônico /ms-playwright, evitando que overrides externos
# quebrem a localização do executável do Chromium. Usamos 'exec' para
# que o Node.js receba corretamente os sinais de terminação (SIGTERM).
CMD ["sh", "-c", "export PLAYWRIGHT_BROWSERS_PATH=/ms-playwright && exec node server.js"]
