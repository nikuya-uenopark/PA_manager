// Vercel Serverless Function: GET/POST/DELETE /api/criteria
const prisma = require('./_prisma');

// データベース初期化（テーブル拡張）
async function initializeDatabase() {
  // Prismaでは migrate/db push 側で管理する想定。ここでは何もしない。
  return;
}

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // 初回アクセス時にデータベース初期化
    await initializeDatabase();
    
    if (req.method === 'GET') {
      try {
        const result = await prisma.criteria.findMany({
          orderBy: [
            { sortOrder: 'asc' },
            { id: 'asc' }
          ]
        });
        res.status(200).json(result ?? []);
      } catch (error) {
        console.error('Criteria GET error:', error);
        res.status(500).json({ error: 'Criteria API failed', detail: error.message });
      }
    } else if (req.method === 'POST') {
      const { name, category, description } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      const last = await prisma.criteria.aggregate({ _max: { sortOrder: true } });
      const nextOrder = (last._max.sortOrder ?? -1) + 1;
      const created = await prisma.criteria.create({
        data: {
          name,
          category: category || '共通',
          description: description || null,
          sortOrder: nextOrder,
        },
        select: { id: true }
      });
      res.status(200).json({ id: created.id, message: '評価項目が追加されました' });
    } else if (req.method === 'PUT') {
      const { items } = req.body || {};
      if (items && Array.isArray(items)) {
        try {
          // 並び替えを順次更新
          for (let i = 0; i < items.length; i++) {
            await prisma.criteria.update({
              where: { id: Number(items[i].id) },
              data: { sortOrder: i }
            });
          }
        } catch (error) {
          throw error;
        }
        res.status(200).json({ message: '並び順が更新されました' });
      } else {
        const { id } = req.query || {};
        const { name, category, description } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required' });
        await prisma.criteria.update({
          where: { id: Number(id) },
          data: {
            name,
            category: category || '共通',
            description: description || null,
          }
        });
        res.status(200).json({ message: '評価項目が更新されました' });
      }
    } else if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      await prisma.criteria.delete({ where: { id: Number(id) } });
      res.status(200).json({ message: '評価項目が削除されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
    
  } catch (error) {
    console.error('Criteria API error:', error);
    res.status(500).json({ 
      error: '評価項目API エラー', 
      detail: error.message 
    });
  }
};
