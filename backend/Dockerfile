FROM node:20-bookworm

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json ./

RUN pnpm install --prod --no-frozen-lockfile
RUN pnpm exec playwright install --with-deps chromium
RUN pnpm store prune

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
