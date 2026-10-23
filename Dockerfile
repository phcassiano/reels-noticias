# Painel + bot do Telegram + render (Remotion/Chromium) numa imagem só.
FROM node:22.22.0-bookworm-slim

# Bibliotecas que o Chrome headless do Remotion precisa, mais fontes de sistema
# (as aspas do círculo usam uma fonte serifada do sistema).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates fonts-dejavu-core fonts-liberation \
    libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 \
    libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 \
    libpango-1.0-0 libcairo2 libcups2 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORTA=3000 \
    PASTA_DADOS=/dados

WORKDIR /app
RUN mkdir -p /dados && chown node:node /app /dados
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
# Baixa o Chrome headless na imagem para o primeiro render não depender de download.
RUN npx remotion browser ensure

VOLUME /dados
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORTA+'/saude').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "servidor/index.mjs"]
