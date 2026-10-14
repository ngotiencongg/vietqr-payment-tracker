# Sổ Thu Tiền Ăn Uống & Tạo Mã VietQR (Payment Tracker & QR Generator)

Ứng dụng web giúp dân văn phòng theo dõi tiền ăn trưa, trà chiều, tổng hợp số tiền cần thu theo từng người, quét hóa đơn bằng AI và tạo mã VietQR thanh toán chính xác.

## Tính năng chính

- **2 Giao diện tách biệt**:
  - **Giao diện Chủ trì (Host)**: Cài đặt tài khoản ngân hàng, nhập tay, dán chat Zalo, quét ảnh bill bằng Gemini AI, đối soát gạch nợ tự động.
  - **Giao diện Người trả tiền (Payer)**: Gọn gàng, không có nút cài đặt, tìm tên và bấm quét mã VietQR chuyển khoản nhanh.
- **Tổng hợp theo từng người (Per-Person Aggregation)**: Tự động gom nhiều món (ví dụ: cơm + trà đá) thành 1 khoản tổng kèm 1 mã VietQR duy nhất.
- **Tự động nhận biết chuyển tiền**:
  - Dán tin nhắn SMS / biến động số dư ngân hàng.
  - Tải ảnh chụp biên lai chuyển khoản (UNC) để AI Gemini Vision tự động đọc và gạch nợ.
- **Bảo mật & Cục bộ**: Dữ liệu lưu trong `localStorage` của trình duyệt, không cần máy chủ backend.

## Cài đặt & Chạy cục bộ

```bash
npm install
npm run dev
```

Bản build triển khai:

```bash
npm run build
```
