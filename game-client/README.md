# Game Client

## ローカル実行方法

Docker composeを利用してローカル実行します。

詳細はプロジェクトルートのREADMEを参照してください。

## 環境変数

ローカル実行に使用する環境変数は[docker-compose](../docker-compose.yml)に記載されています。

デプロイ時に利用する環境変数はAWS Amplifyの環境変数に記載しています。

AWS Amplifyに環境変数NEXT_PUBLIC_WS_URLはWebsocketサーバーのURLを指定してください。

## テスト

コミット前に以下のコマンドでエラーが発生しないことを確認してください。

```bash
# テストの実行
npm run test
# lintの実行
npm run lint
# ビルドの実行
npm run build
```

### Vitest

ユニットテストにはVitestを使用しています。

ユニットテストの詳細については[Vitest導入](../docs/05_単体テスト/Vitest導入.md)を参照してください。

```bash
# テストの実行
npm run test
```

### Storybook

Storybookはコンポーネントの描画テストやドキュメントとして利用します。

```bash
# Storybookの起動
npm run storybook
```

#### 参考

- [Next.js + ViteでのStorybook導入](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite/?renderer=react)

## カラー

| カラー | 役割 |
| --- | --- |
| `blue-400` | 味方キャラクターを示す |
| `red-400` | 敵キャラクターを示す |
| `lime-400` | 動きの設定モードを示す |
| `orange-400` | ユニット行動モードを示す |
| `0xff6b6b` | メイントリガーを示す |
| `0x6b6bff` | サブトリガーを示す |
| `#FF9900` | アクションポイントを示す |
