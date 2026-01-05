FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.js ./

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

USER node

EXPOSE 8080

CMD ["node", "index.js"]
