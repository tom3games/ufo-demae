# 空中出前 UFO襲来（ufo-demae）

https://tom3games.github.io/ufo-demae/

出前のラーメンを UFO がさらった。宇宙人はストローですすりながら街の上を飛んでいる。ワイヤーで飛んで体当たりして UFO を落とし、落ちてくる丼を空中で取り返す3Dアクションのバカゲー。街とワイヤーは空中出前（sky-delivery）のもの。

- 遊ぶ: ブラウザで開くだけ（スマホ縦）
- 開発: `node server.mjs` → http://localhost:6416 ／ 検証 `node verify.mjs` ／ 釣り合い `node tools/sim.mjs 8`（追尾弾だけ `node tools/sim.mjs 12 missile`）／ 掛かる向き `node tools/reach.mjs` ／ fps `node tools/fps.mjs` ／ OGP `node og.mjs`
- 調整値は shared/ufo.js の U・WAVES・BOSS。見た目は js/ufo3d.js
- 素材の出所は CREDITS.md（全部 CC0 か Public domain）
