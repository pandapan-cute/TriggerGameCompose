# local-dynamodb-initialize

## 目的

ローカル環境でDynamoDBを初期化するためのツールとドキュメントです。
DynammoDBのローカル版はdocker compose内で `amazon/dynamodb-local:latest` のイメージを使用しています。
データベースの初期化の目的で `local-dynamodb-initialize` をdocker composeで動かしています。

## 注意点

[game_server](../game_server/template.yaml)の

## ライブラリのインストール

```bash
# ライブラリのインストール(例: AWS SDK v2)
go get github.com/aws/aws-sdk-go-v2

# 依存関係を整理・最新化したいとき
go mod tidy
```
