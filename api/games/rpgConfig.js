// RPG 共通設定: 武器/防具/ボス/ショップパラメータ集中管理
// ここを変更すればフロント/バック両方に反映しやすくする（※フロント用は別ファイル rpg-config.js を参照）

module.exports = {
  ENEMIES: [
    { key: "chort", name: "インプ", min: 1, max: 5 },
    { key: "big_zombie", name: "ゾンビ", min: 6, max: 15 },
    { key: "doc", name: "災厄のタバコ男 ムコサン", min: 16, max: 30 },
    { key: "big_demon", name: "悪の根源 ケイ", min: 31, max: 60 },
    { key: "angel", name: "堕天使 アキヤマーン", min: 61, max: 999999999 },
  ],
  BOSS_NAME: "ベトナムより来訪せし暴虐の魔王 コン",
  // フィールド/戦闘で使うボススプライトキー (assets/rpg/<key>_idle_anim_f0.png 形式)
  BOSS_SPRITE_KEY: "angel", // 強そうな見た目に変更（例: angel, big_demon など）
  WEAPON_BONUS: {
    dagger: 40,
    sword: 500,
    staff: 7000,
    axe: 80000,
    spear: 90000,
    wand: 15000000,
    longsword: 180000000,
    mystic_staff: 2400000000,
    greatsword: 50000000000,
  },
  SHOP_ITEMS: {
    dagger: { cost: 700, msg: "短剣を購入 (+ATK40)", atk: 40 },
    sword: { cost: 6000, msg: "剣を購入 (+ATK500)", atk: 500 },
    staff: { cost: 50000, msg: "杖を購入 (+ATK7000)", atk: 7000 },
    axe: { cost: 400000, msg: "戦斧を購入 (+ATK9万)", atk: 90000 },
    spear: { cost: 3000000, msg: "槍を購入 (+ATK120万)", atk: 1200000 },
    wand: { cost: 20000000, msg: "ワンドを購入 (+ATK1500万)", atk: 15000000 },
    longsword: {
      cost: 100000000,
      msg: "ロングソードを購入 (+ATK1,8億)",
      atk: 180000000,
    },
    mystic_staff: {
      cost: 1000000000,
      msg: "魔導杖を購入 (+ATK24億)",
      atk: 2400000000,
    },
    greatsword: {
      cost: 10000000000,
      msg: "グレートソードを購入 (+ATK500億)",
      atk: 50000000000,
    },
    armor: { cost: 114514, msg: "防具を購入 (+HP114514)", hp: 114514 },
    plate_armor: {
      cost: 37564000,
      msg: "プレートアーマーを購入 (+HP37564000)",
      hp: 37564000,
    },
  },
  BOSS: {
    level: 100000000,
    hp: 12000000000, // 元120の10倍
    atk: 140000,
    exp: 60000000000000,
    gold: 1200000000000,
  },
};
