
# build the application
FROM node:14-bullseye-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
RUN npm run build

# final container
FROM node:14-bullseye-slim
WORKDIR /app

COPY --from=builder /app/build ./build
COPY package.json ./

RUN npm install --production

EXPOSE 3001
CMD [ "node", "./build/main/index.js" ]