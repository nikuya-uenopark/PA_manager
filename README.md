# PA評価管理システム v3.0 - プロフェッショナル版

横向きiPad最適化のモダンなスキル管理・評価システム

## ✨ 主な特徴

### 🎨 モダンなデザイン 
- **美しいグラデーション** - 洗練されたビジュアルデザイン
- **スムーズアニメーション** - 直感的な操作体験
- **レスポンシブレイアウト** - あらゆるデバイスに対応

### 📊 高度な機能
- **タブ切り替えシステム** - スタッフ管理・評価項目・分析を一元化
- **ドラッグ&ドロップ** - 評価項目の直感的並び替え
- **リアルタイム統計** - 進捗状況の可視化
- **評価ログ機能** - 変更履歴の完全記録
- **プロフィール管理** - 詳細なスタッフ情報

### 🚀 技術仕様
- **フロントエンド**: モダンHTML5, CSS3 Grid/Flexbox, ES6+ JavaScript
- **バックエンド**: Vercel Serverless Functions
- **データベース**: Neon PostgreSQL（クラウドネイティブ）
- **デザインシステム**: カスタムCSS変数、Inter フォント
- **外部ライブラリ**: Chart.js, Sortable.js, Font Awesome

## 🎯 主要機能

### スタッフ管理
- **プロフィール機能**: アバター、連絡先、入社日などの詳細情報
- **進捗可視化**: リアルタイムで更新される習得状況
- **統計表示**: 評価済み・習得済み・学習中項目数の一覧

### 評価項目管理
- **カテゴリー分類**: ホール・キッチン・レジ・共通など
- **ドラッグ&ドロップ**: 直感的な並び替え機能
- **自動並び替え**: カテゴリー順ワンクリック整理

### 分析・統計
- **チャート表示**: Chart.jsによる美しい進捗グラフ
- **パフォーマンス分析**: トップパフォーマー・改善点の可視化
- **履歴管理**: 評価変更の完全ログ

## 🛠 セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/nikuya-uenopark/PA_manager.git
cd PA_manager
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Neon PostgreSQL データベース作成

1. [Neon](https://neon.tech/) で無料アカウント作成
2. 新規プロジェクト作成
3. データベース接続文字列（DATABASE_URL）を取得

### 4. Vercel プロジェクト作成

1. [Vercel](https://vercel.com/) で新規プロジェクト作成
2. GitHubリポジトリを連携
3. 環境変数 `DATABASE_URL` に Neon の接続文字列を設定

### 5. データベース初期化

システムが自動的にテーブルを作成しますが、手動で作成する場合：

```sql
-- スタッフテーブル（拡張版）
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    joined DATE,
    avatar_url TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    hire_date DATE,
    birth_date DATE
);

-- 評価項目テーブル（拡張版）
CREATE TABLE IF NOT EXISTS criteria (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT '共通',
    sort_order INTEGER DEFAULT 0
);

-- 評価テーブル
CREATE TABLE IF NOT EXISTS evaluations (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
    criteria_id INTEGER REFERENCES criteria(id) ON DELETE CASCADE,
    score INTEGER,
    comment TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 評価ログテーブル（新機能）
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
```

### 6. デプロイ

```bash
# Vercelで自動デプロイ
vercel --prod
```

## 📱 使用方法

### 基本操作
1. **タブ切り替え**: 上部のタブで機能を切り替え
2. **スタッフ追加**: 「新規スタッフ追加」ボタンから登録
3. **評価項目追加**: 「項目追加」ボタンから新規作成
4. **並び替え**: 評価項目をドラッグ&ドロップで並び替え

### 推奨デバイス
- **デスクトップ**: Chrome, Safari, Firefox 最新版
- **タブレット**: 10インチ以上推奨

## 🎨 デザインシステム

### カラーパレット
- **プライマリー**: `#667eea` → `#764ba2` グラデーション
- **セカンダリー**: `#f093fb` アクセントカラー
- **成功**: `#00d4aa` 習得済み
- **警告**: `#ff9f43` 学習中
- **エラー**: `#ff6b6b` 要改善

### タイポグラフィー
- **メインフォント**: Inter (Google Fonts)
- **システムフォント**: SF Pro (iOS), Roboto (Android)

## 🚀 技術的特徴

### パフォーマンス最適化
- **遅延読み込み**: 必要な時のみデータ取得
- **キャッシュ戦略**: ブラウザキャッシュ活用
- **軽量化**: 最小限のライブラリ使用

### セキュリティ
- **SQL インジェクション対策**: パラメータ化クエリ
- **XSS 対策**: エスケープ処理
- **CSRF 対策**: SameSite Cookie

## 🔧 カスタマイズ

### テーマ変更
CSS変数を編集してカスタムテーマを作成：

```css
:root {
    --primary-color: #your-color;
    --secondary-color: #your-color;
    /* その他の変数... */
}
```

### 新機能追加
1. API エンドポイント追加: `/api/` フォルダ
2. フロントエンド機能: `script.js` に追加
3. スタイル: `style.css` に追加

## 🐛 トラブルシューティング

### よくある問題

**Q: データベース接続エラー**
A: Vercel の環境変数 `DATABASE_URL` を確認

**Q: モーダルが表示されない**
A: JavaScript エラーをブラウザコンソールで確認

**Q: ドラッグ&ドロップが動作しない**
A: Sortable.js の CDN 読み込みを確認

### デバッグモード
開発者ツールのコンソールでエラーログを確認できます。

## 📄 ライセンス

MIT License - 自由に使用、改変、配布が可能です。

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 新機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/nikuya-uenopark/PA_manager/issues)
- **Wiki**: 詳細なドキュメントは Wiki をご覧ください

---

**Built with ❤️ for modern teams**
