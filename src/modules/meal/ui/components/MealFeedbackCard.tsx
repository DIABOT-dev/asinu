"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MealFeedbackCardProps {
  feedback: string;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
  className?: string;
}

/**
 * MealFeedbackCard Component
 *
 * Displays 3-sentence feedback after meal logging
 * Features:
 * - Mascot icon
 * - 3 lines of text (summary → tips → conclusion)
 * - Auto-dismiss after 5s (configurable)
 * - Manual close button
 */
export default function MealFeedbackCard({
  feedback,
  onDismiss,
  autoDismiss = true,
  autoDismissDelay = 5000,
  className,
}: MealFeedbackCardProps) {
  const [visible, setVisible] = useState(true);
  const [progressActive, setProgressActive] = useState(false);

  useEffect(() => {
    if (autoDismiss && visible) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [autoDismiss, autoDismissDelay, visible]);

  useEffect(() => {
    if (!autoDismiss) {
      setProgressActive(false);
      return;
    }
    setProgressActive(false);
    const raf = requestAnimationFrame(() => {
      setProgressActive(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [autoDismiss, autoDismissDelay, feedback]);

  function handleDismiss() {
    setVisible(false);
    onDismiss?.();
  }

  if (!visible) return null;

  // Split feedback into sentences for better display
  const sentences = feedback.split('. ').filter(Boolean);

  return (
    <div
      className={cn(
        "rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md",
        className,
      )}
    >
      <div className="relative flex items-start gap-3 p-4">
        {/* Mascot Icon */}
        <div className="shrink-0">
          <svg className="h-12 w-12 text-blue-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>

        {/* Feedback Text */}
        <div className="flex-1 space-y-2">
          {sentences.map((sentence, index) => {
            const trimmed = sentence.trim();
            const emphasis =
              index === 0 ? "font-semibold" : index === sentences.length - 1 ? "text-blue-600 italic" : "";
            return (
              <p key={index} className={cn("text-sm leading-relaxed text-gray-700", emphasis)}>
                {trimmed.endsWith(".") ? trimmed : `${trimmed}.`}
              </p>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 text-gray-400 transition-colors hover:text-gray-600"
          aria-label="Đóng"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {autoDismiss && (
        <div className="h-1 bg-blue-100">
          <div
            className="h-full bg-blue-400 transition-[width] ease-linear"
            style={{
              width: progressActive ? "0%" : "100%",
              transitionDuration: `${autoDismissDelay}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}
