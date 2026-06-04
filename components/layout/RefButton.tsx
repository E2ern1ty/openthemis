'use client';

import { useState } from 'react';
import { useAssistant, type Reference } from '@/lib/assistant-context';

interface Props {
  reference: Omit<Reference, 'addedAt'>;
  className?: string;
  size?: 'sm' | 'md';
}

export default function RefButton({ reference, className = '', size = 'sm' }: Props) {
  const { addReference } = useAssistant();
  const [added, setAdded] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    addReference({ ...reference, addedAt: Date.now() });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const sizeClasses = size === 'sm'
    ? 'w-6 h-6 text-[10px]'
    : 'w-7 h-7 text-xs';

  return (
    <button
      onClick={handleClick}
      title={`引用「${reference.label}」到助手`}
      className={`inline-flex items-center justify-center rounded-md border transition-all duration-200 ${
        added
          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
          : 'bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
      } ${sizeClasses} ${className}`}
    >
      {added ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <span className="font-bold">@</span>
      )}
    </button>
  );
}
