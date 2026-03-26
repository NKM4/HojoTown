/** 補助金・助成金の1件分のデータ */
export interface Subsidy {
  /** ユニークID（例: "kawagoe-kosodate-001"） */
  id: string;
  /** 補助金名 */
  name: string;
  /** カテゴリ */
  category: Category;
  /** 市区町村コード */
  cityCode: string;
  /** 市区町村名 */
  cityName: string;
  /** 都道府県名 */
  prefecture: string;
  /** 概要（1-2文） */
  summary: string;
  /** 対象者 */
  target: string;
  /** 金額（表示用テキスト） */
  amount: string;
  /** 金額（最大値、ソート・比較用。不明なら0） */
  maxAmount: number;
  /** 申請期限（なければ "通年"） */
  deadline: string;
  /** 公式ページURL */
  officialUrl: string;
  /** ステータス */
  status: 'active' | 'ended' | 'upcoming';
  /** 最終更新日 */
  lastUpdated: string;
}

/** カテゴリ定義 */
export type Category =
  | 'moving'          // 引越し
  | 'childcare'       // 子育て
  | 'birth'           // 出産・多子支援
  | 'reform'          // 住宅リフォーム
  | 'medical'         // 医療費
  | 'migration'       // 移住支援
  | 'utility'         // 水道光熱費減免
  | 'pet'             // ペット
  | 'wifi'            // Wi-Fi・デジタル
  | 'education'       // 教育・資格取得
  | 'marriage'        // 結婚・新生活
  | 'funeral'         // 葬儀・終活
  | 'vacant_house'    // 空き家改修
  | 'safety'          // 防犯・防災
  | 'disability'      // 障害者手当・福祉
  | 'elderly'         // 高齢者支援・介護
  | 'fertility'       // 不妊治療
  | 'vaccine'         // 予防接種
  | 'school_meal'     // 学校給食
  | 'solar'           // 太陽光・蓄電池
  | 'ev'              // EV・電動車
  | 'appliance'       // 省エネ家電
  | 'helmet'          // 自転車ヘルメット
  | 'license_return'  // 免許返納支援
  | 'other';          // その他

/** カテゴリの表示名マッピング */
export const CATEGORY_LABELS: Record<Category, string> = {
  moving: '引越し',
  childcare: '子育て',
  birth: '出産・多子支援',
  reform: '住宅リフォーム',
  medical: '医療費助成',
  migration: '移住支援',
  utility: '水道光熱費減免',
  pet: 'ペット',
  wifi: 'Wi-Fi・デジタル',
  education: '教育・資格取得',
  marriage: '結婚・新生活',
  funeral: '葬儀・終活',
  vacant_house: '空き家改修',
  safety: '防犯・防災',
  disability: '障害者手当・福祉',
  elderly: '高齢者支援・介護',
  fertility: '不妊治療',
  vaccine: '予防接種',
  school_meal: '学校給食',
  solar: '太陽光・蓄電池',
  ev: 'EV・電動車',
  appliance: '省エネ家電',
  helmet: '自転車ヘルメット',
  license_return: '免許返納支援',
  other: 'その他'
};

/** 市区町村データ */
export interface City {
  code: string;
  name: string;
  prefecture: string;
  prefectureSlug: string;
  slug: string;
  population: number;
}
