# ── Build stage ──────────────────────────────────────────
FROM docker.io/library/node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY index.html vite.config.ts tsconfig.json ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

# ── Runtime stage ────────────────────────────────────────
FROM docker.io/library/node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./
COPY --from=build /app/dist ./dist/

EXPOSE 3001

CMD ["node", "server.js"]
