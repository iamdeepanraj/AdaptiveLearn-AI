'use client';

import React, { useEffect, useState } from 'react';
import { 
  Brain, Clock, ShieldCheck, Sparkles, 
  Layers, CheckCircle2, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, BarChart, Bar, Cell 
} from 'recharts';
import { useTheme } from 'next-themes';
import { api, StudentDashboardData } from '@/lib/api';
import { BKTBadge } from '@/components/bkt-badge';

export default function AnalyticsPage() {
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Dynamic colors read from CSS variables for Recharts
  const [themeColors, setThemeColors] = useState({
    fg3: 'currentColor',
    line: 'currentColor',
    primary: 'currentColor',
    success: 'currentColor',
    warning: 'currentColor',
    danger: 'currentColor',
    surface: 'transparent',
    fg: 'currentColor',
  });

  useEffect(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    setThemeColors({
      fg3: rootStyle.getPropertyValue('--fg-3').trim() || 'currentColor',
      line: rootStyle.getPropertyValue('--line').trim() || 'currentColor',
      primary: rootStyle.getPropertyValue('--primary').trim() || 'currentColor',
      success: rootStyle.getPropertyValue('--success').trim() || 'currentColor',
      warning: rootStyle.getPropertyValue('--warning').trim() || 'currentColor',
      danger: rootStyle.getPropertyValue('--danger').trim() || 'currentColor',
      surface: rootStyle.getPropertyValue('--surface').trim() || 'transparent',
      fg: rootStyle.getPropertyValue('--fg').trim() || 'currentColor',
    });
  }, [resolvedTheme]);

  useEffect(() => {
    api.getStudentDashboard()
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-fg-3 gap-3">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Generating knowledge tracing analytics and learning curves...</p>
      </div>
    );
  }

  // Format chart data
  const topicBarData = [...data.weak_topics, ...data.strong_topics].map((t) => ({
    name: t.topic_name.length > 20 ? t.topic_name.substring(0, 18) + '...' : t.topic_name,
    mastery: Math.round(t.p_mastery * 100),
    accuracy: t.accuracy,
    attempts: t.total_attempts
  }));

  const timelineData = data.mastery_timeline.map((point, index) => ({
    attempt: `#${index + 1}`,
    topic: point.topic_name,
    mastery: Math.round(point.p_mastery * 100),
    outcome: point.is_correct ? 'Correct' : 'Incorrect'
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-fg tracking-tight">
          Learning Analytics & Mastery Tracing
        </h1>
        <p className="text-sm text-fg-3 mt-1">
          Detailed telemetry on knowledge acquisition curves, Bayesian model states, and spaced retention schedules.
        </p>
      </div>

      {/* BKT Mathematical Model Transparency Banner */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary-soft text-primary-fg">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-fg">
              Bayesian Knowledge Tracing (BKT) Parameters
            </h2>
            <p className="text-xs text-fg-3">
              Interpretable 4-parameter probabilistic latent skill estimator
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-surface-2 border border-line">
            <span className="text-xs font-semibold text-fg-2 block mb-1">Prior Knowledge P(L₀)</span>
            <span className="text-2xl font-black text-fg">0.20</span>
            <p className="text-[10px] text-fg-2 mt-1">Baseline skill prior before practice</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-2 border border-line">
            <span className="text-xs font-semibold text-fg-2 block mb-1">Transit Prob P(T)</span>
            <span className="text-2xl font-black text-primary-fg">0.15</span>
            <p className="text-[10px] text-fg-2 mt-1">Learning step transition rate</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-2 border border-line">
            <span className="text-xs font-semibold text-fg-2 block mb-1">Slip Prob P(S)</span>
            <span className="text-2xl font-black text-danger">0.10</span>
            <p className="text-[10px] text-fg-2 mt-1">Error despite knowing concept</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-2 border border-line">
            <span className="text-xs font-semibold text-fg-2 block mb-1">Guess Prob P(G)</span>
            <span className="text-2xl font-black text-warning">0.20</span>
            <p className="text-[10px] text-fg-2 mt-1">Correct answer by chance</p>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Topic Mastery Bar Chart */}
        <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-fg">Topic Mastery Levels (%)</h3>
            <span className="text-xs text-fg-3">Target Mastery ≥ 70%</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.line} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: themeColors.fg3 }} 
                  interval={0} 
                  angle={-15} 
                  textAnchor="end"
                  stroke={themeColors.line}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 11, fill: themeColors.fg3 }}
                  stroke={themeColors.line}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: themeColors.surface, 
                    borderRadius: '12px', 
                    border: `1px solid ${themeColors.line}`, 
                    color: themeColors.fg, 
                    fontSize: '12px' 
                  }}
                  formatter={(val: any) => [`${val}%`, 'Mastery Estimate']}
                />
                <Bar dataKey="mastery" radius={[8, 8, 0, 0]}>
                  {topicBarData.map((entry, idx) => (
                    <Cell 
                      key={idx} 
                      fill={entry.mastery >= 70 ? themeColors.success : entry.mastery >= 40 ? themeColors.primary : themeColors.danger} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Learning Progression Timeline */}
        <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-fg">BKT Learning Progression Over Time</h3>
            <span className="text-xs text-primary-fg font-semibold">Sequential Updates</span>
          </div>

          <div className="h-64 w-full">
            {timelineData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-fg-3">
                Take quizzes to see your sequential learning curve.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeColors.line} />
                  <XAxis 
                    dataKey="attempt" 
                    tick={{ fontSize: 11, fill: themeColors.fg3 }} 
                    stroke={themeColors.line}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 11, fill: themeColors.fg3 }}
                    stroke={themeColors.line}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: themeColors.surface, 
                      borderRadius: '12px', 
                      border: `1px solid ${themeColors.line}`, 
                      color: themeColors.fg, 
                      fontSize: '12px' 
                    }}
                    formatter={(val: any, _name: any, item: any) => [
                      `${val}% (${item.payload.outcome})`,
                      item.payload.topic
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mastery" 
                    stroke={themeColors.primary} 
                    strokeWidth={3} 
                    dot={{ fill: themeColors.primary, r: 4 }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Topics Telemetry Table */}
      <div className="p-6 rounded-3xl bg-surface border border-line shadow-card space-y-4">
        <h3 className="font-bold text-base text-fg">Module Retention & Schedule Telemetry</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-fg-2 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5 rounded-l-xl">Module Topic</th>
                <th className="p-3.5">Estimated Mastery P(L)</th>
                <th className="p-3.5">State</th>
                <th className="p-3.5">Attempts</th>
                <th className="p-3.5">Accuracy</th>
                <th className="p-3.5 rounded-r-xl">Next Review Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-fg">
              {[...data.weak_topics, ...data.strong_topics].map((t) => (
                <tr key={t.topic_id} className="hover:bg-surface-2 transition">
                  <td className="p-3.5 font-semibold text-fg">{t.topic_name}</td>
                  <td className="p-3.5">
                    <span className="font-bold">{Math.round(t.p_mastery * 100)}%</span>
                  </td>
                  <td className="p-3.5">
                    <BKTBadge pMastery={t.p_mastery} state={t.mastery_state} size="sm" showEstimateLabel={false} />
                  </td>
                  <td className="p-3.5">{t.total_attempts}</td>
                  <td className="p-3.5">{t.accuracy}%</td>
                  <td className="p-3.5">
                    {t.is_due_for_review ? (
                      <span className="text-warning font-bold">Review Due Today</span>
                    ) : (
                      <span className="text-fg-3">Scheduled (Retention Ok)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
