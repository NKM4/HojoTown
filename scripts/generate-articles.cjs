/**
 * SEO記事量産スクリプト
 * 各都市の補助金データから、kosodate/reform/taiyoko記事を自動生成
 *
 * 条件: 該当カテゴリの補助金が3件以上ある場合のみ生成
 * 既存記事はスキップ
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CITIES_JSON = path.join(PROJECT_ROOT, 'src/data/cities.json');
const SUBSIDIES_DIR = path.join(PROJECT_ROOT, 'src/data/subsidies');
const PAGES_DIR = path.join(PROJECT_ROOT, 'src/pages');

// 記事タイプ定義
const ARTICLE_TYPES = [
  {
    slug: 'kosodate-hojokin',
    categories: ['childcare', 'birth', 'medical'],
    label: '子育て',
    heroCategory: '子育て',
    titleTemplate: (cityName) => `${cityName}の子育て支援・補助金まとめ`,
    titleSub: '児童手当から医療費助成まで全部解説',
    descTemplate: (cityName, count) =>
      `${cityName}で受けられる子育て支援制度${count}件を網羅的に解説。児童手当・こども医療費・出産支援の金額、対象者、申請方法をわかりやすくまとめました。`,
    breadcrumb: '子育て支援まとめ',
    leadTemplate: (cityName) =>
      `${cityName}では、国の制度に加えて市独自の子育て支援策が複数用意されています。「そもそも何がもらえるの？」という方に向けて、金額・対象者・申請のポイントを整理しました。`,
    summaryTitle: 'まとめ：申請しないともらえない',
    summaryText:
      '子育て支援制度の多くは<strong>申請主義</strong>です。特に児童手当は出生届・転入届と同時に申請するのが効率的。期限を逃すと遡及されないケースもあるため、早めの手続きを心がけましょう。',
    adsCategories: '["childcare","birth","medical"]',
  },
  {
    slug: 'reform-hojokin',
    categories: ['reform', 'vacant_house'],
    label: 'リフォーム',
    heroCategory: '住宅',
    titleTemplate: (cityName) => `${cityName}の住宅リフォーム補助金まとめ`,
    titleSub: '申請方法から注意点まで完全ガイド',
    descTemplate: (cityName, count) =>
      `${cityName}の住宅リフォーム・空き家関連の補助金${count}件を詳しく解説。補助金額、対象工事、申請時期、注意点まで網羅しています。`,
    breadcrumb: '住宅リフォーム補助金',
    leadTemplate: (cityName) =>
      `自宅のリフォームを考えている${cityName}の方へ。${cityName}には住宅改修工事の費用を一部補助する制度があります。この記事では、利用できる補助金制度について申請の流れや注意点を詳しくまとめました。`,
    summaryTitle: 'まとめ：リフォーム前に必ず確認を',
    summaryText:
      'リフォーム補助金は<strong>事前申請が必要</strong>なケースがほとんどです。工事着手前に必ず申請し、交付決定を受けてから工事を始めましょう。また、市内業者限定の場合もあるため、見積もり段階で業者の所在地を確認しておくことが重要です。',
    adsCategories: '["reform","vacant_house"]',
  },
  {
    slug: 'taiyoko-hojokin',
    categories: ['solar', 'appliance', 'ev'],
    label: '太陽光・省エネ',
    heroCategory: '省エネ',
    titleTemplate: (cityName) => `${cityName}の太陽光・省エネ補助金まとめ`,
    titleSub: '太陽光発電から蓄電池・EV充電まで全部解説',
    descTemplate: (cityName, count) =>
      `${cityName}で受けられる太陽光発電・省エネ設備の補助金${count}件を網羅的に解説。太陽光パネル・蓄電池・EV充電設備の補助金額、対象設備、申請方法をわかりやすくまとめました。`,
    breadcrumb: '太陽光・省エネ補助金まとめ',
    leadTemplate: (cityName) =>
      `${cityName}では、住宅への太陽光発電システムや蓄電池などの脱炭素化設備の導入を支援する補助金制度を設けています。対象設備・金額・申請スケジュールを整理しました。`,
    summaryTitle: 'まとめ：申請時期を逃さない',
    summaryText:
      '太陽光・省エネ設備の補助金は<strong>予算に達し次第終了</strong>となるケースが多いです。設備導入を検討している方は、早めに申請時期を確認し、工事スケジュールを合わせるのがポイントです。国や都道府県の補助金との併用も検討しましょう。',
    adsCategories: '["solar","appliance","ev"]',
  },
];

// カテゴリの日本語名
const CATEGORY_NAMES = {
  childcare: '子育て',
  birth: '出産',
  medical: '医療',
  reform: 'リフォーム',
  vacant_house: '空き家',
  solar: '太陽光',
  appliance: '省エネ設備',
  ev: 'EV',
};

const ARTICLE_GUIDES = {
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
};

/**
 * 補助金の金額表示を生成
 */
function formatAmount(subsidy) {
  if (subsidy.maxAmount && subsidy.maxAmount > 0) {
    return `最大${subsidy.maxAmount.toLocaleString()}円`;
  }
  return subsidy.amount || '詳細は公式サイト参照';
}

/**
 * 目次HTMLを生成
 */
function generateToc(subsidies, articleType) {
  let items = subsidies
    .map((s, i) => {
      const shortAmount = formatAmount(s);
      return `            <li><a href="#s${i + 1}">${s.name} ― ${shortAmount}</a></li>`;
    })
    .join('\n');
  items += `\n            <li><a href="#application-flow">申請前に確認すること</a></li>`;
  items += `\n            <li><a href="#mistakes">失敗しやすいポイント</a></li>`;
  items += `\n            <li><a href="#combination">併用できる制度の確認</a></li>`;
  items += `\n            <li><a href="#matome">${articleType.summaryTitle.replace('まとめ：', '')}</a></li>`;
  return items;
}

/**
 * 個別補助金セクションHTMLを生成
 */
function generateSubsidySection(subsidy, index) {
  const shortAmount = formatAmount(subsidy);

  let html = '';
  html += `        <!-- ${index + 1}. ${subsidy.name} -->\n`;
  html += `        <h2 id="s${index + 1}">${subsidy.name} ― ${shortAmount}</h2>\n`;
  html += `        <p>${subsidy.summary}</p>\n`;
  html += `\n`;

  // 金額カード
  html += `        <div class="article-amount-card">\n`;
  html += `          <p class="article-amount-label">補助金の概要</p>\n`;
  html += `          <div class="article-amount-grid">\n`;
  html += `            <div class="article-amount-item">\n`;
  html += `              <span class="article-amount-age">金額</span>\n`;
  html += `              <span class="article-amount-value">${subsidy.amount}</span>\n`;
  html += `            </div>\n`;
  html += `            <div class="article-amount-item">\n`;
  html += `              <span class="article-amount-age">対象</span>\n`;
  html += `              <span class="article-amount-value" style="font-size:0.85rem;">${subsidy.target}</span>\n`;
  html += `            </div>\n`;
  html += `            <div class="article-amount-item">\n`;
  html += `              <span class="article-amount-age">申請期限</span>\n`;
  html += `              <span class="article-amount-value" style="font-size:0.85rem;">${subsidy.deadline}</span>\n`;
  html += `            </div>\n`;
  html += `          </div>\n`;
  html += `        </div>\n`;

  // 公式URLがあればtip
  if (subsidy.officialUrl) {
    html += `\n        <div class="article-tip">\n`;
    html += `          <strong>詳細・申請</strong>\n`;
    html += `          <p><a href="${subsidy.officialUrl}" target="_blank" rel="noopener noreferrer">公式サイトで詳細を確認する</a></p>\n`;
    html += `        </div>\n`;
  }

  return html;
}

function generateGuideSections(articleType) {
  const guide = ARTICLE_GUIDES[articleType.slug];
  if (!guide) return '';
  return `        <h2 id="application-flow">申請前に確認すること</h2>
        <p>${guide.flow}</p>

        <h2 id="mistakes">失敗しやすいポイント</h2>
        <p>${guide.caution}</p>

        <h2 id="combination">併用できる制度の確認</h2>
        <p>${guide.combo}</p>

`;
}

/**
 * 記事全体のAstroファイルを生成
 */
function generateArticle(city, subsidies, articleType) {
  const { prefectureSlug, slug: citySlug, name: cityName } = city;
  const filteredSubsidies = subsidies.filter((s) =>
    articleType.categories.includes(s.category)
  );

  const title = articleType.titleTemplate(cityName);
  const description = articleType.descTemplate(cityName, filteredSubsidies.length);
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  // 目次
  const tocItems = generateToc(filteredSubsidies, articleType);

  // 補助金セクション
  const subsidySections = filteredSubsidies
    .map((s, i) => generateSubsidySection(s, i))
    .join('\n');
  const guideSections = generateGuideSections(articleType);

  const astro = `---
import ArticleAds from '../../../components/ArticleAds.astro';
import BaseLayout from '../../../layouts/BaseLayout.astro';
---
<BaseLayout title="${title}｜${articleType.titleSub}" description="${description}">
  <!-- ヒーロー -->
  <section class="article-hero">
    <div class="container" style="max-width:760px;">
      <nav class="article-breadcrumb">
        <a href="/">ホジョタウン</a> &gt; <a href="/${prefectureSlug}/${citySlug}/">${cityName}</a> &gt; <span>${articleType.breadcrumb}</span>
      </nav>
      <span class="article-category">${articleType.heroCategory}</span>
      <h1 class="article-title">${title}<br><span class="article-title-sub">${articleType.titleSub}</span></h1>
      <p class="article-meta">最終更新: ${dateStr}</p>
    </div>
  </section>

  <section class="section">
    <div class="container" style="max-width:760px;">
      <article class="article-body">
        <!-- 目次 -->
        <div class="article-toc">
          <p class="article-toc-title">この記事の内容</p>
          <ol>
${tocItems}
          </ol>
        </div>

        <p class="article-lead">${articleType.leadTemplate(cityName)}</p>

${subsidySections}
${guideSections}
        <!-- まとめ -->
        <h2 id="matome">${articleType.summaryTitle}</h2>
        <p>${articleType.summaryText}</p>

        <!-- CTA -->
        <ArticleAds categories={${articleType.adsCategories}} />
        <div class="article-cta">
          <p class="article-cta-title">あなたに合った補助金を診断</p>
          <p class="article-cta-body">5つの質問に答えるだけで、もらえる補助金と合計金額がわかります。</p>
          <div class="article-cta-buttons">
            <a href="/shindan/" class="btn btn-primary">診断してみる</a>
            <a href="/${prefectureSlug}/${citySlug}/" class="article-cta-link">${cityName}の全補助金を見る →</a>
          </div>
        </div>

        <div class="disclaimer" style="margin-top:32px;">
          この記事の情報は${today.getFullYear()}年${today.getMonth() + 1}月時点のものです。最新情報は各制度の公式サイトでご確認ください。
          <br><a href="/contact/" style="font-size:0.8rem;">情報の誤りを報告する</a>
        </div>
      </article>
    </div>
  </section>
</BaseLayout>

<style>
  .article-hero {
    background: linear-gradient(135deg, #0d3320 0%, var(--green-deep) 40%, var(--green-mid) 100%);
    color: white;
    padding: 32px 0 40px;
  }
  .article-breadcrumb { font-size: 0.8rem; opacity: 0.7; margin-bottom: 16px; }
  .article-breadcrumb a { color: white; }
  .article-category {
    display: inline-block;
    background: rgba(200,168,75,0.2);
    color: var(--gold);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 20px;
    margin-bottom: 12px;
  }
  .article-title { font-size: 1.6rem; font-weight: 700; line-height: 1.4; margin-bottom: 8px; }
  .article-title-sub { font-size: 1.1rem; font-weight: 400; opacity: 0.85; }
  .article-meta { font-size: 0.8rem; opacity: 0.6; }

  .article-body { line-height: 1.9; color: var(--text-dark); }
  .article-body h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-top: 40px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--green-mid);
    color: var(--green-deep);
  }
  .article-body p { margin-bottom: 16px; }
  .article-lead { font-size: 1.05rem; color: var(--text-mid); margin-bottom: 24px; }

  .article-toc {
    background: var(--green-pale);
    border-radius: 8px;
    padding: 20px 24px;
    margin-bottom: 32px;
  }
  .article-toc-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 8px; color: var(--green-deep); }
  .article-toc ol { margin: 0; padding-left: 20px; }
  .article-toc li { margin-bottom: 4px; font-size: 0.9rem; }
  .article-toc a { color: var(--green-deep); text-decoration: none; }
  .article-toc a:hover { text-decoration: underline; }

  .article-amount-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    margin: 20px 0;
  }
  .article-amount-label { font-weight: 700; font-size: 0.85rem; color: var(--text-mid); margin-bottom: 12px; }
  .article-amount-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .article-amount-item {
    background: var(--green-pale);
    border-radius: 8px;
    padding: 14px;
    text-align: center;
  }
  .article-amount-age { display: block; font-size: 0.75rem; color: var(--text-mid); margin-bottom: 4px; }
  .article-amount-value { display: block; font-size: 1.3rem; font-weight: 800; color: var(--green-deep); }
  .article-amount-note { display: block; font-size: 0.7rem; color: var(--text-soft); margin-top: 2px; }

  .article-tip {
    background: #f0fdf4;
    border-left: 4px solid var(--green-mid);
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin: 16px 0;
  }
  .article-tip strong { display: block; font-size: 0.85rem; color: var(--green-deep); margin-bottom: 4px; }
  .article-tip p { margin: 0; font-size: 0.9rem; }

  .article-note {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    border-radius: 0 8px 8px 0;
    padding: 12px 20px;
    margin: 16px 0;
    font-size: 0.85rem;
  }
  .article-note p { margin: 0; }

  .article-cta {
    text-align: center;
    background: var(--green-pale);
    padding: 32px;
    border-radius: 10px;
    margin-top: 40px;
  }
  .article-cta-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 8px; }
  .article-cta-body { font-size: 0.9rem; color: var(--text-mid); margin-bottom: 16px; }
  .article-cta-buttons { display: flex; gap: 16px; justify-content: center; align-items: center; flex-wrap: wrap; }
  .article-cta-link { font-size: 0.9rem; color: var(--green-deep); font-weight: 600; }
</style>
`;

  return astro;
}

// メイン処理
function main() {
  const cities = JSON.parse(fs.readFileSync(CITIES_JSON, 'utf-8'));
  console.log(`都市数: ${cities.length}`);

  const stats = {
    generated: { total: 0 },
    skipped_existing: { total: 0 },
    skipped_few: { total: 0 },
    skipped_no_data: { total: 0 },
  };

  for (const type of ARTICLE_TYPES) {
    stats.generated[type.slug] = 0;
    stats.skipped_existing[type.slug] = 0;
    stats.skipped_few[type.slug] = 0;
    stats.skipped_no_data[type.slug] = 0;
  }

  for (const city of cities) {
    const subsidyFile = path.join(SUBSIDIES_DIR, `${city.slug}.json`);

    // 補助金データファイルがない場合
    if (!fs.existsSync(subsidyFile)) {
      for (const type of ARTICLE_TYPES) {
        stats.skipped_no_data[type.slug]++;
        stats.skipped_no_data.total++;
      }
      continue;
    }

    const subsidies = JSON.parse(fs.readFileSync(subsidyFile, 'utf-8'));

    for (const type of ARTICLE_TYPES) {
      const articleDir = path.join(PAGES_DIR, city.prefectureSlug, city.slug);
      const articleFile = path.join(articleDir, `${type.slug}.astro`);

      // 既存記事チェック
      if (fs.existsSync(articleFile)) {
        stats.skipped_existing[type.slug]++;
        stats.skipped_existing.total++;
        continue;
      }

      // 該当カテゴリの補助金数チェック
      const filtered = subsidies.filter((s) => type.categories.includes(s.category));
      if (filtered.length < 3) {
        stats.skipped_few[type.slug]++;
        stats.skipped_few.total++;
        continue;
      }

      // ディレクトリ作成
      if (!fs.existsSync(articleDir)) {
        fs.mkdirSync(articleDir, { recursive: true });
      }

      // 記事生成
      const content = generateArticle(city, subsidies, type);
      fs.writeFileSync(articleFile, content, 'utf-8');

      stats.generated[type.slug]++;
      stats.generated.total++;
    }
  }

  // 結果表示
  console.log('\n=== 記事生成結果 ===\n');

  console.log('--- 生成済み ---');
  for (const type of ARTICLE_TYPES) {
    console.log(`  ${type.slug}: ${stats.generated[type.slug]}件`);
  }
  console.log(`  合計: ${stats.generated.total}件\n`);

  console.log('--- スキップ（既存記事あり） ---');
  for (const type of ARTICLE_TYPES) {
    console.log(`  ${type.slug}: ${stats.skipped_existing[type.slug]}件`);
  }
  console.log(`  合計: ${stats.skipped_existing.total}件\n`);

  console.log('--- スキップ（該当カテゴリ3件未満） ---');
  for (const type of ARTICLE_TYPES) {
    console.log(`  ${type.slug}: ${stats.skipped_few[type.slug]}件`);
  }
  console.log(`  合計: ${stats.skipped_few.total}件\n`);

  console.log('--- スキップ（補助金データなし） ---');
  for (const type of ARTICLE_TYPES) {
    console.log(`  ${type.slug}: ${stats.skipped_no_data[type.slug]}件`);
  }
  console.log(`  合計: ${stats.skipped_no_data.total}件\n`);
}

main();
