// Vercel Serverless Function: 評価管理 API
const prisma = require('./_prisma');
const { addLog } = require('./_log');

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
        return res.status(200).json(result);
      }
      const result = await prisma.evaluation.findMany({ orderBy: [{ createdAt: 'desc' }] });
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { staff_id, criteria_id, status, changed_by } = req.body || {};
      const normalized = status || 'learning';
      const created = await prisma.evaluation.create({
        data: { staffId: Number(staff_id), criteriaId: Number(criteria_id), status: normalized },
        select: { id: true }
      });
      const [staff, crit, changer] = await Promise.all([
        prisma.staff.findUnique({ where: { id: Number(staff_id) }, select: { name: true } }).catch(()=>null),
        prisma.criteria.findUnique({ where: { id: Number(criteria_id) }, select: { name: true } }).catch(()=>null),
        changed_by ? prisma.staff.findUnique({ where: { id: Number(changed_by) }, select: { name: true } }).catch(()=>null) : Promise.resolve(null)
      ]);
      const label = normalized === 'done' ? '習得済み' : normalized === 'learning' ? '学習中' : '未着手';
      await addLog('evaluation:create', `評価作成
変更者：${changer?.name || '-'}
スタッフ：${staff?.name || staff_id}
項目：${crit?.name || criteria_id}
状態：${label}`).catch(()=>{});
      return res.status(200).json({ id: created.id, message: '評価データが追加されました' });
    }

    if (req.method === 'PUT') {
      const { staffId, criteriaId, status, changedBy } = req.body || {};
      const sid = Number(staffId);
      const cid = Number(criteriaId);
      const result = await prisma.evaluation.updateMany({ where: { staffId: sid, criteriaId: cid }, data: { status } });
      if (result.count === 0) {
        await prisma.evaluation.create({ data: { staffId: sid, criteriaId: cid, status: status || 'learning' } });
      }
      const [staff, crit, changer] = await Promise.all([
        prisma.staff.findUnique({ where: { id: sid }, select: { name: true } }).catch(()=>null),
        prisma.criteria.findUnique({ where: { id: cid }, select: { name: true } }).catch(()=>null),
        changedBy ? prisma.staff.findUnique({ where: { id: Number(changedBy) }, select: { name: true } }).catch(()=>null) : Promise.resolve(null)
      ]);
      const label = status === 'done' ? '習得済み' : status === 'learning' ? '学習中' : '未着手';
      await addLog('evaluation:update', `評価更新
変更者：${changer?.name || '-'}
スタッフ：${staff?.name || staffId}
項目：${crit?.name || criteriaId}
状態：${label}`).catch(()=>{});
      return res.status(200).json({ message: '評価が更新されました' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      const before = await prisma.evaluation.findUnique({ where: { id: Number(id) }, select: { staffId: true, criteriaId: true, status: true } }).catch(()=>null);
      await prisma.evaluation.delete({ where: { id: Number(id) } });
      if (before) {
        const [staff, crit] = await Promise.all([
          prisma.staff.findUnique({ where: { id: before.staffId }, select: { name: true } }).catch(()=>null),
          prisma.criteria.findUnique({ where: { id: before.criteriaId }, select: { name: true } }).catch(()=>null)
        ]);
        const label = before.status === 'done' ? '習得済み' : before.status === 'learning' ? '学習中' : '未着手';
        await addLog('evaluation:delete', `評価削除
スタッフ：${staff?.name || before.staffId}
項目：${crit?.name || before.criteriaId}
状態：${label}`).catch(()=>{});
      } else {
        await addLog('evaluation:delete', `評価削除
id：${id}`).catch(()=>{});
      }
      return res.status(200).json({ message: '評価データが削除されました' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Evaluations API error:', error);
    return res.status(500).json({ error: '評価API エラー', detail: error.message });
  }
}
