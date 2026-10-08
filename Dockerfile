FROM node:22-alpine
WORKDIR /app
COPY package.json index.html favicon.svg ./
COPY src ./src
COPY scripts ./scripts
COPY server ./server
COPY licenses ./licenses
COPY DATA_SOURCES.md README.md ./
RUN node scripts/build.mjs
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/serve.mjs"]
