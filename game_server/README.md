# game_server

## 環境変数

[docker-compose](../docker-compose.yml)で環境変数を定義することで、
ローカル用のDynamoDB・WebSocketサーバーのURLを設定できます。

## テスト

### Rustアプリケーションのテスト実行

```bash
cd game_server/rust_app
cargo test
```

## デプロイ

```bash
cd game_server
# SAM CLIを使ったビルド
sam build --beta-features
# SAM CLIを使ったデプロイ
sam deploy
```
