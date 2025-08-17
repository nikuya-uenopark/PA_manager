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
    dagger: { cost: 500, msg: "短剣を購入 (+ATK5)", atk: 5 },
    sword: { cost: 1000, msg: "剣を購入 (+ATK10)", atk: 10 },
    staff: { cost: 5000, msg: "杖を購入 (+ATK50)", atk: 50 },
    axe: { cost: 10000, msg: "戦斧を購入 (+ATK100)", atk: 100 },
    spear: { cost: 50000, msg: "槍を購入 (+ATK500)", atk: 500 },
    wand: { cost: 100000, msg: "ワンドを購入 (+ATK1000)", atk: 1000 },
    longsword: { cost: 1000000, msg: "ロングソードを購入 (+ATK10000)", atk: 10000 },
    mystic_staff: { cost: 10000000, msg: "魔導杖を購入 (+ATK100000)", atk: 100000 },
    greatsword: { cost: 150000000, msg: "グレートソードを購入 (+ATK1500000)", atk: 1500000 },
    armor: { cost: 114514, msg: "防具を購入 (+HP114514)", hp: 114514 },
    plate_armor: { cost: 37564000, msg: "プレートアーマーを購入 (+HP37564000)", hp: 37564000 },
  },
  BOSS: {
    level: 1,//100000000,
    hp: 50,//12000000000,
    atk: 10,//140000,
    exp: 60000000,
    gold: 1200000000,
  },
};
