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
      // クライアント互換: { items: [{id, sortOrder}] } or { order: [{id, sort_order}] }
      const body = req.body || {};
      const items = Array.isArray(body.items)
        ? body.items.map((x, idx) => ({ id: x.id, index: Number.isInteger(x.sortOrder) ? x.sortOrder : idx }))
        : Array.isArray(body.order)
          ? body.order.map((x, idx) => ({ id: x.id, index: Number.isInteger(x.sort_order) ? x.sort_order - 1 : idx }))
          : null;

      if (items && Array.isArray(items) && items.length > 0) {
        // バリデーション: id が全て数値化できるか
        const invalid = items.find(it => isNaN(Number(it.id)));
        if (invalid) return res.status(400).json({ error: 'invalid id in payload' });

        // index を 0..N-1 に詰め直す（受信値に依存せず送信順を採用）
        const ordered = items.map((it, i) => ({ id: Number(it.id), sortOrder: i }));

        // まとめて更新（トランザクション）
        await prisma.$transaction(
          ordered.map(it => prisma.criteria.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } }))
        );

        return res.status(200).json({ message: '並び順が更新されました' });
      }

      // 単一更新（名前やカテゴリの更新など）
      const { id } = req.query || {};
      const { name, category, description } = body;
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
