# Prisma セットアップ（Neon + Vercel）

## 前提

- 環境変数 `DATABASE_URL` に Neon の接続文字列（?sslmode=require を含む）
- Node.js 22.x（package.json に記載）

## 初期化〜反映

```bash
# 依存インストール（既に done の場合は不要）
npm install

# Prisma Client 生成
npm run prisma:generate

# スキーマをDBへ反映（破壊的変更なし）
npm run prisma:push
```

## 動作確認

```bash
# staff の件数確認
node -e "(async()=>{const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log('staff count:',await p.staff.count());await p.$disconnect();})()"
```

## Vercel での注意

- Post-install で Prisma Client を自動生成（package.json の postinstall）
- Serverless では PrismaClient のシングルトン化（`api/_prisma.js`）
