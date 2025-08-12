// Vercel Serverless Function: 評価一括更新 API
const prisma = require('./_prisma');
const { addLog } = require('./_log');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { changes, changedBy } = req.body || {};
    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: 'changes array is required' });
    }

    // 正規化とバリデーション
    const items = changes.map(c => ({
      staffId: Number(c.staffId),
      criteriaId: Number(c.criteriaId),
      status: (c.status === 'done' || c.status === 'learning' || c.status === 'not-started') ? c.status : 'not-started'
    })).filter(c => Number.isInteger(c.staffId) && Number.isInteger(c.criteriaId));

    if (items.length === 0) return res.status(400).json({ error: 'no valid changes' });

    // まとめて upsert 的に反映（updateMany では個別条件なので transaction で順次）
    await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const updated = await tx.evaluation.updateMany({
          where: { staffId: it.staffId, criteriaId: it.criteriaId },
          data: { status: it.status }
        });
        if (updated.count === 0) {
          await tx.evaluation.create({ data: { staffId: it.staffId, criteriaId: it.criteriaId, status: it.status } });
        }
        // comments(JSON文字列)に testedBy/testedAt を記録、またはクリア
        const target = (req.body.changes || []).find(c => Number(c.staffId) === it.staffId && Number(c.criteriaId) === it.criteriaId);
        if (target && target.test) {
          if (typeof target.test.testedBy === 'number') {
            const comments = JSON.stringify({ testedBy: Number(target.test.testedBy), testedAt: target.test.testedAt || new Date().toISOString() });
            await tx.evaluation.updateMany({ where: { staffId: it.staffId, criteriaId: it.criteriaId }, data: { comments } });
          } else if (target.test.clear === true) {
            await tx.evaluation.updateMany({ where: { staffId: it.staffId, criteriaId: it.criteriaId }, data: { comments: null } });
          }
        }
      }
    });

    // ログ1本に集約
    let changerName = '-';
    if (changedBy) {
      const changer = await prisma.staff.findUnique({ where: { id: Number(changedBy) }, select: { name: true } }).catch(()=>null);
      changerName = changer?.name || '-';
    }
    await addLog('evaluation:batch-update', `評価一括更新
変更者：${changerName}
件数：${items.length}`).catch(()=>{});

    return res.status(200).json({ message: 'batch updated', count: items.length });
  } catch (e) {
    console.error('evaluations-batch error', e);
    return res.status(500).json({ error: 'evaluations-batch failed', detail: e.message });
  }
}
