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
      const normalized = status || 'learning';
      const created = await prisma.evaluation.create({
        data: {
          staffId: Number(staff_id),
          criteriaId: Number(criteria_id),
          status: normalized,
        },
        select: { id: true }
      });
      // ログ（名前と日本語ラベルで）
      const [staff, crit] = await Promise.all([
        prisma.staff.findUnique({ where: { id: Number(staff_id) }, select: { name: true } }).catch(()=>null),
        prisma.criteria.findUnique({ where: { id: Number(criteria_id) }, select: { name: true } }).catch(()=>null)
      ]);
      const label = normalized === 'done' ? '習得済み' : normalized === 'learning' ? '学習中' : '未着手';
      await prisma.log.create({
        data: { event: 'evaluation:create', message: `評価作成 スタッフ:${staff?.name || staff_id} 項目:${crit?.name || criteria_id} 状態:${label}` }
      }).catch(()=>{});
      res.status(200).json({ id: created.id, message: '評価データが追加されました' });
    } else if (req.method === 'PUT') {
      const { staffId, criteriaId, status } = req.body || {};
      const sid = Number(staffId);
      const cid = Number(criteriaId);
      const result = await prisma.evaluation.updateMany({
        where: { staffId: sid, criteriaId: cid },
        data: { status }
      });
      if (result.count === 0) {
        // 存在しない場合は新規作成して保存を保証
        await prisma.evaluation.create({ data: { staffId: sid, criteriaId: cid, status: status || 'learning' } });
      }
      const [staff, crit] = await Promise.all([
        prisma.staff.findUnique({ where: { id: sid }, select: { name: true } }).catch(()=>null),
        prisma.criteria.findUnique({ where: { id: cid }, select: { name: true } }).catch(()=>null)
      ]);
      const label = status === 'done' ? '習得済み' : status === 'learning' ? '学習中' : '未着手';
      await prisma.log.create({
        data: { event: 'evaluation:update', message: `評価更新 スタッフ:${staff?.name || staffId} 項目:${crit?.name || criteriaId} 状態:${label}` }
      }).catch(()=>{});
      res.status(200).json({ message: '評価が更新されました' });
    } else if (req.method === 'DELETE') {
      const { id } = req.query || {};
      // 事前に情報取得
      const before = await prisma.evaluation.findUnique({ where: { id: Number(id) }, select: { staffId: true, criteriaId: true, status: true } }).catch(()=>null);
      await prisma.evaluation.delete({ where: { id: Number(id) } });
      if (before) {
        const [staff, crit] = await Promise.all([
          prisma.staff.findUnique({ where: { id: before.staffId }, select: { name: true } }).catch(()=>null),
          prisma.criteria.findUnique({ where: { id: before.criteriaId }, select: { name: true } }).catch(()=>null)
        ]);
        const label = before.status === 'done' ? '習得済み' : before.status === 'learning' ? '学習中' : '未着手';
        await prisma.log.create({
          data: { event: 'evaluation:delete', message: `評価削除 スタッフ:${staff?.name || before.staffId} 項目:${crit?.name || before.criteriaId} 状態:${label}` }
        }).catch(()=>{});
      } else {
        await prisma.log.create({ data: { event: 'evaluation:delete', message: `評価削除 id:${id}` } }).catch(()=>{});
      }
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
