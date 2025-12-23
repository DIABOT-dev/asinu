RUNBOOK ANDROID DEV CLIENT (WIN) — TRẠNG THÁI 23/12
0) Khi nào cần quay lại quy trình này?

Chỉ cần quay lại khi gặp 1 trong các dấu hiệu:

Emulator mở Dev Client nhưng Searching for development servers…

Connection reset / unexpected end of stream

Build lại dev client xong nhưng không load JS

Metro chạy nhưng app không bắt server

Đổi mạng/VPN/Firewall làm “đứt” kết nối

1) “Reset sạch” (30 giây) — làm trước khi chạy

Mở PowerShell tại repo:

cd F:\Projects\asinu-win


Dọn reverse + process cũ:

adb reverse --remove-all


(Nếu terminal Metro đang chạy) bấm Ctrl+C để tắt.

2) CHẠY METRO — chốt chuẩn: localhost + port 19000

Mở Terminal 1:

cd F:\Projects\asinu-win
npx expo start --dev-client --clear --localhost --port 19000


Quy tắc vàng: luôn dùng --localhost --port 19000 để né lỗi 8081 + LAN.

3) ADB REVERSE — chỉ cần 1 cổng 19000

Mở Terminal 2:

adb reverse tcp:19000 tcp:19000
adb reverse --list


Kỳ vọng có dòng:

host-xx tcp:19000 tcp:19000

4) EMULATOR — kết nối thủ công đúng URL

Trên emulator → Expo Dev Client:

Enter URL manually

Nhập đúng:

http://127.0.0.1:19000


Bấm Connect → app phải vào UI (Login/Home).

5) Nếu app chưa mở / mở nhầm

Ép mở app bằng adb:

adb shell monkey -p com.asinu.lite 1

RUNBOOK BUILD LẠI DEV CLIENT (khi cần rebuild native)

Chỉ làm phần này khi:

đổi native deps

đổi app.json plugins/native

hoặc dev client hỏng cần rebuild

A) Build lại dev client + cài vào emulator
cd F:\Projects\asinu-win
npx expo run:android


Sau khi build xong, quay lại Runbook Metro (mục 2–4).

“CHECKPOINT QUAY LẠI” (Git)

Mỗi lần muốn quay lại đúng trạng thái hôm nay:

git fetch --all
git checkout <branch-hoac-tag-hom-nay>
npm install


Rồi chạy lại theo Runbook Metro (mục 1–4).

Nếu mày chưa tag, khuyên tạo ngay 1 tag dễ nhớ:

git tag BUILDPOINT_2025-12-23_ANDROID_OK
git push origin BUILDPOINT_2025-12-23_ANDROID_OK

Lỗi → cách xử nhanh (khỏi mò)
1) “Searching for development servers…”

→ Làm lại mục 2–4 (Metro 19000 + adb reverse + nhập URL 127.0.0.1)

2) “Connection reset”

→ 99% do Metro/cổng. Đảm bảo đang dùng 19000 + localhost.
Tắt Metro → chạy lại lệnh ở mục 2.

3) “unexpected end of stream”

→ Đổi port về 19000 (đã fix). Không dùng 8081 nữa.

Chốt 1 câu để mày nhớ

Đừng mò LAN nữa. Chỉ dùng localhost + 19000 + adb reverse + 127.0.0.1.
