# 廃都迎撃 UFOを落とせ（ufo-demae）

https://tom3games.github.io/ufo-demae/

侵攻から3日目の焼けた街。ワイヤーでビルからビルへ振って飛び、その勢いで UFO に体当たりして落とす3Dアクション。UFO はシールドを張り、まっすぐ近づくと避け、追跡機は追ってくる。4つの波のあとに母艦。街とワイヤーは空中出前（sky-delivery）のものを廃墟にした（URL は旧名の ufo-demae のまま）。

- 遊ぶ: ブラウザで開くだけ（スマホ縦）
- 開発: `node server.mjs` → http://localhost:6416 ／ 本体は `node tools/build.mjs` で dist/game.js に1つにまとめる（js/ shared/ を直したら毎回。verify.mjs も最初に回す）
- 検証 `node verify.mjs` ／ 釣り合い `node tools/sim.mjs 12`（skilled・hooker・clumsy・runner・idle）／ 掛かる向き `node tools/reach.mjs` ／ fps `node tools/fps.mjs` ／ 撮影 `node tools/shot.mjs`・`node tools/mood.mjs` ／ OGP `node og.mjs`
- 調整値は shared/ufo.js の U・WAVES・BOSS・PTS・RANKS。見た目は js/ufo3d.js（UFO）・js/ruin.js（廃都）・js/facade.js（燃える窓）
- 仕様の正本: ~/Desktop/claudecode/ideas/ufo-demae.md
- 素材の出所は CREDITS.md（全部 CC0 か Public domain）
