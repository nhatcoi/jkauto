# BÁO CÁO ĐỒ ÁN HỌC PHẦN

## ĐÁNH GIÁ VÀ KIỂM ĐỊNH CHẤT LƯỢNG PHẦN MỀM

### Đề tài: Đánh giá và kiểm định chất lượng hệ thống JKAuto

**Sản phẩm:** Nền tảng thiết kế và thực thi kiểm thử tự động đa nền tảng

**Tên sản phẩm:** JKAuto

**Năm thực hiện:** 2026

### Thành viên nhóm

| STT | Họ và tên | Vai trò đề xuất |
|---:|---|---|
| 1 | Nguyễn Văn Nhật | Trưởng nhóm, kiến trúc hệ thống và tổng hợp báo cáo |
| 2 | Nguyễn Kiều Trinh | Phân tích yêu cầu, đánh giá giao diện và khả năng sử dụng |
| 3 | Quách Hữu Nam | Thiết kế kiểm thử, đánh giá engine và khả năng tương thích |
| 4 | Lê Thị Kiều Trang | Đánh giá chất lượng, quản lý tài liệu và kiểm tra báo cáo |

> Thông tin trường, khoa, lớp học phần và giảng viên hướng dẫn có thể được bổ sung trước khi nộp báo cáo.

---

# MỤC LỤC

- [TÓM TẮT](#tóm-tắt)
- [PHẦN I. TỔNG QUAN ĐỀ TÀI VÀ CƠ SỞ ĐÁNH GIÁ](#phần-i-tổng-quan-đề-tài-và-cơ-sở-đánh-giá)
  - [1.1. Lý do chọn đề tài](#11-lý-do-chọn-đề-tài)
  - [1.2. Mục tiêu của đề tài](#12-mục-tiêu-của-đề-tài)
  - [1.3. Đối tượng và phạm vi nghiên cứu](#13-đối-tượng-và-phạm-vi-nghiên-cứu)
  - [1.4. Phương pháp thực hiện](#14-phương-pháp-thực-hiện)
  - [1.5. Cơ sở lý thuyết và tiêu chí chất lượng](#15-cơ-sở-lý-thuyết-và-tiêu-chí-chất-lượng)
  - [1.6. Nguồn tài liệu khảo sát](#16-nguồn-tài-liệu-khảo-sát)
- [PHẦN II. PHÂN TÍCH HỆ THỐNG JKAUTO](#phần-ii-phân-tích-hệ-thống-jkauto)
  - [2.1. Tổng quan sản phẩm](#21-tổng-quan-sản-phẩm)
  - [2.2. Kiến trúc tổng thể](#22-kiến-trúc-tổng-thể)
  - [2.3. Mô hình dữ liệu và tổ chức dự án](#23-mô-hình-dữ-liệu-và-tổ-chức-dự-án)
  - [2.4. Phân tích các chức năng chính](#24-phân-tích-các-chức-năng-chính)
  - [2.5. Luồng thực thi kiểm thử](#25-luồng-thực-thi-kiểm-thử)
  - [2.6. Công nghệ sử dụng](#26-công-nghệ-sử-dụng)
  - [2.7. Các quyết định thiết kế ảnh hưởng đến chất lượng](#27-các-quyết-định-thiết-kế-ảnh-hưởng-đến-chất-lượng)
- [PHẦN III. ĐÁNH GIÁ VÀ KIỂM ĐỊNH CHẤT LƯỢNG](#phần-iii-đánh-giá-và-kiểm-định-chất-lượng)
  - [3.1. Chiến lược đánh giá](#31-chiến-lược-đánh-giá)
  - [3.2. Đánh giá theo mô hình chất lượng](#32-đánh-giá-theo-mô-hình-chất-lượng)
  - [3.3. Kiểm định yêu cầu chức năng](#33-kiểm-định-yêu-cầu-chức-năng)
  - [3.4. Kiểm định dữ liệu và schema](#34-kiểm-định-dữ-liệu-và-schema)
  - [3.5. Kiểm định engine và khả năng tương thích](#35-kiểm-định-engine-và-khả-năng-tương-thích)
  - [3.6. Kiểm định API](#36-kiểm-định-api)
  - [3.7. Kiểm định AI Agent](#37-kiểm-định-ai-agent)
  - [3.8. Kiểm định phi chức năng](#38-kiểm-định-phi-chức-năng)
  - [3.9. Ma trận rủi ro chất lượng](#39-ma-trận-rủi-ro-chất-lượng)
  - [3.10. Nhận xét về mức độ sẵn sàng](#310-nhận-xét-về-mức-độ-sẵn-sàng)
- [PHẦN IV. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN](#phần-iv-kết-luận-và-hướng-phát-triển)
  - [4.1. Kết quả đạt được](#41-kết-quả-đạt-được)
  - [4.2. Hạn chế](#42-hạn-chế)
  - [4.3. Đề xuất cải tiến chất lượng](#43-đề-xuất-cải-tiến-chất-lượng)
  - [4.4. Phân công công việc](#44-phân-công-công-việc)
  - [4.5. Kết luận chung](#45-kết-luận-chung)
  - [4.6. Tài liệu tham khảo nội bộ](#46-tài-liệu-tham-khảo-nội-bộ)

---

# TÓM TẮT

JKAuto là một môi trường phát triển tích hợp phục vụ thiết kế, quản lý và thực thi kiểm thử tự động trên nhiều nền tảng, gồm Web, Desktop, Mobile, Appium và API. Hệ thống hướng tới việc kết hợp sự trực quan của công cụ no-code với khả năng mở rộng của các framework kiểm thử theo mã nguồn. Người dùng có thể tạo test case dưới dạng bảng, tổ chức test suite, quản lý đối tượng giao diện, cấu hình môi trường, gửi yêu cầu API, theo dõi lịch sử chạy và sử dụng AI Agent để hỗ trợ sinh hoặc chỉnh sửa kịch bản kiểm thử.

Báo cáo này tập trung đánh giá chất lượng của JKAuto dựa trên toàn bộ tài liệu Markdown hiện có trong dự án, bao gồm tài liệu giới thiệu, kế hoạch kiến trúc, hướng dẫn đóng góp, tài liệu riêng của từng feature, tài liệu bộ keyword, quy trình gỡ lỗi và các dự án mẫu. Việc đánh giá được tổ chức theo các nhóm thuộc tính chất lượng phổ biến của ISO/IEC 25010: phù hợp chức năng, hiệu năng, tương thích, khả năng sử dụng, độ tin cậy, bảo mật, khả năng bảo trì và tính khả chuyển.

Kết quả khảo sát tài liệu cho thấy hệ thống có định hướng kiến trúc rõ ràng, mô hình dữ liệu có version, phân tách renderer với quyền truy cập hệ thống thông qua IPC, hỗ trợ nhiều runner và ưu tiên định dạng JSON/YAML thân thiện với Git. Các feature quan trọng như Test Case, Test Suite, API Request, Object Repository, Appium và AI Agent đã được mô tả tương đối chi tiết. Tuy nhiên, dự án chưa thể hiện một bộ kiểm thử tự động cấp mã nguồn trong cấu trúc hiện tại; một số chức năng vẫn có ràng buộc hoặc placeholder, đồng thời trạng thái milestone trong tài liệu kế hoạch chưa được cập nhật đồng bộ với tài liệu feature mới hơn.

Vì vậy, báo cáo không xem các mô tả chức năng là bằng chứng tuyệt đối rằng mọi chức năng đã vượt qua kiểm định thực tế. Các kết luận được chia thành hai mức: đánh giá dựa trên thiết kế/tài liệu và các ca kiểm thử cần thực thi để xác nhận chất lượng. Hướng cải tiến ưu tiên là xây dựng test pyramid, chuẩn hóa truy vết yêu cầu, tự động hóa kiểm tra trong CI, bổ sung đo lường hiệu năng và tăng cường kiểm soát an toàn cho AI Agent, thông tin xác thực và các công cụ có quyền ghi tệp.

**Từ khóa:** kiểm thử phần mềm, đảm bảo chất lượng, kiểm định phần mềm, Playwright, Appium, API testing, Electron, AI Agent, ISO/IEC 25010.

---

# PHẦN I. TỔNG QUAN ĐỀ TÀI VÀ CƠ SỞ ĐÁNH GIÁ

## 1.1. Lý do chọn đề tài

Kiểm thử phần mềm hiện đại thường phải xử lý đồng thời nhiều loại đối tượng: giao diện Web, ứng dụng Desktop, thiết bị Mobile, dịch vụ API và dữ liệu môi trường. Các công cụ hiện có thường tối ưu cho một nhóm người dùng hoặc một loại nền tảng cụ thể. Công cụ trực quan dễ tiếp cận có thể hạn chế khả năng mở rộng, trong khi framework mạnh như Playwright hoặc Appium đòi hỏi người sử dụng có kỹ năng lập trình.

JKAuto được xây dựng để giải quyết khoảng cách này bằng một IDE trực quan, trong đó các test step được biểu diễn bằng keyword và lưu thành tệp JSON/YAML. Sản phẩm có ý nghĩa phù hợp với học phần Đánh giá và kiểm định chất lượng phần mềm vì bản thân JKAuto vừa là đối tượng cần đánh giá, vừa là công cụ hỗ trợ hoạt động kiểm thử.

Đề tài được lựa chọn vì các lý do chính:

1. Sản phẩm có phạm vi đủ lớn để đánh giá nhiều thuộc tính chất lượng.
2. Hệ thống sử dụng kiến trúc đa tiến trình và nhiều công nghệ tích hợp.
3. Dữ liệu kiểm thử có schema rõ ràng, thuận lợi cho việc kiểm định tính đúng đắn.
4. Có nhiều luồng nghiệp vụ quan trọng như chạy test case, chạy suite, kiểm thử API, điều khiển Appium và tương tác với AI Agent.
5. Dự án có định hướng mã nguồn mở và lưu trữ artifact thân thiện với Git, phù hợp để đánh giá khả năng bảo trì.

## 1.2. Mục tiêu của đề tài

### 1.2.1. Mục tiêu tổng quát

Phân tích, đánh giá và đề xuất quy trình kiểm định chất lượng cho hệ thống JKAuto, từ đó xác định điểm mạnh, điểm hạn chế, rủi ro và mức độ sẵn sàng của sản phẩm.

### 1.2.2. Mục tiêu cụ thể

- Mô tả kiến trúc, mô hình dữ liệu và các feature chính của JKAuto.
- Xác định yêu cầu chức năng và phi chức năng cần kiểm định.
- Đánh giá thiết kế theo các đặc tính chất lượng phần mềm.
- Xây dựng ma trận ca kiểm thử đại diện cho các luồng quan trọng.
- Phân tích rủi ro liên quan đến runner, IPC, dữ liệu, Appium, API và AI Agent.
- Đề xuất giải pháp nâng cao khả năng kiểm thử tự động, bảo trì và phát hành.
- Phân biệt rõ giữa chức năng được mô tả trong tài liệu và chức năng đã có bằng chứng kiểm thử.

## 1.3. Đối tượng và phạm vi nghiên cứu

### 1.3.1. Đối tượng nghiên cứu

Đối tượng nghiên cứu là mã nguồn và tài liệu thiết kế của hệ thống JKAuto, tập trung vào:

- Ứng dụng Desktop xây dựng bằng Electron.
- Renderer React cung cấp giao diện người dùng.
- Main process xử lý tệp, tiến trình, Appium, HTTP và runner.
- Package `core` chứa schema và hợp đồng IPC.
- Package `engine` thực thi keyword bằng Playwright, Appium, API hoặc Maestro.
- Các feature Test Case, Test Suite, Explorer, API Request, Object Repository, Appium và AI Agent.
- Bộ JKAuto Skills hỗ trợ tạo test case, chọn keyword và chẩn đoán lỗi.
- Các dự án mẫu dùng cho kiểm thử API và automation CLI.

### 1.3.2. Phạm vi đánh giá

Báo cáo thực hiện:

- Đánh giá tĩnh dựa trên tài liệu kiến trúc và quy ước dự án.
- Đánh giá khả năng truy vết giữa feature, dữ liệu và IPC.
- Thiết kế ca kiểm thử chức năng và phi chức năng.
- Nhận diện rủi ro và đề xuất tiêu chí chấp nhận.

Báo cáo không tuyên bố:

- Tất cả ca kiểm thử đã được chạy trên mọi hệ điều hành.
- Các chỉ số hiệu năng đã được đo bằng công cụ benchmark.
- Hệ thống đã vượt qua kiểm thử bảo mật chuyên sâu.
- Các feature được mô tả đều đã sẵn sàng phát hành ở mức production.

## 1.4. Phương pháp thực hiện

Nhóm sử dụng các phương pháp sau:

1. **Khảo sát tài liệu:** ...
2. **Phân loại nguồn:** ...
3. **Đối chiếu chéo:** ...
4. **Phân tích kiến trúc:** ...
5. **Đánh giá theo tiêu chí:** ...
6. **Thiết kế kiểm thử:** ...
7. **Đánh giá bằng chứng:** ...

### Quy tắc ưu tiên tài liệu

Khi có thông tin không đồng nhất, báo cáo áp dụng thứ tự ưu tiên:

1. Tài liệu feature mới nhất trong `apps/desktop/.../features/*/AGENTS.md`.
2. Tài liệu schema và keyword trong `jkauto-skills`.
3. `README.md` và tài liệu hướng dẫn đóng góp.
4. `PLAN.md` dùng làm kiến trúc và roadmap nền.
5. `CONTINUE.md` chỉ được xem là nhật ký phát triển lịch sử.

## 1.5. Cơ sở lý thuyết và tiêu chí chất lượng

### 1.5.1. Đảm bảo chất lượng và kiểm định

Đảm bảo chất lượng phần mềm là tập hợp hoạt động có kế hoạch nhằm bảo đảm quy trình và sản phẩm đáp ứng yêu cầu. Kiểm định tập trung vào việc xác nhận sản phẩm được xây dựng đúng đặc tả và phù hợp với nhu cầu sử dụng.

Hai câu hỏi cốt lõi:

- **Verification:** Hệ thống có được xây dựng đúng theo thiết kế hay không?
- **Validation:** Hệ thống có giải quyết đúng nhu cầu của người dùng hay không?

### 1.5.2. Các mức kiểm thử

- **Unit test:** kiểm tra hàm parse, interpolate, schema, keyword và utility độc lập.
- **Integration test:** kiểm tra IPC, đọc/ghi tệp, HTTP handler, database và adapter.
- **System test:** chạy toàn bộ ứng dụng Electron với project mẫu.
- **Acceptance test:** kiểm tra hành trình người dùng từ tạo project đến xem kết quả chạy.
- **Regression test:** xác nhận thay đổi mới không làm hỏng feature hiện có.

### 1.5.3. Mô hình ISO/IEC 25010 áp dụng

| Đặc tính | Nội dung đánh giá trong JKAuto |
|---|---|
| Phù hợp chức năng | Feature có cung cấp đúng hành vi tạo, sửa, chạy và quản lý kiểm thử không |
| Hiệu năng | Thời gian mở project, gửi API, khởi chạy runner, streaming log và render cây tệp |
| Tương thích | Khả năng chạy trên macOS, Windows, Linux và tích hợp Playwright/Appium/Maestro |
| Khả năng sử dụng | Mức trực quan của editor, thông báo lỗi, phím tắt, undo/redo và hướng dẫn |
| Độ tin cậy | Xử lý timeout, dừng run, lỗi runner, lưu lịch sử và phục hồi dữ liệu |
| Bảo mật | Cách ly renderer, xử lý token, giới hạn filesystem MCP và chế độ AI Agent |
| Khả năng bảo trì | Kiến trúc module, TypeScript strict, schema dùng chung, giới hạn độ dài tệp |
| Tính khả chuyển | Electron đa hệ điều hành, file JSON/YAML và adapter cho nhiều runner |

## 1.6. Nguồn tài liệu khảo sát

Tài liệu được chia thành các nhóm:

| Nhóm | Tài liệu tiêu biểu | Vai trò |
|---|---|---|
| Tổng quan | `README.md`, `PLAN.md` | Mục tiêu sản phẩm, kiến trúc, roadmap |
| Quy trình | `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CLAUDE.md` | Quy ước phát triển và cộng tác |
| Feature | Các tệp `AGENTS.md` | Mô tả chi tiết Test Case, Suite, API, Agent, Appium, Explorer |
| Kỹ năng | `jkauto-skills/**/*.md` | Schema test case, keyword, mapping runner, checklist debug |
| Lịch sử | `CONTINUE.md` | Quá trình xây dựng engine và giao diện log |
| Mẫu kiểm thử | `test-project/**/*.md` | API curl và generic automation target |

Việc có tài liệu theo từng feature là một điểm mạnh về khả năng bảo trì. Tuy nhiên, roadmap trong `PLAN.md` còn đánh dấu nhiều milestone chưa hoàn thành trong khi tài liệu feature mô tả chúng đã được triển khai sâu hơn. Đây là dấu hiệu cần quản lý phiên bản tài liệu tốt hơn.

---

# PHẦN II. PHÂN TÍCH HỆ THỐNG JKAUTO

## 2.1. Tổng quan sản phẩm

JKAuto là IDE kiểm thử tự động theo hướng keyword-driven và file-first. Người dùng không bắt buộc viết trực tiếp mã Playwright hoặc Appium mà có thể tạo từng bước kiểm thử trên giao diện bảng.

Các nhóm người dùng mục tiêu:

- Nhân viên QA cần tạo test case trực quan.
- Lập trình viên cần artifact có thể review bằng Git.
- Nhóm kiểm thử API cần gửi request, assertion và chain token.
- Nhóm Mobile cần Appium hoặc Maestro.
- Người dùng muốn AI hỗ trợ tạo và chỉnh sửa kịch bản.

Giá trị cốt lõi của hệ thống:

- Một IDE cho nhiều nền tảng.
- Artifact là tệp văn bản JSON/YAML.
- Keyword metadata là nguồn dữ liệu chung cho editor và engine.
- Tách dữ liệu nguồn khỏi cache và lịch sử chạy.
- Hỗ trợ AI nhưng vẫn có bước kiểm tra schema hoặc review trước khi áp dụng.

## 2.2. Kiến trúc tổng thể

### 2.2.1. Kiến trúc monorepo

Hệ thống sử dụng pnpm workspace và Turborepo:

```text
jkauto/
├── apps/
│   └── desktop/          # Electron main, preload và React renderer
├── packages/
│   ├── core/             # Zod schema, type và IPC contract
│   ├── engine/           # Runner và keyword executor
│   ├── project-fs/       # Đọc/ghi project
│   ├── storage/          # Dữ liệu SQLite hoặc dữ liệu dẫn xuất
│   └── ui/               # Thành phần giao diện dùng chung
├── jkauto-skills/        # Kỹ năng hỗ trợ agent
└── test-project/         # Dự án mục tiêu mẫu
```

Kiến trúc này giúp phân tách miền nghiệp vụ, hạ tầng thực thi và giao diện. `packages/core` đóng vai trò nguồn sự thật cho schema và hợp đồng giao tiếp.

### 2.2.2. Kiến trúc Electron

JKAuto áp dụng mô hình ba lớp chính:

- **Renderer:** giao diện React, quản lý trạng thái hiển thị.
- **Preload:** cầu nối IPC được kiểm soát.
- **Main process:** truy cập filesystem, spawn tiến trình, gọi Appium, HTTP, SQLite và engine.

Nguyên tắc quan trọng là renderer không truy cập trực tiếp filesystem. Các thao tác đặc quyền phải đi qua IPC. Đây là lựa chọn tốt cho cả bảo mật và khả năng kiểm thử.

### 2.2.3. Kiến trúc feature theo vertical slice

Mỗi feature có thể chứa:

- `components/`
- `hooks/`
- `store.ts`
- `api.ts`
- `types.ts`

Các feature không nên import trực tiếp phần triển khai nội bộ của nhau. Giao tiếp thông qua public API hoặc contract dùng chung giúp giảm coupling.

## 2.3. Mô hình dữ liệu và tổ chức dự án

### 2.3.1. Cấu trúc project của người dùng

```text
MyAutoTestProject/
├── project.json
├── profiles/
├── test-cases/
├── api-request/
├── test-suites/
├── keywords/
├── reports/
├── data-files/
├── checkpoints/
├── plugins/
└── .autotest/
```

JSON/YAML là dữ liệu nguồn. Thư mục `.autotest/` chứa cache, lịch sử hoặc dữ liệu có thể tạo lại. Thiết kế này giảm nguy cơ khóa dữ liệu vào định dạng riêng.

### 2.3.2. Test Case

Một test case gồm metadata, platform, runner, biến và danh sách step có thứ tự. Step có các trường chính:

| Trường | Ý nghĩa |
|---|---|
| `id` | Định danh ổn định |
| `keyword` | Hành động hoặc assertion |
| `objectRef` | Selector hoặc tham chiếu object repository |
| `input` | Giá trị đầu vào |
| `expected` | Giá trị mong đợi |
| `enabled` | Cho phép bỏ qua step |
| `continueOnFailure` | Tiếp tục khi step lỗi |
| `timeout` | Timeout riêng của step |

Schema version và ID ổn định là nền tảng tốt cho migration và truy vết.

### 2.3.3. Test Suite

Test Suite tham chiếu test case bằng cả ID và path. Mỗi item có trạng thái enabled và order. Suite có thể đặt profile riêng, cho phép chạy một tập smoke test trên staging mà không thay đổi profile toàn cục.

### 2.3.4. Object Repository

Mỗi object có nhiều locator với độ ưu tiên. Engine thử locator theo thứ tự cho đến khi tìm thấy phần tử. Các chiến lược gồm:

- `testid`
- `css`
- `xpath`
- `text`
- `role`
- `label`
- `placeholder`

Multi-locator giúp tăng độ bền của test nhưng cũng cần log rõ locator nào đã được sử dụng để hỗ trợ gỡ lỗi.

### 2.3.5. Environment Profile

Biến môi trường được lưu trong các tệp profile. Tài liệu ghi nhận cả hai cú pháp `{{name}}` và `${name}`, trong đó `{{name}}` được khuyến nghị cho tệp sinh mới. Các biến chưa được resolve cần được giữ nguyên hoặc cảnh báo rõ, tránh âm thầm thay bằng chuỗi rỗng.

## 2.4. Phân tích các chức năng chính

### 2.4.1. Explorer

Explorer hiển thị nhiều project, hỗ trợ cây tệp ảo hóa, theo dõi thay đổi filesystem, tạo/xóa/đổi tên, kéo thả và menu ngữ cảnh theo loại node.

Các chức năng đáng chú ý:

- Đặt project đang hoạt động.
- Nhân bản project và sinh UUID mới.
- Mở thư mục chứa project.
- Cập nhật đường dẫn tab khi đổi tên tệp hoặc thư mục.
- Xác nhận trước khi loại project khỏi workspace.

Rủi ro chính là đồng bộ trạng thái tab với thay đổi tệp ngoài ứng dụng và xử lý xung đột khi rename/move.

### 2.4.2. Test Case Editor

Editor hỗ trợ:

- Thêm, xóa, di chuyển và kéo thả step.
- Chọn keyword theo platform.
- Chọn thiết bị Mobile.
- Import step.
- Context menu copy/cut/paste.
- Undo/redo với giới hạn lịch sử.
- Run, Debug, Stop và theo dõi trạng thái từng step.
- Lịch sử chạy.
- Phím tắt như F5, F6, Ctrl/Cmd+S.

Keyword được lấy từ engine qua IPC thay vì hard-code ở renderer. Quyết định này giúp tránh sai lệch giữa giao diện và khả năng thực thi.

### 2.4.3. Test Suite

Suite Editor hỗ trợ khám phá test case trong project, thêm/xóa/sắp xếp case, chọn profile, chạy toàn suite hoặc từng case, hiển thị trạng thái từng case và tổng kết kết quả.

Hệ thống có cơ chế normalize định dạng legacy. Đây là điểm tích cực về tương thích ngược nhưng cần test migration để tránh mất dữ liệu.

### 2.4.4. API Request

Request Editor cung cấp:

- Các phương thức HTTP phổ biến.
- Query param, header, body và auth.
- Resolve biến môi trường trong main process.
- Assertion status, response time, header và JSON path.
- Import/export cURL.
- Import OpenAPI/Swagger.
- Lịch sử tối đa 30 lần gửi.
- Trích giá trị từ JSON response vào profile.
- Import dữ liệu CSV/JSON.

Tài liệu về collection đề cập Bruno, OpenCollection, Postman, Insomnia, OpenAPI, WSDL và ZIP. Tuy nhiên, mô tả feature triển khai hiện tại xác nhận rõ nhất luồng OpenAPI và cURL. Các định dạng khác cần được xem là định hướng cho đến khi có code hoặc ca kiểm thử xác nhận.

### 2.4.5. Object Editor

Object Editor cho phép thêm object, thêm locator, chỉnh strategy, value và priority. Hệ thống yêu cầu mỗi object có ít nhất một locator. Đây là một invariant cần được kiểm tra cả ở UI và schema.

### 2.4.6. Appium

Feature Appium gồm:

- Cấu hình host, port, log level và auto-start.
- Kiểm tra môi trường Appium, ADB và Xcode command line.
- Quản lý driver.
- Khởi động/dừng Appium server.
- Kết nối session inspector.
- Liệt kê thiết bị Android/iOS.
- Mirror màn hình thiết bị.
- Tap, swipe, nút phần cứng và chụp ảnh màn hình.
- Inspector tách thành cửa sổ riêng.

Android mirror sử dụng scrcpy và WebCodecs; iOS dùng luồng MJPEG. Touch vẫn được gửi qua Appium REST. Đây là feature có độ phức tạp và rủi ro tương thích cao nhất.

### 2.4.7. AI Agent

AI Agent có bốn lớp:

1. Session chat được lưu trong SQLite.
2. Lịch sử message đầy đủ, cắt còn 20 message gần nhất khi gửi LLM.
3. Context gồm trạng thái ứng dụng, tệp đang mở, keyword, test case và profile.
4. Artifact/action để áp dụng step hoặc theo dõi tool call.

Ba chế độ quyền sửa tệp:

| Chế độ | Quyền ghi | Cơ chế an toàn |
|---|---|---|
| `ask` | Không | Chỉ đề xuất hoặc sinh `apply-steps` |
| `auto` | Có | Cho phép tool ghi trực tiếp |
| `auto-with-rollback` | Có | Sao lưu tệp trước khi ghi |

Agent tích hợp MCP nội bộ, filesystem và Playwright. `AGENT_CANCEL` hiện được mô tả là placeholder, vì vậy khả năng hủy yêu cầu dài là một điểm còn thiếu.

### 2.4.8. JKAuto Skills

Ba skill chính:

- `jkauto-testcase-author`: tạo hoặc sửa test case đúng schema.
- `jkauto-keywords`: chọn keyword và field phù hợp platform/runner.
- `jkauto-run-debugger`: chẩn đoán lỗi keyword, selector, biến, API và timing.

Các skill giúp chuẩn hóa đầu ra AI và giảm việc sinh cấu hình không hợp lệ. Tuy nhiên, skill không thay thế schema validation và test thực thi.

## 2.5. Luồng thực thi kiểm thử

Luồng chạy test case:

1. Editor tự động lưu tệp.
2. Đọc profile đang hoạt động.
3. Gửi yêu cầu `ENGINE_RUN_CASE` qua IPC.
4. Main process chọn adapter theo platform/runner.
5. Engine resolve biến, object reference và keyword.
6. Runner thực thi từng step.
7. Event trạng thái được stream về renderer.
8. Renderer cập nhật bảng, console và progress.
9. Kết quả chạy được lưu vào lịch sử.

Luồng chạy suite bổ sung bước duyệt các test case theo order, áp dụng profile cấp suite và xử lý `continueOnFailure`.

Luồng API Request:

1. Đọc request từ tệp.
2. Nạp biến profile.
3. Resolve URL, header, body và auth trong main process.
4. Gửi HTTP request.
5. Trả response cho renderer.
6. Đánh giá assertion.
7. Lưu lịch sử.
8. Cho phép trích dữ liệu response vào profile.

## 2.6. Công nghệ sử dụng

| Thành phần | Công nghệ | Mục đích |
|---|---|---|
| Desktop shell | Electron | Truy cập hệ thống và phát hành đa nền tảng |
| Giao diện | React, Vite, TypeScript | Xây dựng UI |
| Thành phần UI | shadcn/ui, Radix UI, Tailwind CSS | Giao diện nhất quán |
| State | Zustand, TanStack Query | Quản lý trạng thái |
| Web/Desktop runner | Playwright | Tự động hóa trình duyệt và Electron |
| Native Mobile | Appium/WebDriverIO | Điều khiển ứng dụng di động |
| Mobile flow | Maestro mapping | Chạy kịch bản mobile theo DSL trung gian |
| Validation | Zod | Schema và kiểm tra dữ liệu |
| Data | JSON, YAML, SQLite | Artifact, cấu hình và lịch sử |
| AI | Vercel AI SDK, MCP | Chat, tool calling và sinh test |
| Workspace | pnpm, Turborepo | Quản lý monorepo |

## 2.7. Các quyết định thiết kế ảnh hưởng đến chất lượng

### Điểm tích cực

- JSON/YAML là nguồn sự thật, thuận lợi cho Git và review.
- Schema version được thiết kế từ đầu.
- ID ổn định, tên có thể thay đổi.
- Renderer không truy cập filesystem trực tiếp.
- Keyword registry là nguồn chung cho engine và editor.
- Adapter giúp mở rộng runner.
- Undo/redo được dùng chung qua hook.
- AI có chế độ chỉ đề xuất và chế độ rollback.
- History và cache được tách khỏi artifact nguồn.

### Điểm cần kiểm soát

- Tài liệu giữa roadmap và feature chưa đồng bộ.
- Một số dữ liệu lịch sử dùng JSON thay vì SQLite, cần kiểm soát ghi đồng thời.
- Việc dùng package native như `better-sqlite3` yêu cầu rebuild đúng phiên bản Electron.
- GUI Electron có thể không thừa hưởng PATH của shell, ảnh hưởng Playwright, Appium và ADB.
- Maestro chỉ hỗ trợ một tập con keyword; một số keyword bị skip hoặc báo không hỗ trợ.
- `get-text` hiện đọc nhưng chưa lưu giá trị theo tài liệu keyword.
- Agent gọi nhiều MCP server cho mỗi lượt chat có thể ảnh hưởng hiệu năng và độ ổn định.

---

# PHẦN III. ĐÁNH GIÁ VÀ KIỂM ĐỊNH CHẤT LƯỢNG

## 3.1. Chiến lược đánh giá

### 3.1.1. Mô hình kiểm thử đề xuất

```text
                    Kiểm thử chấp nhận
                 Kiểm thử hệ thống/E2E
              Kiểm thử tích hợp IPC/adapter
           Unit test schema, parser, utility, keyword
```

Tỷ trọng tự động hóa nên ưu tiên unit và integration test vì đây là nơi các lỗi schema, parser và IPC có thể được phát hiện nhanh, ổn định và ít tốn chi phí hơn.

### 3.1.2. Kỹ thuật thiết kế ca kiểm thử

- **Phân lớp tương đương:** URL hợp lệ/không hợp lệ, profile có/không có biến.
- **Giá trị biên:** timeout 0, 1, 30.000 ms; lịch sử 29, 30, 31 bản ghi.
- **Bảng quyết định:** `continueOnFailure`, enabled và trạng thái step.
- **Chuyển trạng thái:** idle → running → passed/failed/stopped.
- **Kiểm thử cặp:** platform × runner × keyword.
- **Kiểm thử theo rủi ro:** ưu tiên ghi tệp, chạy tiến trình, token và AI tool.

### 3.1.3. Tiêu chí vào và ra

**Tiêu chí vào:**

- Build và typecheck thành công.
- Project mẫu có cấu trúc hợp lệ.
- Playwright/Appium hoặc API target đã sẵn sàng.
- Ca kiểm thử có dữ liệu và kết quả mong đợi.

**Tiêu chí ra đề xuất:**

- 100% ca kiểm thử mức Critical và High đạt.
- Không còn lỗi làm mất dữ liệu hoặc thực thi sai test.
- Không còn lỗi ghi tệp ngoài project.
- Tỷ lệ pass regression đạt tối thiểu 95%.
- Các lỗi Medium còn lại có workaround và kế hoạch xử lý.

## 3.2. Đánh giá theo mô hình chất lượng

Thang đánh giá tài liệu:

- **Tốt:** thiết kế rõ và có cơ chế kiểm soát phù hợp.
- **Khá:** đáp ứng phần lớn nhưng thiếu bằng chứng hoặc còn ràng buộc.
- **Trung bình:** có chức năng nền nhưng rủi ro hoặc thiếu kiểm định.
- **Yếu:** chưa có cơ chế hoặc chưa đủ thông tin.

| Đặc tính | Mức đánh giá qua tài liệu | Nhận xét |
|---|---|---|
| Phù hợp chức năng | Khá | Phạm vi feature rộng, dữ liệu và luồng được mô tả rõ; cần test xác nhận |
| Hiệu năng | Trung bình | Có virtualized tree và cache, nhưng chưa có benchmark/SLA |
| Tương thích | Khá | Thiết kế đa platform và adapter; Appium phụ thuộc mạnh vào môi trường |
| Khả năng sử dụng | Khá | Editor trực quan, phím tắt, undo/redo, log; cần usability test |
| Độ tin cậy | Trung bình–Khá | Có timeout, stop, history và backup; vẫn có placeholder và phụ thuộc tiến trình ngoài |
| Bảo mật | Trung bình | Có context isolation và tool filtering; token/profile và AI tool cần hardening |
| Khả năng bảo trì | Khá | Monorepo, TypeScript, vertical slice, schema dùng chung; tài liệu trạng thái chưa đồng bộ |
| Tính khả chuyển | Khá | Electron và file-based artifact; native dependency tạo rủi ro đóng gói |

## 3.3. Kiểm định yêu cầu chức năng

### 3.3.1. Test Case Editor

| Mã | Ca kiểm thử | Dữ liệu/Thao tác | Kết quả mong đợi | Mức ưu tiên |
|---|---|---|---|---|
| TC-01 | Mở test case hợp lệ | Tệp `.test.json` đúng schema | Hiển thị đúng metadata và step | Critical |
| TC-02 | Mở test case lỗi cú pháp | JSON thiếu dấu ngoặc | Hiển thị lỗi, không làm treo editor | High |
| TC-03 | Thêm step | Nhấn Add Step | Step mới có ID và giá trị mặc định | High |
| TC-04 | Undo/redo | Sửa 3 lần rồi undo/redo | Trạng thái phục hồi đúng, không vượt stack | High |
| TC-05 | Lọc keyword | Chọn platform Appium | Chỉ hiển thị keyword được hỗ trợ | Critical |
| TC-06 | Chạy test | Nhấn F5 | Tự lưu, gửi IPC, trạng thái step được stream | Critical |
| TC-07 | Dừng test | Stop khi đang chạy | Runner dừng, trạng thái chuyển `stopped` | Critical |
| TC-08 | Continue on failure | Step đầu lỗi, cờ bật | Step tiếp theo vẫn chạy | High |
| TC-09 | Timeout | Step chờ quá timeout | Step fail với thông báo rõ | High |
| TC-10 | Disabled step | `enabled=false` | Step được đánh dấu skipped | Medium |

### 3.3.2. Test Suite

| Mã | Ca kiểm thử | Kết quả mong đợi |
|---|---|---|
| TS-01 | Thêm test case chưa có trong suite | Item được thêm với order đúng |
| TS-02 | Thêm trùng test case | Không tạo bản ghi trùng |
| TS-03 | Sắp xếp case | Order được cập nhật nhất quán |
| TS-04 | Profile cấp suite | Runner nhận đúng biến của profile suite |
| TS-05 | Case fail, `continueOnFailure=false` | Suite dừng theo chính sách |
| TS-06 | Case fail, `continueOnFailure=true` | Case sau tiếp tục chạy |
| TS-07 | Mở suite legacy | `testCaseIds` được normalize không mất dữ liệu |
| TS-08 | Case bị đổi đường dẫn | Hệ thống ưu tiên resolve bằng ID |

### 3.3.3. Explorer

| Mã | Ca kiểm thử | Kết quả mong đợi |
|---|---|---|
| EX-01 | Tạo file/folder | Cây tệp cập nhật và file tồn tại trên đĩa |
| EX-02 | Rename file đang mở | Tab đổi path, nội dung không mất |
| EX-03 | Rename folder | Mọi tab con được cập nhật path |
| EX-04 | Xóa file đang mở | Tab đóng và cây tệp cập nhật |
| EX-05 | Thay đổi file từ bên ngoài | File watcher cập nhật cây |
| EX-06 | Nhân bản project | Project mới có UUID và tên mới |
| EX-07 | Remove from workspace | Project bị loại khỏi workspace, tệp trên đĩa còn nguyên |

## 3.4. Kiểm định dữ liệu và schema

### 3.4.1. Test Case schema

Cần kiểm tra:

- `schemaVersion` có giá trị được hỗ trợ.
- `id` và `keyword` không rỗng.
- `timeout` là `null` hoặc số không âm.
- `steps` giữ nguyên thứ tự.
- `createdAt` và `updatedAt` đúng ISO datetime khi schema yêu cầu.
- Platform và runner là cặp hợp lệ.
- Mỗi step dùng đúng trường `objectRef`, `input`, `expected`.

### 3.4.2. Object Repository schema

Các invariant:

- Mỗi object có ID ổn định.
- Tên object không trùng trong cùng repository.
- Mỗi object có ít nhất một locator.
- Priority không trùng hoặc phải có quy tắc sắp xếp xác định.
- Strategy nằm trong danh sách hỗ trợ.
- Locator rỗng không được dùng khi thực thi.

### 3.4.3. Variable interpolation

Các trường hợp cần kiểm tra:

| Trường hợp | Kết quả mong đợi |
|---|---|
| Biến tồn tại trong test case | Được thay thế |
| Biến tồn tại trong profile | Được thay thế |
| Trùng tên ở hai nguồn | Áp dụng quy tắc ưu tiên được tài liệu hóa |
| Biến không tồn tại | Giữ nguyên và/hoặc phát cảnh báo |
| Chuỗi có nhiều biến | Tất cả biến được resolve đúng |
| Giá trị chứa ký tự đặc biệt | Không làm hỏng JSON, URL hoặc shell quoting |

## 3.5. Kiểm định engine và khả năng tương thích

### 3.5.1. Ma trận platform và runner

| Platform | Runner chính | Nội dung cần xác nhận |
|---|---|---|
| Web | Playwright | Navigation, selector, assertion, screenshot |
| Desktop | Playwright/Electron | Window focus, close, maximize, title |
| Mobile | Maestro hoặc Playwright emulation | Mapping keyword và app ID |
| Appium | Appium/WebDriverIO | Session, accessibility ID, gesture |
| API | API runner | Request, response và assertion |

### 3.5.2. Kiểm định keyword

Mỗi keyword cần ít nhất:

- Một ca hợp lệ.
- Một ca thiếu field bắt buộc.
- Một ca selector không tồn tại.
- Một ca timeout.
- Một ca dùng biến.
- Một ca chạy sai platform.

Các điểm cần chú ý:

- `type-text`: selector ở `objectRef`, dữ liệu ở `input`.
- `assert-text`: giá trị mong đợi ở `expected`.
- `http-request`: method ở `objectRef`, URL/path ở `input`.
- `assert-json-path`: JSON path ở `objectRef`, giá trị ở `expected`.
- `call-test-case`: đường dẫn tuyệt đối phải được giới hạn trong phạm vi project hoặc có kiểm soát.

### 3.5.3. Maestro mapping

Các keyword được hỗ trợ phải chuyển thành đúng lệnh Maestro. Các keyword bị skip như `mobile.clearText` và `mobile.closeApp` cần:

- Cảnh báo rõ trong editor.
- Không được hiển thị như hỗ trợ đầy đủ.
- Có test xác nhận hành vi no-op không làm người dùng hiểu nhầm.

Keyword không được hỗ trợ phải dừng sớm với thông báo cụ thể, thay vì lỗi chung từ runner.

### 3.5.4. Appium

Các ca kiểm thử môi trường:

- Không cài Appium.
- Có Appium nhưng thiếu driver.
- Có Appium nhưng thiếu ADB.
- Port đang bị chiếm.
- Thiết bị offline.
- Session bị mất giữa lúc thao tác.
- Appium server bị dừng ngoài ứng dụng.
- Ảnh mirror ngắt luồng.

Tiêu chí quan trọng là lỗi môi trường phải được phân loại khác với lỗi test case.

## 3.6. Kiểm định API

### 3.6.1. Request và auth

| Mã | Trường hợp | Kết quả mong đợi |
|---|---|---|
| API-01 | GET không body | Gửi đúng URL và query |
| API-02 | POST JSON | Content-Type và body đúng |
| API-03 | Basic Auth | Header Authorization đúng |
| API-04 | Bearer token từ profile | Token được resolve trong main process |
| API-05 | API key ở query | Query được encode đúng |
| API-06 | Timeout/network error | Hiển thị lỗi, không ghi response giả |

### 3.6.2. Assertion

Kiểm tra các target:

- HTTP status.
- Response time.
- Header.
- JSON dot-path.

Kiểm tra các operator:

- `eq`, `ne`
- `contains`, `not-contains`
- `exists`, `not-exists`
- `lt`, `gt`

Đặc biệt cần kiểm tra ép kiểu số và chuỗi để tránh trường hợp `"10"` được so sánh từ điển với `"2"`.

### 3.6.3. cURL

Parser cần được unit test với:

- Quote đơn và quote kép.
- ANSI-C quoting.
- Lệnh nhiều dòng có ký tự `\`.
- Nhiều header cùng tên.
- Authorization Bearer/Basic.
- JSON có dấu nháy.
- Form-urlencoded.
- URL có query và ký tự Unicode.

Hàm export phải bảo đảm shell quoting không tạo lệnh sai hoặc tạo nguy cơ chèn lệnh khi người dùng sao chép.

### 3.6.4. OpenAPI import

Các ca cần kiểm tra:

- Spec từ URL và từ file.
- `$ref` nội bộ và bên ngoài.
- Spec không có `servers`.
- Nhiều tag.
- Tên collection trùng.
- Security scheme bearer, basic và api-key.
- Request body JSON/form.
- Path param và query param.
- Spec sai hoặc không thể dereference.

### 3.6.5. Dự án mẫu ECM

Dự án ECM cung cấp chuỗi API phù hợp cho smoke test:

1. Health check.
2. Login.
3. Lấy thông tin người dùng.
4. Thống kê hệ thống.
5. Tạo tài liệu.
6. Lấy danh sách và chi tiết tài liệu.
7. Cập nhật, xóa và khôi phục tài liệu.
8. Truy vấn user với quyền admin.

Chuỗi login → trích token → gọi API bảo vệ là bài kiểm định phù hợp cho chức năng Save-to-Env và variable resolution.

## 3.7. Kiểm định AI Agent

### 3.7.1. Kiểm định session và context

- Session được tạo tự động khi mở project.
- Chuyển session tải đúng message.
- Soft delete không làm mất dữ liệu ngoài ý muốn.
- Chỉ 20 message gần nhất được gửi LLM nhưng lịch sử đầy đủ còn trong DB.
- Active test file bị giới hạn kích thước context đúng quy định.
- Profile secret không bị hiển thị không cần thiết trong log hoặc UI.

### 3.7.2. Kiểm định quyền công cụ

| Ca kiểm thử | Kết quả mong đợi |
|---|---|
| Chế độ `ask` yêu cầu ghi file | Tool ghi không xuất hiện với LLM |
| Chế độ `auto` ghi trong project | Ghi thành công và log action |
| Chế độ `auto-with-rollback` | Có backup trước khi ghi |
| Yêu cầu ghi ngoài project | Bị chặn |
| Yêu cầu xóa file | Cần policy rõ và log đầy đủ |

### 3.7.3. Kiểm định `apply-steps`

Artifact hợp lệ phải:

- Là đúng một JSON array.
- Có `keyword`.
- Không có comment hoặc trailing comma.
- Không cần ID vì IDE sinh ID.
- Được normalize các giá trị mặc định.
- Được validate bằng schema trước khi ghi.
- Có cơ chế phục hồi nếu ghi tệp thất bại.

### 3.7.4. Rủi ro AI

- Hallucination keyword không tồn tại.
- Chọn keyword không hỗ trợ runner.
- Ghi đè toàn bộ steps ngoài ý muốn.
- Đưa secret vào prompt.
- Prompt injection từ nội dung project.
- Tool call lặp gây tốn tài nguyên.
- Không thể hủy request do `AGENT_CANCEL` còn placeholder.

## 3.8. Kiểm định phi chức năng

### 3.8.1. Hiệu năng

Chỉ số đề xuất:

| Chỉ số | Mục tiêu tham khảo |
|---|---:|
| Thời gian mở project 1.000 tệp | ≤ 3 giây |
| Thời gian mở editor tệp thông thường | ≤ 500 ms |
| Độ trễ cập nhật step event | ≤ 200 ms |
| Thời gian render cây sau thay đổi tệp | ≤ 500 ms |
| Thời gian gửi request không tính network | ≤ 100 ms overhead |
| Mức tăng RAM sau 20 lần run | Không tăng liên tục bất thường |

Các mục tiêu trên cần được hiệu chỉnh theo cấu hình máy chuẩn của nhóm.

### 3.8.2. Độ tin cậy và phục hồi

Kiểm tra:

- Electron renderer reload khi run đang hoạt động.
- Runner crash không làm mất tệp.
- Database agent bị khóa hoặc hỏng.
- Mất điện khi đang ghi tệp.
- Lịch sử vượt giới hạn.
- Backup rollback có thể khôi phục đúng nội dung.
- Dừng ứng dụng phải giải phóng Appium server và session.

Khuyến nghị ghi tệp theo cơ chế atomic write: ghi tệp tạm, `fsync` nếu cần và rename.

### 3.8.3. Bảo mật

Các kiểm soát hiện có:

- `contextIsolation` và tắt `nodeIntegration` trong renderer.
- Filesystem đi qua IPC.
- Filesystem MCP được giới hạn theo project path.
- Chế độ `ask` lọc tool ghi.

Các điểm cần tăng cường:

- Validate payload IPC hai chiều bằng Zod như nguyên tắc kiến trúc đã nêu.
- Chống path traversal và symlink escape.
- Không lưu token/API key dạng rõ trong log và report.
- Mã hóa hoặc tích hợp secret store của hệ điều hành cho thông tin nhạy cảm.
- Không cho AI tự động xóa/di chuyển dữ liệu quan trọng nếu chưa có xác nhận.
- Kiểm tra URL để giảm nguy cơ SSRF khi import OpenAPI hoặc gửi request nội bộ.
- Giới hạn kích thước file/spec/response để tránh tiêu thụ tài nguyên.

### 3.8.4. Khả năng sử dụng

Đề xuất usability test với các nhiệm vụ:

1. Tạo project Web mới.
2. Tạo test case đăng nhập.
3. Chọn object và keyword.
4. Chạy test và tìm nguyên nhân một step fail.
5. Tạo suite smoke.
6. Import cURL và trích token vào profile.
7. Kết nối thiết bị Appium.
8. Dùng Agent thêm assertion.

Chỉ số:

- Tỷ lệ hoàn thành nhiệm vụ.
- Thời gian hoàn thành.
- Số lỗi thao tác.
- Số lần cần hỗ trợ.
- Điểm SUS hoặc bảng hỏi tương đương.

### 3.8.5. Khả năng bảo trì

Điểm mạnh:

- TypeScript và schema dùng chung.
- Phân chia package và feature rõ.
- Quy ước Conventional Commits.
- Giới hạn tệp khoảng 400 dòng.
- Có tài liệu kỹ thuật cho từng feature.

Khoảng trống được ghi nhận:

- Không tìm thấy tệp unit test hoặc spec theo mẫu tên thông dụng trong cấu trúc hiện tại.
- Root có script `build`, `lint`, `typecheck`, nhưng các package chưa đồng nhất script test/lint.
- `packages/engine`, `project-fs`, `storage` chưa thể hiện script `typecheck` độc lập trong manifest được khảo sát.
- Roadmap chưa đồng bộ với trạng thái feature.

## 3.9. Ma trận rủi ro chất lượng

Thang xác suất và tác động: 1 thấp, 5 rất cao. Điểm rủi ro = Xác suất × Tác động.

| Rủi ro | Xác suất | Tác động | Điểm | Mức | Biện pháp |
|---|---:|---:|---:|---|---|
| Mất dữ liệu khi Agent ghi đè steps | 3 | 5 | 15 | Cao | Schema validation, diff preview, atomic write, rollback |
| Keyword hiển thị nhưng runner không hỗ trợ | 3 | 4 | 12 | Cao | Contract test registry–adapter |
| Appium không khởi động do PATH/driver | 4 | 3 | 12 | Cao | Env check, hướng dẫn và test đa OS |
| Path traversal qua IPC/filesystem MCP | 2 | 5 | 10 | Cao | Canonical path, allowlist project root |
| Secret xuất hiện trong log/prompt | 3 | 5 | 15 | Cao | Masking, secret store, context filtering |
| Runner treo và không dừng được | 3 | 4 | 12 | Cao | Abort test, watchdog, child process isolation |
| OpenAPI lớn làm treo ứng dụng | 3 | 3 | 9 | Trung bình | Size limit, worker/process riêng |
| Lịch sử JSON ghi đồng thời bị hỏng | 2 | 3 | 6 | Trung bình | Queue và atomic write |
| Tài liệu sai lệch trạng thái | 4 | 2 | 8 | Trung bình | Docs review trong Definition of Done |
| Native dependency lỗi khi đóng gói | 3 | 4 | 12 | Cao | Build matrix và smoke test artifact |

## 3.10. Nhận xét về mức độ sẵn sàng

### Bằng chứng tích cực

- Kiến trúc và phạm vi feature được mô tả chi tiết.
- Có schema và quy tắc authoring cụ thể.
- Có cơ chế run event, history, undo/redo và profile.
- Có hướng dẫn gỡ lỗi theo nhóm nguyên nhân.
- Có project mẫu API để tạo smoke test thực tế.
- Có script build và typecheck ở cấp workspace.

### Khoảng trống bằng chứng

- Chưa phát hiện bộ test tự động trong tên tệp `test/spec` thông dụng.
- Chưa có báo cáo coverage.
- Chưa có log CI hoặc ma trận build đa hệ điều hành trong tài liệu đã đọc.
- Chưa có kết quả benchmark.
- Chưa có báo cáo kiểm thử bảo mật.
- Một số chức năng như hủy Agent vẫn là placeholder.

### Kết luận mức sẵn sàng

Dựa trên tài liệu, JKAuto có thể được đánh giá ở mức **prototype hoàn thiện cao hoặc sản phẩm đang trong giai đoạn beta kỹ thuật**. Kiến trúc và feature đủ để thực hiện kiểm thử chức năng có hệ thống, nhưng chưa đủ bằng chứng để kết luận sẵn sàng production. Điều kiện quan trọng để nâng mức sẵn sàng là bổ sung automated regression suite, CI đa nền tảng, kiểm thử đóng gói, kiểm thử bảo mật IPC/filesystem và đo lường độ ổn định của runner.

---

# PHẦN IV. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## 4.1. Kết quả đạt được

Qua quá trình khảo sát và đánh giá, báo cáo đã:

1. Hệ thống hóa kiến trúc và các thành phần chính của JKAuto.
2. Phân tích mô hình dữ liệu Test Case, Test Suite, Object Repository và Profile.
3. Làm rõ luồng chạy Web, Desktop, Mobile, Appium và API.
4. Phân tích cơ chế AI Agent, session, context, artifact và quyền ghi tệp.
5. Đánh giá hệ thống theo tám nhóm đặc tính chất lượng.
6. Xây dựng danh sách ca kiểm thử chức năng và phi chức năng.
7. Nhận diện các rủi ro ưu tiên cao.
8. Phân biệt mô tả tài liệu với bằng chứng kiểm định đã có.

JKAuto có nền tảng thiết kế tốt ở các khía cạnh file-based, schema-first, adapter-based và feature modularization. Đây là các yếu tố thuận lợi để phát triển một hệ thống automation IDE có khả năng bảo trì và mở rộng.

## 4.2. Hạn chế

### 4.2.1. Hạn chế của hệ thống

- Phụ thuộc nhiều vào môi trường ngoài như browser binary, Appium, ADB, Xcode và driver.
- Một số keyword có mức hỗ trợ khác nhau giữa Playwright, Maestro và Appium.
- Agent có quyền ghi tệp tạo ra rủi ro mất dữ liệu hoặc ghi sai nếu thiếu validation.
- Native module và Electron có thể phát sinh lỗi khi đóng gói đa nền tảng.
- Chưa có bằng chứng đầy đủ về test coverage và regression automation.

### 4.2.2. Hạn chế của báo cáo

- Báo cáo chủ yếu dựa trên tài liệu và khảo sát cấu trúc dự án.
- Chưa thực hiện benchmark trên cấu hình máy chuẩn.
- Chưa chạy toàn bộ ma trận hệ điều hành và thiết bị.
- Chưa thực hiện penetration test.
- Các vai trò thành viên trong bảng phân công là đề xuất và có thể điều chỉnh theo thực tế.

## 4.3. Đề xuất cải tiến chất lượng

### 4.3.1. Giai đoạn 1: Thiết lập nền tảng kiểm thử

1. Bổ sung Vitest cho unit test.
2. Viết test schema, parser cURL, interpolation, JSON path và normalize suite.
3. Viết contract test bảo đảm keyword registry khớp với từng adapter.
4. Mock IPC để kiểm tra renderer hook và store.
5. Chuẩn hóa script `test`, `lint`, `typecheck` cho tất cả package.

### 4.3.2. Giai đoạn 2: Kiểm thử tích hợp

1. Test IPC với temporary directory.
2. Test đọc/ghi JSON/YAML và atomic write.
3. Test HTTP handler bằng local mock server.
4. Test SQLite migration và session lifecycle.
5. Test Appium handler bằng mock server hoặc fixture.
6. Test Agent tool filtering theo từng edit mode.

### 4.3.3. Giai đoạn 3: E2E và CI

1. Dùng Playwright chạy E2E cho Electron.
2. Tạo project fixture nhỏ, vừa và lớn.
3. Chạy build/typecheck/test trên Ubuntu, Windows và macOS.
4. Smoke test gói cài đặt sau build.
5. Lưu artifact gồm screenshot, log và report.
6. Đặt quality gate cho pull request.

Quality gate đề xuất:

```text
- Typecheck: pass
- Lint: pass
- Unit/Integration test: pass
- Critical E2E: pass
- Coverage dòng: >= 80% cho core utility
- Không có lỗi bảo mật mức Critical/High chưa xử lý
```

### 4.3.4. Giai đoạn 4: Bảo mật và độ tin cậy

1. Validate toàn bộ IPC payload bằng schema.
2. Chặn path traversal và symlink escape.
3. Mask secret trong log, prompt và history.
4. Thêm cancel thật cho AI Agent.
5. Chạy runner trong process riêng có watchdog.
6. Thêm transaction/atomic write cho artifact quan trọng.
7. Giới hạn kích thước response, spec và context.

### 4.3.5. Giai đoạn 5: Quản trị chất lượng

1. Gắn mã yêu cầu cho từng feature và ca kiểm thử.
2. Duy trì ma trận truy vết yêu cầu–test–kết quả.
3. Cập nhật roadmap khi feature thay đổi trạng thái.
4. Đưa cập nhật tài liệu vào Definition of Done.
5. Theo dõi defect leakage, flaky rate và mean time to repair.

## 4.4. Phân công công việc

Phân công đề xuất cho quá trình hoàn thiện và trình bày đồ án:

| Thành viên | Công việc chính | Sản phẩm bàn giao |
|---|---|---|
| Nguyễn Văn Nhật | Kiến trúc, tổng hợp và kiểm tra kỹ thuật | Sơ đồ hệ thống, phần II, bản báo cáo hợp nhất |
| Nguyễn Kiều Trinh | Phân tích yêu cầu và usability | Danh sách yêu cầu, ca kiểm thử UI, đánh giá trải nghiệm |
| Quách Hữu Nam | Engine, API, Appium và test matrix | Ma trận keyword/runner, ca kiểm thử tích hợp |
| Lê Thị Kiều Trang | ISO 25010, rủi ro và tài liệu | Bảng đánh giá chất lượng, risk matrix, rà soát trình bày |

Nguyên tắc phối hợp:

- Mỗi nội dung có một người phụ trách và một người review.
- Mọi kết quả kiểm thử phải lưu bằng chứng.
- Không đánh dấu đạt nếu chưa có log, screenshot hoặc report.
- Các lỗi Critical phải được xử lý trước khi trình diễn.

## 4.5. Kết luận chung

JKAuto là đề tài có tính thực tiễn cao trong lĩnh vực kiểm thử phần mềm. Hệ thống thể hiện định hướng rõ ràng: cung cấp trải nghiệm trực quan nhưng vẫn giữ artifact minh bạch, có thể review và mở rộng. Kiến trúc Electron kết hợp Playwright, Appium, API runner và AI Agent tạo ra khả năng bao phủ nhiều nhu cầu kiểm thử trong một công cụ.

Về chất lượng thiết kế, các quyết định như schema versioning, stable ID, IPC boundary, keyword registry dùng chung, adapter runner và rollback cho AI là những điểm mạnh. Về chất lượng kiểm định, dự án cần tiến thêm một bước quan trọng: biến tài liệu chi tiết thành bằng chứng tự động có thể lặp lại. Khi có test pyramid, CI đa nền tảng, quality gate và quản trị secret đầy đủ, JKAuto sẽ có cơ sở vững chắc hơn để chuyển từ beta kỹ thuật sang sản phẩm có thể phát hành ổn định.

Nhóm kết luận rằng JKAuto đáp ứng tốt mục tiêu của một đồ án môn học về đánh giá và kiểm định chất lượng phần mềm. Sản phẩm có đủ thành phần để áp dụng các kỹ thuật verification, validation, kiểm thử chức năng, kiểm thử phi chức năng và quản trị rủi ro. Giá trị lớn nhất của quá trình đánh giá là xác định rõ khoảng cách giữa “đã được thiết kế/mô tả” và “đã được kiểm định bằng bằng chứng”, từ đó đưa ra lộ trình nâng cao chất lượng có thể thực hiện được.

## 4.6. Tài liệu tham khảo 

---

**HẾT**
