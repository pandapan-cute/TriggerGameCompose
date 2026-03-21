# game_serverのデプロイ

## 参考

[AWS SAM での Cargo Lambda を使用した Rust Lambda 関数の構築](https://docs.aws.amazon.com/ja_jp/serverless-application-model/latest/developerguide/building-rust.html)

## 前提条件

* SAM CLIがインストールされていること

## デプロイ手順

1. ビルド

```bash
sam build --beta-features

# You can also enable this beta feature with "sam build --beta-features". [y/N]: y
```

2. デプロイ

```bash
sam deploy
```