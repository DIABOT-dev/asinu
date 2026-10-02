# Biến môi trường IAP mobile

```env
EXPO_PUBLIC_PAYMENT_METHOD=iap
EXPO_PUBLIC_API_BASE_URL=https://<backend-test-hoặc-production>
```

Không khai báo Product ID trong mobile. App gọi `GET /api/iap/products`, đối chiếu danh mục đó với sản phẩm native Store và chỉ hiển thị SKU có mặt ở cả hai nguồn.

Môi trường sử dụng:

- Development/Sandbox: API local hoặc staging nhận receipt sandbox.
- Production: `https://asinu.top`, chỉ nhận receipt production.
- TestFlight: luôn dùng sandbox, vì vậy build TestFlight thử nghiệm phải trỏ backend staging.
