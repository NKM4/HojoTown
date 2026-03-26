import type { Category } from './types';

/** アフィリエイト広告の定義 */
export interface AffiliateAd {
  id: string;
  /** 表示するカテゴリ（この補助金カテゴリが結果に含まれている時に表示） */
  triggerCategories: Category[];
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
}

/**
 * カテゴリ連動アフィリエイト広告の定義
 * ASP登録後にurlをアフィリエイトリンクに差し替える
 */
export const AFFILIATE_ADS: AffiliateAd[] = [
  // リフォーム補助金 → リフォーム見積もり（タウンライフ: 23,100円）
  {
    id: 'reform-townlife',
    triggerCategories: ['reform', 'vacant_house'],
    title: 'リフォーム補助金と併用でさらにお得',
    description: '補助金を活用したリフォームプランを無料で一括比較。地元の優良業者から最適なプランが届きます。',
    ctaText: '無料でリフォームプランを比較する',
    url: '#', // ASP登録後に差し替え
    label: 'PR',
    icon: '🏠',
  },
  // 引越し・移住 → 光回線（NURO光: 21,000円）
  {
    id: 'moving-nuro',
    triggerCategories: ['moving', 'migration'],
    title: '引越し先のネット回線、もう決めた？',
    description: '新生活に必要な光回線を比較。工事費実質無料・キャッシュバック付きのプランも。',
    ctaText: '光回線プランを比較する',
    url: '#',
    label: 'PR',
    icon: '🌐',
  },
  // 子育て・医療費 → 保険相談（面談完了: 1〜3万円）
  {
    id: 'childcare-insurance',
    triggerCategories: ['childcare', 'birth', 'medical'],
    title: 'お子さんの将来に備えて、保険の見直しを',
    description: '学資保険・医療保険をFPに無料で相談。補助金ではカバーしきれない将来のリスクに備えましょう。',
    ctaText: '無料でFPに相談する',
    url: '#',
    label: 'PR',
    icon: '🛡️',
  },
  // 高齢者 → 老人ホーム検索（資料請求: 5,000〜15,000円）
  {
    id: 'elderly-home',
    triggerCategories: ['elderly'],
    title: '老人ホーム・介護施設を探していますか？',
    description: 'お住まいの地域の施設を一括検索。費用・空き状況・口コミを比較できます。',
    ctaText: '近くの施設を検索する',
    url: '#',
    label: 'PR',
    icon: '🏥',
  },
  // 障害者 → 就労支援（atGP等: 〜1万円）
  {
    id: 'disability-work',
    triggerCategories: ['disability'],
    title: '障害者向けの就職・転職サポート',
    description: '専門のキャリアアドバイザーが、あなたに合った働き方を一緒に見つけます。',
    ctaText: '無料で相談する',
    url: '#',
    label: 'PR',
    icon: '💼',
  },
  // 結婚 → 結婚相談所（入会: 40,000円）
  {
    id: 'marriage-agency',
    triggerCategories: ['marriage'],
    title: '結婚新生活支援の対象になるかも',
    description: '結婚をお考えの方へ。自治体の支援金を活用しながら、理想のパートナー探しを。',
    ctaText: '結婚相談所を比較する',
    url: '#',
    label: 'PR',
    icon: '💍',
  },
  // 太陽光・省エネ → 太陽光見積もり
  {
    id: 'solar-estimate',
    triggerCategories: ['solar', 'appliance', 'ev'],
    title: '太陽光パネル、補助金でいくらお得に？',
    description: '補助金適用後の実質費用がわかる。複数メーカーの見積もりを無料で比較。',
    ctaText: '無料で見積もりを取る',
    url: '#',
    label: 'PR',
    icon: '☀️',
  },
  // 雇用・教育 → プログラミングスクール（DMM WEBCAMP: 1〜3万円）
  {
    id: 'education-school',
    triggerCategories: ['education'],
    title: '教育訓練給付金で受講料の最大70%が戻る',
    description: '対象の資格スクール・プログラミングスクールなら、給付金を使って大幅にお得に受講できます。',
    ctaText: '対象スクールを見る',
    url: '#',
    label: 'PR',
    icon: '📚',
  },
  // 不妊治療 → 保険相談
  {
    id: 'fertility-insurance',
    triggerCategories: ['fertility'],
    title: '不妊治療の費用、保険でカバーできる部分も',
    description: '医療保険の中には不妊治療をカバーするものも。FPに無料で相談して最適なプランを見つけましょう。',
    ctaText: '無料でFPに相談する',
    url: '#',
    label: 'PR',
    icon: '🍀',
  },
  // 災害 → 火災保険（見積もり: 1,000〜3,000円）
  {
    id: 'disaster-insurance',
    triggerCategories: ['safety'],
    title: '火災保険・地震保険、見直していますか？',
    description: '公的支援の上限は300万円。住宅再建には数千万円かかることも。保険の見直しで備えましょう。',
    ctaText: '火災保険を一括比較する',
    url: '#',
    label: 'PR',
    icon: '🔥',
  },
];

/**
 * 診断結果のカテゴリに合致するアフィ広告を取得
 * 最大2件まで返す（多すぎるとUXが悪い）
 */
export function getMatchingAds(resultCategories: string[]): AffiliateAd[] {
  const matched = AFFILIATE_ADS.filter(ad =>
    ad.triggerCategories.some(tc => resultCategories.includes(tc))
  );
  return matched.slice(0, 2);
}
