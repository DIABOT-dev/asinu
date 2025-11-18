// src/app/layout.tsx
"use client";

import "@/styles/index.css";
import BottomNav from "@/interfaces/ui/components/BottomNav";
import { usePathname } from "next/navigation";

// (Giữ nguyên metadata nếu bạn có ở file khác)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Ẩn BottomNav ở các route đặc biệt
  const isAuthPage = pathname?.startsWith("/auth") ?? false;
  const isProfileSetup = pathname?.startsWith("/profile/setup") ?? false;
  const hideBottomNav = isAuthPage || isProfileSetup;

  return (
    <html lang="vi">
      <body className="bg-bg font-sans text-text min-h-screen">
        {children}
        {!hideBottomNav && <BottomNav />} {/* Chỉ render khi không phải auth/setup */}
      </body>
    </html>
  );
}
