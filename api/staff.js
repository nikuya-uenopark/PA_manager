// Vercel Serverless Function: GET /api/staff
const prisma = require("./_prisma");
const { addLog } = require("./_log");
const { sanitizeContent } = require("./_sanitize");

module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    // スタッフ一覧取得
    try {
      let result;
      try {
        result = await prisma.staff.findMany({
          orderBy: [{ id: "desc" }],
          select: {
            id: true,
            name: true,
            kana: true,
            position: true,
            joined: true,
            birthDate: true,
            createdAt: true,
            mgmtCode: true,
          },
        });
      } catch (e) {
        // mgmtCode フィールド未生成 (古い DB) 時はフォールバック
        if (String(e.message || "").includes("mgmtCode")) {
          result = await prisma.staff.findMany({
            orderBy: [{ id: "desc" }],
            select: {
              id: true,
              name: true,
              kana: true,
              position: true,
              joined: true,
              birthDate: true,
              createdAt: true,
            },
          });
        } else throw e;
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("Staff GET error:", error);
      res
        .status(500)
        .json({ error: "Staff API failed", detail: error.message });
    }
  } else if (req.method === "POST") {
    // スタッフ追加
    try {
      let {
        name,
        kana,
        position,
        birth_date,
        avatar_url,
        hire_date,
        mgmtCode,
      } = req.body || {};
      // mgmtCode: '' または null -> null / それ以外はサニタイズし 3-5桁チェック
      if (mgmtCode === "" || mgmtCode === null || mgmtCode === undefined) {
        mgmtCode = null;
      } else {
        mgmtCode = sanitizeContent(String(mgmtCode));
      }
      name = sanitizeContent(name);
      kana = kana ? sanitizeContent(kana) : null;
      position = position ? sanitizeContent(position) : null;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      // mgmtCode が指定されている場合は 4 桁数字のみ (重複許容)
      if (mgmtCode && !/^\d{4}$/.test(mgmtCode)) {
        return res
          .status(400)
          .json({ error: "mgmtCode は4桁の数字で入力してください" });
      }
      const created = await prisma.staff.create({
        data: {
          name,
          kana: kana || null,
          position: position || null,
          joined: hire_date ? new Date(hire_date) : null,
          birthDate: birth_date ? new Date(birth_date) : null,
          mgmtCode: mgmtCode || null,
        },
        select: { id: true },
      });
      // ログ（YYYY/MM/DD にゼロ詰め）
      const birthText = (() => {
        if (!birth_date) return "-";
        const d = new Date(birth_date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}/${m}/${day}`;
      })();
      await addLog(
        "staff:create",
        `新規スタッフ追加
名前：${name}
役職：${position || "-"}
生年月日：${birthText}`
      ).catch(() => {});
      res
        .status(200)
        .json({ id: created.id, message: "スタッフが追加されました" });
    } catch (error) {
      console.error("Staff POST error:", error);
      res
        .status(500)
        .json({ error: "スタッフの追加に失敗しました", detail: error.message });
    }
  } else if (req.method === "DELETE") {
    // スタッフ削除
    try {
      const { id } = req.query || {};
      if (!id) {
        return res.status(400).json({ error: "id is required" });
      }
      const sid = Number(id);
      const result = await prisma.$transaction(async (tx) => {
        const before = await tx.staff.findUnique({
          where: { id: sid },
          select: { name: true, position: true },
        });
        if (!before) return { before: null, evals: 0, gameScores: 0 };
        // 関連評価を先に削除（外部キー制約回避）
        const delEval = await tx.evaluation.deleteMany({
          where: { staffId: sid },
        });
        // ゲームスコア(RPG等)削除
        const delGame = await tx.gameScore.deleteMany({
          where: { staffId: sid },
        });
        await tx.staff.delete({ where: { id: sid } });
        return { before, evals: delEval.count, gameScores: delGame.count };
      });
      if (result.before) {
        await addLog(
          "staff:delete",
          `スタッフ削除
ID：${id}
名前：${result.before.name}
役職：${result.before.position || "-"}
評価削除：${result.evals}件
ゲームデータ削除：${result.gameScores}件`
        ).catch(() => {});
      } else {
        await addLog(
          "staff:delete",
          `スタッフ削除
ID：${id} (既に存在しない)`
        ).catch(() => {});
      }
      res.status(200).json({
        message: "スタッフを削除しました",
        deletedEvaluations: result.evals,
        deletedGameScores: result.gameScores,
      });
    } catch (error) {
      console.error("Staff DELETE error:", error);
      res
        .status(500)
        .json({ error: "スタッフの削除に失敗しました", detail: error.message });
    }
  } else {
    // スタッフ更新
    if (req.method === "PUT") {
      try {
        const { id } = req.query || {};
        let {
          name,
          kana,
          position,
          birth_date,
          avatar_url,
          hire_date,
          mgmtCode,
        } = req.body || {};
        let mgmtCodeProvided = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "mgmtCode"
        );
        if (mgmtCodeProvided) {
          if (mgmtCode === "" || mgmtCode === null) {
            mgmtCode = null; // 明示的にクリア
          } else if (mgmtCode !== undefined) {
            mgmtCode = sanitizeContent(String(mgmtCode));
          }
        } else {
          mgmtCode = undefined; // 変更なし
        }
        name = sanitizeContent(name);
        kana = kana ? sanitizeContent(kana) : undefined;
        position = position ? sanitizeContent(position) : undefined;
        if (!id) return res.status(400).json({ error: "id is required" });
        if (
          mgmtCode !== undefined &&
          mgmtCode !== null &&
          mgmtCode !== "" &&
          !/^\d{4}$/.test(mgmtCode)
        ) {
          return res
            .status(400)
            .json({ error: "mgmtCode は4桁の数字で入力してください" });
        }
        const updated = await prisma.staff.update({
          where: { id: Number(id) },
          data: {
            name,
            kana: kana ?? undefined,
            position: position ?? undefined,
            joined: hire_date ? new Date(hire_date) : undefined,
            birthDate: birth_date ? new Date(birth_date) : undefined,
            mgmtCode: mgmtCodeProvided ? mgmtCode : undefined,
          },
          select: {
            id: true,
            name: true,
            position: true,
            birthDate: true,
            mgmtCode: true,
          },
        });
        const bd = updated.birthDate ? new Date(updated.birthDate) : null;
        const birthText = bd
          ? `${bd.getFullYear()}/${String(bd.getMonth() + 1).padStart(
              2,
              "0"
            )}/${String(bd.getDate()).padStart(2, "0")}`
          : "-";
        await addLog(
          "staff:update",
          `スタッフ更新
ID：${updated.id}
名前：${updated.name}
役職：${updated.position || "-"}
生年月日：${birthText}
管理番号：${updated.mgmtCode || "-"}
`
        ).catch(() => {});
        res.status(200).json({ message: "スタッフを更新しました" });
      } catch (error) {
        console.error("Staff PUT error:", error);
        res.status(500).json({
          error: "スタッフの更新に失敗しました",
          detail: error.message,
        });
      }
    } else {
      res.status(405).json({ error: "Method Not Allowed" });
    }
  }
};
