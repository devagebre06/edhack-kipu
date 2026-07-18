FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/* \
 && pip3 install --break-system-packages --no-cache-dir 'markitdown[pdf,pptx,xlsx]'
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm i tsx
COPY . .
ENV NODE_ENV=production
CMD ["npx", "tsx", "src/server.ts"]
