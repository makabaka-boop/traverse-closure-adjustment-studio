# --- 构建阶段：安装依赖并产出纯静态文件（构建后运行期无需网络） ---
FROM node:20-alpine AS build
WORKDIR /app

# 优先复制依赖清单，尽量利用层缓存
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

# --- 运行阶段：仅用 nginx 托管静态产物 ---
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
