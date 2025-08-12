// Common log helper with cap at 200 entries
const prisma = require('./_prisma');

/**
 * Append a log entry and keep only the most recent 200 logs.
 * Uses a transaction: create, then prune extras (skip 200 by newest order).
 * @param {string} event
 * @param {string} message
 * @returns {Promise<{id:number}>}
 */
async function addLog(event, message) {
  // 空メッセージは通常弾くが shared-note の場合のみ許容（内容消去も履歴化したい）
  if (!event) return null;
  if ((message === undefined || message === null) || (message === '' && event !== 'shared-note')) return null;
  return prisma.$transaction(async (tx) => {
    const created = await tx.log.create({ data: { event, message }, select: { id: true } });
    // Find logs beyond the newest 200 and delete them in bulk
    const extras = await tx.log.findMany({
      orderBy: { createdAt: 'desc' },
      skip: 200,
      take: 1000,
      select: { id: true },
    });
    if (extras.length) {
      await tx.log.deleteMany({ where: { id: { in: extras.map(x => x.id) } } });
    }
    return created;
  });
}

module.exports = { addLog };
