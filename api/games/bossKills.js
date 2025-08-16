// Boss kill ranking endpoint
const prisma = require("../_prisma");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    const rows = await prisma.gameScore.findMany({
      where: { game: 'rpg' },
      select: { staffId: true, meta: true, staff: { select: { name: true, id: true } } },
    });
    const list = rows.map(r => ({
      staffId: r.staffId,
      name: r.staff?.name || '?',
      bossKills: typeof r.meta?.bossKills === 'number' ? r.meta.bossKills : 0,
    }));
    list.sort((a,b)=> b.bossKills - a.bossKills);
    return res.json(list.slice(0, 50));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};
