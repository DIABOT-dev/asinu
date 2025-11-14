# TASK_MOBILE_CAPACITOR_SHELL.md
### Mục tiêu: Tạo “vỏ mobile” cho Asinu bằng Capacitor, tạm thời dùng WebView trỏ thẳng vào web Asinu hiện tại.

## Tổng quan

Chúng ta **không viết lại logic**.  
Chỉ tạo một project mobile riêng (Android/iOS) dùng Capacitor, load URL:

- STAGING/PROD: ví dụ `https://asinu.top` hoặc `https://app.asinu.top` (để TODO cho người cấu hình).

Kết quả mong muốn:

- Có thư mục `mobile-shell/` chứa project Capacitor.
- Có platform Android (và chuẩn bị iOS skeleton).
- Có npm script để build/sync.
- Không commit bất kỳ secret/keystore.

> Lưu ý: không đụng gì vào Next.js, backend, DB. Mọi thay đổi đều nằm trong `mobile-shell/` + vài script/CI nếu cần.

---

## P0 – Tạo folder `mobile-shell` & package cơ bản

### 1. Tạo thư mục project mobile

- Tạo thư mục mới ở root repo:
  - `mobile-shell/`

Bên trong `mobile-shell/`:

- Tạo `package.json` tối thiểu:
  ```json
  {
    "name": "asinu-mobile-shell",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "cap:init": "npx cap init Asinu com.diabot.asinu --web-dir=dist",
      "cap:sync": "npx cap sync",
      "cap:android": "npx cap add android",
      "cap:open:android": "npx cap open android",
      "cap:build": "echo \"Build web assets to dist/ trước khi sync\""
    },
    "devDependencies": {
      "@capacitor/cli": "^6.0.0"
    },
    "dependencies": {
      "@capacitor/core": "^6.0.0"
    }
  }
Phiên bản Capacitor có thể điều chỉnh theo chuẩn hiện tại, nhưng giữ format tương tự.

Thêm file .gitignore trong mobile-shell/:

gitignore
Sao chép mã
node_modules
dist
android/app/build
ios/build
ios/Pods
P1 – Init Capacitor & config trỏ về web Asinu
2. Cài Capacitor & init
Bên trong mobile-shell/:

Chạy:

bash
Sao chép mã
npm install
npm run cap:init
Kết quả mong đợi:

Có file capacitor.config.ts (hoặc .json)

Có thư mục android/ sau bước sau.

3. Cấu hình Capacitor để load web Asinu (remote URL)
Cập nhật capacitor.config.* (ưu tiên .ts), ví dụ:

ts
Sao chép mã
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.diabot.asinu',
  appName: 'Asinu',
  webDir: 'dist',
  server: {
    // TODO: chỉnh URL này khi dùng thật (staging/prod)
    url: process.env.ASINU_WEB_URL || 'https://asinu.top',
    cleartext: false
  }
};

export default config;
Mục tiêu: app mobile không cần bundle web, chỉ cần mở URL web Asinu hiện tại.

P2 – Thêm Android platform
4. Thêm Android vào Capacitor
Trong mobile-shell/:

Chạy:

bash
Sao chép mã
npm run cap:android
npm run cap:sync
Kết quả mong đợi:

Có thư mục: mobile-shell/android/

Có thể mở được project bằng Android Studio (sau này dev thao tác).

5. Chuẩn bị docs build APK/AAB (không cần Codex chạy, chỉ viết tài liệu)
Tạo file: docs/MOBILE_CAPACITOR_ANDROID_RELEASE.md (ở root repo), nội dung:

Yêu cầu:

Android Studio / SDK

Java JDK

Các bước build:

cd mobile-shell

npm install

Đảm bảo ASINU_WEB_URL trỏ URL đúng:

Staging: https://staging.asinu.top (vd)

Prod: https://asinu.top

npm run cap:sync

Mở Android Studio: npm run cap:open:android

Build APK/AAB trong Android Studio (Build > Generate Signed Bundle/APK)

Chỉ cần Codex tạo file docs, không chạy Android Studio.

P3 – Hook nhẹ vào CI (optional, skeleton)
6. Thêm script tiện dụng ở root repo
Trong package.json (root):

Thêm:

json
Sao chép mã
"scripts": {
  "mobile:android:sync": "cd mobile-shell && npm run cap:sync",
  "mobile:android:open": "cd mobile-shell && npm run cap:open:android"
}
Không bắt buộc build trong CI lúc này.
Mục tiêu: dev nội bộ có lệnh sẵn để dùng.

7. Thêm note vào README / docs
Trong docs/RELEASE_ANDROID.md hoặc file mới:

Bổ sung mục “Capacitor mobile shell”:

Giải thích: app Android hiện tại là vỏ Capacitor load web Asinu.

Cảnh báo: nếu URL web đổi (ASINU_WEB_URL), phải update config + build lại.

P4 – iOS (skeleton, không build)
8. Tạo skeleton iOS (optional, tùy config môi trường)
Nếu môi trường cho phép:

Bên trong mobile-shell/:

bash
Sao chép mã
npx cap add ios
Cập nhật .gitignore trong mobile-shell/ để ignore build iOS, Pods.

Nếu môi trường không có macOS → chỉ cần thêm hướng dẫn vào docs/RELEASE_IOS.md:

“Khi có máy macOS, vào mobile-shell/, chạy npx cap add ios, mở Xcode từ ios/App/App.xcworkspace và build như app iOS bình thường.”

Kết quả mong muốn sau task này
Trong repo có thư mục:

mobile-shell/ (project Capacitor)

Có:

mobile-shell/package.json

mobile-shell/capacitor.config.ts

mobile-shell/android/ (sau khi add)

Có docs:

docs/MOBILE_CAPACITOR_ANDROID_RELEASE.md

Root repo có script:

npm run mobile:android:sync

npm run mobile:android:open

Không chạm tới:

Mã Next.js

Mã backend

CI phức tạp (chỉ thêm script nhẹ nếu cần)

yaml
Sao chép mã

---

## Gợi ý bước tiếp theo cho ông

1. **Tạo file task**:  
   Lưu nội dung trên thành: `docs/TASK_MOBILE_CAPACITOR_SHELL.md`.

2. **Gọi Codex**:  
   ```bash
   codex run --task docs/TASK_MOBILE_CAPACITOR_SHELL.md
