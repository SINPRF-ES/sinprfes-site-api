FROM node:20-bookworm

WORKDIR /app

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./

RUN npm install --package-lock-only \
    && npm ci --omit=dev \
    && npx playwright install --with-deps chromium \
    && npm cache clean --force

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
