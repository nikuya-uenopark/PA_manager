// Demo seed for Staff table
// Run with: node prisma/seed.js (Ensure DATABASE_URL is set)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const demoStaff = [
    { name: '山田 太郎', kana: 'ヤマダ タロウ', position: 'バイト', birthDate: new Date('2002-04-12'), mgmtCode: '101' },
    { name: '佐藤 花子', kana: 'サトウ ハナコ', position: 'バイト', birthDate: new Date('2003-07-03'), mgmtCode: '102' },
    { name: '鈴木 次郎', kana: 'スズキ ジロウ', position: '社員',  birthDate: new Date('1998-11-21'), mgmtCode: '103' },
    { name: '高橋 三奈', kana: 'タカハシ ミナ', position: '社員',  birthDate: new Date('1996-02-08'), mgmtCode: '201' },
    { name: '伊藤 健',   kana: 'イトウ ケン',   position: 'バイト', birthDate: new Date('2004-09-30'), mgmtCode: '202' },
    { name: '渡辺 玲奈', kana: 'ワタナベ レナ', position: 'バイト', birthDate: new Date('2001-01-15'), mgmtCode: '301' },
    { name: '小林 翔',   kana: 'コバヤシ ショウ', position: '社員', birthDate: new Date('1995-05-27'), mgmtCode: '302' },
    { name: '加藤 美咲', kana: 'カトウ ミサキ', position: 'バイト', birthDate: new Date('2004-12-02'), mgmtCode: '401' },
    { name: '吉田 大樹', kana: 'ヨシダ ダイキ', position: 'バイト', birthDate: new Date('2002-08-18'), mgmtCode: '402' },
    { name: '中村 彩',   kana: 'ナカムラ アヤ', position: '社員', birthDate: new Date('1997-03-09'), mgmtCode: '501' }
  ];

  for (const s of demoStaff) {
    await prisma.staff.upsert({
      where: { mgmtCode: s.mgmtCode },
      update: {},
      create: s
    });
  }
  console.log('Seed completed (staff).');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
