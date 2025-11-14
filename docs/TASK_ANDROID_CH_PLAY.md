
---

# **📌 FILE 2 — `TASK_ANDROID_CH_PLAY.md` (FULL VERSION)**

```md
# TASK_ANDROID_CH_PLAY.md
### Nhiệm vụ: Chuẩn bị tài liệu & cấu trúc publish Asinu lên Google Play

## Mục tiêu
- Có đủ metadata (mô tả, asset yêu cầu)
- Có template Data Safety
- Có template Content Rating
- Hoàn thiện docs RELEASE_ANDROID.md để publish được

---

# P1 – Metadata app

## 1. Tạo thư mục:
`store/android/`

## 2. Tạo file mô tả:
### `store/android/app_listing.vi.md`
### `store/android/app_listing.en.md`

Nội dung cần có:
- App name
- Short description (≤80 ký tự)
- Full description
- Key features (bullet)
- Ghi chú: Asinu hỗ trợ – không phải app điều trị
- Asset checklist:
  - Icon 512×512
  - Screenshot 9:16
  - Feature graphic

---

# P2 – Data Safety template

## 3. Tạo file:
`store/android/data_safety_template.md`

Nội dung:
- Loại dữ liệu thu thập (placeholder)
- Mục đích: analytics, functionality
- Third-party sharing: TODO
- Encryption: TODO
- Data deletion request: TODO

---

# P3 – Content rating questionnaire

## 4. Tạo file:
`store/android/content_rating_answers.md`

Nội dung:
- Các nhóm câu hỏi:
  - Violence
  - Drugs
  - Sexuality
  - Gambling
  - UGC
  - Medical
- Gợi ý câu trả lời (dạng TODO)
- Nhắc phần Medical phải kiểm soát claim

---

# P4 – Quy trình publish CH Play

## 5. Bổ sung `docs/RELEASE_ANDROID.md` với các bước:

1. Chuẩn bị:
   - Google Play Console account
   - 25 USD fee
   - Asset đầy đủ trong `store/android/`

2. Tạo app:
   - App name
   - Default language
   - Package name `com.diabot.asinu`

3. Điền Store Listing:
   - Sử dụng file metadata

4. Điền Data Safety:
   - Dựa vào template

5. Content Rating:
   - Dựa vào file questionnaire

6. Upload AAB:
   - Track: Internal testing

7. Thêm tester:
   - Email

8. Promote lên production:
   - Khi không crash

---

## Kết quả kỳ vọng
- Folder `store/android/` có đầy đủ metadata & templates
- `docs/RELEASE_ANDROID.md` sẵn sàng dùng để publish
