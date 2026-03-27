import { useState, useMemo } from 'react';
import type { Subsidy } from '../data/types';
import { CATEGORY_LABELS } from '../data/types';
import { getMatchingAds } from '../data/affiliate';
import postalMap from '../data/postal-codes.json';

interface Props {
  allSubsidies: Subsidy[];
  cities: { code: string; name: string; prefecture: string; slug: string; prefectureSlug: string }[];
}

/** 子ども1人分の情報 */
interface Child {
  age: string; // 'baby_0' | 'baby_1' | 'baby_2' | 'preschool' | 'elementary_lower' | 'elementary_upper' | 'junior_high' | 'high_school'
}

/** 障害の種類 */
interface DisabilityInfo {
  hasPhysical: boolean;     // 身体障害
  physicalGrade: string;    // '1' | '2' | '3' | '4' | '5' | '6' | ''
  hasIntellectual: boolean; // 知的障害
  intellectualGrade: string; // 'marua' | 'a' | 'b' | 'c' | ''
  hasMental: boolean;       // 精神障害
  mentalGrade: string;      // '1' | '2' | '3' | ''
}

interface UserProfile {
  // STEP 1: 地域
  postalCode: string;
  cityCode: string;
  cityName: string;

  // STEP 2: 世帯
  livingAlone: boolean;
  isPregnant: boolean;
  pregnancyMonth: string; // '1'〜'10' or ''
  hasChildren: boolean;
  children: Child[];
  isSingleParent: boolean;

  // STEP 3: 健康・障害
  hasDisability: boolean;
  disability: DisabilityInfo;
  hasElderly: boolean;
  elderlyAge: string; // '65-69' | '70-79' | '80-89' | '90+' | ''
  elderlyNeedsCare: boolean;
  careLevel: string; // '1'〜'5' | ''

  // STEP 4: 住宅
  ownsHome: boolean;
  planningReform: boolean;
  wantsSolar: boolean;
  hasPet: boolean;

  // STEP 5: 今後の予定
  planningMove: boolean;
  planningMarriage: boolean;
  wantsFertility: boolean;
}

const STEPS = [
  { id: 'area', title: 'お住まいの地域' },
  { id: 'household', title: '世帯構成' },
  { id: 'health', title: '健康・障害' },
  { id: 'housing', title: '住宅・暮らし' },
  { id: 'plans', title: '今後の予定' },
] as const;

const AGE_OPTIONS = [
  { value: 'baby_0', label: '0歳' },
  { value: 'baby_1', label: '1歳' },
  { value: 'baby_2', label: '2歳' },
  { value: 'preschool', label: '3〜5歳（未就学）' },
  { value: 'elementary_lower', label: '小学1〜3年' },
  { value: 'elementary_upper', label: '小学4〜6年' },
  { value: 'junior_high', label: '中学生' },
  { value: 'high_school', label: '高校生' },
];

const emptyDisability: DisabilityInfo = {
  hasPhysical: false, physicalGrade: '',
  hasIntellectual: false, intellectualGrade: '',
  hasMental: false, mentalGrade: '',
};

const initialProfile: UserProfile = {
  postalCode: '', cityCode: '', cityName: '',
  livingAlone: false,
  isPregnant: false, pregnancyMonth: '',
  hasChildren: false, children: [],
  isSingleParent: false,
  hasDisability: false, disability: { ...emptyDisability },
  hasElderly: false, elderlyAge: '', elderlyNeedsCare: false, careLevel: '',
  ownsHome: false, planningReform: false, wantsSolar: false,
  hasPet: false,
  planningMove: false, planningMarriage: false, wantsFertility: false,
};

const STORAGE_KEY = 'hojotown_profile';

function loadSavedProfile(): UserProfile | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // 必須フィールドの存在チェック
    if (parsed.postalCode && parsed.cityCode) return parsed;
    return null;
  } catch { return null; }
}

function saveProfile(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

function clearSavedProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export default function ShindanForm({ allSubsidies, cities }: Props) {
  const saved = loadSavedProfile();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>(saved || initialProfile);
  const [showResult, setShowResult] = useState(!!saved);
  const [showWelcomeBack, setShowWelcomeBack] = useState(!!saved);

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  // 郵便番号→市区町村の自動判定（7桁全部取ってから判定）
  const handlePostalCode = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length <= 7) {
      // 7桁入力されたら判定
      if (cleaned.length === 7) {
        const prefix = cleaned.substring(0, 3);
        const match = (postalMap as Record<string, { code: string; name: string; prefecture: string }>)[prefix];
        if (match) {
          setProfile(prev => ({ ...prev, postalCode: cleaned, cityCode: match.code, cityName: `${match.prefecture} ${match.name}` }));
        } else {
          setProfile(prev => ({ ...prev, postalCode: cleaned, cityCode: '', cityName: '' }));
        }
      } else {
        // 7桁未満の途中入力 → まだ判定しない
        setProfile(prev => ({ ...prev, postalCode: cleaned, cityCode: '', cityName: '' }));
      }
    }
  };

  // 子ども追加・削除
  const addChild = () => {
    setProfile(prev => ({ ...prev, children: [...prev.children, { age: '' }] }));
  };
  const removeChild = (index: number) => {
    setProfile(prev => ({ ...prev, children: prev.children.filter((_, i) => i !== index) }));
  };
  const setChildAge = (index: number, age: string) => {
    setProfile(prev => ({
      ...prev,
      children: prev.children.map((c, i) => i === index ? { ...c, age } : c),
    }));
  };

  // 障害情報更新
  const setDisability = <K extends keyof DisabilityInfo>(key: K, value: DisabilityInfo[K]) => {
    setProfile(prev => ({ ...prev, disability: { ...prev.disability, [key]: value } }));
  };

  const selectedCity = cities.find(c => c.code === profile.cityCode);

  // フィルタリング（属性マッチング）
  const filterByProfile = (subsidies: Subsidy[]) => {
    if (!profile.cityCode) return [];

    const hasSmallChild = profile.children.some(c => ['baby_0', 'baby_1', 'baby_2'].includes(c.age));
    const hasSchoolChild = profile.children.some(c =>
      ['elementary_lower', 'elementary_upper', 'junior_high'].includes(c.age)
    );
    const hasAnyChild = profile.hasChildren && profile.children.length > 0;

    return subsidies.filter(s => {
      if (s.cityCode !== profile.cityCode) return false;
      const cat = s.category;

      if (cat === 'childcare' && !hasAnyChild && !profile.isPregnant) return false;
      if (cat === 'birth' && !profile.isPregnant && !hasSmallChild) return false;
      if (cat === 'reform' && (!profile.ownsHome || !profile.planningReform)) return false;
      if (cat === 'disability' && !profile.hasDisability) return false;
      if (cat === 'elderly' && !profile.hasElderly) return false;
      if (cat === 'moving' && !profile.planningMove) return false;
      if (cat === 'marriage' && !profile.planningMarriage) return false;
      if (cat === 'pet' && !profile.hasPet) return false;
      if (cat === 'solar' && (!profile.ownsHome || !profile.wantsSolar)) return false;
      if (cat === 'fertility' && !profile.wantsFertility) return false;
      if (cat === 'school_meal' && !hasSchoolChild) return false;

      return true;
    });
  };

  // 受付中のみ → 診断結果に表示
  const matchedSubsidies = useMemo(() =>
    filterByProfile(allSubsidies).filter(s => s.status === 'active'),
    [profile, allSubsidies]
  );

  // 受付終了 → 折りたたみで参考表示
  const endedSubsidies = useMemo(() =>
    filterByProfile(allSubsidies).filter(s => s.status === 'ended'),
    [profile, allSubsidies]
  );

  const totalMaxAmount = matchedSubsidies.reduce((sum, s) => sum + s.maxAmount, 0);
  const [showEnded, setShowEnded] = useState(false);

  const canProceed = (): boolean => {
    if (step === 0) return profile.postalCode.length === 7 && !!profile.cityCode;
    return true;
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setShowResult(true);
      setShowWelcomeBack(false);
      // プロフィールを保存（再訪時に復元用）
      saveProfile(profile);
      // 匿名ログも保存（集計用）
      try {
        const log = JSON.parse(localStorage.getItem('shindan_log') || '[]');
        log.push({
          cityCode: profile.cityCode,
          livingAlone: profile.livingAlone,
          isPregnant: profile.isPregnant,
          pregnancyMonth: profile.pregnancyMonth,
          childrenCount: profile.children.length,
          childrenAges: profile.children.map(c => c.age),
          isSingleParent: profile.isSingleParent,
          hasDisability: profile.hasDisability,
          disabilityTypes: {
            physical: profile.disability.hasPhysical,
            intellectual: profile.disability.hasIntellectual,
            mental: profile.disability.hasMental,
          },
          hasElderly: profile.hasElderly,
          elderlyAge: profile.elderlyAge,
          careLevel: profile.careLevel,
          ownsHome: profile.ownsHome,
          planningReform: profile.planningReform,
          planningMove: profile.planningMove,
          planningMarriage: profile.planningMarriage,
          wantsFertility: profile.wantsFertility,
          resultCount: matchedSubsidies.length,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem('shindan_log', JSON.stringify(log));
        // GA4カスタムイベント: 診断完了
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'shindan_completed', {
            city_code: profile.cityCode,
            result_count: matchedSubsidies.length,
            has_children: profile.children.length > 0,
            is_pregnant: profile.isPregnant,
            owns_home: profile.ownsHome,
            planning_move: profile.planningMove,
          });
        }
      } catch {}
    }
  };

  const back = () => {
    if (showResult) setShowResult(false);
    else if (step > 0) setStep(step - 1);
  };

  const reset = () => {
    clearSavedProfile();
    setProfile(initialProfile);
    setStep(0);
    setShowResult(false);
    setShowWelcomeBack(false);
  };

  // 特定ステップに飛んで編集
  const editStep = (targetStep: number) => {
    setStep(targetStep);
    setShowResult(false);
    setShowWelcomeBack(false);
  };

  // ───── 結果画面 ─────
  if (showResult) {
    return (
      <div className="shindan-result">
        {/* おかえり表示 */}
        {showWelcomeBack && (
          <div className="welcome-back">
            <p className="welcome-back-text">前回の診断結果を表示しています</p>
            <div className="welcome-back-actions">
              <button onClick={() => setShowWelcomeBack(false)} className="welcome-back-dismiss">OK</button>
              <button onClick={reset} className="welcome-back-reset">最初からやり直す</button>
            </div>
          </div>
        )}

        <div className="result-header">
          <p className="result-city">{profile.cityName}</p>
          <h2 className="result-title">あなたがもらえる可能性のある補助金</h2>
          <div className="result-summary">
            <div className="result-count">
              <span className="result-number">{matchedSubsidies.length}</span>件
            </div>
            {totalMaxAmount > 0 && (
              <div className="result-amount">
                最大合計 <span className="result-number">{totalMaxAmount.toLocaleString()}</span>円
              </div>
            )}
          </div>
          {profile.children.length > 0 && (
            <p className="result-note">
              お子さん{profile.children.length}人の世帯として診断しました
            </p>
          )}
        </div>

        <div className="result-list">
          {matchedSubsidies.map(s => (
            <div key={s.id} className="result-card">
              <span className="result-tag">{CATEGORY_LABELS[s.category as keyof typeof CATEGORY_LABELS]}</span>
              <h3>{s.name}</h3>
              <p className="result-card-amount">{s.amount}</p>
              <p className="result-card-summary">{s.summary}</p>
              <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="result-link">
                公式サイトで詳細を確認 →
              </a>
            </div>
          ))}
        </div>

        {matchedSubsidies.length === 0 && (
          <div className="result-empty">
            <p>現在受付中の該当する補助金が見つかりませんでした。</p>
            <p>条件を変えてもう一度お試しください。</p>
          </div>
        )}

        {/* カテゴリ連動アフィリエイト広告 */}
        {(() => {
          const resultCategories = [...new Set(matchedSubsidies.map(s => s.category))];
          const ads = getMatchingAds(resultCategories);
          if (ads.length === 0) return null;
          return (
            <div className="affiliate-section">
              {ads.map(ad => (
                <a key={ad.id} href={ad.url} target="_blank" rel="noopener noreferrer sponsored" className="affiliate-card">
                  <span className="affiliate-label">{ad.label}</span>
                  <div className="affiliate-content">
                    <span className="affiliate-icon">{ad.icon}</span>
                    <div>
                      <h4 className="affiliate-title">{ad.title}</h4>
                      <p className="affiliate-desc">{ad.description}</p>
                    </div>
                  </div>
                  <span className="affiliate-cta">{ad.ctaText}</span>
                </a>
              ))}
            </div>
          );
        })()}

        {/* 受付終了した制度（折りたたみ） */}
        {endedSubsidies.length > 0 && (
          <div className="ended-section">
            <button onClick={() => setShowEnded(!showEnded)} className="ended-toggle">
              <span>過去にあった制度（受付終了）</span>
              <span className="ended-count">{endedSubsidies.length}件</span>
              <span className="ended-arrow">{showEnded ? '▲' : '▼'}</span>
            </button>
            {showEnded && (
              <div className="ended-list">
                <p className="ended-note">以下の制度は現在受付終了していますが、次年度以降に再開される可能性があります。</p>
                {endedSubsidies.map(s => (
                  <div key={s.id} className="result-card ended-card">
                    <span className="result-tag ended-tag">受付終了</span>
                    <h3>{s.name}</h3>
                    <p className="result-card-amount">{s.amount}</p>
                    <p className="result-card-summary">{s.summary}</p>
                    <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="result-link">
                      公式サイトで詳細を確認 →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LINE保存 */}
        <div className="line-save-card">
          <div className="line-save-icon">💚</div>
          <h3>この診断結果をLINEに保存する</h3>
          <p>LINE公式アカウントに友だち追加すると、診断結果が保存され、<strong>あなたの条件に合った新着補助金</strong>が自動で届きます。</p>
          <a href="https://lin.ee/oHiY2Pp" className="line-save-btn" target="_blank" rel="noopener">LINEで保存＆通知を受け取る</a>
          <span className="line-save-note">無料で友だち追加</span>
        </div>

        {/* 条件編集ボタン */}
        <div className="edit-conditions">
          <p className="edit-conditions-title">条件を変更して再診断</p>
          <div className="edit-conditions-grid">
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => editStep(i)} className="edit-step-btn">
                {s.title}を変更
              </button>
            ))}
          </div>
        </div>

        <div className="result-actions">
          <button onClick={reset} className="shindan-btn shindan-btn-secondary">最初からやり直す</button>
          {selectedCity && (
            <a href={`/${selectedCity.prefectureSlug}/${selectedCity.slug}/`} className="shindan-btn shindan-btn-primary">
              {selectedCity.name}の全補助金を見る
            </a>
          )}
        </div>

        <div className="saved-notice">
          💾 診断結果はこのブラウザに一時保存されています。LINEに保存すると、端末を変えても復元できます。
        </div>

        <div className="shindan-disclaimer">
          ※ 診断結果は参考情報です。実際の受給条件は各自治体の公式サイトでご確認ください。
        </div>
      </div>
    );
  }

  // ───── フォーム画面 ─────
  return (
    <div className="shindan-form">
      {/* プログレスバー */}
      <div className="progress-bar">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`progress-step ${i <= step ? 'active' : ''} ${i === step ? 'current' : ''}`}>
            <div className="progress-dot">{i < step ? '✓' : i + 1}</div>
            <span className="progress-label">{s.title}</span>
          </div>
        ))}
      </div>

      <div className="step-content">

        {/* ───── STEP 1: 地域 ───── */}
        {step === 0 && (
          <div className="step-panel">
            <h2 className="step-title">お住まいの郵便番号を入力してください</h2>
            <p className="step-subtitle">ハイフンなしの7桁で入力してください</p>
            <div className="postal-input-wrap">
              <span className="postal-prefix">〒</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                placeholder="3500043"
                value={profile.postalCode}
                onChange={e => handlePostalCode(e.target.value)}
                className="postal-input"
                autoFocus
              />
              <span className="postal-count">{profile.postalCode.length}/7</span>
            </div>
            {profile.postalCode.length === 7 && profile.cityName && (
              <div className="postal-result">
                <span className="postal-check">✓</span>
                <span>{profile.cityName}にお住まいですね</span>
              </div>
            )}
            {profile.postalCode.length === 7 && !profile.cityCode && (
              <div className="postal-error">
                <p>この地域（〒{profile.postalCode}）はまだ対応していません。</p>
                <p style={{marginTop: '8px'}}>対応エリアから選んでください：</p>
                <div className="city-fallback-grid">
                  {cities.map(city => (
                    <button
                      key={city.code}
                      className={`select-btn ${profile.cityCode === city.code ? 'selected' : ''}`}
                      onClick={() => setProfile(prev => ({ ...prev, cityCode: city.code, cityName: `${city.prefecture} ${city.name}` }))}
                    >
                      <span className="select-btn-main">{city.name}</span>
                      <span className="select-btn-sub">{city.prefecture}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ───── STEP 2: 世帯構成 ───── */}
        {step === 1 && (
          <div className="step-panel">
            <h2 className="step-title">世帯の状況を教えてください</h2>
            <div className="check-group">

              <label className="check-item">
                <input type="checkbox" checked={profile.livingAlone} onChange={e => set('livingAlone', e.target.checked)} />
                <span className="check-label">🏢 一人暮らし</span>
              </label>

              {!profile.livingAlone && (
                <>
                  <label className="check-item">
                    <input type="checkbox" checked={profile.isPregnant} onChange={e => set('isPregnant', e.target.checked)} />
                    <span className="check-label">🤰 現在妊娠中</span>
                  </label>

                  {profile.isPregnant && (
                    <div className="sub-select">
                      <p className="sub-select-label">現在の妊娠月数は？</p>
                      <div className="radio-group">
                        {['初期（〜4ヶ月）', '中期（5〜7ヶ月）', '後期（8〜9ヶ月）', '臨月（10ヶ月）'].map((label, i) => {
                          const val = String(i + 1);
                          return (
                            <label key={val} className={`radio-item ${profile.pregnancyMonth === val ? 'selected' : ''}`}>
                              <input type="radio" name="pregnancyMonth" value={val}
                                checked={profile.pregnancyMonth === val}
                                onChange={() => set('pregnancyMonth', val)} />
                              {label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <label className="check-item">
                    <input type="checkbox" checked={profile.hasChildren}
                      onChange={e => {
                        set('hasChildren', e.target.checked);
                        if (e.target.checked && profile.children.length === 0) {
                          setProfile(prev => ({ ...prev, hasChildren: true, children: [{ age: '' }] }));
                        }
                      }} />
                    <span className="check-label">👶 子どもがいる</span>
                  </label>

                  {profile.hasChildren && (
                    <div className="sub-select">
                      <p className="sub-select-label">お子さんの人数と年齢を教えてください</p>
                      {profile.children.map((child, i) => (
                        <div key={i} className="child-row">
                          <span className="child-label">{i + 1}人目</span>
                          <select
                            value={child.age}
                            onChange={e => setChildAge(i, e.target.value)}
                            className="child-select"
                          >
                            <option value="">年齢を選択</option>
                            {AGE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {profile.children.length > 1 && (
                            <button onClick={() => removeChild(i)} className="child-remove">✕</button>
                          )}
                        </div>
                      ))}
                      <button onClick={addChild} className="add-child-btn">＋ 子どもを追加</button>
                    </div>
                  )}

                  <label className="check-item">
                    <input type="checkbox" checked={profile.isSingleParent} onChange={e => set('isSingleParent', e.target.checked)} />
                    <span className="check-label">👤 ひとり親家庭</span>
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* ───── STEP 3: 健康・障害 ───── */}
        {step === 2 && (
          <div className="step-panel">
            <h2 className="step-title">ご本人またはご家族の健康状態について</h2>
            <p className="step-subtitle">当てはまるものをすべて選んでください（なければそのまま「次へ」）</p>
            <div className="check-group">

              <label className="check-item">
                <input type="checkbox" checked={profile.hasDisability} onChange={e => set('hasDisability', e.target.checked)} />
                <span className="check-label">♿ 障害のある方がいる</span>
              </label>

              {profile.hasDisability && (
                <div className="sub-select">
                  <p className="sub-select-label">障害の種類を教えてください（複数選択可）</p>

                  <label className="check-item-sm">
                    <input type="checkbox" checked={profile.disability.hasPhysical}
                      onChange={e => setDisability('hasPhysical', e.target.checked)} />
                    <span>身体障害</span>
                  </label>
                  {profile.disability.hasPhysical && (
                    <div className="grade-select">
                      <span className="grade-label">等級:</span>
                      <div className="radio-group">
                        {['1', '2', '3', '4', '5', '6'].map(g => (
                          <label key={g} className={`radio-item-sm ${profile.disability.physicalGrade === g ? 'selected' : ''}`}>
                            <input type="radio" name="physicalGrade" value={g}
                              checked={profile.disability.physicalGrade === g}
                              onChange={() => setDisability('physicalGrade', g)} />
                            {g}級
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="check-item-sm">
                    <input type="checkbox" checked={profile.disability.hasIntellectual}
                      onChange={e => setDisability('hasIntellectual', e.target.checked)} />
                    <span>知的障害</span>
                  </label>
                  {profile.disability.hasIntellectual && (
                    <div className="grade-select">
                      <span className="grade-label">程度:</span>
                      <div className="radio-group">
                        {[
                          { value: 'marua', label: '丸A（最重度）' },
                          { value: 'a', label: 'A（重度）' },
                          { value: 'b', label: 'B（中度）' },
                          { value: 'c', label: 'C（軽度）' },
                        ].map(opt => (
                          <label key={opt.value} className={`radio-item-sm ${profile.disability.intellectualGrade === opt.value ? 'selected' : ''}`}>
                            <input type="radio" name="intellectualGrade" value={opt.value}
                              checked={profile.disability.intellectualGrade === opt.value}
                              onChange={() => setDisability('intellectualGrade', opt.value)} />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="check-item-sm">
                    <input type="checkbox" checked={profile.disability.hasMental}
                      onChange={e => setDisability('hasMental', e.target.checked)} />
                    <span>精神障害</span>
                  </label>
                  {profile.disability.hasMental && (
                    <div className="grade-select">
                      <span className="grade-label">等級:</span>
                      <div className="radio-group">
                        {['1', '2', '3'].map(g => (
                          <label key={g} className={`radio-item-sm ${profile.disability.mentalGrade === g ? 'selected' : ''}`}>
                            <input type="radio" name="mentalGrade" value={g}
                              checked={profile.disability.mentalGrade === g}
                              onChange={() => setDisability('mentalGrade', g)} />
                            {g}級
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <label className="check-item">
                <input type="checkbox" checked={profile.hasElderly} onChange={e => set('hasElderly', e.target.checked)} />
                <span className="check-label">👴 65歳以上の方がいる</span>
              </label>

              {profile.hasElderly && (
                <div className="sub-select">
                  <p className="sub-select-label">年齢帯を教えてください</p>
                  <div className="radio-group">
                    {[
                      { value: '65-69', label: '65〜69歳' },
                      { value: '70-79', label: '70〜79歳' },
                      { value: '80-89', label: '80〜89歳' },
                      { value: '90+', label: '90歳以上' },
                    ].map(opt => (
                      <label key={opt.value} className={`radio-item ${profile.elderlyAge === opt.value ? 'selected' : ''}`}>
                        <input type="radio" name="elderlyAge" value={opt.value}
                          checked={profile.elderlyAge === opt.value}
                          onChange={() => set('elderlyAge', opt.value)} />
                        {opt.label}
                      </label>
                    ))}
                  </div>

                  <label className="check-item-sm" style={{ marginTop: '12px' }}>
                    <input type="checkbox" checked={profile.elderlyNeedsCare}
                      onChange={e => set('elderlyNeedsCare', e.target.checked)} />
                    <span>要介護認定を受けている</span>
                  </label>
                  {profile.elderlyNeedsCare && (
                    <div className="grade-select">
                      <span className="grade-label">要介護度:</span>
                      <div className="radio-group">
                        {['要支援1', '要支援2', '要介護1', '要介護2', '要介護3', '要介護4', '要介護5'].map((label, i) => {
                          const val = String(i + 1);
                          return (
                            <label key={val} className={`radio-item-sm ${profile.careLevel === val ? 'selected' : ''}`}>
                              <input type="radio" name="careLevel" value={val}
                                checked={profile.careLevel === val}
                                onChange={() => set('careLevel', val)} />
                              {label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───── STEP 4: 住宅 ───── */}
        {step === 3 && (
          <div className="step-panel">
            <h2 className="step-title">住宅・暮らしについて教えてください</h2>
            <div className="check-group">
              <label className="check-item">
                <input type="checkbox" checked={profile.ownsHome} onChange={e => set('ownsHome', e.target.checked)} />
                <span className="check-label">🏠 持ち家に住んでいる</span>
              </label>
              {profile.ownsHome && (
                <>
                  <label className="check-item sub">
                    <input type="checkbox" checked={profile.planningReform} onChange={e => set('planningReform', e.target.checked)} />
                    <span className="check-label">🔨 リフォームを検討している</span>
                  </label>
                  <label className="check-item sub">
                    <input type="checkbox" checked={profile.wantsSolar} onChange={e => set('wantsSolar', e.target.checked)} />
                    <span className="check-label">☀️ 太陽光・蓄電池を検討している</span>
                  </label>
                </>
              )}
              <label className="check-item">
                <input type="checkbox" checked={profile.hasPet} onChange={e => set('hasPet', e.target.checked)} />
                <span className="check-label">🐾 ペットを飼っている</span>
              </label>
            </div>
          </div>
        )}

        {/* ───── STEP 5: 今後の予定 ───── */}
        {step === 4 && (
          <div className="step-panel">
            <h2 className="step-title">今後の予定はありますか？</h2>
            <p className="step-subtitle">当てはまるものをすべて選んでください（なければそのまま「結果を見る」）</p>
            <div className="check-group">
              <label className="check-item">
                <input type="checkbox" checked={profile.planningMove} onChange={e => set('planningMove', e.target.checked)} />
                <span className="check-label">📦 引越しを予定している</span>
              </label>
              <label className="check-item">
                <input type="checkbox" checked={profile.planningMarriage} onChange={e => set('planningMarriage', e.target.checked)} />
                <span className="check-label">💍 結婚を予定している</span>
              </label>
              <label className="check-item">
                <input type="checkbox" checked={profile.wantsFertility} onChange={e => set('wantsFertility', e.target.checked)} />
                <span className="check-label">🍀 不妊治療を検討している</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div className="step-nav">
        {step > 0 && (
          <button onClick={back} className="shindan-btn shindan-btn-secondary">戻る</button>
        )}
        <button onClick={next} className="shindan-btn shindan-btn-primary" disabled={!canProceed()}>
          {step === STEPS.length - 1 ? '結果を見る' : '次へ'}
        </button>
      </div>
    </div>
  );
}
