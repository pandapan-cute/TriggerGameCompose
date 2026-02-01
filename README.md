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

## ツール

### VSCode拡張機能

* todo-tree

## タスクリスト

- [x] プレイヤーidとクライアントIDの保存機能実装
- [x] プレイヤーidからクライアントIDを取得する機能実装
- [x] ユニット管理にゲームidを追加
- [x] マッチIDとゲームIDってどちらも必要？？（triggergame-simulator）
        -> マッチIDをゲームIDに統一する方向で実装
- [x] マッチングに移行した段階でユニットの初期状態をテーブルに登録
  - [x] 現在装備しているトリガーも含めて取得する
- [ ] マッチング完了のレスポンスにユニット情報を含める
  - [x] 味方キャラのフロント情報作成と敵情報作成機能を入れる 
  - [x] ユニットがBAGWORMをそうびしている場合は不可視とする
- [ ] マッチング完了時にゲーム状態をリポジトリに登録する
- [ ] ターン内の操作をリクエストしたあとのシーケンスを作成
- [ ] ゲーム状態を保存するリポジトリを作成
- [ ] ゲーム内の操作をリクエストしたあとのシーケンスを実装