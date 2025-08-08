# PA Manager v2.1 - Vercel + Neon(Postgres)対応/iPad最適化

バイト・パートスタッフのスキル評価と進捗管理を行うWebアプリケーション（iPad最適化・Vercelサーバレス/Neon DB対応）

## 主な特徴

- iPad/タッチデバイス最適化UI
- スタッフ・評価項目・進捗の一元管理
- VercelサーバレスAPI + Neon(Postgres)でデータ永続化
- 無料枠でのクラウド運用が可能

## 技術構成

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **バックエンド**: Vercel Serverless Functions (Node.js)
- **データベース**: Neon (Postgres)
- **API設計**: RESTful (staff, criteria, evaluations, stats, export)

## セットアップ手順

### 1. リポジトリのクローン
```bash
git clone https://github.com/nikuya-uenopark/PA_manager.git
cd PA_manager
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. NeonでPostgresデータベース作成
1. https://neon.tech/ で無料アカウント作成
2. 新規プロジェクトでPostgres DBを作成
3. 「Connection string（DATABASE_URL）」をコピー

### 4. Vercelでプロジェクト作成・環境変数設定
1. https://vercel.com/ で新規プロジェクト作成
2. 「Environment Variables」に `DATABASE_URL` を追加し、Neonの接続文字列を貼り付け

### 5. データベーステーブル作成
NeonのSQLエディタで以下を実行：
```sql
CREATE TABLE IF NOT EXISTS staff (
   id SERIAL PRIMARY KEY,
   name VARCHAR(255) NOT NULL,
   position VARCHAR(255),
   joined DATE
);
CREATE TABLE IF NOT EXISTS criteria (
   id SERIAL PRIMARY KEY,
   name VARCHAR(255) NOT NULL,
   description TEXT
);
CREATE TABLE IF NOT EXISTS evaluations (
   id SERIAL PRIMARY KEY,
   staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
   criteria_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
   score INTEGER,
   comment TEXT,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Vercelでデプロイ
Vercelの「Deploy」ボタンで本番公開

## 使い方

1. **スタッフの追加**：「新規追加」ボタンからスタッフ登録
2. **評価項目の追加**：「項目追加」ボタンから評価項目登録
3. **評価の実施**：スタッフ詳細画面で各項目を評価
4. **進捗の確認**：進捗バー・統計タブで全体状況を把握

## よくある質問

- Q. HobbyプランでAPI数制限は？
   - A. 12個まで。API統合済みなので制限内です。
- Q. DBは無料？
   - A. NeonのFreeプランで十分運用可能です。

### Vercel
1. Vercelにリポジトリをインポート
2. ゼロ設定で自動デプロイ

## ライセンス

MIT License - 自由に使用、改変、配布が可能です。
