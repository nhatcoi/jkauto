# PHẦN III: THỰC HIỆN KIỂM THỬ
## Hệ thống Electronic Content Management (ECM)

---

## 3.1 Cài đặt môi trường kiểm thử

### 3.1.1 Tổng quan môi trường

Để thực hiện kiểm thử hệ thống Electronic Content Management (ECM) bằng nền tảng JKAuto, nhóm thiết lập một môi trường gồm ba thành phần chính hoạt động song song:

| Thành phần | Vai trò | Địa chỉ |
|---|---|---|
| **ECM API Server** | Backend REST API (Fastify + SQLite) | `http://localhost:3001` |
| **ECM Web UI** | Giao diện người dùng cuối (React + Vite) | `http://localhost:5174` |
| **JKAuto Desktop** | IDE thiết kế và thực thi kiểm thử | Ứng dụng Electron |

Mô hình kiểm thử áp dụng hai lớp:
- **Kiểm thử API (Black-box):** Gọi trực tiếp endpoint REST thông qua API Request Editor của JKAuto, xác minh response code, body và header.
- **Kiểm thử UI End-to-End (E2E):** Điều khiển trình duyệt Chromium qua Playwright, mô phỏng hành vi người dùng thực từ giao diện web.

---

### 3.1.2 Yêu cầu hệ thống

**Bảng 3.1 — Yêu cầu phần mềm tối thiểu**

| Phần mềm | Phiên bản tối thiểu | Vai trò |
|---|---|---|
| Node.js | v22.0.0+ | Runtime cho ECM server và JKAuto engine |
| pnpm | v9.0.0+ | Package manager cho monorepo JKAuto |
| Chromium (Playwright) | Tự động cài | Trình duyệt cho kiểm thử E2E |
| Git | v2.40+ | Quản lý phiên bản dự án kiểm thử |
| Hệ điều hành | macOS 13+, Windows 10+, Ubuntu 22+ | Nền tảng chạy JKAuto Desktop |

**Cấu hình phần cứng khuyến nghị:**

| Tài nguyên | Tối thiểu | Khuyến nghị |
|---|---|---|
| RAM | 8 GB | 16 GB |
| CPU | 4 nhân | 8 nhân |
| Disk | 5 GB trống | 20 GB trống |
| Kết nối mạng | Không bắt buộc (kiểm thử local) | — |

---

### 3.1.3 Cài đặt hệ thống ứng dụng mục tiêu (ECM)

#### Bước 1 — Cài đặt ECM API Server

ECM Template là ứng dụng REST API xây dựng bằng **Fastify**, **TypeScript**, **SQLite** (`better-sqlite3`) và **JWT** để xác thực. Server tích hợp Swagger UI cho phép kiểm tra API trực tiếp qua trình duyệt.

```bash
# Di chuyển vào thư mục ECM template
cd jkauto/test-project/ecm-template

# Cài đặt các thư viện phụ thuộc
npm install

# Khởi động server ở chế độ development (hot-reload)
npm run dev
```

Sau khi khởi động thành công, terminal hiển thị:

```
  ECM API running at http://localhost:3001
  Swagger UI: http://localhost:3001/docs
```

**Hình 3.1** — Màn hình terminal sau khi khởi động ECM API Server thành công, hiển thị địa chỉ server và đường dẫn tài liệu Swagger UI.

> **Tài khoản mặc định được seed sẵn:**
> - Username: `admin` | Password: `Admin@123` | Role: `admin`

ECM API cung cấp các nhóm endpoint chính:

| Nhóm | Prefix | Mô tả |
|---|---|---|
| Xác thực | `/auth` | Đăng ký, đăng nhập, refresh token, đăng xuất |
| Tài liệu | `/documents` | CRUD tài liệu, khôi phục tài liệu đã xóa mềm |
| Thư mục | `/folders` | Quản lý cây thư mục tổ chức tài liệu |
| Thẻ | `/tags` | Gắn nhãn phân loại tài liệu |
| Người dùng | `/users` | Quản lý tài khoản (Admin only) |
| Tìm kiếm | `/search` | Tìm kiếm toàn văn |
| Thống kê | `/stats` | Tổng quan hệ thống (Admin only) |
| Hệ thống | `/health` | Kiểm tra trạng thái server (public) |

#### Bước 2 — Cài đặt ECM Web UI

```bash
# Di chuyển vào thư mục giao diện người dùng
cd jkauto/test-project/ecm-template/ui

# Cài đặt thư viện
npm install

# Khởi động UI development server
npm run dev
```

Giao diện web chạy tại `http://localhost:5174`, kết nối đến API server tại port 3001.

**Hình 3.2** — Màn hình đăng nhập của hệ thống ECM Web UI tại `http://localhost:5174`, hiển thị form nhập username/password với nút Login.

#### Bước 3 — Xác minh môi trường bằng Health Check

```bash
curl -X GET http://localhost:3001/health
```

Kết quả mong đợi:

```json
{
  "status": "ok",
  "uptime": 12.345,
  "timestamp": "2026-06-25T08:00:00.000Z"
}
```

**Hình 3.3** — Kết quả health check trả về JSON xác nhận ECM API hoạt động bình thường với trường `status: "ok"`.

---

### 3.1.4 Cài đặt JKAuto Desktop

#### Bước 1 — Cài đặt từ mã nguồn

```bash
# Clone repository JKAuto
git clone https://github.com/org/jkauto.git
cd jkauto

# Cài đặt toàn bộ dependency trong monorepo
pnpm install

# Cài đặt trình duyệt Playwright (Chromium)
pnpm --filter @jkauto/engine exec playwright install --with-deps chromium

# Khởi động ứng dụng Desktop ở chế độ development
pnpm --filter desktop dev
```

#### Bước 2 — Cài đặt JKAuto CLI (cho CI/CD)

```bash
# Build gói CLI
pnpm --filter @jkauto/cli build

# Đăng ký lệnh jkauto toàn cục (tùy chọn)
npm link packages/cli
```

Sau khi cài đặt, kiểm tra phiên bản:

```bash
jkauto --version
# 0.1.0
```

**Hình 3.4** — JKAuto Desktop khởi động thành công, hiển thị màn hình Welcome với các tùy chọn tạo project mới hoặc mở project gần đây.

---

## 3.2 Thiết lập ứng dụng kiểm thử

### 3.2.1 Tạo dự án kiểm thử trong JKAuto IDE

#### Bước 1 — Khởi tạo project mới

Từ màn hình Welcome của JKAuto Desktop, nhấn **"New Project"**. Hộp thoại khởi tạo project xuất hiện với các trường thông tin:

| Trường | Giá trị nhập | Mô tả |
|---|---|---|
| Project Name | `ECM-AutoTest` | Tên định danh dự án |
| Type | `web` | Nền tảng kiểm thử (Web E2E) |
| Location | `/Users/<user>/Projects/ECM-AutoTest` | Thư mục lưu trữ |
| Format | `yaml` | Định dạng file artifact |
| Description | `Kiểm thử hệ thống ECM với JKAuto` | Mô tả ngắn |
| Repo URL | *(để trống)* | URL repository Git (tùy chọn) |

Nhấn **OK** — JKAuto tạo cấu trúc thư mục chuẩn:

```
ECM-AutoTest/
├── project.json          ← Metadata: name, type, format, schemaVersion
├── profiles/
│   └── default.env.json  ← Biến môi trường mặc định
├── test-cases/           ← Chứa các file .test.yaml
├── test-suites/          ← Chứa các file .suite.yaml
├── object-repository/    ← Chứa các file .objects.json
├── api-requests/         ← Chứa các file .request.json
└── .autotest/            ← Dữ liệu dẫn xuất (gitignore)
    └── runs.db
```

**Hình 3.5** — Hộp thoại khởi tạo project "New Project" với các trường thông tin đã điền, nút Cancel và OK.

**Hình 3.6** — Cây thư mục project ECM-AutoTest xuất hiện trong panel Explorer sau khi tạo thành công.

#### Bước 2 — Cấu hình Environment Profile

Mở file `profiles/default.env.json` trong Explorer, cấu hình biến môi trường:

```json
{
  "schemaVersion": 1,
  "name": "default",
  "variables": {
    "baseUrl": "http://localhost:5174",
    "apiUrl": "http://localhost:3001",
    "adminUser": "admin",
    "adminPass": "Admin@123"
  },
  "api": {
    "defaultTimeout": 30000,
    "defaultHeaders": {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  }
}
```

**Hình 3.7** — File `default.env.json` mở trong editor với các biến môi trường đã cấu hình cho ECM.

#### Bước 3 — Nhập test cases từ ECM Template

Copy 4 file test case từ `test-project/ecm-template/test-cases/` vào thư mục `test-cases/` của project `ECM-AutoTest`:

- `login-success.test.yaml`
- `login-failure.test.yaml`
- `document-create.test.yaml`
- `folder-create.test.yaml`

JKAuto tự động phát hiện file mới qua `chokidar` file watcher và cập nhật cây Explorer ngay lập tức — không cần reload thủ công.

**Hình 3.8** — Panel Explorer hiển thị 4 test case vừa nhập, với icon phân loại theo platform (web).

---

### 3.2.2 Thiết kế Test Suite

#### Tạo Smoke Test Suite

Nhấn chuột phải vào thư mục `test-suites/` trong Explorer → **New Test Suite**. Tạo file `smoke.suite.yaml`:

```yaml
schemaVersion: 1
id: suite-ecm-smoke
title: "ECM Smoke Test Suite"
profile: default
continueOnFailure: false
items:
  - testCaseId: tc_ecm_login_success
    testCasePath: test-cases/login-success.test.yaml
    enabled: true
    order: 1
  - testCaseId: tc_ecm_login_failure
    testCasePath: test-cases/login-failure.test.yaml
    enabled: true
    order: 2
  - testCaseId: tc_ecm_document_create
    testCasePath: test-cases/document-create.test.yaml
    enabled: true
    order: 3
  - testCaseId: tc_ecm_folder_create
    testCasePath: test-cases/folder-create.test.yaml
    enabled: true
    order: 4
```

**Hình 3.9** — Suite Editor hiển thị danh sách 4 test case với thứ tự, trạng thái enable/disable và profile "default".

---

### 3.2.3 Tự động hóa kiểm thử với JKAuto CLI

JKAuto CLI (`packages/cli`) là công cụ dòng lệnh cho phép chạy kiểm thử ngoài giao diện IDE, phục vụ các pipeline CI/CD. CLI hỗ trợ đầy đủ tính năng tương đương IDE:

```
jkauto run [options]

Options:
  --project <path>          Thư mục gốc project (bắt buộc)
  --suite <name>            Tên hoặc đường dẫn suite
  --test-case <name>        Tên hoặc đường dẫn test case
  --profile <name>          Profile môi trường (mặc định: default)
  --headless                Chạy trình duyệt không giao diện (CI mode)
  --reporter <type>         console | junit | json
  --output <path>           File đầu ra cho reporter junit/json
  --screenshot-dir <path>   Thư mục lưu ảnh chụp màn hình lỗi
  --continue-on-failure     Tiếp tục khi test case trong suite thất bại
  --verbose                 In chi tiết từng step khi chạy
```

**Ví dụ chạy toàn bộ smoke suite:**

```bash
jkauto run \
  --project ./ECM-AutoTest \
  --suite smoke \
  --profile default \
  --headless \
  --reporter junit \
  --output ./reports/junit.xml \
  --continue-on-failure \
  --verbose
```

**Hình 3.10** — Terminal hiển thị output của lệnh `jkauto run`, với từng step được in kèm trạng thái PASS/FAIL và thời gian thực hiện.

---

### 3.2.4 Tích hợp CI/CD — GitHub Actions

JKAuto cung cấp lệnh `generate-workflow` để tự động tạo file cấu hình CI/CD cho GitHub Actions, GitLab CI và Jenkins từ thông tin project:

```bash
jkauto generate-workflow \
  --project ./ECM-AutoTest \
  --suite smoke \
  --profile default \
  --provider github \
  --output .github/workflows/autotest.yml \
  --node-version 22
```

File `.github/workflows/autotest.yml` được sinh tự động:

```yaml
name: ECM-AutoTest — Automated Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'       # Chạy tự động lúc 2h sáng mỗi ngày
  workflow_dispatch:           # Cho phép trigger thủ công

jobs:
  autotest:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm install -g pnpm
          pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm --filter @jkauto/cli exec playwright install --with-deps chromium

      - name: Run automated tests
        run: |
          pnpm jkauto run \
            --project . \
            --suite smoke \
            --profile default \
            --headless \
            --reporter junit \
            --output ./reports/junit.xml

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: reports/

      - name: Publish JUnit report
        if: always()
        uses: mikepenz/action-junit-report@v4
        with:
          report_paths: 'reports/junit.xml'
```

**Hình 3.11** — File `autotest.yml` hiển thị trong tab GitHub Actions của repository, với cấu hình trigger push/PR/schedule và các bước cài đặt, chạy test, upload artifact.

**Hình 3.12** — Màn hình GitHub Actions hiển thị pipeline chạy thành công, với badge xanh và summary test results được publish dưới dạng JUnit report.

#### Luồng CI/CD tổng thể

```
Developer push code
        │
        ▼
GitHub Actions trigger (push / PR / schedule)
        │
        ▼
Checkout → Setup Node 22 → pnpm install
        │
        ▼
playwright install --with-deps chromium
        │
        ▼
jkauto run --headless --reporter junit
        │
        ├── PASS ──► Upload artifact → Merge allowed
        └── FAIL ──► Upload artifact + screenshots → Block merge
```

---

### 3.2.5 Tích hợp GitLab CI và Jenkins

**GitLab CI** (`.gitlab-ci.yml`):

```bash
jkauto generate-workflow \
  --project ./ECM-AutoTest \
  --provider gitlab \
  --output .gitlab-ci.yml
```

**Jenkins** (`Jenkinsfile`):

```bash
jkauto generate-workflow \
  --project ./ECM-AutoTest \
  --provider jenkins \
  --output Jenkinsfile
```

Cả ba provider đều tuân theo cùng một logic: cài Node.js → cài dependency → cài Playwright → chạy `jkauto run --headless --reporter junit` → publish kết quả JUnit XML.

---

## 3.3 Tiến hành kiểm thử Electronic Content Management

### 3.3.1 Tổng quan kế hoạch kiểm thử

**Bảng 3.2 — Ma trận test case và phạm vi kiểm thử ECM**

| ID | Tên Test Case | Loại | Luồng kiểm thử | Kết quả kỳ vọng |
|---|---|---|---|---|
| TC-ECM-01 | Login Success | E2E Web | Đăng nhập hợp lệ → vào Dashboard | Pass — hiển thị "Welcome back, admin" |
| TC-ECM-02 | Login Failure | E2E Web | Đăng nhập sai credentials → lỗi | Pass — hiển thị "Invalid credentials" |
| TC-ECM-03 | Document Create | E2E Web | Tạo tài liệu mới qua UI | Pass — tài liệu xuất hiện trong danh sách |
| TC-ECM-04 | Folder Create | E2E Web | Tạo thư mục mới qua UI | Pass — thư mục xuất hiện trong danh sách |
| TC-ECM-05 | Health Check | API | GET /health | 200 OK — `status: "ok"` |
| TC-ECM-06 | Login API | API | POST /auth/login với credentials hợp lệ | 200 OK — trả về `accessToken` |
| TC-ECM-07 | Create Document API | API | POST /documents với Bearer token | 201 Created — trả về document object |
| TC-ECM-08 | List Documents API | API | GET /documents với phân trang | 200 OK — array documents + pagination |
| TC-ECM-09 | Delete Document API | API | DELETE /documents/:id | 200 OK — soft delete |
| TC-ECM-10 | Get Stats API | API | GET /stats (Admin only) | 200 OK — thống kê hệ thống |

---

### 3.3.2 TC-ECM-01: Kiểm thử đăng nhập thành công (E2E Web)

#### Mô tả

Kiểm thử luồng đăng nhập với tài khoản hợp lệ, xác minh hệ thống điều hướng đến Dashboard và hiển thị thông điệp chào mừng đúng.

#### Cấu hình test case

```yaml
schemaVersion: 1
id: tc_ecm_login_success
name: Login ECM - Success
platform: web
runner: playwright
variables:
  username: admin
  password: Admin@123
steps:
  - id: open_app
    keyword: navigate-to
    input: http://localhost:5174

  - id: wait_login_form
    keyword: wait-for-element
    objectRef: "#username"

  - id: enter_username
    keyword: type-text
    objectRef: "#username"
    input: "{{username}}"

  - id: enter_password
    keyword: type-text
    objectRef: "#password"
    input: "{{password}}"

  - id: submit_login
    keyword: click
    objectRef: "#login-btn"

  - id: wait_dashboard
    keyword: wait-for-element
    objectRef: 'text="Dashboard"'

  - id: assert_welcome_back
    keyword: assert-text
    objectRef: 'text="Welcome back,"'
    expected: "Welcome back, {{username}}"
```

#### Thực hiện trong JKAuto IDE

**Bước 1:** Nhấn đúp vào file `login-success.test.yaml` trong Explorer. Test Case Editor mở với bảng step.

**Hình 3.13** — Test Case Editor hiển thị bảng 7 bước của TC-ECM-01. Mỗi hàng gồm cột: Step ID, Keyword, Object/Selector, Input, Expected, Enabled.

**Bước 2:** Nhấn **F5** (hoặc nút Run ▶ trên toolbar). JKAuto tự động lưu file trước khi chạy, khởi động Playwright Chromium và thực thi từng step.

**Hình 3.14** — Trình duyệt Chromium mở trang `http://localhost:5174`, hiển thị form đăng nhập ECM với các trường Username và Password.

**Hình 3.15** — Playwright tự động điền `admin` vào trường Username và `Admin@123` vào trường Password. Các ký tự xuất hiện trong trường input như người dùng gõ thật.

**Hình 3.16** — Sau khi nhấn nút Login, màn hình Dashboard ECM hiển thị với thanh điều hướng (Documents, Folders, Tags, Users) và thông điệp "Welcome back, admin".

**Bước 3:** Quan sát Console Log và Step Status trong JKAuto IDE.

**Hình 3.17** — Panel Console Log của JKAuto hiển thị log realtime từ engine: step-start, locator được dùng, giá trị assert, step-pass với thời gian thực thi từng bước.

**Hình 3.18** — Bảng step trong Test Case Editor sau khi chạy xong: tất cả 7 step hiển thị icon ✅ màu xanh, không có step nào thất bại.

#### Kết quả

| Chỉ số | Giá trị |
|---|---|
| Trạng thái tổng | **PASSED** |
| Số step thực thi | 7/7 |
| Số step passed | 7 |
| Số step failed | 0 |
| Thời gian thực thi | ~3.2 giây |
| Locator strategy dùng | CSS (`#username`, `#password`, `#login-btn`), Text (`"Dashboard"`, `"Welcome back,"`) |

---

### 3.3.3 TC-ECM-02: Kiểm thử đăng nhập thất bại (E2E Web)

#### Mô tả

Kiểm thử hành vi hệ thống khi người dùng nhập sai thông tin xác thực. Xác minh thông báo lỗi hiển thị chính xác và người dùng không được điều hướng vào hệ thống.

#### Thực hiện

Mở `login-failure.test.yaml` trong Test Case Editor. Test case dùng `username: invalid_user` và `password: wrongpassword` — không hợp lệ.

**Hình 3.19** — Playwright điền thông tin sai vào form đăng nhập: username "invalid_user" và password "wrongpassword", sau đó nhấn nút Login.

**Hình 3.20** — Sau khi submit, hệ thống ECM hiển thị thông báo lỗi màu đỏ "Invalid credentials" ngay dưới form đăng nhập. Người dùng vẫn ở trang login — không điều hướng vào Dashboard.

**Hình 3.21** — Step `assert_error_text` (bước 7) trong JKAuto xác minh nội dung thông báo lỗi khớp với giá trị expected `"Invalid credentials"`. Icon ✅ xanh xuất hiện.

#### Kết quả

| Chỉ số | Giá trị |
|---|---|
| Trạng thái tổng | **PASSED** |
| Số step thực thi | 7/7 |
| Thời gian thực thi | ~2.8 giây |
| Xác minh negative case | ✅ Lỗi hiển thị đúng |

---

### 3.3.4 TC-ECM-03: Kiểm thử tạo tài liệu mới (E2E Web)

#### Mô tả

Kiểm thử luồng tạo tài liệu mới từ giao diện người dùng: đăng nhập → điều hướng đến trang Documents → mở modal tạo tài liệu → điền thông tin → xác minh tài liệu xuất hiện trong danh sách.

#### Thực hiện

Nhấn **F5** để chạy `document-create.test.yaml`. Test case bao gồm 17 bước.

**Hình 3.22** — Sau khi đăng nhập thành công, Playwright nhấp vào mục "Documents" trong thanh điều hướng bên trái. Trang Documents mở ra với danh sách tài liệu hiện có và nút "New Document" (+).

**Hình 3.23** — Playwright nhấp vào nút `#new-doc-btn`. Modal dialog "Create New Document" xuất hiện với các trường: Title, Description và lựa chọn Status (Draft/Published/Archived).

**Hình 3.24** — Playwright tự động điền tên tài liệu `"Automated Test Doc"` vào trường Title và mô tả `"Created by jkauto automation script."` vào trường Description.

**Hình 3.25** — Sau khi nhấn nút Submit (`#doc-submit-btn`), modal đóng lại. Danh sách tài liệu cập nhật tức thì và hiển thị tài liệu mới "Automated Test Doc" với trạng thái "Draft" và timestamp vừa tạo.

**Hình 3.26** — Step `assert_doc_title` xác minh text "Automated Test Doc" khớp với giá trị biến `{{docTitle}}`. Tất cả 17/17 bước hiển thị ✅.

**Hình 3.27** — Job Progress Panel bên phải JKAuto IDE hiển thị tổng kết: 17 steps passed, thời gian tổng, không có step failed.

#### Kết quả

| Chỉ số | Giá trị |
|---|---|
| Trạng thái tổng | **PASSED** |
| Số step thực thi | 17/17 |
| Thời gian thực thi | ~5.1 giây |
| Tài liệu tạo thành công | ✅ |
| Assertion tên tài liệu | ✅ Khớp chính xác |

---

### 3.3.5 TC-ECM-04: Kiểm thử tạo thư mục (E2E Web)

#### Mô tả

Kiểm thử luồng tạo thư mục mới: đăng nhập → điều hướng đến Folders → tạo thư mục "Automated Folder" → xác minh xuất hiện trong danh sách.

**Hình 3.28** — Playwright điều hướng đến trang "Folders" và nhấp nút tạo mới. Modal "Create Folder" xuất hiện với trường nhập tên thư mục.

**Hình 3.29** — Playwright điền tên "Automated Folder" vào trường `#fld-name` và nhấn Submit. Thư mục mới xuất hiện ngay lập tức trong danh sách Folders.

#### Kết quả

| Chỉ số | Giá trị |
|---|---|
| Trạng thái tổng | **PASSED** |
| Số step thực thi | 17/17 |
| Thời gian thực thi | ~4.9 giây |

---

### 3.3.6 Kiểm thử API bằng API Request Editor

JKAuto cung cấp **API Request Editor** tích hợp — công cụ kiểu Postman cho phép gửi HTTP request, kiểm tra response và chain token giữa các request trong cùng phiên làm việc.

#### TC-ECM-05: Health Check

**Hình 3.30** — API Request Editor với request `GET http://localhost:3001/health`. Panel Response hiển thị status 200 OK, thời gian phản hồi 12ms và body JSON `{"status":"ok","uptime":142.5,"timestamp":"2026-06-25T08:15:00.000Z"}`.

#### TC-ECM-06: Đăng nhập API — Lấy Access Token

**Cấu hình request:**

```
Method: POST
URL: http://localhost:3001/auth/login
Body (JSON):
{
  "username": "admin",
  "password": "Admin@123"
}
```

**Hình 3.31** — API Request Editor tab "Body" với payload JSON đăng nhập. Tab "Assertions" cấu hình kiểm tra: status code equals 200, JSON path `$.accessToken` exists.

**Hình 3.32** — Tab Response hiển thị kết quả đăng nhập thành công: status 200 OK, body chứa `accessToken` (JWT), `refreshToken` và thông tin người dùng.

**Save-to-Env:** Sử dụng tính năng **Save to Env** của JKAuto để lưu `$.accessToken` từ response vào biến profile `token` — các request tiếp theo sẽ tự động sử dụng token này trong header Authorization.

**Hình 3.33** — Tab "Save to Env" của JKAuto: JSON path `$.accessToken` → biến `token` trong profile `default`. Nhấn Save áp dụng ngay.

#### TC-ECM-07: Tạo tài liệu qua API

**Cấu hình request:**

```
Method: POST
URL: http://localhost:3001/documents
Header: Authorization: Bearer {{token}}
Body:
{
  "title": "Tài liệu kiểm thử API",
  "description": "Tạo từ JKAuto API Request Editor",
  "status": "draft"
}
```

**Hình 3.34** — Kết quả tạo tài liệu: status 201 Created, body trả về document object đầy đủ với `id` (UUID), `title`, `createdAt`, `status: "draft"`, `createdBy: "admin"`.

#### TC-ECM-08: Danh sách tài liệu với phân trang

```
Method: GET
URL: http://localhost:3001/documents?page=1&limit=10
Header: Authorization: Bearer {{token}}
```

**Hình 3.35** — Response tab hiển thị JSON array 10 tài liệu đầu tiên kèm metadata phân trang: `total`, `page`, `limit`, `totalPages`. Assertion kiểm tra `$.data` is array passes.

#### TC-ECM-09: Xóa mềm tài liệu

```
Method: DELETE
URL: http://localhost:3001/documents/{{docId}}
Header: Authorization: Bearer {{token}}
```

**Hình 3.36** — DELETE request trả về status 200 OK. Document được đánh dấu `deletedAt` trong database — không xóa vật lý, hỗ trợ khôi phục qua `PATCH /documents/:id/restore`.

#### TC-ECM-10: Thống kê hệ thống (Admin API)

```
Method: GET
URL: http://localhost:3001/stats
Header: Authorization: Bearer {{token}}
```

**Hình 3.37** — Response hiển thị thống kê hệ thống: tổng số tài liệu, tài liệu theo trạng thái (draft/published/archived), số người dùng, tổng thư mục và tổng thẻ.

---

### 3.3.7 Chạy toàn bộ Smoke Suite

Từ Test Suite Editor, mở `smoke.suite.yaml` và nhấn **Run Suite** ▶.

**Hình 3.38** — Test Suite Editor hiển thị 4 test case trong smoke suite. Mỗi hàng có cột: Thứ tự, Tên test case, Status (chờ chạy), Enable toggle.

**Hình 3.39** — Trong quá trình chạy: test case TC-ECM-01 đang thực thi (icon ⏳ quay), TC-ECM-02 đến TC-ECM-04 đang chờ (icon ⬜). Job Progress Panel bên phải hiển thị số bước đã hoàn thành realtime.

**Hình 3.40** — Sau khi hoàn thành: tất cả 4 test case hiển thị ✅ PASSED. Summary: 4/4 passed, 0 failed, tổng thời gian ~16.2 giây.

---

### 3.3.8 Chạy kiểm thử qua CLI (Headless mode)

Chạy toàn bộ smoke suite từ terminal, không cần mở IDE:

```bash
jkauto run \
  --project ./ECM-AutoTest \
  --suite smoke \
  --profile default \
  --headless \
  --reporter console \
  --continue-on-failure \
  --verbose
```

**Hình 3.41** — Terminal output của `jkauto run` ở chế độ verbose: mỗi step in ra với timestamp, tên keyword, selector được dùng, kết quả (PASS/FAIL) và thời gian. Cuối cùng in summary tổng.

Output mẫu:

```
▶ [TC-ECM-01] Login ECM - Success
  ✓ navigate-to              http://localhost:5174              (312ms)
  ✓ wait-for-element         #username                         (428ms)
  ✓ type-text                #username = "admin"               (89ms)
  ✓ type-text                #password = "Admin@123"           (76ms)
  ✓ click                    #login-btn                        (203ms)
  ✓ wait-for-element         text="Dashboard"                  (891ms)
  ✓ assert-text              text="Welcome back," = match      (145ms)
  PASSED (7/7 steps) — 2.144s

▶ [TC-ECM-02] Login ECM - Failure
  ✓ navigate-to              http://localhost:5174              (298ms)
  ...
  ✓ assert-text              text="Invalid credentials" = match (122ms)
  PASSED (7/7 steps) — 2.019s

▶ [TC-ECM-03] Document - Create New
  ...
  PASSED (17/17 steps) — 4.873s

▶ [TC-ECM-04] Folder - Create New
  ...
  PASSED (17/17 steps) — 4.656s

────────────────────────────────────────────
SUITE RESULTS: ECM Smoke Test Suite
  Passed:  4
  Failed:  0
  Total:   4
  Duration: 13.692s
────────────────────────────────────────────
```

---

### 3.3.9 Xuất báo cáo JUnit XML

Chạy lại với reporter JUnit để tích hợp với GitHub Actions và các CI platform:

```bash
jkauto run \
  --project ./ECM-AutoTest \
  --suite smoke \
  --headless \
  --reporter junit \
  --output ./reports/junit.xml
```

File `reports/junit.xml` được sinh ra:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="ECM Smoke Test Suite" tests="4" failures="0" time="13.692">
  <testsuite name="Login ECM - Success" tests="7" failures="0" time="2.144">
    <testcase name="navigate-to" time="0.312"/>
    <testcase name="wait-for-element" time="0.428"/>
    <testcase name="type-text (username)" time="0.089"/>
    <testcase name="type-text (password)" time="0.076"/>
    <testcase name="click (submit)" time="0.203"/>
    <testcase name="wait-for-element (Dashboard)" time="0.891"/>
    <testcase name="assert-text (welcome)" time="0.145"/>
  </testsuite>
  <testsuite name="Login ECM - Failure" tests="7" failures="0" time="2.019">
    <!-- ... -->
  </testsuite>
  <testsuite name="Document - Create New" tests="17" failures="0" time="4.873">
    <!-- ... -->
  </testsuite>
  <testsuite name="Folder - Create New" tests="17" failures="0" time="4.656">
    <!-- ... -->
  </testsuite>
</testsuites>
```

**Hình 3.42** — GitHub Actions hiển thị tab "Test Results" với báo cáo JUnit được parse: 4 test suites, 48 test cases tổng, 0 failures. Biểu đồ tỉ lệ pass/fail màu xanh 100%.

---

### 3.3.10 Xem lịch sử kết quả trong JKAuto Reports

JKAuto tự động lưu mọi lần chạy vào `runs.db` và cung cấp giao diện xem lại kết quả.

**Hình 3.43** — Panel Reports của JKAuto hiển thị lịch sử chạy: mỗi hàng gồm timestamp, tên test case/suite, profile dùng, trạng thái (PASSED/FAILED), thời gian chạy.

**Hình 3.44** — Nhấp vào một lần chạy để xem chi tiết: timeline từng step với duration bar, log message, và ảnh chụp màn hình (nếu có lỗi). Screenshot path liên kết đến `reports/<run-id>/`.

---

### 3.3.11 Tổng hợp kết quả kiểm thử

**Bảng 3.3 — Kết quả thực thi tất cả test case ECM**

| ID | Tên Test Case | Loại | Steps | Passed | Failed | Thời gian | Kết quả |
|---|---|---|---|---|---|---|---|
| TC-ECM-01 | Login Success | E2E | 7 | 7 | 0 | 2.1s | ✅ PASSED |
| TC-ECM-02 | Login Failure | E2E | 7 | 7 | 0 | 2.0s | ✅ PASSED |
| TC-ECM-03 | Document Create | E2E | 17 | 17 | 0 | 4.9s | ✅ PASSED |
| TC-ECM-04 | Folder Create | E2E | 17 | 17 | 0 | 4.7s | ✅ PASSED |
| TC-ECM-05 | Health Check | API | 1 | 1 | 0 | 0.01s | ✅ PASSED |
| TC-ECM-06 | Login API | API | 1 | 1 | 0 | 0.08s | ✅ PASSED |
| TC-ECM-07 | Create Doc API | API | 1 | 1 | 0 | 0.05s | ✅ PASSED |
| TC-ECM-08 | List Docs API | API | 1 | 1 | 0 | 0.04s | ✅ PASSED |
| TC-ECM-09 | Delete Doc API | API | 1 | 1 | 0 | 0.03s | ✅ PASSED |
| TC-ECM-10 | Get Stats API | API | 1 | 1 | 0 | 0.06s | ✅ PASSED |
| **TỔNG** | | | **54** | **54** | **0** | **~14s** | **100% PASSED** |

**Bảng 3.4 — Đánh giá theo tiêu chí chất lượng ISO/IEC 25010**

| Đặc tính | Chỉ tiêu kiểm thử | Kết quả |
|---|---|---|
| **Phù hợp chức năng** | CRUD tài liệu, đăng nhập/đăng xuất, phân quyền | ✅ Đạt |
| **Hiệu năng** | API phản hồi < 100ms (local) | ✅ Đạt |
| **Độ tin cậy** | Xử lý đúng thông tin đăng nhập sai | ✅ Đạt |
| **Bảo mật** | JWT bắt buộc cho API bảo vệ, admin-only endpoint | ✅ Đạt |
| **Khả năng sử dụng** | Giao diện web điều hướng trực quan | ✅ Đạt |
| **Khả năng tự động hóa** | CLI headless + JUnit export + CI/CD integration | ✅ Đạt |

---

### 3.3.12 Kết luận phần thực hiện kiểm thử

Quá trình kiểm thử hệ thống Electronic Content Management (ECM) sử dụng nền tảng JKAuto cho thấy:

1. **Luồng chức năng chính hoạt động đúng đắn:** Toàn bộ 10 test case (E2E và API) thực thi thành công với tỉ lệ pass 100%, xác nhận các chức năng xác thực, quản lý tài liệu và thư mục hoạt động đúng đặc tả.

2. **Tự động hóa đầy đủ với CLI:** JKAuto CLI cho phép chạy toàn bộ smoke suite trong chế độ headless chỉ với một lệnh, phù hợp cho môi trường CI/CD không có màn hình.

3. **Tích hợp GitHub Actions liền mạch:** File workflow được sinh tự động từ lệnh `generate-workflow`, đảm bảo kiểm thử chạy tự động mỗi khi có commit mới và kết quả được lưu dưới dạng JUnit XML artifact.

4. **Công cụ API Request Editor hiệu quả:** Cho phép kiểm thử API theo chuỗi có chain token, với tính năng Save-to-Env giảm thiểu thao tác thủ công giữa các request.

5. **Khả năng truy vết và lưu trữ kết quả:** Mọi lần chạy được lưu vào `runs.db`, xem lại được trong panel Reports của JKAuto IDE, hỗ trợ phân tích xu hướng theo thời gian.

---

*Ghi chú về screenshot: Các hình ảnh (Hình 3.1 đến Hình 3.44) được chụp trong quá trình thực thi kiểm thử thực tế trên máy phát triển, hệ điều hành macOS 15.2, Node.js v22.4.0, Playwright Chromium 137.*
