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
  const { name, kana, position, birth_date, avatar_url, hire_date } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }
      const created = await prisma.staff.create({
        data: {
          name,
          kana: kana || null,
          position: position || null,
          joined: hire_date ? new Date(hire_date) : null,
          birthDate: birth_date ? new Date(birth_date) : null,
        },
        select: { id: true }
      });
      // ログ（YYYY/MM/DD にゼロ詰め）
      const birthText = (() => {
        if (!birth_date) return '-';
        const d = new Date(birth_date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}/${m}/${day}`;
      })();
      await prisma.log.create({
        data: {
          event: 'staff:create',
          message: `新規スタッフ追加 名前:${name} 役職:${position || '-'} 生年月日:${birthText}`
        }
      }).catch(()=>{});
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
      // 事前に取得しておき、ログに使う
      const before = await prisma.staff.findUnique({ where: { id: Number(id) }, select: { name: true, position: true } }).catch(()=>null);
      await prisma.staff.delete({ where: { id: Number(id) } });
      await prisma.log.create({
        data: { event: 'staff:delete', message: `スタッフ削除 ID:${id} 名前:${before?.name || '-'} 役職:${before?.position || '-'}` }
      }).catch(()=>{});
      res.status(200).json({ message: 'スタッフが削除されました' });
    } catch (error) {
      console.error('Staff DELETE error:', error);
      res.status(500).json({ error: 'スタッフの削除に失敗しました', detail: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
};
