// Vercel Serverless Function: 評価管理 API
const prisma = require('./_prisma');

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
    if (req.method === 'GET') {
      const { staffId } = req.query;
      if (staffId) {
        const result = await prisma.evaluation.findMany({
          where: { staffId: Number(staffId) },
          include: { criteria: true },
          orderBy: [
            { criteria: { category: 'asc' } },
            { criteria: { name: 'asc' } }
          ]
        });
        res.status(200).json(result);
      } else {
        const result = await prisma.evaluation.findMany({
          orderBy: [{ createdAt: 'desc' }]
        });
        res.status(200).json(result);
      }
    } else if (req.method === 'POST') {
      const { staff_id, criteria_id, status } = req.body || {};
      const created = await prisma.evaluation.create({
        data: {
          staffId: Number(staff_id),
          criteriaId: Number(criteria_id),
          status: status || 'learning',
        },
        select: { id: true }
      });
      res.status(200).json({ id: created.id, message: '評価データが追加されました' });
    } else if (req.method === 'PUT') {
      const { staffId, criteriaId, status } = req.body || {};
      await prisma.evaluation.updateMany({
        where: { staffId: Number(staffId), criteriaId: Number(criteriaId) },
        data: { status }
      });
      res.status(200).json({ message: '評価が更新されました' });
    } else if (req.method === 'DELETE') {
      const { id } = req.query || {};
      await prisma.evaluation.delete({ where: { id: Number(id) } });
      res.status(200).json({ message: '評価データが削除されました' });
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error('Evaluations API error:', error);
    res.status(500).json({ 
      error: '評価API エラー', 
      detail: error.message 
    });
  }
}
