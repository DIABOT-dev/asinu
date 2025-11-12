# Android – .aab & Data Safety (Concept)

## Build .aab (Expo/EAS ví dụ)
- Cài EAS: `npm i -g eas-cli`
- Login: `eas login`
- Init: `eas build:configure`
- Build: `eas build -p android --profile preview`

## Play Console – Internal testing
1) Tạo track Internal testing → upload file `.aab`
2) Mời tester (email)
3) Phát hành bản nội bộ

## Data Safety form (gợi ý nội dung)
- Thu thập dữ liệu sức khỏe: BG/meal/water/weight/bp/insulin (do user nhập)
- Lưu trữ: ảnh bữa ăn (Viettel Object Storage – presigned URL)
- Chia sẻ: **không chia sẻ** cho bên thứ ba (nếu đúng thực tế)
- Mục đích: health & fitness; app functionality
- Xóa dữ liệu: có tính năng **Account Deletion** trong app
> Đảm bảo nội dung form khớp đúng những gì app thực sự làm.
