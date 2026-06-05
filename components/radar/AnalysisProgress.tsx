'use client';

import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';

interface Props {
  progress: number;
  status: string;
}

const STEPS = [
  { min: 0, max: 20, zh: '采集数据...', en: 'Collecting data...' },
  { min: 20, max: 35, zh: '存储与清洗...', en: 'Storing & cleaning...' },
  { min: 35, max: 55, zh: '情感分析...', en: 'Sentiment analysis...' },
  { min: 55, max: 70, zh: '主题聚类...', en: 'Topic clustering...' },
  { min: 70, max: 85, zh: '差评提取...', en: 'Extracting complaints...' },
  { min: 85, max: 100, zh: '舆情研判...', en: 'Risk assessment...' },
];

export default function AnalysisProgress({ progress, status }: Props) {
  const { t } = useI18n();
  if (status !== 'processing') return null;

  const currentStep = STEPS.find(s => progress >= s.min && progress < s.max) || STEPS[STEPS.length - 1];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{t(currentStep.zh, currentStep.en)}</span>
        <span className="text-sm text-slate-500">{progress}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
