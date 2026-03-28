import type { Category } from './types';

/** ライフイベント種別 */
export type LifeEvent =
  | 'reform'      // 家を直す
  | 'housing'     // 家を建てる
  | 'baby'        // 子どもが生まれる
  | 'moving'      // 引っ越す
  | 'energy'      // 省エネしたい
  | 'retirement'  // 老後に備える
  | 'marriage'    // 結婚する
  | 'career'      // 仕事を辞める・変える
  | 'funeral';    // 家族が亡くなる

/** ライフイベントの表示名マッピング */
export const LIFE_EVENT_LABELS: Record<LifeEvent, string> = {
  reform: '家を直す',
  housing: '家を建てる',
  baby: '子どもが生まれる',
  moving: '引っ越す',
  energy: '省エネしたい',
  retirement: '老後に備える',
  marriage: '結婚する',
  career: '仕事を辞める・変える',
  funeral: '家族が亡くなる',
};

/** ライフイベントとカテゴリの対応 */
export const LIFE_EVENT_CATEGORIES: Record<LifeEvent, Category[]> = {
  reform: ['reform', 'vacant_house'],
  housing: ['reform', 'solar', 'childcare'],
  baby: ['childcare', 'birth', 'medical', 'fertility'],
  moving: ['moving', 'migration'],
  energy: ['solar', 'appliance', 'ev'],
  retirement: ['elderly', 'medical', 'license_return'],
  marriage: ['marriage'],
  career: ['education'],
  funeral: ['funeral', 'elderly'],
};

/** アフィリエイト広告の定義 */
export interface AffiliateAd {
  id: string;
  /** 表示するカテゴリ（この補助金カテゴリが結果に含まれている時に表示） */
  triggerCategories: Category[];
  /** 対応するライフイベント（ライフイベントLPでの表示用） */
  lifeEvents?: LifeEvent[];
  /** 広告タイトル */
  title: string;
  /** 説明文 */
  description: string;
  /** CTAボタンのテキスト */
  ctaText: string;
  /** リンク先（ASP登録後にアフィリンクに差し替え） */
  url: string;
  /** PRラベル */
  label: string;
  /** アイコン */
  icon: string;
  /** 成約条件（表示用） */
  conversionType?: string;
  /** 優先度（高いほど先に表示、デフォルト0） */
  priority?: number;
}

/**
 * カテゴリ連動アフィリエイト広告の定義
 * ASP登録後にurlをアフィリエイトリンクに差し替える
 */
export const AFFILIATE_ADS: AffiliateAd[] = [
  // ============================================
  // 高単価案件（ライフイベントLP本命）
  // ============================================

  // リフォーム補助金 → タウンライフリフォーム（11,209円/件）
  {
    id: 'townlife-reform',
    triggerCategories: ['reform', 'vacant_house'],
    lifeEvents: ['reform'],
    title: '補助金を使ったリフォーム、実質いくら？',
    description: '補助金適用後の実質負担額がわかる。地元の優良業者から無料でプランと見積もりが届きます。',
    ctaText: '無料で見積もりを比較する',
    url: 'https://townlife-aff.com/link.php?i=reform&m=hojotown',  // TODO: タウンライフ提携後に差し替え
    label: 'PR',
    icon: '🏠',
    conversionType: '無料見積り申込',
    priority: 10,
  },
  // 注文住宅 → タウンライフ家づくり（14,300円/件）
  {
    id: 'townlife-housing',
    triggerCategories: ['reform', 'solar', 'childcare'],
    lifeEvents: ['housing'],
    title: '注文住宅、補助金で最大100万円お得に',
    description: '子育てエコホーム支援事業など、住宅取得の補助金を活用。間取りプランと資金計画が無料で届きます。',
    ctaText: '無料で間取りプランを取り寄せる',
    url: 'https://townlife-aff.com/link.php?i=house&m=hojotown',  // TODO: タウンライフ提携後に差し替え
    label: 'PR',
    icon: '🏗️',
    conversionType: '無料間取りプラン申込',
    priority: 10,
  },
  // 太陽光 → グリエネ（9,350円/件）
  {
    id: 'griene-solar',
    triggerCategories: ['solar', 'appliance', 'ev'],
    lifeEvents: ['energy', 'housing', 'reform'],
    title: '太陽光パネル、補助金でいくらお得に？',
    description: '補助金適用後の実質費用がわかる。複数メーカーの見積もりを無料で比較できます。',
    ctaText: '無料で太陽光の見積もりを取る',
    url: 'https://townlife-aff.com/link.php?i=solar&m=hojotown',  // TODO: タウンライフ提携後に差し替え
    label: 'PR',
    icon: '☀️',
    conversionType: '無料見積り申込',
    priority: 9,
  },

  // ============================================
  // 中単価案件（ライフイベントLP追加枠）
  // ============================================

  // 保険・FP相談 → エイチームライフデザイン（8,000〜11,000円/件）
  {
    id: 'childcare-insurance',
    triggerCategories: ['childcare', 'birth', 'medical', 'fertility'],
    lifeEvents: ['baby', 'retirement', 'marriage'],
    title: 'お金のプロに無料で相談しませんか？',
    description: '補助金だけでは不安な将来の備え。学資保険・医療保険・老後資金をFPに無料相談。',
    ctaText: '無料でFPに相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3LSINM+ZXM+6HES1',
    label: 'PR',
    icon: '🛡️',
    conversionType: '無料FP相談',
    priority: 8,
  },
  // 老人ホーム → クオリティライフ・コンシェルジュ（3,000〜10,000円/件）
  {
    id: 'elderly-home',
    triggerCategories: ['elderly'],
    lifeEvents: ['retirement'],
    title: '老人ホーム・介護施設を探していますか？',
    description: 'お住まいの地域の施設を一括検索。費用・空き状況・口コミを比較できます。',
    ctaText: '近くの施設を無料で検索する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3SCAB6+3E5S+5YJRM',
    label: 'PR',
    icon: '🏥',
    conversionType: '無料資料請求',
    priority: 7,
  },
  // 結婚 → 結婚相談所（mogana）
  {
    id: 'marriage-agency',
    triggerCategories: ['marriage'],
    lifeEvents: ['marriage'],
    title: '結婚新生活支援金の対象になるかも',
    description: '結婚をお考えの方へ。自治体の支援金を活用しながら、理想のパートナー探しを。',
    ctaText: '結婚相談所を無料で比較する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3CV0KY+5ULO+5YZ75',
    label: 'PR',
    icon: '💍',
    conversionType: '無料資料請求',
    priority: 6,
  },

  // ============================================
  // 小粒案件（全ページで拾う）
  // ============================================

  // リフォーム → 外壁塗装の窓口
  {
    id: 'reform-exterior',
    triggerCategories: ['reform', 'vacant_house'],
    lifeEvents: ['reform'],
    title: '外壁塗装、補助金で安くなるかも',
    description: '外壁塗装の見積もりを最大3社から無料で比較。補助金対応の業者も見つかります。',
    ctaText: '無料で見積もりを比較する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+448YEQ+4V8C+5ZU29',
    label: 'PR',
    icon: '🎨',
    conversionType: '無料見積り申込',
    priority: 5,
  },
  // リフォーム → リフォーム見積もり（Speee）
  {
    id: 'reform-speee',
    triggerCategories: ['reform', 'vacant_house'],
    lifeEvents: ['reform'],
    title: 'リフォーム補助金と併用でさらにお得',
    description: '補助金を活用したリフォームプランを無料で一括比較。地元の優良業者から最適なプランが届きます。',
    ctaText: '無料でリフォームプランを比較する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3X3R5E+410U+5ZMCH',
    label: 'PR',
    icon: '🏠',
    conversionType: '無料見積り申込',
    priority: 4,
  },
  // 引越し → トランクルーム（ランドピア）
  {
    id: 'moving-storage',
    triggerCategories: ['moving', 'migration'],
    lifeEvents: ['moving'],
    title: '引越しの荷物、トランクルームに預けませんか？',
    description: '月額2,520円〜。引越し前後の荷物整理に便利なトランクルームを比較。',
    ctaText: 'トランクルームを探す',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3U4L4I+3GJ2+5YJRM',
    label: 'PR',
    icon: '📦',
    conversionType: '資料請求',
    priority: 3,
  },
  // 引越し → 不用品回収（アシスト）
  {
    id: 'moving-cleanup',
    triggerCategories: ['moving', 'vacant_house'],
    lifeEvents: ['moving'],
    title: '引越し・片付けの不用品、まとめて買取',
    description: '不用品をまとめて査定・買取。引越し費用の足しにも。出張買取で手間なし。',
    ctaText: '無料で査定を依頼する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+44UE0I+36X8+1HMAQP',
    label: 'PR',
    icon: '♻️',
    conversionType: '無料査定申込',
    priority: 3,
  },
  // 障害者 → 生活トラブル対応（シェアリングテクノロジー）
  {
    id: 'disability-support',
    triggerCategories: ['disability'],
    title: '暮らしのお困りごと、すぐに解決',
    description: '水道・鍵・害虫など生活トラブルを24時間対応。お気軽にご相談ください。',
    ctaText: '無料で相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+45FTMA+39GM+NUU7L',
    label: 'PR',
    icon: '💼',
    conversionType: '無料相談',
    priority: 2,
  },
  // 太陽光・省エネ → 太陽光見積もり（WAVE）※グリエネと併用
  {
    id: 'solar-estimate',
    triggerCategories: ['solar', 'appliance', 'ev'],
    lifeEvents: ['energy'],
    title: '太陽光パネルの見積もり、もう1社比較',
    description: '複数メーカーの見積もりを無料で比較。補助金適用後の実質費用がわかります。',
    ctaText: '無料で見積もりを取る',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3WIBJM+5CRG+5ZEMP',
    label: 'PR',
    icon: '⚡',
    conversionType: '無料見積り申込',
    priority: 4,
  },
  // 教育 → 保険見直し（エイチーム）
  {
    id: 'education-insurance',
    triggerCategories: ['education'],
    lifeEvents: ['career'],
    title: '教育費の準備、保険で賢く備える',
    description: '学資保険や積立型保険で教育資金を準備。FPに無料相談できます。',
    ctaText: '無料でFPに相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3K07UA+ZXM+I7NE9',
    label: 'PR',
    icon: '📚',
    conversionType: '無料FP相談',
    priority: 3,
  },
  // 不妊治療 → 保険相談
  {
    id: 'fertility-insurance',
    triggerCategories: ['fertility'],
    lifeEvents: ['baby'],
    title: '不妊治療の費用、保険でカバーできる部分も',
    description: '医療保険の中には不妊治療をカバーするものも。FPに無料で相談して最適なプランを見つけましょう。',
    ctaText: '無料でFPに相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3LSINM+ZXM+6HES1',
    label: 'PR',
    icon: '🍀',
    conversionType: '無料FP相談',
    priority: 5,
  },
  // 防犯 → 防犯カメラ（サフタ）
  {
    id: 'safety-camera',
    triggerCategories: ['safety'],
    title: '防犯カメラ・セキュリティ、補助金活用で設置',
    description: '自治体の防犯補助金を活用して、防犯カメラをお得に設置。無料見積もり受付中。',
    ctaText: '無料で見積もりを取る',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+419SDU+46CI+5YZ77',
    label: 'PR',
    icon: '📹',
    conversionType: '無料見積り申込',
    priority: 2,
  },
];

/**
 * 診断結果のカテゴリに合致するアフィ広告を取得
 * priority降順でソートし、最大2件返す
 */
export function getMatchingAds(resultCategories: string[]): AffiliateAd[] {
  const matched = AFFILIATE_ADS.filter(ad =>
    ad.triggerCategories.some(tc => resultCategories.includes(tc))
  );
  return matched
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 2);
}

/**
 * ライフイベントに合致するアフィ広告を取得
 * priority降順でソート、最大count件返す
 */
export function getAdsByLifeEvent(event: LifeEvent, count = 3): AffiliateAd[] {
  const matched = AFFILIATE_ADS.filter(ad =>
    ad.lifeEvents?.includes(event)
  );
  return matched
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, count);
}

/**
 * ライフイベントに対応する補助金カテゴリを取得
 */
export function getCategoriesForLifeEvent(event: LifeEvent): Category[] {
  return LIFE_EVENT_CATEGORIES[event] ?? [];
}
