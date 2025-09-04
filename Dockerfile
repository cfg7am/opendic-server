FROM node:18-alpine

ENV NODE_ENV=production
ENV PORT=32756
ENV CORS_ORIGIN=*

RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 먼저 package files만 복사하여 dependency 설치
COPY package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

# 나머지 애플리케이션 파일들 복사
COPY server.js ./
COPY worker.js ./
COPY models/ ./models/
COPY services/ ./services/
COPY scripts/ ./scripts/

RUN mkdir -p logs && \
    chown -R node:node /app

USER node

EXPOSE 32756

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:32756/health || exit 1

CMD ["node", "server.js"]