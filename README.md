# PA評価管理システム v3.x

新人教育 / スキル評価 / 進捗共有を 1 画面で扱える軽量 Web アプリ。iPad 横向き最適化・サーバレス・最小依存で高速表示。

## 特徴

- タブ: 共有メモ / スタッフ / 評価項目 / ログ
- 評価モーダル: ローカル反映 → 閉じる時に一括保存
- 評価項目説明: 行頭 "- " 自動付与し `<br>` 化
- 共有メモ: 1 秒デバウンス自動保存 (空文字も履歴)
- ログ: 最新 200 件ローテーション / 複数行表示
- セキュリティ: 共通サニタイズ

## 技術スタック

- フロント: Vanilla JS / HTML / CSS
- サーバ: Vercel Functions (Node.js)
- ORM / DB: Prisma + PostgreSQL
- フォント: Inter / Font Awesome
- 外部ライブラリ: なし

## データモデル

| Model | 主なフィールド | 備考 |
|-------|----------------|------|
| Staff | id, name, kana, position, joined, birthDate, createdAt | joined/birthDate は Date |
| Criteria | id, name, description, category, sortOrder, createdAt | category 既定 '共通'; description は `<br>` 保存可 |
| Evaluation | id, staffId, criteriaId, status, score?, comments?, createdAt | status: not-started / learning / done; comments JSON({testedBy, testedAt}) |
| Log | id, event, message, createdAt | 最新 200 件保持 |

`comments` JSON 例:

```json
{
    "testedBy": 12,
    "testedAt": "2025-08-12T05:18:40.000Z"
}
```

## 🔐 サニタイズ方針

`api/_sanitize.js` の `sanitizeContent(raw, { allowBr })` を利用。

- script / iframe / object / embed / svg / link / meta タグ除去
- `javascript:` スキーム除去
- on* イベント属性除去
- `allowBr=true` の場合のみ `<br>` を素通し (他はエスケープ)
- 適用対象: staff.name/kana/position, criteria.name/description(allowBr), evaluation.status, shared-note 本文

| HTTP | 意味 |
|------|------|
| 200  | 成功 |
| 400  | バリデーションエラー / パラメータ不足 |
| 405  | メソッド不許可 |
| 500  | サーバ内部エラー |

---

### 1. スタッフ API `/api/staff`

| Method | 用途           | パラメータ       | Body 例                                                                 | 戻り値 |
|--------|----------------|------------------|-------------------------------------------------------------------------|--------|
| POST   | 新規追加       | なし             | `{ "name":"山田", "kana":"ヤマダ", "position":"社員", "birth_date":"2001-04-24" }` | `{ id, message }` |
| PUT    | 更新           | `?id=number`     | 上記と同形式 (未指定は変更なし)                                         | `{ message }` |
| DELETE | 削除           | `?id=number`     | -                                                                       | `{ message, deletedEvaluations }` |

ログイベント: `staff:create`, `staff:update`, `staff:delete`

---

### 2. 評価項目 API `/api/criteria`

| Method | 用途                    | パラメータ        | Body                                                                                                                 | 備考 |
|--------|-------------------------|-------------------|----------------------------------------------------------------------------------------------------------------------|------|
| POST   | 追加                    | なし              | `{ "name":"レジ操作", "category":"ホール", "description":"- ログイン<br>- 会計" }`                             | name 必須。category は {共通/ホール/キッチン/その他} 以外は共通 |
| PUT    | 並び替え or 単一更新    | `?id` (単一時)    | 並び替え: `{ "items": [{"id":3,"sortOrder":0}, ...] }` または `{ "order": [{"id":3,"sort_order":1}, ...] }` / 単一更新: `{ "name":..., "category":..., "description":... }` | 並び替えは配列順を採用 |
| DELETE | 削除                    | `?id=number`      | -                                                                                                                    | - |

ログイベント: `criteria:create`, `criteria:update`, `criteria:delete`, `criteria:reorder`

---

### 3. 評価 API `/api/evaluations`

| Method | 用途                   | パラメータ            | Body                                                                                       | 備考 |
|--------|------------------------|-----------------------|--------------------------------------------------------------------------------------------|------|
| GET    | 全評価 (降順)          | なし                  | -                                                                                          | 一覧用途 |
| POST   | 新規作成               | なし                  | `{ "staff_id":1, "criteria_id":5, "status":"learning", "changed_by":2 }`             | status 省略時 `learning` |
| PUT    | 更新 (無ければ作成)    | なし                  | `{ "staffId":1, "criteriaId":5, "status":"done", "changedBy":2 }`                  | upsert 動作 |
| DELETE | 単一削除               | `?id=number`          | -                                                                                          | - |

ステータス値: `not-started` / `learning` / `done` (UI 表示: 未着手 / 学習中 / 習得済み)

ログイベント: `evaluation:create`, `evaluation:update`, `evaluation:delete`

---

### 4. 評価一括更新 API `/api/evaluations-batch`

| Method | 用途                                   | Body 例 |
|--------|----------------------------------------|---------|

動作: `status` 不正値→ `not-started` に正規化。`test.testedBy` (数値) で comments JSON `{ testedBy, testedAt }` 保存。`test.clear=true` で削除。

レスポンス例: `{ "message":"batch updated", "count":12 }`

ログイベント: `evaluation:batch-update` (メッセージ書式: `評価更新\n変更者：<名前>\nスタッフ：<複数>\n件数：N\n項目：<criteria一覧>`)

---

### 5. スタッフ進捗集計 API `/api/staff-progress`

| モード   | パラメータ       | 戻り値例 |
|----------|------------------|----------|
| 個別一覧 | `?staffId` 任意  | `[ { staffId, totalCriteria, progressPercent, counts:{done,learning,notStarted}, tested } ]` |

`progressPercent = (tested / totalCriteria) * 100` (丸め)

---

### 6. ログ API `/api/logs`

| Method | 用途         | パラメータ                | Body 例                            | 備考 |
|--------|--------------|---------------------------|------------------------------------|------|
| POST   | 任意ログ追加 | なし                      | `{ "event":"custom", "message":"内容" }` | 追加後 200 件に prune |

`addLog()` 仕様: 空 message は shared-note のみ許容。トランザクションで古い順削除。

---

### 7. 共有メモ API `/api/shared-note`

| Method | 用途       | Body 例                 | 備考 |
|--------|------------|-------------------------|------|
| POST   | 保存       | `{ "content":"文字列" }` | 15000 文字超は末尾 `...[省略]` 付与。空文字も保存 |

ログイベント: `shared-note` (本文先頭行に "メモ更新")

---

### 8. エクスポート API `/api/export`

| Method | 用途            | 備考 |
|--------|-----------------|------|

---

### 9. ヘルスチェック `/api/health`

| Method | 用途            | 備考 |
|--------|-----------------|------|
| POST   | デバッグ挿入     | `?action=debug-insert` で staff 1 行追加 |

---

### 10. 内部ユーティリティ

- `_log.js`: `addLog(event, message)` 追加 & 200件制限
- `_sanitize.js`: サニタイズ共通関数

## 🧪 ステータス遷移

`not-started` → (クリック) → `learning` → (クリック) → `done` → (クリック) → `not-started`

テスト完了は status を変えず `comments` のみ付帯管理。

## 📞 サポート

Issuesへ
