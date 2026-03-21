# Local WebSocket API Gateway

## 目的

ローカル環境でWebSocket API Gatewayの挙動を模倣するサーバーの実装とドキュメントです。

## 実行手順

```bash
# 依存関係を整理
go mod tidy

# ローカルで実行
go run main.go

# ビルド（実行ファイル作成）
go build -o websocket-gateway

# 実行
./websocket-gateway
```
