# WebSocketメッセージ定義書

## 目的
ゲーム内操作をWebSocketで送受信する際のメッセージ形式を定義する。

## 対象範囲
本書は、[20260202_game操作のリクエスト.md](_Documents/04_実装/フロント実装/20260202_game操作のリクエスト.md) に記載されているメッセージのみを対象とする。

## メッセージ一覧
| 種別 | `action` | 方向 | 概要 |
| --- | --- | --- | --- |
| ターン操作送信 | `turnActions` | Client → Server | 1ターン内の操作履歴を送信する |

---

## turnActions
### 概要
1ターン内の操作履歴を送信する。

### フィールド定義
| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `action` | string | 必須 | メッセージ種別。固定値: `turnActions` |
| `turnNumber` | number | 必須 | ターン番号 |
| `playerId` | string | 必須 | 操作主体のプレイヤーID |
| `gameId` | string | 必須 | ゲームID |
| `actionHistory` | ActionHistory[] | 必須 | ターン内の操作履歴 |
| `timestamp` | string | 必須 | メッセージ送信時刻（ISO 8601） |

### ActionHistory
| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `characterId` | string | 必須 | キャラクターID |
| `position` | Position | 必須 | 位置情報 |
| `mainAzimuth` | number | 必須 | メイン武器の方位角 |
| `subAzimuth` | number | 必須 | サブ武器の方位角 |
| `mainTrigger` | string | 必須 | メイン武器/トリガー種別 |
| `subTrigger` | string | 必須 | サブ武器/トリガー種別 |
| `timestamp` | string | 必須 | 操作時刻（ISO 8601） |

### Position
| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `col` | number | 必須 | 列 |
| `row` | number | 必須 | 行 |

### サンプル
```json
{
	"action": "turnActions",
	"turnNumber": 1,
	"playerId": "68046fc2-f60a-49fb-a987-83e8a731c5c9",
	"gameId": "4388a7db-fa32-4589-a289-9a92e38f67bf",
	"actionHistory": [
		{
			"characterId": "MIKUMO_OSAMU",
			"position": {
				"col": 4,
				"row": 33
			},
			"mainAzimuth": 0,
			"subAzimuth": 0,
			"mainTrigger": "ASTEROID",
			"subTrigger": "RAYGUST",
			"timestamp": "2026-02-02T06:46:34.240Z"
		}
	],
	"timestamp": "2026-02-02T06:46:53.032Z"
}
```
