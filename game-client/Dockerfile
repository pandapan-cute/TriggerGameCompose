FROM node:20-alpine

WORKDIR /app

# package.json をコピー
COPY package.json package-lock.json* ./

# 依存関係をインストール
RUN npm install

# ソースコードをマウントポイントとして使用
VOLUME /app

# ポート公開
EXPOSE 3000

# 開発サーバー起動
CMD ["npm", "run", "dev"]