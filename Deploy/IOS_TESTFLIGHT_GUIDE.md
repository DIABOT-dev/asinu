# iOS – TestFlight & App Privacy (Concept)

## Build TestFlight (Expo/EAS ví dụ)
- Yêu cầu: Apple Developer, certs/profiles
- Build: `eas build -p ios --profile preview`
- Upload: `eas submit -p ios` hoặc upload qua Transporter

## App Store Connect – TestFlight
1) Tạo nhóm tester nội bộ
2) Thêm build vào TestFlight
3) Mời tester & phát hành nội bộ

## App Privacy (Nutrition Labels) – gợi ý
- Data Types: health (user input), identifiers (auth), usage data (optional)
- Purpose: app functionality, health
- Linked to user: **Có**, lưu trên Postgres nội bộ
- Tracking: **Không** (nếu không dùng SDK quảng cáo)
> Khai đúng thực tế, đồng bộ với Privacy Policy trong app.
