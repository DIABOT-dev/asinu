"use client";

import { useState, useEffect } from 'react';
import Button from '@/interfaces/ui/components/atoms/Button';
import Toast from '@/interfaces/ui/components/atoms/Toast';
import { cn } from '@/lib/utils';
import { PersonaPrefs } from '@/lib/profile/mappers';
import { apiFetch, ApiError } from "@/lib/http";

interface PersonaSwitchProps {
  className?: string;
}

/**
 * PersonaSwitch Component
 *
 * Allows user to switch AI persona and guidance level
 * Integrates with PUT /api/profile/personality
 */
export default function PersonaSwitch({ className }: PersonaSwitchProps) {
  const [prefs, setPrefs] = useState<PersonaPrefs>({
    ai_persona: 'friend',
    guidance_level: 'minimal',
    low_ask_mode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchPrefs();
  }, []);

  async function fetchPrefs() {
    try {
      setLoading(true);
      const data = await apiFetch<{ prefs: PersonaPrefs }>('/api/profile/personality');
      setPrefs({
        ai_persona: data.prefs.ai_persona ?? 'friend',
        guidance_level: data.prefs.guidance_level ?? 'minimal',
        low_ask_mode: data.prefs.low_ask_mode ?? false,
      });
    } catch (error) {
      console.error('Error fetching prefs:', error);
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Không thể tải cài đặt';
      setToast({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function savePrefs(updates: Partial<PersonaPrefs>) {
    try {
      setSaving(true);
      const data = await apiFetch<{ prefs: PersonaPrefs }>('/api/profile/personality', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      setPrefs({
        ai_persona: data.prefs.ai_persona ?? 'friend',
        guidance_level: data.prefs.guidance_level ?? 'minimal',
        low_ask_mode: data.prefs.low_ask_mode ?? false,
      });
      setToast({ message: 'Đã lưu thay đổi', type: 'success' });
    } catch (error) {
      console.error('Error saving prefs:', error);
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Không thể lưu thay đổi';
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function handlePersonaChange(persona: NonNullable<PersonaPrefs['ai_persona']>) {
    setPrefs((current) => ({ ...current, ai_persona: persona }));
    void savePrefs({ ai_persona: persona });
  }

  function handleGuidanceLevelChange(level: NonNullable<PersonaPrefs['guidance_level']>) {
    setPrefs((current) => ({ ...current, guidance_level: level }));
    void savePrefs({ guidance_level: level });
  }

  function handleLowAskModeToggle() {
    const newValue = !prefs.low_ask_mode;
    setPrefs((current) => ({ ...current, low_ask_mode: newValue }));
    void savePrefs({ low_ask_mode: newValue });
  }

  if (loading) {
    return (
      <div className={cn('persona-switch', className)}>
        <div className="text-center py-4 text-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className={cn('persona-switch space-y-6', className)}>
      {/* Persona Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Phong cách trợ lý AI</h3>
        <div className="grid gap-3">
          <PersonaOption
            id="friend"
            name="Bạn bè"
            description="Ấm áp, thân thiện,"
            selected={prefs.ai_persona === 'friend'}
            onClick={() => handlePersonaChange('friend')}
            disabled={saving}
          />
          <PersonaOption
            id="coach"
            name="Huấn luyện viên"
            description="Mục tiêu rõ ràng, động viên thực tế"
            selected={prefs.ai_persona === 'coach'}
            onClick={() => handlePersonaChange('coach')}
            disabled={saving}
          />
          <PersonaOption
            id="advisor"
            name="Cố vấn"
            description="Ngắn gọn, chuyên nghiệp, lịch sự"
            selected={prefs.ai_persona === 'advisor'}
            onClick={() => handlePersonaChange('advisor')}
            disabled={saving}
          />
        </div>
      </div>

      {/* Guidance Level */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Mức độ chi tiết</h3>
        <div className="flex gap-3">
          <button
            onClick={() => handleGuidanceLevelChange('minimal')}
            disabled={saving}
            className={cn(
              'flex-1 p-3 rounded-lg border transition-colors',
              prefs.guidance_level === 'minimal'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <div className="font-medium">Tối giản</div>
            <div className="text-xs text-gray-500 mt-1">1 gợi ý ngắn gọn</div>
          </button>
          <button
            onClick={() => handleGuidanceLevelChange('detailed')}
            disabled={saving}
            className={cn(
              'flex-1 p-3 rounded-lg border transition-colors',
              prefs.guidance_level === 'detailed'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
            )}
          >
            <div className="font-medium">Chi tiết</div>
            <div className="text-xs text-gray-500 mt-1">2 gợi ý đầy đủ</div>
          </button>
        </div>
      </div>

      {/* Low Ask Mode */}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
        <div>
          <div className="font-medium">Chế độ ít hỏi</div>
          <div className="text-sm text-gray-500 mt-1">
            Giảm số lần hỏi, ưu tiên hành động
          </div>
        </div>
        <label className="relative inline-flex h-6 w-12 items-center">
          <input
            type="checkbox"
            checked={prefs.low_ask_mode}
            onChange={handleLowAskModeToggle}
            disabled={saving}
            className="peer sr-only"
          />
          <span className="h-6 w-12 rounded-full bg-gray-300 transition-colors peer-checked:bg-blue-500 peer-disabled:opacity-50" />
          <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-6" />
        </label>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}
    </div>
  );
}

interface PersonaOptionProps {
  id: string;
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function PersonaOption({ id, name, description, selected, onClick, disabled }: PersonaOptionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-4 rounded-lg border text-left transition-colors',
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center',
            selected ? 'border-blue-500' : 'border-gray-300'
          )}
        >
          {selected && (
            <div className="w-3 h-3 rounded-full bg-blue-500" />
          )}
        </div>
        <div className="flex-1">
          <div className="font-medium">{name}</div>
          <div className="text-sm text-gray-500 mt-1">{description}</div>
        </div>
      </div>
    </button>
  );
}
