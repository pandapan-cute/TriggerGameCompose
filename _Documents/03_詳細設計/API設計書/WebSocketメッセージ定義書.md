# WebSocketメッセージ定義書

## メッセージ

最新のメッセージ定義は以下を参照してください

- [asyncapi.yaml](./asyncapi.yaml): AsyncAPI 形式での定義。ドキュメント生成の元データ。

asyncapi.yamlはメッセージの更新があったら最新化してください

## AsyncAPI 生成コマンド

### HTML ドキュメント生成

プロジェクトルートで以下のコマンドを実行します

```bash
npx @asyncapi/cli generate fromTemplate \
    _Documents/03_詳細設計/API設計書/asyncapi.yaml \
    @asyncapi/html-template \
    --output _Documents/03_詳細設計/API設計書/asyncapi-html

# Need to install the following packages:
# @asyncapi/cli@6.0.0
# Ok to proceed? (y) y
```

### PDF 化（HTML から作成）

1. 生成された _Documents/03_詳細設計/API設計書/asyncapi-html/index.html をブラウザで開く
2. ブラウザの印刷機能で PDF 保存する

---
