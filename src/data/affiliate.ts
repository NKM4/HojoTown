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
  // リフォーム補助金 → リフォーム見積もり（Speee）
  {
    id: 'reform-speee',
    triggerCategories: ['reform', 'vacant_house'],
    title: 'リフォーム補助金と併用でさらにお得',
    description: '補助金を活用したリフォームプランを無料で一括比較。地元の優良業者から最適なプランが届きます。',
    ctaText: '無料でリフォームプランを比較する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3X3R5E+410U+5ZMCH',
    label: 'PR',
    icon: '🏠',
  },
  // 外壁塗装 → 外壁塗装の窓口
  {
    id: 'reform-exterior',
    triggerCategories: ['reform', 'vacant_house'],
    title: '外壁塗装、補助金で安くなるかも',
    description: '外壁塗装の見積もりを最大3社から無料で比較。補助金対応の業者も見つかります。',
    ctaText: '無料で見積もりを比較する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+448YEQ+4V8C+5ZU29',
    label: 'PR',
    icon: '🎨',
  },
  // 引越し・移住 → トランクルーム（ランドピア）
  {
    id: 'moving-storage',
    triggerCategories: ['moving', 'migration'],
    title: '引越しの荷物、トランクルームに預けませんか？',
    description: '月額2,520円〜。引越し前後の荷物整理に便利なトランクルームを比較。',
    ctaText: 'トランクルームを探す',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3U4L4I+3GJ2+5YJRM',
    label: 'PR',
    icon: '📦',
  },
  // 引越し → 不用品回収（アシスト）
  {
    id: 'moving-cleanup',
    triggerCategories: ['moving', 'vacant_house'],
    title: '引越し・片付けの不用品、まとめて買取',
    description: '不用品をまとめて査定・買取。引越し費用の足しにも。出張買取で手間なし。',
    ctaText: '無料で査定を依頼する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+44UE0I+36X8+1HMAQP',
    label: 'PR',
    icon: '♻️',
  },
  // 子育て・医療費 → 保険相談（エイチームライフデザイン）
  {
    id: 'childcare-insurance',
    triggerCategories: ['childcare', 'birth', 'medical'],
    title: 'お子さんの将来に備えて、保険の見直しを',
    description: '学資保険・医療保険をFPに無料で相談。補助金ではカバーしきれない将来のリスクに備えましょう。',
    ctaText: '無料でFPに相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3LSINM+ZXM+6HES1',
    label: 'PR',
    icon: '🛡️',
  },
  // 高齢者 → 老人ホーム検索（クオリティライフ・コンシェルジュ）
  {
    id: 'elderly-home',
    triggerCategories: ['elderly'],
    title: '老人ホーム・介護施設を探していますか？',
    description: 'お住まいの地域の施設を一括検索。費用・空き状況・口コミを比較できます。',
    ctaText: '近くの施設を検索する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3SCAB6+3E5S+5YJRM',
    label: 'PR',
    icon: '🏥',
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
  },
  // 結婚 → 結婚相談所（mogana）
  {
    id: 'marriage-agency',
    triggerCategories: ['marriage'],
    title: '結婚新生活支援の対象になるかも',
    description: '結婚をお考えの方へ。自治体の支援金を活用しながら、理想のパートナー探しを。',
    ctaText: '結婚相談所を比較する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3CV0KY+5ULO+5YZ75',
    label: 'PR',
    icon: '💍',
  },
  // 太陽光・省エネ → 太陽光見積もり（WAVE）
  {
    id: 'solar-estimate',
    triggerCategories: ['solar', 'appliance', 'ev'],
    title: '太陽光パネル、補助金でいくらお得に？',
    description: '補助金適用後の実質費用がわかる。複数メーカーの見積もりを無料で比較。',
    ctaText: '無料で見積もりを取る',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3WIBJM+5CRG+5ZEMP',
    label: 'PR',
    icon: '☀️',
  },
  // 雇用・教育 → 保険見直し（エイチームライフデザイン）
  {
    id: 'education-insurance',
    triggerCategories: ['education'],
    title: '教育費の準備、保険で賢く備える',
    description: '学資保険や積立型保険で教育資金を準備。FPに無料相談できます。',
    ctaText: '無料でFPに相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3K07UA+ZXM+I7NE9',
    label: 'PR',
    icon: '📚',
  },
  // 不妊治療 → 保険相談（エイチームライフデザイン）
  {
    id: 'fertility-insurance',
    triggerCategories: ['fertility'],
    title: '不妊治療の費用、保険でカバーできる部分も',
    description: '医療保険の中には不妊治療をカバーするものも。FPに無料で相談して最適なプランを見つけましょう。',
    ctaText: '無料でFPに相談する',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+3LSINM+ZXM+6HES1',
    label: 'PR',
    icon: '🍀',
  },
  // 災害・防犯 → 防犯カメラ（サフタ）
  {
    id: 'safety-camera',
    triggerCategories: ['safety'],
    title: '防犯カメラ・セキュリティ、補助金活用で設置',
    description: '自治体の防犯補助金を活用して、防犯カメラをお得に設置。無料見積もり受付中。',
    ctaText: '無料で見積もりを取る',
    url: 'https://px.a8.net/svt/ejp?a8mat=4AZPON+419SDU+46CI+5YZ77',
    label: 'PR',
    icon: '📹',
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
