// RPG 共通設定: 武器/防具/ボス/ショップパラメータ集中管理
// ここを変更すればフロント/バック両方に反映しやすくする（※フロント用は別ファイル rpg-config.js を参照）

module.exports = {
  WEAPON_BONUS: {
    dagger: 4,
    sword: 5,
    staff: 7,
    axe: 8,
    spear: 9,
    wand: 9,
    longsword: 10,
    mystic_staff: 12,
    greatsword: 14,
  },
  SHOP_ITEMS: {
    dagger: { cost: 40, msg: "短剣を購入 (+ATK4)", atk: 4 },
    sword: { cost: 60, msg: "剣を購入 (+ATK5)", atk: 5 },
    staff: { cost: 70, msg: "杖を購入 (+ATK7)", atk: 7 },
    axe: { cost: 110, msg: "戦斧を購入 (+ATK8)", atk: 8 },
    spear: { cost: 120, msg: "槍を購入 (+ATK9)", atk: 9 },
    wand: { cost: 125, msg: "ワンドを購入 (+ATK9)", atk: 9 },
    longsword: { cost: 150, msg: "ロングソードを購入 (+ATK10)", atk: 10 },
    mystic_staff: { cost: 200, msg: "魔導杖を購入 (+ATK12)", atk: 12 },
    greatsword: { cost: 240, msg: "グレートソードを購入 (+ATK14)", atk: 14 },
    armor: { cost: 70, msg: "防具を購入 (+HP15)", hp: 15 },
    plate_armor: { cost: 140, msg: "プレートアーマーを購入 (+HP30)", hp: 30 },
  },
  BOSS: {
    level: 10000,
    hp: 1200, // 元120の10倍
    atk: 14,
    exp: 60,
    gold: 120,
  },
};
