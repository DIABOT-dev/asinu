"use client";

import Link from "next/link";
import Image from "next/image";

export default function FloatingAIBtn() {
  return (
    <Link
      href="/ai-agent"
      aria-label="Trợ lý AI"
      className="fixed left-1
    bottom-20 z-50 block"
    >
      {/* chỉ PNG, không bo/viền; dùng đổ bóng token để nổi khối */}
      <Image
        src="/assets/anora.png"
        alt="DIABOT"
        width={200}
        height={200}
        className="select-none pointer-events-none shadow-card"
        priority
      />
    </Link>
    
  );
}
