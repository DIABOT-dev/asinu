# ASINU CloudOps Center — GPT Governance (v1)

Ngày kích hoạt: 2025-10-08 (ICT)

Mục tiêu: GPT-5 Pro trở thành **IDE + CI/CD + PM** trung tâm của ASINU. Bolt chuyển thành **archive** (không còn quyền deploy).

## Thành phần thư mục
```
/ops/        # script deploy/rollback/backup/healthcheck
/agents/     # cấu hình AgentKit (AsinuOps, AsinuAI)
/archive/    # lưu trữ tài liệu/flow cũ từ Bolt (read-only)
QA_SMOKE.md  # checklist kiểm thử sau deploy
PROMPT_GUIDE.md  # quy ước #boltprompt nội bộ
.env.example # template biến môi trường (điền thật trên VPS)
app.manifest.json # Apps SDK manifest cho My GPTs
```
## Quy trình vận hành
1) GPT build image → push GHCR
2) GPT SSH deploy → Viettel VPS (cổng 3000)
3) GPT chạy QA_SMOKE → pass → ghi log triển khai
4) Cron hằng ngày: healthcheck + backup DB (Viettel S3)
5) Sự cố: chạy `ops/rollback.sh` để quay về tag ổn định

## Định nghĩa hoàn tất (DoD)
- /api/qa/selftest trả 200
- /api/log/* ghi thành công (201)
- Chart 7/30 trả JSON từ OLAP-lite
- RLS đảm bảo: user chỉ thấy dữ liệu mình
- Backup xuất hiện trong bucket S3
