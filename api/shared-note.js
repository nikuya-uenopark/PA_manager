// 新実装: ログテーブル依存を廃止し SharedNote 単一レコードを永続化
const prisma = require("./_prisma");
const { addLog } = require("./_log");
const { sanitizeContent } = require("./_sanitize");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    if (req.method === "GET") {
      const note = await prisma.sharedNote.findUnique({ where: { id: 1 } });
      return res.status(200).json({
        ops: note?.ops || "",
        comm: note?.comm || "",
        stoveDate: note?.stoveDate || null,
        stoveNumber: note?.stoveNumber || null,
        opsFont: note?.opsFont || null,
        commFont: note?.commFont || null,
        updatedAt: note?.updatedAt || null,
      });
    }
    if (req.method === "POST") {
      const { content, ops, comm, stoveDate, stoveNumber, opsFont, commFont } =
        req.body || {};
      const rawOps = (ops !== undefined ? ops : content) || "";
      const rawComm = comm || "";
      const clip = (s) =>
        s.length > 15000 ? s.slice(0, 15000) + "\n...[省略]" : s;
      const sanitizedOps = sanitizeContent(clip(String(rawOps)));
      const sanitizedComm = sanitizeContent(clip(String(rawComm)));
      const saved = await prisma.sharedNote.upsert({
        where: { id: 1 },
        update: {
          ops: sanitizedOps,
          comm: sanitizedComm,
          stoveDate: stoveDate || null,
          stoveNumber: stoveNumber || null,
          opsFont: opsFont || null,
          commFont: commFont || null,
        },
        create: {
          id: 1,
          ops: sanitizedOps,
          comm: sanitizedComm,
          stoveDate: stoveDate || null,
          stoveNumber: stoveNumber || null,
          opsFont: opsFont || null,
          commFont: commFont || null,
        },
        select: { updatedAt: true },
      });
      try {
        await addLog("shared-note", "メモ更新");
      } catch {}
      return res
        .status(200)
        .json({ message: "saved", updatedAt: saved.updatedAt });
    }
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("shared-note api error", e);
    return res
      .status(500)
      .json({ error: "shared-note failed", detail: e.message });
  }
};
