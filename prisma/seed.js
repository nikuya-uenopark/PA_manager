// Prisma seed script: initial staff mgmtCode entries
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staffSeeds = [
    { name: '山田 太郎', mgmtCode: '123' },
    { name: '佐藤 花子', mgmtCode: '124' },
    { name: '鈴木 次郎', mgmtCode: '125' },
    { name: '田中 美咲', mgmtCode: '130' },
    { name: '高橋 健', mgmtCode: '200' },
    { name: '伊藤 愛', mgmtCode: '345' },
    { name: '渡辺 翔', mgmtCode: '501' },
    { name: '中村 真', mgmtCode: '777' },
    { name: '小林 結衣', mgmtCode: '888' },
    { name: '加藤 陽菜', mgmtCode: '999' }
  ];
  for (const s of staffSeeds) {
    await prisma.staff.upsert({
      where: { mgmtCode: s.mgmtCode },
      update: { name: s.name },
      create: s
    });
  }
  console.log('Seed completed.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(()=> prisma.$disconnect());
