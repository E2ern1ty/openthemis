'use client';

import { motion } from 'framer-motion';

interface Props {
  progress: number;
  status: string;
}

const STEPS = [
  { min: 0, max: 20, label: '采集数据...' },
  { min: 20, max: 35, label: '存储与清洗...' },
  { min: 35, max: 55, label: '情感分析...' },
  { min: 55, max: 70, label: '主题聚类...' },
  { min: 70, max: 85, label: '差评提取...' },
  { min: 85, max: 100, label: '舆情研判...' },
];

export default function AnalysisProgress({ progress, status }: Props) {
  if (status !== 'processing') return null;

  const currentStep = STEPS.find(s => progress >= s.min && progress < s.max) || STEPS[STEPS.length - 1];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{currentStep.label}</span>
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
