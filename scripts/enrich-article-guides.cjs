const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');

const articleGuides = {
  'kosodate-hojokin': {
    flow: '子育て支援は、出生・転入・所得変更などのタイミングで手続きが必要になることが多いです。まず対象制度の公式ページで受付状況を確認し、本人確認書類、振込先口座、健康保険証、所得確認書類などをそろえてから窓口またはオンライン申請へ進みます。',
    caution: '児童手当や医療費助成は、申請が遅れるとさかのぼって受け取れない場合があります。保育料、医療費、ひとり親支援は世帯状況や所得で扱いが変わるため、引っ越し・出産・離婚・就職などがあったら早めに担当課へ確認してください。',
    combo: '国の児童手当、自治体の医療費助成、保育・出産関連の給付は同時に確認すると漏れを減らせます。自治体独自制度は年度途中で予算終了や対象拡大が起きることがあるため、申請前に最新の受付状況を確認しましょう。',
  },
  'reform-hojokin': {
    flow: 'リフォーム補助金は、見積取得、対象工事の確認、事前申請、交付決定、工事着手、完了報告という順番が基本です。契約や着工を先に進めると対象外になる制度が多いため、見積書と工事内容が補助対象に合うかを先に確認してください。',
    caution: '市内業者限定、耐震・省エネ性能の条件、写真提出、領収書の名義などで不備になりやすいです。補助対象外の工事が混ざる場合は、見積明細を分けてもらうと審査や完了報告が進めやすくなります。',
    combo: '国や都道府県の省エネ住宅支援、介護保険の住宅改修、空き家関連補助と併用できる場合があります。ただし同じ工事費に二重で補助を受けられない制度もあるため、併用可否は申請前に確認しておきましょう。',
  },
  'taiyoko-hojokin': {
    flow: '太陽光・蓄電池・省エネ設備の補助金は、対象機器の型番確認、見積取得、事前申請、交付決定、設置工事、実績報告の順で進むことが多いです。予算枠が限られるため、設備導入を決める前に受付開始日と残額を確認してください。',
    caution: '対象設備の性能要件、未使用品であること、既存住宅か新築か、契約日・着工日の条件で対象外になることがあります。販売店任せにせず、見積書に型番・容量・工事費内訳が入っているか確認すると安心です。',
    combo: '自治体補助に加えて、国・都道府県の省エネ支援、電力会社のキャンペーン、EV充電設備補助を組み合わせられることがあります。併用時は、補助対象経費と申請順序が制度ごとに違う点に注意してください。',
  },
  default: {
    flow: '申請前に、対象者、対象経費、受付期間、必要書類を公式ページで確認します。条件に合いそうな制度は、期限前に担当窓口へ相談し、書類の不足や申請順序の誤りがないか確認してから提出してください。',
    caution: '補助金は年度ごとに内容が変わり、予算に達すると受付終了になる場合があります。公式サイトの更新日、申請期限、添付書類、対象外条件を確認し、迷う場合は担当課へ問い合わせるのが確実です。',
    combo: '似た制度が複数ある場合は、国・都道府県・市区町村の順に確認すると漏れを減らせます。同じ費用への重複補助ができない制度もあるため、併用できるかは申請前に確認してください。',
  },
};

function findArticles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findArticles(full));
    else if (entry.name.endsWith('.astro') && entry.name !== 'index.astro' && entry.name !== '404.astro') {
      results.push(full);
    }
  }
  return results;
}

function guideFor(file) {
  const basename = path.basename(file, '.astro');
  return articleGuides[basename] || articleGuides.default;
}

function enrich(content, guide) {
  if (content.includes('id="application-flow"')) return content;
  if (!content.includes('<h2 id="matome">')) return content;

  const tocNeedle = '            <li><a href="#matome">';
  if (content.includes(tocNeedle) && !content.includes('#application-flow')) {
    content = content.replace(
      tocNeedle,
      '            <li><a href="#application-flow">申請前に確認すること</a></li>\n' +
        '            <li><a href="#mistakes">失敗しやすいポイント</a></li>\n' +
        '            <li><a href="#combination">併用できる制度の確認</a></li>\n' +
        tocNeedle
    );
  }

  const section = `        <h2 id="application-flow">申請前に確認すること</h2>
        <p>${guide.flow}</p>

        <h2 id="mistakes">失敗しやすいポイント</h2>
        <p>${guide.caution}</p>

        <h2 id="combination">併用できる制度の確認</h2>
        <p>${guide.combo}</p>

`;

  return content.replace('        <!-- まとめ -->\n', section + '        <!-- まとめ -->\n');
}

let updated = 0;
for (const file of findArticles(pagesDir)) {
  const original = fs.readFileSync(file, 'utf8');
  const next = enrich(original, guideFor(file));
  if (next !== original) {
    fs.writeFileSync(file, next, 'utf8');
    updated++;
  }
}

console.log(`Enriched article guides: ${updated}`);
