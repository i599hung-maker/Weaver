import { BookOpen, Compass, LayoutGrid, MessageSquare, UserRoundPlus, Users } from 'lucide-react';
import { BRAND_NAME, BRAND_TAGLINE } from '../brand';

/** 十二地支：首頁羅盤環，對應命盤十二宮 */
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const FEATURES = [
  {
    icon: LayoutGrid,
    title: '占驗派排盤',
    desc: '依文墨天機安星碼 S5VoG 規則排出十二宮命盤，大限、流年即點即換。',
  },
  {
    icon: MessageSquare,
    title: 'AI 解盤問答',
    desc: '以盤面事實為據向 AI 提問，事業、感情、財運皆可追問到底。',
  },
  {
    icon: BookOpen,
    title: '完整命書',
    desc: '一鍵產生涵蓋本命十二宮與各大限的完整命書，可隨時開啟重讀。',
  },
  {
    icon: Users,
    title: '命主管理',
    desc: '建立多位命主，生辰、盤面與問答紀錄各自保存，互不干擾。',
  },
];

interface Props {
  onAdd: () => void;
}

/** 首頁介紹：未選命主時顯示；點左上角品牌鈕也會回到這裡 */
export default function HomeIntro({ onAdd }: Props) {
  return (
    <div className="home">
      <div className="home-ring" aria-hidden="true">
        <div className="home-ring-spin">
          {BRANCHES.map((b, i) => (
            <span key={b} style={{ transform: `rotate(${i * 30}deg) translateY(-64px)` }}>
              {b}
            </span>
          ))}
        </div>
        <Compass className="home-ring-center" size={30} strokeWidth={1.4} />
      </div>

      <h2 className="home-title">{BRAND_NAME}</h2>
      <p className="home-lede">{BRAND_TAGLINE}</p>

      <div className="home-features">
        {FEATURES.map((f) => (
          <div key={f.title} className="home-feature">
            <f.icon size={18} strokeWidth={1.6} className="home-feature-icon" />
            <div>
              <div className="home-feature-title">{f.title}</div>
              <div className="home-feature-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="home-note">
        <span className="home-note-label">門派之別</span>
        占驗派與通行排法不同：十干四化鎖死、庚干「陽武同相」；天馬依月支；截空、旬空單星制；
        晚子時歸次日，並以真太陽時定時辰。
      </div>

      <button className="primary home-cta" onClick={onAdd}>
        <UserRoundPlus size={16} strokeWidth={1.8} />
        新增命主，開始排盤
      </button>
      <div className="home-hint">所有資料只儲存在這台裝置的瀏覽器裡。</div>
    </div>
  );
}
