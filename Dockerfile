# ========== 构建阶段 ==========
FROM node:22-alpine AS builder

WORKDIR /app

# 前端构建
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ========== 运行阶段 ==========
FROM node:22-alpine

WORKDIR /app

# 复制后端
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/

# 复制前端构建产物
COPY --from=builder /app/dist ./dist

# 数据持久化目录
VOLUME ["/app/server/data"]

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
