# 開発環境セットアップガイド

## 前提条件

このアプリケーションを動作させるには以下が必要です：

### 1. Node.js のインストール
https://nodejs.org/ から最新のLTS版をダウンロードしてインストール

### 2. MySQL のインストール
- **Windows**: https://dev.mysql.com/downloads/mysql/
- **MySQL Community Server** をダウンロードしてインストール
- インストール時にrootパスワードを設定

### 3. 環境設定

#### .env ファイルの作成
```bash
# .env.example を .env にコピーして以下を設定
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_root_password
DB_NAME=pa_manager_db
PORT=3000
```

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. データベースの初期化
```bash
npm run setup-db
```

### 3. サーバー起動
```bash
# 開発モード（ファイル変更時に自動再起動）
npm run dev

# または通常モード
npm start
```

### 4. ブラウザでアクセス
`http://localhost:3000` でアプリケーションが起動します

## 無料クラウドでの運用

Node.jsとMySQLが必要なため、以下のクラウドサービスを推奨：

### Railway (推奨)
- GitHubと連携して自動デプロイ
- MySQL含めて無料枠あり
- 簡単セットアップ

### PlanetScale + Vercel
- PlanetScale: MySQL互換の無料データベース
- Vercel: Node.js アプリのホスティング

### Heroku + ClearDB
- Heroku: アプリケーションホスティング
- ClearDB: MySQL アドオン（無料枠あり）

## iPadでの利用

1. アプリケーションをクラウドにデプロイ
2. iPad Safari でURLにアクセス
3. 共有ボタン → ホーム画面に追加
4. PWAとしてネイティブアプリのように使用

## トラブルシューティング

### MySQLエラー
- MySQLサービスが起動しているか確認
- .envファイルの設定を確認
- パスワードが正しいか確認

### ポートエラー
- 他のアプリケーションが3000番ポートを使用していないか確認
- .envでPORTを変更可能
