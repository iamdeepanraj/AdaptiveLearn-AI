'use client';

import React from 'react';
import { Sparkles, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';

interface BKTBadgeProps {
  pMastery: number;
  state?: string;
  showEstimateLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BKTBadge({
  pMastery,
  state,
  showEstimateLabel = true,
  size = 'md',
}: BKTBadgeProps) {
  const percentage = Math.round(pMastery * 100);

  let label = state || 'novice';
  let colorStyles = 'bg-danger-soft text-danger border-danger/30';
  let Icon = AlertTriangle;

  if (pMastery >= 0.85 || label === 'mastered') {
    label = 'Mastered';
    colorStyles = 'bg-success-soft text-success border-success/30';
    Icon = Sparkles;
  } else if (pMastery >= 0.70 || label === 'proficient') {
    label = 'Proficient';
    colorStyles = 'bg-primary-soft text-primary-fg border-primary/30';
    Icon = CheckCircle;
  } else if (pMastery >= 0.40 || label === 'learning') {
    label = 'Learning';
    colorStyles = 'bg-warning-soft text-warning border-warning/30';
    Icon = TrendingUp;
  } else {
    label = 'Novice';
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3.5 py-1.5 text-sm gap-2',
  }[size];

  return (
    <div className="inline-flex items-center gap-2">
      <span
        title="Bayesian Knowledge Tracing estimate of learner knowledge state (P(L))"
        className={`inline-flex items-center font-medium rounded-full border transition-all ${sizeClasses} ${colorStyles}`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{label}</span>
        <span className="font-semibold">{percentage}%</span>
      </span>
      {showEstimateLabel && (
        <span
          className="text-[10px] text-fg-2 tracking-tight"
          title="Probabilistic BKT model estimate"
        >
          (Est. BKT)
        </span>
      )}
    </div>
  );
}
