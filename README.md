# TriggerGameCompose

## テスト方法

### websocketクライアントでの接続テスト

```bash
# (前提)websocatのインストール
npm install -g wscat

# WebSocketサーバーに接続
wscat -c ws://localhost:8080

# 接続後、対話的にメッセージを送信
{"action": "matchmaking", "player_id": "212df6af-6345-46a3-b7fe-d1d892ae0f2b"}
{"type": "ping"}
```

## Dockerコマンド

```bash
# Dockerコンテナの起動
docker compose up --build

# composeの停止と関連コンテナの削除
docker compose down
```