import Navigation from '@/components/layout/Navigation';

export const metadata = {
  title: 'Themis舆情分析系统 · 舆情分析',
  description: '多渠道舆情监测、情感研判与风险预警',
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="growthbox min-h-screen bg-slate-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
