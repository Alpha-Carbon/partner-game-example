
# build the application
FROM node:14-bullseye-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# final container
FROM node:14-bullseye-slim
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public.pem .
COPY --from=builder /app/private.pem .

EXPOSE 3001
CMD [ "node", "./build/main/index.js" ]


