# ECM API curl Examples

Tài liệu này hướng dẫn cách sử dụng `curl` để gọi các API trong `ecm-template`.

## Khởi chạy server API
Trước khi kiểm tra các API, bạn cần khởi chạy server Fastify:
```bash
cd test-project/ecm-template
npm install
npm run dev
```
Mặc định, server sẽ chạy tại `http://localhost:3001` và tài liệu Swagger UI có sẵn tại `http://localhost:3001/docs`.

---

## 1. System / Public API

### Health Check (Kiểm tra trạng thái)
```bash
curl -X GET http://localhost:3001/health
```

---

## 2. Authentication API (Quản lý Xác thực)

### Đăng ký tài liệu/người dùng mới (Register)
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tester1",
    "email": "tester1@example.com",
    "password": "Password123",
    "role": "editor"
  }'
```

### Đăng nhập (Login)
Sử dụng tài khoản admin có sẵn trong hệ thống:
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123"
  }'
```
> **Lưu ý:** Lệnh này trả về một JSON chứa `accessToken`. Hãy copy chuỗi token này để sử dụng trong các API bảo mật tiếp theo.

### Lấy thông tin tài khoản hiện tại (Me)
```bash
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Refresh Token
```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<REFRESH_TOKEN>"
  }'
```

### Đăng xuất (Logout)
```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<REFRESH_TOKEN>"
  }'
```

---

## 3. System Statistics (Thống kê hệ thống)
```bash
curl -X GET http://localhost:3001/stats \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## 4. Documents API (Quản lý tài liệu)

### Tạo mới một tài liệu (Create Document)
```bash
curl -X POST http://localhost:3001/documents \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tài liệu thiết kế hệ thống",
    "description": "Bản phác thảo kiến trúc Automation Test Platform",
    "status": "draft"
  }'
```

### Danh sách tài liệu (List Documents)
```bash
curl -X GET "http://localhost:3001/documents?page=1&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Lấy tài liệu theo ID (Get Document)
```bash
curl -X GET http://localhost:3001/documents/<DOCUMENT_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Cập nhật tài liệu (Update Document)
```bash
curl -X PUT http://localhost:3001/documents/<DOCUMENT_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tài liệu thiết kế hệ thống v2",
    "status": "published"
  }'
```

### Xóa tài liệu (Delete Document)
```bash
curl -X DELETE http://localhost:3001/documents/<DOCUMENT_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Khôi phục tài liệu đã xóa (Restore Document)
```bash
curl -X PATCH http://localhost:3001/documents/<DOCUMENT_ID>/restore \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## 5. Users API (Quản lý User - Admin Only)

### Danh sách User
```bash
curl -X GET http://localhost:3001/users \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Lấy thông tin User theo ID
```bash
curl -X GET http://localhost:3001/users/<USER_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Tự động kiểm thử qua shell script
Chúng tôi đã cung cấp sẵn script `test-api.sh` giúp bạn tự động kiểm tra nhanh chuỗi hành trình (health check -> login -> stats -> create doc -> get doc).

Để chạy script:
```bash
chmod +x test-api.sh
./test-api.sh
```
*(Yêu cầu server đang chạy trên port 3001 trước khi thực hiện)*
