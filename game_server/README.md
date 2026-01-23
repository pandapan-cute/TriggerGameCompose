# game_server

## テスト

### Rustアプリケーションのテスト実行

```bash
cd game_server/rust_app
cargo test
```

## デプロイ

```bash
# SAM CLIを使ったビルド
sam build --beta-features
# SAM CLIを使ったデプロイ
sam deploy
```