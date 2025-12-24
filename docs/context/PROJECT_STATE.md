PROJECT STATE (Updated: Session 3)
1. ROLES & PROTOCOLS (VIBE CODING)
Tech Lead (Gemini): Architect, ra chỉ thị (Directive), không viết code chi tiết.

Operator (User): Cầu nối, copy/paste lệnh, vận hành terminal/tool.

Worker (Codex/Cursor/Windsurf): Thực thi code, tạo file, fix bug.

Advisor (ChatGPT): Xử lý logic phức tạp, giải thuật khó.

QC (Copilot): Review code, check security.

Rule: Luôn đọc docs/context/* trước khi code. Fix tận gốc (Root Cause).

2. SYSTEM STATUS
Core: Asinu Family Health OS (Mobile + Gateway + AI Brain).

Phase: Stabilize MVP for Store Submission (Ưu tiên Mobile).

Repo: Clean (theo Master Plan), đã khởi tạo docs/context/.

3. ACTIVE SPRINT GOALS
[DONE] Init Context Kit (TECH_RULES.md, PROJECT_STATE.md, ARCHITECTURE_MAP.md).

[IN PROGRESS] Fix Mobile Dev Environment (dev-client crash issue).

Action: Đã thêm script dev:clean, dev:force vào package.json.

Action: Đã tạo .env.local cho mobile.

[PENDING] Sync API Mobile <-> Backend (Tránh mobile gọi API 404/500).

4. CURRENT BLOCKER
Waiting for Verification: Cần xác nhận lệnh npm run dev:clean (hoặc dev:force) đã giúp App Mobile khởi động thành công và hiện QR code chưa.

5. KNOWN ISSUES
Architectural mismatch: Master Plan says mobile is in apps/ but runtime is at Root. Always use Root for mobile commands.
