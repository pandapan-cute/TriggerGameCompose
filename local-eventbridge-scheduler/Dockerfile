# syntax=docker/dockerfile:1
FROM golang:1.25-alpine AS build

WORKDIR /app

# 依存関係のダウンロード（キャッシュ効率化）
# COPY go.mod go.sum ./
# RUN go mod download

# ソースコードのコピーとビルド
COPY . .
RUN go build -o /bin/local-eventbridge-scheduler .

# マルチステージビルドで最終イメージを軽量化
FROM alpine:latest

# 必要に応じてCA証明書などをインストール
RUN apk --no-cache add ca-certificates

# ビルドステージから実行ファイルをコピー
COPY --from=build /bin/local-eventbridge-scheduler /bin/local-eventbridge-scheduler

EXPOSE 8081

ENTRYPOINT ["/bin/local-eventbridge-scheduler"]