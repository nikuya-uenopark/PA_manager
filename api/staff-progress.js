// GET /api/staff-progress?staffId= or none for all
const prisma = require('./_prisma');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { staffId } = req.query || {};
    const criteriaCount = await prisma.criteria.count();
    const baseWhere = staffId ? { staffId: Number(staffId) } : {};
    const evals = await prisma.evaluation.findMany({ where: baseWhere, select: { staffId: true, status: true } });

    // 集計
    const map = new Map(); // staffId -> {done, learning, notStarted}
    if (staffId) {
      map.set(Number(staffId), { done: 0, learning: 0, notStarted: 0 });
    }
    for (const e of evals) {
      if (!map.has(e.staffId)) map.set(e.staffId, { done: 0, learning: 0, notStarted: 0 });
      const s = map.get(e.staffId);
      if (e.status === 'done') s.done++;
      else if (e.status === 'learning') s.learning++;
      else s.notStarted++;
    }
    // criteria があり、評価未作成分は未着手として数える
    for (const [sid, agg] of map.entries()) {
      const totalRecorded = agg.done + agg.learning + agg.notStarted;
      if (criteriaCount > totalRecorded) {
        agg.notStarted += (criteriaCount - totalRecorded);
      }
    }
    // staffId未指定時、評価が全く無いスタッフも0カウントで返す
    if (!staffId) {
      const staffIds = (await prisma.staff.findMany({ select: { id: true } })).map(s => s.id);
      for (const id of staffIds) {
        if (!map.has(id)) map.set(id, { done: 0, learning: 0, notStarted: criteriaCount });
      }
    }

    // レスポンス構築
    const result = Array.from(map.entries()).map(([sid, agg]) => {
      const total = Math.max(criteriaCount, agg.done + agg.learning + agg.notStarted);
      const progress = total > 0 ? Math.round((agg.done / total) * 100) : 0;
      return { staffId: sid, totalCriteria: criteriaCount, progressPercent: progress, counts: { done: agg.done, learning: agg.learning, notStarted: agg.notStarted } };
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error('staff-progress error', e);
    return res.status(500).json({ error: 'staff-progress failed', detail: e.message });
  }
}
