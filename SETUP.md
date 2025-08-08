# PA評価管理システム v3.0 - 完全セットアップガイド

横向きiPad最適化のプロフェッショナルなスキル管理システムです。

## 🎯 システム概要

このシステムは以下の技術スタックで構築されています：

- **フロントエンド**: モダンHTML5, CSS3, ES6+ JavaScript
- **バックエンド**: Vercel Serverless Functions
- **データベース**: Neon PostgreSQL
- **デザイン**: iPad横向き最適化、レスポンシブデザイン

## 🔧 事前準備

以下のアカウントを事前に作成してください：

1. **GitHub アカウント** - ソースコード管理
2. **Vercel アカウント** - ホスティング
3. **Neon アカウント** - データベース

## 📋 セットアップ手順

### ステップ 1: ソースコード取得

```bash
# リポジトリをクローン
git clone https://github.com/nikuya-uenopark/PA_manager.git
cd PA_manager

# 依存パッケージをインストール
npm install
```

### ステップ 2: データベースセットアップ

#### 2-1. Neon でプロジェクト作成

1. [Neon Console](https://console.neon.tech/) にアクセス
2. 「New Project」をクリック
3. プロジェクト名: `pa-manager`
4. リージョン: `Asia Pacific (Tokyo)` 推奨
5. 「Create Project」をクリック

#### 2-2. データベース接続情報取得

1. プロジェクトダッシュボードで「Connection Details」を確認
2. 「Connection string」をコピー
3. 形式: `postgresql://user:password@host/database?sslmode=require`

#### 2-3. テーブル作成

Neon の SQL Editor で以下を実行：

```sql
-- スタッフテーブル（プロフィール機能付き）
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    joined DATE DEFAULT CURRENT_DATE,
    avatar_url TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    hire_date DATE,
    birth_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 評価項目テーブル（カテゴリー・並び順機能付き）
CREATE TABLE IF NOT EXISTS criteria (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT '共通',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 評価テーブル
CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    criteria_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
    score INTEGER,
    status VARCHAR(50) DEFAULT '未評価',
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 評価ログテーブル（変更履歴記録）
CREATE TABLE IF NOT EXISTS evaluation_logs (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    criteria_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
    old_score INTEGER,
    new_score INTEGER,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    comment TEXT,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_evaluations_staff_id ON evaluations(staff_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_criteria_id ON evaluations(criteria_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_logs_staff_id ON evaluation_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_criteria_sort_order ON criteria(sort_order);
```

### ステップ 3: Vercel デプロイ設定

#### 3-1. Vercel プロジェクト作成

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. 「New Project」をクリック
3. GitHub リポジトリを選択
4. 「Import」をクリック

#### 3-2. 環境変数設定

1. プロジェクト設定画面で「Environment Variables」を選択
2. 以下の環境変数を追加：

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `DATABASE_URL` | Neonの接続文字列 | PostgreSQL接続情報 |

#### 3-3. デプロイ実行

```bash
# Vercel CLI でデプロイ（オプション）
npx vercel --prod
```

または Vercel Dashboard の「Deploy」ボタンをクリック

### ステップ 4: 動作確認

#### 4-1. 基本動作テスト

1. デプロイしたURLにアクセス
2. ローディング画面が表示されることを確認
3. タブが正常に切り替わることを確認

#### 4-2. データベース接続テスト

1. ブラウザの開発者ツールを開く
2. Network タブで API 通信を確認
3. エラーがないことを確認

## 🎨 カスタマイズ設定

### テーマカラー変更

`public/style.css` の CSS変数を編集：

```css
:root {
    --primary-color: #667eea;    /* メインカラー */
    --secondary-color: #f093fb;  /* アクセントカラー */
    --success-color: #00d4aa;    /* 成功カラー */
    --warning-color: #ff9f43;    /* 警告カラー */
    --danger-color: #ff6b6b;     /* エラーカラー */
}
```

### ロゴ・ブランディング変更

1. `public/index.html` のタイトル部分を編集
2. ファビコン画像を `public/` フォルダに配置
3. マニフェストファイル更新

## 🚀 運用設定

### パフォーマンス最適化

#### データベース最適化

```sql
-- 統計情報更新（定期実行推奨）
ANALYZE staff;
ANALYZE criteria;
ANALYZE evaluations;
ANALYZE evaluation_logs;
```

#### CDN設定

Vercel は自動でCDNを設定しますが、以下の最適化が可能：

1. 画像ファイルの圧縮
2. JavaScript の最小化
3. CSS の最小化

### セキュリティ設定

#### 環境変数の管理

- 本番環境では必ずSSL接続を使用
- データベースパスワードは強力なものを設定
- 定期的にアクセスログを確認

#### バックアップ設定

Neon の自動バックアップ機能を有効化：

1. Neon Console でプロジェクトを選択
2. 「Settings」→「Backup」
3. 自動バックアップを有効化

## 🔍 トラブルシューティング

### よくある問題と解決方法

#### 問題: データベース接続エラー

**症状**: `Error: connect ECONNREFUSED`

**解決方法**:
1. `DATABASE_URL` の設定を確認
2. Neon データベースが起動していることを確認
3. ネットワーク接続を確認

#### 問題: JavaScriptエラー

**症状**: ボタンが動作しない、モーダルが表示されない

**解決方法**:
1. ブラウザのコンソールでエラーを確認
2. CDN ライブラリの読み込み状態を確認
3. キャッシュをクリア

#### 問題: レイアウト崩れ

**症状**: iPad で表示が崩れる

**解決方法**:
1. ビューポート設定を確認
2. CSS Grid/Flexbox の対応状況確認
3. ブラウザキャッシュをクリア

### ログ確認方法

#### Vercel Functions ログ

1. Vercel Dashboard でプロジェクトを選択
2. 「Functions」タブを選択
3. 各 API のログを確認

#### ブラウザコンソールログ

```javascript
// デバッグ情報を表示
console.log('PA Manager Debug Mode');
localStorage.setItem('debug', 'true');
```

## 📊 監視・メンテナンス

### パフォーマンス監視

1. **Vercel Analytics** - ページビュー、パフォーマンス
2. **Neon Metrics** - データベースパフォーマンス
3. **ブラウザ開発者ツール** - フロントエンド性能

### 定期メンテナンス

#### 月次作業

- [ ] データベース容量確認
- [ ] パフォーマンスログ確認
- [ ] セキュリティアップデート確認

#### 四半期作業

- [ ] フルバックアップ作成
- [ ] ライブラリアップデート
- [ ] ユーザビリティ改善検討

## 🆘 サポート

### 技術サポート

- **GitHub Issues**: [問題報告・機能要求](https://github.com/nikuya-uenopark/PA_manager/issues)
- **Wiki**: [詳細ドキュメント](https://github.com/nikuya-uenopark/PA_manager/wiki)

### コミュニティ

- **Discussions**: 使い方の質問・情報交換
- **Pull Requests**: 機能追加・バグ修正の貢献

---

**🎉 セットアップ完了！**

これでプロフェッショナルなスキル管理システムの運用を開始できます。
