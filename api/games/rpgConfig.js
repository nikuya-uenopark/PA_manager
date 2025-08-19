// RPG 共通設定: 武器/防具/ボス/ショップパラメータ集中管理
// ここを変更すればフロント/バック両方に反映しやすくする（※フロント用は別ファイル rpg-config.js を参照）

module.exports = {
  LEVEL_SCALING: {
    HP_PER: 6, // 1レベル毎 HP増加量 (基礎)
    ATK_PER: 2, // 1レベル毎 ATK増加量
    EXP_BASE: 30, // Lv1->2 必要基礎
    EXP_PER_LV: 20, // 線形成分
    EXP_QUAD: 0.04, // 二次係数 (緩やかな二次: lv^2 * 0.04)
  },
  ENEMIES: [
    { key: "chort", name: "インプ" },
    { key: "big_zombie", name: "ゾンビ" },
    { key: "doc", name: "タバコ男ムコサン" },
    { key: "big_demon", name: "悪の根源ケイ" },
    { key: "angel", name: "堕天使アキヤマーン" },
  ],
    // クリティカル設定 (プレイヤーのみ適用)
    CRIT: {
      RATE: 0.1, // 10% 発生率
      MULT: 2.0, // 倍率 (与ダメージに乗算)
    },
  BOSS_NAME: "暴虐の魔王 コン",
  // フィールド/戦闘で使うボススプライトキー (assets/rpg/<key>_idle_anim_f0.png 形式)
  BOSS_SPRITE_KEY: "big_demon", // 強そうな見た目に変更（例: angel, big_demon など）
  WEAPON_BONUS: {
    dagger: 5,
    sword: 10,
    staff: 50,
    axe: 100,
    spear: 500,
    wand: 1000,
    longsword: 10000,
    mystic_staff: 100000,
    greatsword: 1500000,
  },
  SHOP_ITEMS: {
    dagger: { cost: 100, msg: "短剣を購入 (+ATK5)", atk: 5 },
    sword: { cost: 1000, msg: "剣を購入 (+ATK10)", atk: 10 },
    staff: { cost: 5000, msg: "杖を購入 (+ATK50)", atk: 50 },
    axe: { cost: 10000, msg: "戦斧を購入 (+ATK100)", atk: 100 },
    spear: { cost: 50000, msg: "槍を購入 (+ATK500)", atk: 500 },
    wand: { cost: 100000, msg: "ワンドを購入 (+ATK1000)", atk: 1000 },
    longsword: {
      cost: 1000000,
      msg: "ロングソードを購入 (+ATK10000)",
      atk: 10000,
    },
    mystic_staff: {
      cost: 10000000,
      msg: "魔導杖を購入 (+ATK100000)",
      atk: 100000,
    },
    greatsword: {
      cost: 150000000,
      msg: "グレートソードを購入 (+ATK1500000)",
      atk: 1500000,
    },
    armor: { cost: 500, msg: "防具を購入 (+HP500)", hp: 500 },
    plate_armor: {
      cost: 37564000,
      msg: "プレートアーマーを購入 (+HP37564000)",
      hp: 37564000,
    },
  },
  BOSS: {
    level: 100000000,
    hp: 120000000,
    atk: 10000,
    exp: 60000000,
    gold: 1200000000,
  },
};
