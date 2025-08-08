# PA Manager セットアップガイド（Vercel + Neon/Postgres 版）

このアプリはVercel（サーバレス）+ Neon（Postgres）で無料運用できます。

## 必要なもの

- GitHubアカウント
- Vercelアカウント（https://vercel.com/）
- Neonアカウント（https://neon.tech/）

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/nikuya-uenopark/PA_manager.git
cd PA_manager
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. NeonでPostgresデータベース作成

1. Neonにサインアップし新規プロジェクト作成
2. 「Connection string（DATABASE_URL）」をコピー

### 4. Vercelで新規プロジェクト作成

1. VercelにGitHub連携し本リポジトリをインポート
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

## ローカル開発（任意）

1. `.env` ファイルを作成し、NeonのDATABASE_URLを記載
2. `npm run dev` でローカルサーバ起動

## よくある質問

- Q. HobbyプランでAPI数制限は？
	- A. 12個まで。API統合済みなので制限内です。
- Q. DBは無料？
	- A. NeonのFreeプランで十分運用可能です。

## トラブルシューティング

- デプロイ時に「No more than 12 Serverless Functions」エラー → APIファイル数を12個以下に統合済み
- DB接続エラー → Vercelの環境変数DATABASE_URLを再確認

## ライセンス
MIT
