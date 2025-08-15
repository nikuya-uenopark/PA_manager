// GET /api/staff-progress
//   ?staffId=ID 単一スタッフ
//   ?summary=1  サマリ統計 (staffCount / criteriaCount / overallProgress など)
const prisma = require("./_prisma");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method Not Allowed" });

  // サマリーモード（元 stats.js を統合）
  if (
    req.query &&
    (req.query.summary === "1" || req.query.summary === "true")
  ) {
    try {
      const [staffCount, criteriaCount] = await Promise.all([
        prisma.staff.count(),
        prisma.criteria.count(),
      ]);
      // overallProgress: テスト完了割合 (tested / criteriaCount) の全スタッフ平均
      // staff-progress ロジックを簡易再利用
      const evals = await prisma.evaluation.findMany({
        select: { status: true, comments: true },
      });
      let tested = 0;
      if (criteriaCount > 0) {
        for (const e of evals) {
          if (e.comments) {
            try {
              const c = JSON.parse(e.comments);
              if (c && typeof c.testedBy === "number") tested++;
            } catch {}
          }
        }
      }
      const overallProgress =
        criteriaCount > 0 && staffCount > 0
          ? Math.round((tested / (criteriaCount * staffCount)) * 100)
          : 0;
      return res
        .status(200)
        .json({ staffCount, criteriaCount, overallProgress });
    } catch (e) {
      console.error("summary stats error", e);
      return res
        .status(500)
        .json({ error: "summary failed", detail: e.message });
    }
  }

  try {
    const { staffId } = req.query || {};
    const criteriaCount = await prisma.criteria.count();
    const baseWhere = staffId ? { staffId: Number(staffId) } : {};
    const evals = await prisma.evaluation.findMany({
      where: baseWhere,
      select: { staffId: true, status: true, comments: true },
    });

    // 集計
    const statusMap = new Map(); // staffId -> {done, learning, notStarted}
    const testedMap = new Map(); // staffId -> testedCount
    if (staffId) {
      statusMap.set(Number(staffId), { done: 0, learning: 0, notStarted: 0 });
      testedMap.set(Number(staffId), 0);
    }
    for (const e of evals) {
      if (!statusMap.has(e.staffId))
        statusMap.set(e.staffId, { done: 0, learning: 0, notStarted: 0 });
      if (!testedMap.has(e.staffId)) testedMap.set(e.staffId, 0);
      const s = statusMap.get(e.staffId);
      if (e.status === "done") s.done++;
      else if (e.status === "learning") s.learning++;
      else s.notStarted++;

      // comments(JSON) から tested をカウント
      if (e.comments) {
        try {
          const c = JSON.parse(e.comments);
          if (c && typeof c.testedBy === "number") {
            testedMap.set(e.staffId, (testedMap.get(e.staffId) || 0) + 1);
          }
        } catch {}
      }
    }
    // criteria があり、評価未作成分は未着手として数える（ステータス集計用）
    for (const [sid, agg] of statusMap.entries()) {
      const totalRecorded = agg.done + agg.learning + agg.notStarted;
      if (criteriaCount > totalRecorded) {
        agg.notStarted += criteriaCount - totalRecorded;
      }
    }
    // staffId未指定時、評価が全く無いスタッフも0カウントで返す
    if (!staffId) {
      const staffIds = (
        await prisma.staff.findMany({ select: { id: true } })
      ).map((s) => s.id);
      for (const id of staffIds) {
        if (!statusMap.has(id))
          statusMap.set(id, {
            done: 0,
            learning: 0,
            notStarted: criteriaCount,
          });
        if (!testedMap.has(id)) testedMap.set(id, 0);
      }
    }

    // レスポンス構築（progressPercent は tested / criteriaCount）
    const result = Array.from(statusMap.entries()).map(([sid, agg]) => {
      const tested = testedMap.get(sid) || 0;
      const total = criteriaCount; // 進捗%は常に評価項目総数を分母にする
      const progress = total > 0 ? Math.round((tested / total) * 100) : 0;
      return {
        staffId: sid,
        totalCriteria: criteriaCount,
        progressPercent: progress,
        counts: {
          done: agg.done,
          learning: agg.learning,
          notStarted: agg.notStarted,
        },
        // 将来的な利用のため tested を同梱（既存フロントは未使用）
        tested,
      };
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error("staff-progress error", e);
    return res
      .status(500)
      .json({ error: "staff-progress failed", detail: e.message });
  }
};
