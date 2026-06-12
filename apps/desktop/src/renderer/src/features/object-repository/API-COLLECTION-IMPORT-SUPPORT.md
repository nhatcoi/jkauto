Trong màn hình **Import Collection** này, công cụ đang hỗ trợ import các định dạng API Collection phổ biến.

### 1. Bruno (.bru)

Bruno là API Client mã nguồn mở, thay thế Postman.

Ví dụ cấu trúc:

```text
collection/
├─ Login.bru
├─ Users.bru
└─ bruno.json
```

Nội dung:

```bru
meta {
  name: Login
  type: http
}

post {
  url: http://localhost:3000/login
}

body:json {
  {
    "username": "admin",
    "password": "123456"
  }
}
```

---

### 2. OpenCollection

Đây là format collection chung được một số API tools dùng để trao đổi dữ liệu.

Ví dụ:

```json
{
  "name": "My APIs",
  "items": [
    {
      "name": "Login",
      "method": "POST",
      "url": "http://localhost:3000/login"
    }
  ]
}
```

---

### 3. Postman Collection (.json)

Phổ biến nhất.

Ví dụ:

```json
{
  "info": {
    "name": "Demo API"
  },
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "url": {
          "raw": "http://localhost:3000/login"
        }
      }
    }
  ]
}
```

Export từ Postman:

```text
Collection
 └─ Export
      └─ Collection v2.1
```

---

### 4. Insomnia Collection

Export từ Insomnia.

Ví dụ:

```json
{
  "_type": "export",
  "__export_format": 4,
  "resources": [
    {
      "_type": "request",
      "name": "Login",
      "method": "POST",
      "url": "http://localhost:3000/login"
    }
  ]
}
```

---

### 5. OpenAPI v3

Chuẩn mô tả API phổ biến nhất hiện nay.

Ví dụ:

```yaml
openapi: 3.0.0

info:
  title: User API
  version: 1.0.0

paths:
  /login:
    post:
      summary: Login
      responses:
        "200":
          description: Success
```

Hoặc JSON:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "User API",
    "version": "1.0.0"
  }
}
```

Thường có URL:

```text
http://localhost:3000/openapi.json
http://localhost:3000/swagger.json
```

---

### 6. WSDL (.wsdl)

Dùng cho SOAP Web Service (hệ thống ngân hàng, bảo hiểm, chính phủ vẫn còn dùng khá nhiều).

Ví dụ:

```xml
<definitions
    xmlns="http://schemas.xmlsoap.org/wsdl/">

  <service name="UserService">
    <port name="UserPort">
    </port>
  </service>

</definitions>
```

URL thường:

```text
http://example.com/service?wsdl
```

---

### 7. ZIP

Cho phép import nguyên project.

Ví dụ:

```text
api-project.zip
│
├─ collection.json
├─ environment.json
├─ openapi.yaml
└─ tests/
```

Tool sẽ tự giải nén rồi đọc các file bên trong.

---

## Nếu áp dụng vào Auto Test Studio của bạn

Mình sẽ hỗ trợ Import:

| Format               | Mục đích                   |
| -------------------- | -------------------------- |
| OpenAPI 3            | Sinh Test Case API tự động |
| Postman              | Chuyển Request → Test Case |
| Insomnia             | Chuyển Request → Test Case |
| Bruno                | Chuyển Request → Test Case |
| ZIP                  | Import cả project          |
| Selenium IDE (.side) | Sinh UI Test               |
| Playwright (.ts/.js) | Parse Script → Flow        |
| Cypress (.cy.ts)     | Parse Script → Flow        |

Trong thực tế, **OpenAPI v3 + Postman Collection** là 2 định dạng đáng hỗ trợ nhất vì chiếm phần lớn nhu cầu import API hiện nay.
