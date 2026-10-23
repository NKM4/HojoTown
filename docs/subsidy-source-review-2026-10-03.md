# 13件の公式情報再確認（2026-10-03）

対象は8自治体・13レコード。11件を更新、根拠のない近江八幡市の移住支援金1件を掲載から削除し、旭川市の1件は変更せず維持した。関連する既存記事3本の該当箇所も同期した。他制度・記事全体を再検証したものではない。

## 確認結果と一次情報

| レコード | 判断 | 公式根拠 |
| --- | --- | --- |
| arakawa-birth-001 | 2025年4月の後継「妊婦支援給付金」に名称・対象・金額を更新。妊婦5万円＋胎児数×5万円 | [荒川区](https://www.city.arakawa.tokyo.jp/a033/ninshinshussan/joseikyuufu/ninpushien.html) |
| asahikawa-medical-002 | 既存URLに制度本文を確認。今回のクラウド環境ではHEAD・GETとも200。変更不要 | [旭川市](https://www.city.asahikawa.hokkaido.jp/kurashi/135/171/177/p004494.html) |
| ashikaga-birth-001 | 後継「妊婦のための支援給付」に更新。旧制度は2026-03-30で申請終了。後継は妊婦本人が申請し、各給付に2年の時効あり | [旧制度](https://www.city.ashikaga.tochigi.jp/health/000035/000201/000636/p003886.html)・[後継制度](https://www.city.ashikaga.tochigi.jp/health/000035/000202/000639/p006948.html) |
| hanno-childcare-001 | 同一ページIDの現行URLに修正。継続中の児童手当 | [飯能市](https://www.city.hanno.lg.jp/soshikikarasagasu/kodomoshienbu/kodomoshienka/teatesoumu/10140.html) |
| hanno-childcare-002 | 2026年4月の第1子月額11,340〜48,050円、追加児童5,680〜11,350円に更新 | [飯能市](https://www.city.hanno.lg.jp/kosodate_kyoiku/kosodate_hoiku_jidofukushi/kakushuteate_kyufukin/5304.html) |
| hino-helmet-001 | 2024-03-31受付終了。過去の助成は購入費上限2,000円であり、半額ではない | [日野市](https://www.city.hino.lg.jp/kurashi/annzen/kotsu/1031970/1024235.html) |
| iwaki-reform-001 | 2026年度事業は9月30日受付終了。対象工事費10%、上限15万円。バリアフリー・省エネルギー等の必須工事あり | [いわき市](https://www.city.iwaki.lg.jp/www/contents/1785896784118/index.html) |
| omihachiman-childcare-001 | 児童手当の現行URLと年齢・児童数別金額を掲載 | [近江八幡市](https://www.city.omihachiman.lg.jp/soshiki/shien/tanjyou/1535.html) |
| omihachiman-reform-001 | 耐震改修の専用ページに修正。基本額80%、上限115万円、条件付き加算あり | [近江八幡市](https://www.city.omihachiman.lg.jp/kurashi/sumai/12/20644.html)・[概要PDF](https://www.city.omihachiman.lg.jp/material/files/group/152/zigyougaiyou.pdf) |
| omihachiman-solar-001 | 太陽光部分は3万円/kW・他の公的補助控除後の対象経費15%・15万円の最小額。2027-02-26書類完備締切、2026年度終了予定 | [近江八幡市](https://www.city.omihachiman.lg.jp/news/41371.html)・[2026年度チラシ](https://www.city.omihachiman.lg.jp/material/files/group/196/r8chirashii.pdf) |
| omihachiman-migration-001 | 市の制度として裏付けられず削除。県の現行実施9市町に近江八幡市は含まれない | [滋賀県](https://www.pref.shiga.lg.jp/fe00/6292.html) |
| omihachiman-marriage-001 | 夫婦双方の年齢、前年合計所得、受講等の条件を補足。2027-02-28締切（窓口26日、予算終了あり） | [近江八幡市](https://www.city.omihachiman.lg.jp/soshiki/kikaku/konkatsu/40936.html) |
| sendai-elderly-001 | 実証実験ページから敬老乗車証の総合案内へ。負担額と2026年10月の対象路線拡大を反映 | [仙台市](https://www.city.sendai.jp/korekikaku-kikaku/kurashi/kenkotofukushi/korenokata/katsudo/sedo/joshasho/index.html) |

## 表現・データ上の判断

- 荒川区・足利市の安定IDは維持し、掲載対象を後継制度へ明示的に更新した。旧制度を現行制度として扱わない。
- 妊婦支援は胎児数に応じるため10万円を総額の最大値とはしない。既存スキーマの「不明なら0」に従い `maxAmount: 0` とし、表示用 `amount` に算式と単胎の例を残した。この2件の給付は診断の数値合計には算入されない。
- 飯能市の数値は第1子の月額、近江八幡市の耐震改修は加算を除く基本上限。表示用金額に単位・加算条件を明記した。
- 日野市といわき市は `ended`。市別一覧がステータスや期限を表示しなくても分かるよう、名称・概要にも受付終了を明記した。いわき市は2026年度募集の終了であり制度の廃止とは断定しない。
- 近江八幡市の移住支援金について、過去の実施や廃止の証拠は得られていない。`ended` として残すと実在した制度と誤認されるため削除した。その他の移住支援の不存在を示すものではない。
- 耐震改修の当年度受付期間・残予算は公式資料から確定できない。制度掲載は維持し、概要と期限欄に市への確認が必要と記載した。結婚支援も残予算は未確認。
- URLチェック機能・通知・デプロイ設定は変更していない。本文を確認できることと全実行環境で同じHTTP応答になることは別であり、今回の旭川市200応答は過去の失敗原因を説明するものではない。

## 検証コマンド

- `node --test tests/subsidy-source-corrections.test.cjs`
- `node scripts/check-articles.cjs`
- `npm run build`
- `npm run audit:affiliate`
- `npm run audit:affiliate-tracking`

対象外データの変更がないこと、削除1件を除きIDを維持していることも比較で確認する。

## 2026-10-03の実行結果

- 回帰テスト6件、全501記事チェック、アフィリエイト配置・計測監査はいずれも成功。
- `ASTRO_TELEMETRY_DISABLED=1 XDG_CONFIG_HOME=/tmp/hojotown-config npm run build` により975ページをビルド。通常のホームディレクトリが書き込み不可の環境のため、一時設定先を使用した。
- ビルド済みHTMLで、11更新レコードの名称・URLが市別ページに反映され、受付終了2件と削除1件がアクティブな比較データから除外されることを確認。
- 残る対象12URLは同環境・URLチェッカーと同じUser-AgentでHEAD/GETの両方を確認し、24応答すべてHTTP 200。
- 全4,220レコードのJSONを読めること、対象の11更新・1削除以外のデータが元のコミットと一致することを確認。
- 全自治体への外部リンク再巡回や本番デプロイは実施していない。独立したlint/typecheck用npmスクリプトはリポジトリに定義されていない。
