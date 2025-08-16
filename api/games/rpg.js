// CommonJS へ統一 & RPG 進行管理
const prisma = require("../_prisma");
const { addLog } = require("../_log");

// 簡易RPG進行 API
// POST { staffId, action, payload }
// action: init | battle | heal | boss | equip | save
// Game state is stored in GameScore.meta (JSON)

const BASE_HP = 30;
const BASE_ATK = 5;

function newState(name) {
  return {
    name,
    level: 1,
    exp: 0,
    gold: 0,
    hp: BASE_HP,
    maxHp: BASE_HP,
    atk: BASE_ATK,
    equips: [],
    bossDefeated: false,
    nextExp: levelNeeded(1),
    items: [
      { type: 'chest', x: 7, y: 3, opened: false, reward: { gold: 30, exp: 10 } },
      { type: 'chest', x: 10, y: 7, opened: false, reward: { gold: 50, exp: 0 } }
    ],
  };
}

function levelNeeded(lv) {
  return 20 + (lv - 1) * 15;
}
function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function recomputeDerived(state) {
  if (!state) return state;
  const equips = state.equips || [];
  // レベル由来の成長計算 + 装備ボーナス
  const levelBonusHp = (state.level - 1) * 6;
  const levelBonusAtk = (state.level - 1) * 2;
  const armorBonus = equips.includes("armor") ? 15 : 0;
  const swordBonus = equips.includes("sword") ? 5 : 0;
  state.maxHp = BASE_HP + levelBonusHp + armorBonus;
  state.atk = BASE_ATK + levelBonusAtk + swordBonus;
  if (state.hp > state.maxHp) state.hp = state.maxHp;
  state.nextExp = levelNeeded(state.level);
  return state;
}

function applyBattle(state, enemy) {
  // ターン制: 先手プレイヤー
  const log = [];
  while (state.hp > 0 && enemy.hp > 0) {
    enemy.hp -= state.atk;
    log.push(`あなたの攻撃! ${state.atk} ダメージ`);
    if (enemy.hp <= 0) break;
    state.hp -= enemy.atk;
    log.push(`敵の攻撃! ${enemy.atk} ダメージ`);
  }
  if (state.hp <= 0) {
    log.push("敗北... HPを全快して再挑戦しよう");
    state.hp = state.maxHp; // ペナルティ無し簡易版
    return { state, victory: false, log };
  }
  // 勝利
  const goldGain = enemy.gold || 5;
  const expGain = enemy.exp || 10;
  state.gold += goldGain;
  state.exp += expGain;
  log.push(`勝利! GOLD+${goldGain} EXP+${expGain}`);
  // レベルアップ判定
  while (state.exp >= levelNeeded(state.level)) {
    state.exp -= levelNeeded(state.level);
    state.level += 1;
    recomputeDerived(state); // レベルアップ毎に再計算
    state.hp = state.maxHp; // 全回復
    log.push(`レベルアップ! Lv${state.level}`);
  }
  recomputeDerived(state);
  return { state, victory: true, log };
}
module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { staffId } = req.query || {};
      if (!staffId) return res.status(400).json({ error: "staffId required" });
      const key = { game_staffId: { game: "rpg", staffId: Number(staffId) } };
      const record = await prisma.gameScore.findUnique({ where: key });
      const st = record?.meta ? recomputeDerived(record.meta) : null;
      return res.json({ state: st, record });
    }
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    const { staffId, action, payload } = req.body || {};
    if (!staffId || !action)
      return res.status(400).json({ error: "staffId & action required" });
    const staff = await prisma.staff.findUnique({
      where: { id: Number(staffId) },
    });
    if (!staff) return res.status(404).json({ error: "staff not found" });
    const key = { game_staffId: { game: "rpg", staffId: Number(staffId) } };
    let record = await prisma.gameScore.findUnique({ where: key });
    let state = record?.meta || null;
    if (!state) state = newState(staff.name);
    recomputeDerived(state); // 破損/旧データ対策

    let result = null;
    if (action === "init") {
      /* no change */
    } else if (action === "heal") {
      // 宿屋: 所持金の10% (端数切り捨て) を支払い HP全回復。最低1G必要。
      const cost = Math.floor(state.gold * 0.1);
      if (state.gold > 0 && cost >= 1 && state.gold >= cost) {
        state.gold -= cost;
        state.hp = state.maxHp;
        result = { msg: `宿屋で休んだ (-${cost}G)` };
      } else if (state.gold > 0 && cost === 0) {
        // 1G以上だが 10% が 0G になる極少資産 (1~9G)。その場合は全額1G扱い
        if (state.gold >= 1) {
          state.gold -= 1;
          state.hp = state.maxHp;
          result = { msg: "宿屋で休んだ (-1G)" };
        } else {
          result = { msg: "ゴールド不足" };
        }
      } else {
        result = { msg: "ゴールド不足" };
      }
    } else if (action === "battle") {
      // ランダム敵
      const enemy = {
        hp: randInt(12, 25),
        atk: randInt(3, 7),
        exp: randInt(8, 14),
        gold: randInt(6, 11),
      };
      result = applyBattle(state, enemy);
    } else if (action === "boss") {
      if (state.bossDefeated) {
        result = { msg: "既に討伐済み" };
      } else {
        const boss = { hp: 120, atk: 14, exp: 60, gold: 120 };
        const r = applyBattle(state, boss);
        if (r.victory) {
          state.bossDefeated = true;
        }
        result = r;
      }
  } else if (action === "equip") {
      const { type } = payload || {};
      if (type === "sword") {
        if (state.equips.includes("sword")) result = { msg: "既に剣所持" };
        else if (state.gold >= 50) {
          state.gold -= 50;
          state.equips.push("sword");
    recomputeDerived(state);
    result = { msg: "剣を購入 (+ATK5)" };
        } else result = { msg: "G不足(50G必要)" };
      } else if (type === "armor") {
        if (state.equips.includes("armor")) result = { msg: "既に防具所持" };
        else if (state.gold >= 50) {
          state.gold -= 50;
          state.equips.push("armor");
    recomputeDerived(state);
    state.hp = state.maxHp;
    result = { msg: "防具を購入 (+HP15)" };
        } else result = { msg: "G不足(50G必要)" };
      } else {
        result = { msg: "不明な装備" };
      }
    } else if (action === 'pickup') {
      const { x, y } = payload || {};
      if (typeof x === 'number' && typeof y === 'number') {
        const item = (state.items||[]).find(it=>it.type==='chest' && it.x===x && it.y===y);
        if (item) {
          if (item.opened) {
            result = { msg: '空の宝箱だ' };
          } else {
            item.opened = true;
            const rw = item.reward||{};
            if (rw.gold) state.gold += rw.gold;
            if (rw.exp) {
              state.exp += rw.exp;
              // レベルアップ判定再利用
              while (state.exp >= levelNeeded(state.level)) {
                state.exp -= levelNeeded(state.level);
                state.level += 1;
                recomputeDerived(state);
                state.hp = state.maxHp;
              }
            }
            result = { msg: `宝箱を開けた! +${rw.gold||0}G ${rw.exp?'+EXP'+rw.exp:''}` };
          }
        } else {
          result = { msg: '何もない' };
        }
      } else {
        result = { msg: '座標不正' };
      }
    } else if (action === "save") {
      /* explicit save only */
    } else {
      return res.status(400).json({ error: "unknown action" });
    }

    // 保存 (value=level, extra=gold)
    recomputeDerived(state);
    record = await prisma.gameScore.upsert({
      where: key,
      update: { value: state.level, extra: state.gold, meta: state },
      create: {
        game: "rpg",
        staffId: Number(staffId),
        value: state.level,
        extra: state.gold,
        meta: state,
      },
    });
    try { await addLog("rpg", `rpg action ${action} by staff#${staffId}`); } catch {}
    return res.json({ state, result, record });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
};
