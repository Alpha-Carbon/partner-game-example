
# build the application
FROM node:14-bullseye-slim AS builder
WORKDIR /app
COPY package.json ./
# NOTE: clean npm cache if encountered issue
# RUN npm install && npm cache clean --force
RUN npm install --production
COPY . .
RUN npm run build

# final container
FROM node:14-bullseye-slim
WORKDIR /app

COPY --from=builder /app/build ./build
COPY banq_public.pem ./
COPY private.pem ./
COPY public.pem ./
COPY package.json ./

RUN npm install --production

EXPOSE 3001
CMD [ "node", "./build/main/index.js" ]