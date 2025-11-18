# ASINU TEMPLATE SWAP PLAN: CLONE 30% + ASINU STYLE

## 1. Mục tiêu
- Dùng Carer Patient RN làm **xương sống** (navigation, cấu trúc dự án).
- Clone 30% UI từ template Flutter AI Mental Health theo **đúng luật bản quyền**.
- Đưa toàn bộ UI về phong cách Asinu (màu, font, icon, spacing, animation).
- Giữ code mở để **thay template khác bất cứ lúc nào**.

---

## 2. Kiến trúc tổng quan

### 2.1 Carer giữ lại:
- `navigation/` (Tab + Stack)
- `App.tsx`
- `theme/` (sẽ override)
- `utils/`

### 2.2 Xoá bỏ hoặc thay thế:
- `screens/doctor/*`
- `screens/hospital/*`
- `screens/appointment/*` (nếu không dùng)
- `assets/illustrations`

### 2.3 Tạo mới module Asinu
```
src/features/
  ai/
  mood/
  sleep/
  journal/
  stress_relief/
  vitals/
  family/
```

---

## 3. Clone 30% từ Flutter – Quy tắc bắt buộc
- Không copy code Dart.
- Không copy asset Flutter.
- Không giữ spacing/margin giống 100%.
- Không giữ icon/hình gốc.
- Dùng Flutter như **bản vẽ** → dựng lại bằng RN/Expo.
- Chỉ giữ lại flow + logic bố cục.

---

## 4. Phong cách Asinu (dùng cho toàn app)

### 4.1 Màu chủ đạo
- Xanh ngọc Asinu
- Xanh nước sâu
- Trắng sạch
- Gradient nhẹ

### 4.2 Font
- Inter / Nunito / SF Pro (tuỳ OS)

### 4.3 Icon
- Bộ icon tùy chỉnh theo Asinu (line icon mềm, bo tròn).

### 4.4 Animation
- Lottie Asinu
- Animation nhẹ: fade, slide-up.

### 4.5 Card style
- Bo tròn lớn (16–20px)
- Shadow nhẹ
- Padding 16–24px

---

## 5. Quy trình clone UI sang RN/Expo

### Bước 1: Nhận diện màn Flutter
- MoodTracker
- SleepCalendar
- Journal
- StressBreathing
- AIChatbot
- Monitoring

### Bước 2: Chụp màn, mô tả block
Ví dụ MoodTracker:
- Header
- Mood graph
- Daily mood buttons
- AI suggestion row

### Bước 3: Tạo file RN tương ứng
```
src/features/mood/screens/MoodTrackerScreen.tsx
```

### Bước 4: Codex dựng UI bằng Tailwind RN
- Dùng `View`, `ScrollView`, `Pressable`, `Image`.
- Dữ liệu để tạm (JSON mock).

### Bước 5: Style Asinu hoá từng phần
- Màu Asinu
- Icon Asinu
- Font Asinu
- Card spacing mới

### Bước 6: Gắn navigation
- Tab: Home / AI / Mood / Sleep / Journal / Profile
- Stack: Details, Stats, AddNote

---

## 6. Phương án dự phòng (Fail-safe)

### Trường hợp 1: Carer không hợp vibe
- Giữ navigation → xoá toàn bộ `screens/` → Codex generate lại UI từ Flutter.
- Không ảnh hưởng project structure.

### Trường hợp 2: UI Flutter quá phức tạp
- Giảm xuống clone 20% → chỉ lấy Mood/Sleep/Journal.
- Phần còn lại dùng UI mặc định của Asinu.

### Trường hợp 3: Cần đổi template khác
- Giữ `navigation/` + `App.tsx`.
- Tạo folder UI mới → swap bằng cách đổi import.
- Không cần refactor sâu.

---

## 7. Các màn cần clone trước (ưu tiên)
1. HomeScreen mới (Asinu)
2. AIScreen
3. MoodTracker
4. SleepOverview
5. JournalList
6. JournalAdd
7. StressBreathing
8. MonitoringDashboard

---

## 8. Bộ tiêu chuẩn Asinu UI
- Dễ nhìn, ít chữ, icon lớn
- Không ngập tính năng
- Mỗi màn tối đa 3 hành động
- CTA rõ ràng: "Hỏi Asinu", "Thêm nhật ký", "Điều chỉnh cảm xúc"
- Luồng đơn giản: Home → Mood → AI → Journal → Report

---

## 9. Checklist giao cho Codex
- [ ] Tạo project RN/Expo
- [ ] Import navigation từ Carer
- [ ] Xoá toàn bộ màn medical không cần
- [ ] Tạo module Asinu theo folder structure mới
- [ ] Clone UI Mood/Sleep/Journal từ Flutter
- [ ] Convert UI sang style Asinu
- [ ] Gắn vào tab navigation
- [ ] Chuẩn bị mock API
- [ ] Tối ưu hiệu năng
- [ ] Đảm bảo swap template dễ dàng

---

## 10. Kết luận
- Clone 30% từ Flutter → hoàn toàn hợp pháp & sạch.
- Dự án vẫn thuần React Native/Expo → đồng bộ với Asinu.
- Navigation Carer → xương vững.
- UI Flutter → da đẹp.
- Asinu style → hồn của sản phẩm.

Đây là hướng tối ưu nhất: đẹp – sạch – nhanh – an toàn – dễ thay đổi.

