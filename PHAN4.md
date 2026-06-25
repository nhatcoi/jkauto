# PHẦN IV: BÁO CÁO PHÂN TÍCH TỔNG HỢP

---

## 4.1 Tổng hợp kết quả kiểm thử

### 4.1.1 Kết quả thực thi

Nhóm thực hiện kiểm thử hệ thống Electronic Content Management (ECM) thông qua nền tảng JKAuto, áp dụng hai lớp kiểm thử: **E2E Web** (Playwright) và **API** (API Request Editor). Toàn bộ 10 test case thuộc Smoke Suite đều thực thi thành công trong môi trường local.

**Bảng 4.1 — Tổng hợp kết quả kiểm thử ECM**

| Phân loại | Số test case | Passed | Failed | Tổng bước | Tỉ lệ pass |
|---|---|---|---|---|---|
| E2E Web (Playwright) | 4 | 4 | 0 | 48 | 100% |
| API (HTTP) | 6 | 6 | 0 | 6 | 100% |
| **Tổng cộng** | **10** | **10** | **0** | **54** | **100%** |

Thời gian thực thi toàn bộ smoke suite: **~14 giây** (headless mode).

### 4.1.2 Đánh giá theo đặc tính chất lượng ISO/IEC 25010

**Bảng 4.2 — Đánh giá chất lượng ECM qua kết quả kiểm thử**

| Đặc tính | Nội dung kiểm thử | Đánh giá | Ghi chú |
|---|---|---|---|
| Phù hợp chức năng | CRUD tài liệu, thư mục; đăng nhập/đăng xuất; phân quyền admin | **Đạt** | 10/10 test case pass |
| Hiệu năng | API response < 100ms (health, login, CRUD) | **Đạt** | Môi trường local |
| Độ tin cậy | Xử lý thông tin sai, thông báo lỗi rõ ràng | **Đạt** | TC-ECM-02 xác nhận negative case |
| Bảo mật | JWT bắt buộc cho endpoint bảo vệ; endpoint admin-only | **Đạt** | Chưa kiểm thử penetration |
| Khả năng sử dụng | Giao diện điều hướng trực quan, luồng tạo tài liệu rõ ràng | **Đạt** | Đánh giá qua E2E |
| Tương thích | Playwright Chromium trên macOS | **Đạt một phần** | Chưa kiểm tra đa browser |
| Khả năng bảo trì | Codebase TypeScript + Zod schema + Swagger docs | **Tốt** | Đánh giá tĩnh |
| Tính khả chuyển | Fastify cross-platform, SQLite portable | **Đạt** | Chưa kiểm thử Windows |

---

## 4.2 Phân tích lỗi và rủi ro phát hiện

### 4.2.1 Lỗi phát hiện trong quá trình kiểm thử

Trong phạm vi smoke test (10 test case), **không ghi nhận lỗi nghiêm trọng**. Tuy nhiên, nhóm nhận diện một số điểm cần lưu ý:

| # | Vấn đề | Mức độ | Phạm vi |
|---|---|---|---|
| 1 | Soft delete chưa ẩn tài liệu khỏi danh sách mặc định (cần filter `deletedAt IS NULL`) | Trung bình | Documents API |
| 2 | Endpoint `/stats` không có rate limiting — nguy cơ nếu expose production | Thấp | Security |
| 3 | Token JWT không có thời hạn ngắn rõ ràng trong cấu hình mẫu | Thấp | Security |
| 4 | UI không hiển thị thông báo xác nhận sau khi xóa tài liệu | Thấp | UX |

### 4.2.2 Rủi ro ngoài phạm vi smoke test

| Rủi ro | Xác suất | Tác động | Biện pháp đề xuất |
|---|---|---|---|
| Race condition khi nhiều người dùng sửa cùng tài liệu | Trung bình | Cao | Thêm optimistic locking hoặc version field |
| Token lộ trong log server | Thấp | Cao | Mask `Authorization` header trong log Fastify |
| Mất dữ liệu khi server crash giữa chừng ghi SQLite | Thấp | Cao | Dùng transaction cho mọi thao tác ghi phức hợp |
| Payload không có giới hạn kích thước (document body) | Thấp | Trung bình | Thêm `Content-Length` limit trong Fastify config |

---

## 4.3 Đánh giá hiệu quả của JKAuto làm công cụ kiểm thử

### 4.3.1 Điểm mạnh

- **Tích hợp liền mạch:** Toàn bộ luồng từ thiết kế test case → thực thi → xem kết quả nằm trong một IDE duy nhất; không cần chuyển đổi công cụ.
- **File-first artifact:** Test case lưu YAML — dễ review qua Git diff, dễ chia sẻ giữa thành viên nhóm.
- **CLI headless:** Lệnh `jkauto run --headless --reporter junit` cho phép tích hợp CI/CD chỉ với một dòng lệnh.
- **Sinh workflow tự động:** `jkauto generate-workflow` tạo GitHub Actions/GitLab CI/Jenkins từ thông tin project — tiết kiệm thời gian cấu hình.
- **API Request Editor:** Chain token giữa request bằng Save-to-Env, giảm thao tác thủ công khi kiểm thử chuỗi API.

### 4.3.2 Hạn chế ghi nhận

- **Phụ thuộc môi trường:** Playwright yêu cầu cài browser riêng; môi trường CI cần bước `playwright install --with-deps`.
- **Chưa hỗ trợ parallel execution:** Smoke suite 4 test case chạy tuần tự — thời gian có thể tăng đáng kể với suite lớn.
- **Thiếu assertion phức tạp cho UI:** Hiện tại keyword `assert-text` chỉ so sánh exact match; chưa có `assert-regex`, `assert-contains` cho nội dung động.
- **Reports panel:** Chưa có biểu đồ xu hướng (trend) theo thời gian — khó theo dõi regression rate qua nhiều sprint.

---

## 4.4 So sánh với công cụ kiểm thử thay thế

**Bảng 4.3 — JKAuto vs. công cụ kiểm thử phổ biến**

| Tiêu chí | JKAuto | Playwright Test | Postman | Katalon Studio |
|---|---|---|---|---|
| Thiết kế test không cần code | ✅ Keyword table | ❌ Code only | ✅ GUI | ✅ GUI |
| Artifact Git-friendly | ✅ YAML/JSON | ✅ .ts file | ⚠ Collection JSON | ❌ Binary |
| CLI CI/CD | ✅ `jkauto run` | ✅ `playwright test` | ✅ Newman | ✅ katalonc |
| Tích hợp E2E + API cùng IDE | ✅ | ❌ Chỉ E2E | ❌ Chỉ API | ✅ |
| AI sinh test | ✅ Agent + Autogen | ❌ | ❌ | ❌ |
| Mobile (Appium) | ✅ | ❌ | ❌ | ✅ |
| Mã nguồn mở | ✅ | ✅ | ❌ | ❌ |
| Học phí | Thấp | Cao (cần biết TS) | Thấp | Trung bình |

JKAuto lấp được khoảng cách giữa công cụ no-code (dễ dùng nhưng hạn chế) và framework viết mã (mạnh nhưng ngưỡng học cao). Điểm khác biệt nổi bật là khả năng kết hợp E2E + API + AI sinh test trong một IDE duy nhất với artifact minh bạch.

---

## 4.5 Kết luận và kiến nghị

### 4.5.1 Kết luận

Qua quá trình thiết lập và thực thi kiểm thử hệ thống ECM bằng JKAuto:

1. **Hệ thống ECM** vận hành đúng đắn ở các chức năng cốt lõi: xác thực, quản lý tài liệu, thư mục và phân quyền. Toàn bộ 10 test case smoke suite đều pass, xác nhận ECM đủ điều kiện làm ứng dụng mục tiêu kiểm thử.

2. **Nền tảng JKAuto** chứng minh khả năng tự động hóa kiểm thử end-to-end hoàn chỉnh: từ thiết kế test case dạng bảng, thực thi qua Playwright/API, đến xuất báo cáo JUnit và tích hợp CI/CD qua một lệnh duy nhất.

3. **Tích hợp CI/CD** thực hiện được ngay lập tức nhờ `generate-workflow` — rào cản thiết lập pipeline gần như bằng 0 với người dùng không quen DevOps.

### 4.5.2 Kiến nghị

| Ưu tiên | Kiến nghị | Đối tượng |
|---|---|---|
| Cao | Bổ sung kiểm thử parallel (chạy nhiều test case đồng thời) | JKAuto Engine |
| Cao | Thêm assertion nâng cao: `assert-contains`, `assert-regex`, `assert-count` | JKAuto Keyword |
| Trung bình | Thêm trend chart trong Reports panel (pass rate theo ngày/sprint) | JKAuto Reports |
| Trung bình | Thêm rate limiting và audit log cho ECM API production | ECM Server |
| Thấp | Mở rộng kiểm thử trên Windows và multi-browser (Firefox, WebKit) | Cả hai |

---

**Nhóm thực hiện:** Nguyễn Văn Nhật · Nguyễn Kiều Trinh · Quách Hữu Nam · Lê Thị Kiều Trang

**Năm thực hiện:** 2026
