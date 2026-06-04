import './globals.css';
import { AssistantProvider } from '@/lib/assistant-context';
import FloatingAssistant from '@/components/layout/FloatingAssistant';

export const metadata = {
  title: 'Themis舆情分析系统',
  description: 'OpenThemis · AI 舆情分析系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AssistantProvider>
          {children}
          <FloatingAssistant />
        </AssistantProvider>
      </body>
    </html>
  );
}
