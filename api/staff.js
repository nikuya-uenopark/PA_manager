// Vercel Serverless Function: GET /api/staff
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
  await addLog('staff:create', `新規スタッフ追加
名前：${name}
役職：${position || '-'}
生年月日：${birthText}`).catch(()=>{});
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
      const sid = Number(id);
      const result = await prisma.$transaction(async (tx) => {
        const before = await tx.staff.findUnique({ where: { id: sid }, select: { name: true, position: true } });
        if (!before) return { before: null, evals: 0 };
        // 関連評価を先に削除（外部キー制約回避）
        const delEval = await tx.evaluation.deleteMany({ where: { staffId: sid } });
        await tx.staff.delete({ where: { id: sid } });
        return { before, evals: delEval.count };
      });
      if (result.before) {
        await addLog('staff:delete', `スタッフ削除
ID：${id}
名前：${result.before.name}
役職：${result.before.position || '-'}
評価削除：${result.evals}件`).catch(()=>{});
      } else {
        await addLog('staff:delete', `スタッフ削除
ID：${id} (既に存在しない)`).catch(()=>{});
      }
      res.status(200).json({ message: 'スタッフを削除しました', deletedEvaluations: result.evals });
    } catch (error) {
      console.error('Staff DELETE error:', error);
      res.status(500).json({ error: 'スタッフの削除に失敗しました', detail: error.message });
    }
  } else {
    // スタッフ更新
    if (req.method === 'PUT') {
      try {
        const { id } = req.query || {};
        const { name, kana, position, birth_date, avatar_url, hire_date } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required' });
        const updated = await prisma.staff.update({
          where: { id: Number(id) },
          data: {
            name,
            kana: kana ?? undefined,
            position: position ?? undefined,
            joined: hire_date ? new Date(hire_date) : undefined,
            birthDate: birth_date ? new Date(birth_date) : undefined,
          },
          select: { id: true, name: true, position: true, birthDate: true }
        });
        const bd = updated.birthDate ? new Date(updated.birthDate) : null;
        const birthText = bd ? `${bd.getFullYear()}/${String(bd.getMonth()+1).padStart(2,'0')}/${String(bd.getDate()).padStart(2,'0')}` : '-';
  await addLog('staff:update', `スタッフ更新
ID：${updated.id}
名前：${updated.name}
役職：${updated.position || '-'}
生年月日：${birthText}`).catch(()=>{});
        res.status(200).json({ message: 'スタッフを更新しました' });
      } catch (error) {
        console.error('Staff PUT error:', error);
        res.status(500).json({ error: 'スタッフの更新に失敗しました', detail: error.message });
      }
    } else {
      res.status(405).json({ error: 'Method Not Allowed' });
    }
  }
};
