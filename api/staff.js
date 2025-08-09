// Vercel Serverless Function: GET /api/staff
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

  if (req.method === 'GET') {
    // スタッフ一覧取得
    try {
      const result = await prisma.staff.findMany({
        orderBy: [
          { id: 'desc' }
        ]
      });
      res.status(200).json(result);
    } catch (error) {
      console.error('Staff GET error:', error);
      res.status(500).json({ error: 'Staff API failed', detail: error.message });
    }
  } else if (req.method === 'POST') {
    // スタッフ追加
    try {
      const { name, position, email, phone } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      const created = await prisma.staff.create({
        data: {
          name,
          position: position || null,
          email: email || null,
          phone: phone || null,
        },
        select: { id: true }
      });
      res.status(200).json({ id: created.id, message: 'スタッフが追加されました' });
    } catch (error) {
      console.error('Staff POST error:', error);
      res.status(500).json({ error: 'スタッフの追加に失敗しました', detail: error.message });
    }
  } else if (req.method === 'DELETE') {
    // スタッフ削除
    try {
      const { id } = req.query || {};
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }
      await prisma.staff.delete({ where: { id: Number(id) } });
      res.status(200).json({ message: 'スタッフが削除されました' });
    } catch (error) {
      console.error('Staff DELETE error:', error);
      res.status(500).json({ error: 'スタッフの削除に失敗しました', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
};
