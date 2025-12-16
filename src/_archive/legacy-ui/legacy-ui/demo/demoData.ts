export type MetricDatum = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  accentColor?: string;
};

export type TrendPoint = { id: string; label: string; value: number };
export type TrackerDatum = { id: string; name: string; progress: number; targetValue: number; unit?: string };
export type ResourceDatum = {
  id: string;
  title: string;
  category: string;
  media?: string;
  likes?: number;
  comments?: number;
};

export type LogEntry = {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  status: 'scheduled' | 'completed' | 'missed';
  steps?: { id: string; label: string; description?: string }[];
};

export type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: string;
};

export const demoData = {
  metrics: [
    { id: 'metric1', label: 'Primary Metric', value: 82, unit: '%', delta: 4, trend: 'up', accentColor: '#4f46e5' },
    { id: 'metric2', label: 'Secondary Metric', value: 6.5, unit: '/10', delta: -0.3, trend: 'down', accentColor: '#16a34a' },
    { id: 'metric3', label: 'Support Metric', value: 42, unit: 'pts', delta: 1.2, trend: 'up', accentColor: '#f97316' }
  ] as MetricDatum[],
  trendSeries: {
    title: 'Key Trend',
    data: [
      { id: 'point1', label: 'Mon', value: 48 },
      { id: 'point2', label: 'Tue', value: 56 },
      { id: 'point3', label: 'Wed', value: 60 },
      { id: 'point4', label: 'Thu', value: 54 },
      { id: 'point5', label: 'Fri', value: 68 },
      { id: 'point6', label: 'Sat', value: 72 },
      { id: 'point7', label: 'Sun', value: 63 }
    ] as TrendPoint[]
  },
  trackers: [
    { id: 'tracker1', name: 'Tracker Alpha', progress: 0.72, targetValue: 8, unit: 'units' },
    { id: 'tracker2', name: 'Tracker Beta', progress: 0.43, targetValue: 12, unit: 'units' },
    { id: 'tracker3', name: 'Tracker Gamma', progress: 0.88, targetValue: 6, unit: 'cycles' }
  ] as TrackerDatum[],
  resources: [
    { id: 'resource1', title: 'Resource Title', category: 'Category', media: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80', likes: 214, comments: 32 },
    { id: 'resource2', title: 'Creative Brief', category: 'Inspiration', media: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&q=80', likes: 178, comments: 12 },
    { id: 'resource3', title: 'Playbook Update', category: 'Process', media: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=80', likes: 241, comments: 48 }
  ] as ResourceDatum[],
  logs: [
    {
      id: 'log1',
      title: 'Log Item One',
      subtitle: 'Short description for context',
      timestamp: '2024-07-18T10:00:00Z',
      status: 'completed',
      steps: [
        { id: 'step1', label: 'Kick-off', description: 'Aligned on goals' },
        { id: 'step2', label: 'Review', description: 'Evaluated progress' },
        { id: 'step3', label: 'Follow-up', description: 'Defined next actions' }
      ]
    },
    {
      id: 'log2',
      title: 'Log Item Two',
      subtitle: 'Additional context lives here',
      timestamp: '2024-07-20T09:30:00Z',
      status: 'scheduled'
    },
    {
      id: 'log3',
      title: 'Log Item Three',
      subtitle: 'High-level summary placeholder',
      timestamp: '2024-07-22T14:15:00Z',
      status: 'missed'
    }
  ] as LogEntry[],
  notifications: [
    { id: 'notification1', title: 'Reminder Title', time: '08:30', type: 'reminder' },
    { id: 'notification2', title: 'Sync checkpoint', time: '14:15', type: 'info' }
  ],
  chatPreset: {
    assistantAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    userAvatar: 'https://images.unsplash.com/photo-1529665253569-6d01c0eaf7b6?auto=format&fit=crop&w=200&q=80',
    initialMessages: [
      { id: 'msg1', role: 'assistant', text: 'Welcome back. Ready to continue?', timestamp: new Date().toISOString() },
      { id: 'msg2', role: 'user', text: 'Show me the highlights from this week.', timestamp: new Date().toISOString() }
    ] as ChatMessage[]
  },
  authCopy: {
    headline: 'Sign in to your workspace',
    subline: 'Continue where you left off.'
  }
};

export type DemoData = typeof demoData;
