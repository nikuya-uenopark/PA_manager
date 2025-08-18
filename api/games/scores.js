// CommonJS へ統一（他 API と同様）
const prisma = require("../_prisma");
const { addLog } = require("../_log");

// GET /api/games/scores?game=reaction|twenty|rpg
//  - reaction: 反応が速い(数値小)順
//  - twenty:   20秒との差分が小さい順 (abs(value))
//  - rpg:      レベル(value)高い順
module.exports = async function handler(req, res) {
  try {
    const { method } = req;
    if (method === "GET") {
      const { game } = req.query;
      if (!game) return res.status(400).json({ error: "game required" });
      let orderBy;
      if (game === "rpg") orderBy = { value: "desc" };
      else orderBy = { value: "asc" }; // 小さいほど良い
      const rows = await prisma.gameScore.findMany({
        where: { game },
        orderBy,
        take: 50,
        include: { staff: { select: { id: true, name: true } } },
      });
      return res.json(rows);
    }
    if (method === "POST") {
      const { game, staffId, value, extra, meta } = req.body || {};
      if (!game || !staffId)
        return res.status(400).json({ error: "game & staffId required" });
      // upsert: reaction/twenty はベスト更新時のみ。rpg は常に現在値(レベル/状態)。
      const existing = await prisma.gameScore.findUnique({
        where: { game_staffId: { game, staffId: Number(staffId) } },
      });
      let shouldUpdate = false;
      if (!existing) shouldUpdate = true;
      else if (game === "rpg") shouldUpdate = true; // 常に進行保存
      else if (typeof value === "number") {
        if (existing.value == null) shouldUpdate = true;
        else if (game === "reaction" || game === "twenty") {
          // どちらも小さい数値が良い
          if (value < existing.value) shouldUpdate = true;
        }
      }
      if (!shouldUpdate) return res.json({ ok: true, unchanged: true });
      const saved = await prisma.gameScore.upsert({
        where: { game_staffId: { game, staffId: Number(staffId) } },
        update: { value, extra, meta },
        create: { game, staffId: Number(staffId), value, extra, meta },
      });
      return res.json(saved);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
};
