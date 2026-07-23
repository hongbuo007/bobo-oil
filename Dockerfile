# ========== 构建阶段 ==========
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ========== 运行阶段 ==========
FROM node:22-alpine

# 安装编译 better-sqlite3 需要的工具
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

VOLUME ["/app/server/data"]

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
