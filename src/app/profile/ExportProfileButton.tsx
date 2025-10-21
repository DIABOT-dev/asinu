'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { 
  data: unknown; 
  filename?: string; 
};

export default function ExportProfileButton({ data, filename = 'anora-profile.json' }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = () => {
    // Guard SSR - chỉ chạy trong browser
    if (typeof window === 'undefined') return;
    
    try {
      setLoading(true);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Không thể xuất file. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? '⏳ Đang xuất...' : '📄 Xuất hồ sơ JSON'}
    </button>
  );
}