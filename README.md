# PA評価管理システム v3.x

新人教育 / スキル評価 / 進捗共有と簡易ミニゲーム (RPG) を統合したシングルページ Web アプリ。iPad 横向きでの現場利用を想定し、依存を最小限に抑え高速表示を重視しています。

## 全体概要

コア機能:
- スタッフ管理 (基本情報 + かな + 入社日等)
- 評価項目管理 (カテゴリ/説明/並び順編集、複数行説明 `<br>` 保存対応)
- 評価状態管理 (未着手 / 学習中 / 習得済み 3 ステート循環 + テスト実施者記録)
- 共有メモ (1 秒デバウンス自動保存 / 空文字も履歴)
- 操作/システムログ (最新 200 件ローテーション)
- 共通 XSS 対策サニタイズ
- ミニRPG (フィールド移動 + ランダムエンカウント + ボス挑戦 + 装備購入 + ランキング)

ゲーム関連追加点:
- 通常敵 5 種 (レベル帯/サーバ返却 key に応じスプライト切替)
- ボスは何度でも再挑戦可能 (撃破フラグ固定なし)
- 敗北ペナルティ: レベル半減 (下限1) + EXP リセット + 所持金半減 + 全装備ロスト (HP 全快で復帰)
- 装備購入: 武器 ATK 最大値反映 / 防具 HP 加算 (複数可) / 高位装備多数
- ゴールド DB 保存時は 32bit 整数上限でクリップ (メタJSONには実値)
- レベル必要 EXP は線形 + 二次係数 (緩やかな成長) 方式
- ボス討伐数ランキング, レベルランキングを共通ランキングセクションに表示

## 技術スタック

| Layer | 使用技術 |
|-------|----------|
| フロント | HTML / CSS / JS |
| サーバ | Vercel Serverless Functions |
| DB | PostgreSQL + Prisma ORM |
| UI 資産 | Inter / Font Awesome |
| 外部依存ライブラリ | なし |

## データモデル概要

| Model | 主なフィールド | 備考 |
|-------|----------------|------|
| Staff | id, name, kana, position, joined, birthDate, createdAt | joined/birthDate は Date |
| Criteria | id, name, description, category, sortOrder, createdAt | description は `<br>` 埋め込み保存許可 |
| Evaluation | id, staffId, criteriaId, status, comments(JSON), createdAt | status 3 値循環 / comments にテスト実施者情報 |
| Log | id, event, message, createdAt | 最新 200 保持 (古い順削除) |
| GameScore | game, staffId, value, extra, meta(JSON) | RPG: value=レベル, extra=クリップ済ゴールド, meta=完全状態 |


## サニタイズ

`api/_sanitize.js` の `sanitizeContent(raw, { allowBr })` を利用し以下を除去/制限:
- script / iframe / object / embed / svg / link / meta タグ除去
- `javascript:` スキーム禁止
- on* イベント属性除去
- `allowBr=true` のときのみ `<br>` 素通し

適用対象フィールド: staff.name/kana/position, criteria.name/description(allowBr), evaluation.status, shared-note 本文

## HTTP ステータス

| Code | 意味 |
|------|------|
| 200 | 正常 |
| 400 | バリデーション / パラメータ不足 |
| 405 | メソッド不許可 |
| 500 | サーバ内部エラー |

## API 一覧 (抜粋)

### スタッフ `/api/staff`
POST (新規) / PUT (更新 `?id`) / DELETE (削除 `?id`)

### 評価項目 `/api/criteria`
POST / PUT (並び替え or 単一更新) / DELETE

### 評価 `/api/evaluations`
GET 全件 / POST 新規 / PUT upsert / DELETE 単一

### 一括評価更新 `/api/evaluations-batch`
POST: status 正規化, comments テスト情報付与, clear 指定で削除

### 進捗集計 `/api/staff-progress`
GET `?staffId` 任意

### ログ `/api/logs`
POST 任意イベント追加 (200 件制限)

### 共有メモ `/api/shared-note`
POST 保存 (空文字も保存 / 15000 文字超 truncation)

### エクスポート `/api/export`
必要に応じ実装拡張前提 (現状プレースホルダ)

### ヘルスチェック `/api/health`
POST: `?action=debug-insert` で staff 1 行仮挿入

### RPG ゲーム API `/api/games/rpg`

メソッド:
- GET `?staffId=` : 現在状態 + ショップ + ボス設定取得
- POST 本体 `{ staffId, action, payload? }`

`action` 一覧:
| action | 内容 |
|--------|------|
| init | ショップ/ボス設定同期 (state は既存 meta から) |
| battle | 通常戦闘 (ランダム敵) |
| boss | ボス戦 (何度でも) |
| heal | 宿屋 (所持金 10% か最低 1G 消費, HP 全快) |
| equip | 装備購入 `{ type }` |
| pickup | フィールド宝箱開封 `{ x,y }` |
| save | 手動セーブ (メタの再保存) |

敗北時: レベル半減 (floor(level/2), 最低1), EXP 0, 所持金半減 (floor), 装備全消失, HP 全快。

### RPG ランキング API
| エンドポイント | 内容 |
|----------------|------|
| `/api/games/scores?game=rpg` | レベルランキング (GameScore.value DESC) |
| `/api/games/bossKills` | ボス討伐数ランキング (meta.bossKills DESC) |

フロント `index.html` 下部 game-rankings セクションに「RPG レベル」「RPG ボス討伐数」を表示。

## アセット

- タイルセット: "Dungeon Tileset II" by 0x72 (CC0 / Public Domain)
- URL: https://0x72.itch.io/dungeontileset-ii
