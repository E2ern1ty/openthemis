import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Themis舆情分析系统 · 看板',
  description: '实时舆情看板：定时刷新、话题关键词趋势',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
