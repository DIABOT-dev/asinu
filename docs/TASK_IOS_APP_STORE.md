# TASK_IOS_APP_STORE.md
### Nhiệm vụ: Chuẩn bị tài liệu & cấu trúc để publish Asinu lên Apple App Store

## Mục tiêu
- Metadata App Store đầy đủ
- App Privacy template
- Export compliance template
- Docs TestFlight & Review

---

# P1 – Metadata App Store

## 1. Tạo thư mục:
`store/ios/`

## 2. Tạo file:
### `store/ios/app_store_metadata.vi.md`
### `store/ios/app_store_metadata.en.md`

Nội dung:
- App name
- Subtitle
- Description (theo chuẩn Apple)
- Features
- Keywords
- Support URL / Marketing URL / Privacy URL (TODO)

---

# P2 – Apple App Privacy (nutrition label)

## 3. Tạo file:
`store/ios/app_privacy_template.md`

Nội dung:
- Nhóm dữ liệu:
  - Contact Info
  - Health & Fitness
  - Usage Data
  - Diagnostics
- Cho từng nhóm:
  - Collected? (TODO)
  - Linked to user? (TODO)
  - Used for tracking? (TODO)

---

# P3 – Export compliance template

## 4. Tạo file:
`store/ios/export_compliance_template.md`

Nội dung:
- App có dùng encryption? (TODO)
- Có export encryption? (TODO)
- Có dùng mã hóa phi chuẩn? (TODO)

---

# P4 – Update RELEASE_IOS.md

### Bổ sung các mục:
- TestFlight:
  - Internal testers
  - External testers
  - Apple review external build

- Submit For Review:
  - Chọn build
  - Nhập metadata
  - Nhập privacy (template)
  - Nhập export compliance (template)

- Release mode:
  - Manual
  - Automatic

---

## Kết quả kỳ vọng
- Folder `store/ios/` hoàn chỉnh
- `docs/RELEASE_IOS.md` có đầy đủ nội dung publish App Store
