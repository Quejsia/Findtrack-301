import React from "react";
import { useTranslation } from "react-i18next";
import { 
  ShoppingBag, 
  Search, 
  Users, 
  CheckSquare, 
  MessageSquare 
} from "lucide-react";

export interface ItemReport {
  id: string;
  userId: string;
  title: string;
  location: string;
  desc?: string;
  description?: string;
  type: "lost" | "found";
  image?: string;
  imageUrl?: string;
  createdAt: any;
  claimed: boolean;
  contactName?: string;
  date?: string;
}

interface HomeProps {
  items: ItemReport[];
  stats: { lost: number; found: number; claimed: number };
  members?: number;
  profileName: string;
  setActiveTab: (tab: string) => void;
  setCategoryKeywords: (keywords: string[] | null) => void;
  setShowGuestModal: (show: boolean) => void;
}

const StatGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">{children}</div>
);

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: number | string }> = ({ icon: Icon, label, value }) => (
  <div className="bg-[#D3E8E5] p-5 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
    <Icon className="w-8 h-8 text-[#1A7B72] mb-3" strokeWidth={1.5} aria-hidden="true" />
    <div className="text-sm font-medium text-[#15605A] leading-tight mb-1">{label}:</div>
    <div className="text-3xl font-bold text-[#1A7B72]">{value}</div>
  </div>
);

// Show only a safe display name: never an email prefix or a username with digits.
const safeFirstName = (name?: string) => {
  const first = name?.trim().split(/\s+/)[0] || '';
  return first && !first.includes('@') && !/\d/.test(first) ? first : '';
};

export const Home: React.FC<HomeProps> = ({
  items,
  stats,
  members,
  profileName,
  setActiveTab,
  setCategoryKeywords,
  setShowGuestModal,
}) => {
  const { t, i18n } = useTranslation();

  const getGreetingKey = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'greeting.morning';
    } else if (hour >= 12 && hour < 18) {
      return 'greeting.afternoon';
    } else {
      return 'greeting.evening';
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-8 flex items-center gap-2">
        {t(getGreetingKey())}
      </h1>
      
      {/* Stats row */}
      <StatGrid>
        <StatCard icon={ShoppingBag} label={t('dashboard.itemsReported')} value={stats.lost + stats.found} />
        <StatCard icon={Search} label={t('dashboard.itemsFound')} value={stats.found} />
        <StatCard
          icon={Users}
          label={t('dashboard.communityMembers')}
          value={members ?? (new Set(items.map(i => i.userId).filter(Boolean)).size || 1)}
        />
        <StatCard icon={CheckSquare} label={t('dashboard.recoveriesThisWeek')} value={stats.claimed} />
      </StatGrid>

      {/* Content row */}
      <div className="grid md:grid-cols-2 gap-6 mb-8 flex-1 min-h-[384px]">
        {/* Recent Community Activity */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50 flex flex-col h-full">
          <h2 className="text-xl font-bold text-on-surface mb-6">{t('dashboard.recentCommunityActivity')}</h2>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {items.slice(0, 6).map((r) => (
              <div key={r.id} className="text-sm border-b border-slate-50 pb-4 last:border-0">
                <span className="font-semibold text-on-surface">{r.type === 'lost' ? t('dashboard.lost') : t('dashboard.found')} {r.title}</span> {r.location ? `${t('dashboard.in', 'in')} ${r.location}` : ''} - 
                <span className="text-on-surface-variant ml-1">{t('dashboard.reportedBy', 'Reported by')} {safeFirstName(r.contactName) || t('dashboard.member', 'Member')} ({r.date ? new Date(r.date).toLocaleDateString(i18n.language) : t('search.recent', 'Recent')})</span>
              </div>
            ))}
            {items.length === 0 && <div className="text-on-surface-variant text-sm">{t('dashboard.noRecentActivity')}</div>}
          </div>
        </div>
        
        {/* Private Messages */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50 flex flex-col h-full">
          <h2 className="text-xl font-bold text-on-surface mb-6">{t('dashboard.privateMessages')}</h2>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2 flex items-center justify-center flex-col text-on-surface-variant">
            <MessageSquare className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-sm font-medium">{t('dashboard.noMessagesYet')}</p>
            <p className="text-xs text-center mt-1">{t('dashboard.whenSomeoneContactsYouAboutYourReportedItemItWillAppearHere')}</p>
          </div>
        </div>
      </div>

      {/* Footer Banner */}
      <div className="mt-auto bg-[#1A7B72] text-white text-center py-5 px-6 rounded-xl font-medium shadow-md">
        {t('dashboard.everyRecoveredItemStrengthensTheCommunity')}
      </div>
    </div>
  );
};

export default Home;
