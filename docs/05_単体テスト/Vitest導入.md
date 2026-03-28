# Vitest導入

このドキュメントは、`game-client` へ Vitest を導入する最小手順をまとめたものです。

## 1. 追加するnpmパッケージ

### 導入済みのパッケージ

`game-client` 配下で以下を実行する。

```bash
cd game-client
npm i -D vitest vite vite-tsconfig-paths
```

### 今後追加するかもなパッケージ

- カバレッジを取りたい場合

```bash
npm i -D @vitest/coverage-v8
```

- DOMテストを行う場合（Reactコンポーネントの描画テストなど）

```bash
npm i -D jsdom @testing-library/react @testing-library/jest-dom
```

## 2. 最小設定

### 2-1. `package.json` の scripts 追加

`game-client/package.json` の `scripts` に以下を追加する。

```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        // "test:coverage": "vitest run --coverage"
    }
}
```

### 2-2. `vitest.config.ts` 作成

`game-client/vitest.config.ts` を作成する。

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: "node",
        globals: true,
    },
});
```

補足:

- `@/` エイリアスを使うために `vite-tsconfig-paths` を有効化している。
- Reactコンポーネントを描画テストする場合は `environment: "jsdom"` に変更する。

## 3. テストファイルのフォルダ配置ルール

**実装ファイルの近くに `__tests__` を置く**

推奨例:
`game-client/game-logics/phaser/scenes/services/__tests__/FieldViewService.test.ts`

命名ルール:

- `*.test.ts` または `*.spec.ts`
- コンポーネントテストは `*.test.tsx`

## 4. テスト実行方法

`game-client` 配下で実行する。

```bash
# 全テストを1回実行
npm run test

# 変更監視で実行
npm run test:watch
```

ファイルを絞って実行したい場合:

```bash
npx vitest run game-logics/phaser/scenes/services/__tests__/FieldViewService.test.ts
```

## 5. 運用上の注意

- private メソッドを直接テストしたい場合は、短期的には `as any` 経由で呼び出せる。
- 長期的には pure 関数に切り出して export し、公開APIとしてテストするほうが保守しやすいとのこと。

## その他

変更があった場合はフロントエンドの[Readme](../../game-client/README.md)のテストセクションも更新してください
