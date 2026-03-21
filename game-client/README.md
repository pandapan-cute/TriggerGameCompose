# Game Client

## ローカル実行方法

Docker composeを利用してローカル実行します。

詳細はプロジェクトルートのREADMEを参照してください。

## 環境変数

ローカル実行に使用する環境変数は[docker-compose](../docker-compose.yml)に記載されています。

デプロイ時に利用する環境変数はAWS Amplifyの環境変数に記載しています。

AWS Amplifyに環境変数NEXT_PUBLIC_WS_URLはWebsocketサーバーのURLを指定してください。
