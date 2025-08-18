// CommonJS へ統一 & RPG 進行管理
const prisma = require("../_prisma");
const { addLog } = require("../_log");
const CFG = require("./rpgConfig");

// 簡易RPG進行 API
// POST { staffId, action, payload }
// action: init | battle | heal | boss | equip | save
// Game state is stored in GameScore.meta (JSON)

const BASE_HP = 30;
const BASE_ATK = 5;
const INT32_MAX = 2147483647; // Postgres Int 上限 (2^31-1)

// 初期配置アイテム (不変) - 新規 state 作成ごとにディープコピー
const INITIAL_ITEMS = Object.freeze([
  { type: "chest", x: 7, y: 3, opened: false, reward: { gold: 30, exp: 10 } },
  { type: "chest", x: 10, y: 7, opened: false, reward: { gold: 50, exp: 0 } },
]);

/**
 * 新規プレイヤー state 生成
 * @param {string} name スタッフ名
 * @param {object} [opts]
 * @param {number} [opts.level=1] 初期レベル (将来チュートリアルスキップ等で利用)
 * @param {number} [opts.gold=0] 初期所持金
 */
function newState(name, opts = {}) {
  const level = opts.level ?? 1;
  const gold = opts.gold ?? 0;
  return {
    name,
    level,
    exp: 0,
    gold,
    hp: BASE_HP,
    maxHp: BASE_HP,
    atk: BASE_ATK,
    equips: [],
    // bossDefeated はレガシーデータ互換のため後段の互換処理で付与する (ここでは持たない)
    bossKills: 0, // 連続/累計討伐数
    nextExp: levelNeeded(level),
    // アイテムはコピー (凍結定数を破壊しない)
    items: INITIAL_ITEMS.map((it) => ({ ...it, reward: { ...it.reward } })),
  };
}

function levelNeeded(lv) {
  const S = CFG.LEVEL_SCALING || {
    HP_PER: 6,
    ATK_PER: 2,
    EXP_BASE: 20,
    EXP_PER_LV: 15,
    EXP_QUAD: 0,
  };
  return (
    S.EXP_BASE +
    (lv - 1) * S.EXP_PER_LV +
    Math.floor(lv * lv * (S.EXP_QUAD || 0))
  );
}
function randInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function recomputeDerived(state) {
  if (!state) return state;
  const equips = state.equips || [];
  // レベル由来の成長計算 + 装備ボーナス
  const S = CFG.LEVEL_SCALING || { HP_PER: 6, ATK_PER: 2 };
  const levelBonusHp = (state.level - 1) * (S.HP_PER || 6);
  const levelBonusAtk = (state.level - 1) * (S.ATK_PER || 2);
  // 防具HPボーナス: SHOP_ITEMS の hp プロパティ合算 (巨大数値も反映) ※以前の固定+15/+30を廃止
  let armorBonus = 0;
  const shopItems = CFG.SHOP_ITEMS || {};
  for (const eq of equips) {
    const it = shopItems[eq];
    if (it && typeof it.hp === "number") armorBonus += it.hp;
  }
  // 武器は複数所持しても最大値のみ反映 (CFG.WEAPON_BONUS)
  const weaponBonusTable = CFG.WEAPON_BONUS;
  let weaponBonus = 0;
  for (const w of Object.keys(weaponBonusTable)) {
    if (equips.includes(w))
      weaponBonus = Math.max(weaponBonus, weaponBonusTable[w]);
  }
  state.maxHp = BASE_HP + levelBonusHp + armorBonus;
  state.atk = BASE_ATK + levelBonusAtk + weaponBonus;
  if (state.hp > state.maxHp) state.hp = state.maxHp;
  state.nextExp = levelNeeded(state.level);
  return state;
}

// ボス設定フォールバック: rpgConfig が編集中で一時的に BOSS / BOSS_SPRITE_KEY が欠落しても 500 を出さない
function getBossConfig() {
  const raw = CFG.BOSS || {};
  return {
    level: typeof raw.level === "number" ? raw.level : 1,
    hp: typeof raw.hp === "number" ? raw.hp : 50,
    atk: typeof raw.atk === "number" ? raw.atk : 5,
    exp: typeof raw.exp === "number" ? raw.exp : 20,
    gold: typeof raw.gold === "number" ? raw.gold : 30,
    name: CFG.BOSS_NAME || "??ボス??",
    spriteKey: CFG.BOSS_SPRITE_KEY || "big_demon",
  };
}

function applyBattle(state, enemy) {
  // ターン制: 先手プレイヤー。イベント列を生成してフロントでアニメ再生可能にする
  const log = [];
  const events = []; // {type:'player'|'enemy', dmg, enemyHp, playerHp}
  while (state.hp > 0 && enemy.hp > 0) {
    // プレイヤー攻撃
    enemy.hp -= state.atk;
    log.push(`あなたの攻撃! ${state.atk} ダメージ`);
    events.push({
      type: "player",
      dmg: state.atk,
      enemyHp: Math.max(0, enemy.hp),
      playerHp: state.hp,
    });
    if (enemy.hp <= 0) break;
    // 敵攻撃
    state.hp -= enemy.atk;
    log.push(`敵の攻撃! ${enemy.atk} ダメージ`);
    events.push({
      type: "enemy",
      dmg: enemy.atk,
      enemyHp: Math.max(0, enemy.hp),
      playerHp: Math.max(0, state.hp),
    });
  }
  if (state.hp <= 0) {
    const prevLevel = state.level;
    const newLevel = Math.max(1, Math.floor(state.level / 2));
    if (newLevel < prevLevel) {
      state.level = newLevel;
      state.exp = 0; // シンプル: レベルダウン時に経験値はリセット (必要なら残存割合方式に変更可)
      recomputeDerived(state);
    }
    // 敗北ペナルティ: ゴールド半減 (切り捨て) & 装備全ロスト
  const prevGold = state.gold;
  // 残すのは floor(prevGold/2) (半減後残額) / 失うのは prevGold - newGold
  const newGold = Math.floor(prevGold / 2);
  const lostGold = prevGold - newGold;
  state.gold = newGold;
    const lostEquips = [...state.equips];
    state.equips = [];
    recomputeDerived(state); // 装備リセット後再計算
    state.hp = state.maxHp; // 蘇生 (HPのみ全快)
    log.push(
      `敗北... Lv${prevLevel}→Lv${state.level} 所持金-${lostGold}G 装備${lostEquips.length}個ロスト (HP全快)`
    );
    const defeat = {
      stateHpAfter: state.hp,
      enemyHpAfter: enemy.hp,
      levelBefore: prevLevel,
      levelAfter: state.level,
      levelLost: prevLevel - state.level,
      goldBefore: prevGold,
      goldLost: lostGold,
      equipsLost: lostEquips,
    };
    return { state, victory: false, log, events, defeat };
  }
  // 勝利処理
  const goldGain = enemy.gold || 5;
  const expGain = enemy.exp || 10;
  state.gold += goldGain;
  state.exp += expGain;
  log.push(`勝利! GOLD+${goldGain} EXP+${expGain}`);
  const levelUps = [];
  while (state.exp >= levelNeeded(state.level)) {
    state.exp -= levelNeeded(state.level);
    state.level += 1;
    recomputeDerived(state);
    state.hp = state.maxHp;
    levelUps.push(state.level);
    log.push(`レベルアップ! Lv${state.level}`);
  }
  recomputeDerived(state);
  return {
    state,
    victory: true,
    log,
    events,
    reward: { goldGain, expGain, levelUps },
  };
}
module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { staffId } = req.query || {};
      if (!staffId) return res.status(400).json({ error: "staffId required" });
      const key = { game_staffId: { game: "rpg", staffId: Number(staffId) } };
      const record = await prisma.gameScore.findUnique({ where: key });
      let st = record?.meta || null;
      // 互換: 旧データで bossDefeated 未設定なら false 付与
      if (st && typeof st.bossDefeated !== "boolean") st.bossDefeated = false;
      if (st && typeof st.bossKills !== "number") st.bossKills = 0;
      st = st ? recomputeDerived(st) : null;
      return res.json({
        state: st,
        record,
        shop: CFG.SHOP_ITEMS,
        boss: getBossConfig(),
      });
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
    // 互換: bossDefeated が未定義なら false に固定
    if (state && typeof state.bossDefeated !== "boolean")
      state.bossDefeated = false;
    if (state && typeof state.bossKills !== "number") state.bossKills = 0;
    recomputeDerived(state); // 破損/旧データ対策

    let result = null;
    if (action === "init") {
      // 初期化時にショップ & ボス設定を返してフロント同期
      result = {
        shop: CFG.SHOP_ITEMS,
        boss: getBossConfig(),
      };
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
      // プレイヤー±10 で敵レベル決定し、敵種はコンフィグ ENEMIES からランダム
      const enemyDefs = CFG.ENEMIES || [];
      const chosen = enemyDefs.length
        ? enemyDefs[Math.floor(Math.random() * enemyDefs.length)]
        : { key: "chort", name: "インプ" };
      const enemyLevel = Math.max(1, state.level + randInt(-10, 10));
      const variance = () => Math.random() * 0.2 + 0.9; // 0.9 - 1.1
      const baseHp = Math.round((18 + enemyLevel * 5) * variance());
      const baseAtk = Math.round((3 + enemyLevel * 1.2) * variance());
      const baseExp = Math.round((5 + enemyLevel * 4) * variance());
      const baseGold = Math.round((4 + enemyLevel * 3) * variance());
      const enemy = {
        key: chosen.key,
        name: chosen.name,
        level: enemyLevel,
        maxHp: baseHp,
        hp: baseHp,
        atk: baseAtk,
        exp: baseExp,
        gold: baseGold,
      };
      const battle = applyBattle(state, { ...enemy });
      result = { ...battle, enemy };
    } else if (action === "boss") {
      // 常に挑戦可能 (勝ってもフラグ固定せず繰り返し OK)
      const bc = getBossConfig();
      const boss = {
        hp: bc.hp,
        atk: bc.atk,
        exp: bc.exp,
        gold: bc.gold,
        level: bc.level,
        name: bc.name,
        key: bc.spriteKey,
      };
      try {
        const r = applyBattle(state, { ...boss });
        if (r.victory) {
          if (typeof state.bossKills !== "number") state.bossKills = 0;
          state.bossKills += 1;
        }
        result = { ...r, enemy: boss };
      } catch (e) {
        console.error("boss battle error", e);
        return res.status(500).json({ error: "boss battle failed" });
      }
    } else if (action === "equip") {
      const { type } = payload || {};
      const shopItems = CFG.SHOP_ITEMS;
      if (!shopItems[type]) {
        result = { msg: "不明な装備" };
      } else if (state.equips.includes(type)) {
        result = { msg: "既に所持" };
      } else if (state.gold < shopItems[type].cost) {
        result = { msg: `G不足(${shopItems[type].cost}G必要)` };
      } else {
        state.gold -= shopItems[type].cost;
        state.equips.push(type);
        recomputeDerived(state); // 装備の HP/ATK ボーナス反映
        if (shopItems[type].hp) state.hp = state.maxHp; // HP増加装備購入時は全回復
        result = { msg: shopItems[type].msg };
      }
    } else if (action === "pickup") {
      const { x, y } = payload || {};
      if (typeof x === "number" && typeof y === "number") {
        const item = (state.items || []).find(
          (it) => it.type === "chest" && it.x === x && it.y === y
        );
        if (item) {
          if (item.opened) {
            result = { msg: "空の宝箱だ", goldGain: 0, expGain: 0 };
          } else {
            item.opened = true;
            const rw = item.reward || {};
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
            result = {
              msg: `宝箱を開けた! +${rw.gold || 0}G ${
                rw.exp ? "+EXP" + rw.exp : ""
              }`,
              goldGain: rw.gold || 0,
              expGain: rw.exp || 0,
            };
          }
        } else {
          result = { msg: "何もない", goldGain: 0, expGain: 0 };
        }
      } else {
        result = { msg: "座標不正", goldGain: 0, expGain: 0 };
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
      // extra フィールドは Prisma Int (32bit) のため GOLD が上限超過するとエラー -> クリップ
      update: {
        value: state.level,
        extra: Math.min(state.gold, INT32_MAX),
        meta: state,
      },
      create: {
        game: "rpg",
        staffId: Number(staffId),
        value: state.level,
        extra: Math.min(state.gold, INT32_MAX),
        meta: state,
      },
    });
    return res.json({ state, result, record });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
};
