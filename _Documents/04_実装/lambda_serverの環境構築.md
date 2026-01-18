# Lambda関数のデプロイ

## 参考

[AWS SAM での Cargo Lambda を使用した Rust Lambda 関数の構築](https://docs.aws.amazon.com/ja_jp/serverless-application-model/latest/developerguide/building-rust.html)

## 環境構築手順

1. Rustの開発環境が構築されていること

    省略

2. Cargo Lambda のインストール

```bash
# npm経由でインストールするときに権限必要
sudo su
curl -fsSL https://cargo-lambda.info/install.sh | sh
```

3. AWS SAM CLI のインストール

以下を参考にインストール

[AWS SAM CLI のインストール](https://docs.aws.amazon.com/ja_jp/serverless-application-model/latest/developerguide/install-sam-cli.html)


4. SAMプロジェクトの作成

以下を参考に実行

[AWS SAM での Cargo Lambda を使用した Rust Lambda 関数の構築](https://docs.aws.amazon.com/ja_jp/serverless-application-model/latest/developerguide/building-rust.html)
