# Docker Local Environment Setup

Dự án sử dụng Docker Compose để thiết lập môi trường phát triển cục bộ cho các Database và Background Services.

## Các Services hiện tại trong Docker
1. **Redis** (`redis:alpine`)
   - **Port**: `6379`
   - **Vai trò**: Dùng làm In-memory Caching layer và message broker cho **BullMQ** (quản lý Task Queue cào dữ liệu bằng Playwright).
   - **Data Volume**: `redis_data`
   
2. **MongoDB** (`mongo:latest`)
   - **Port**: `27017`
   - **Vai trò**: Dùng để lưu trữ dữ liệu phi cấu trúc, đặc biệt là lịch sử hội thoại của AI Chatbot.
   - **Data Volume**: `mongo_data`
   - **Credentials**: Được cấu hình qua `.env.docker`.

3. **Elasticsearch** (`elasticsearch:8.13.0`)
   - **Port**: `9200` (HTTP) và `9300` (Transport)
   - **Vai trò**: Search Engine để phục vụ việc tìm kiếm việc làm (Full-text search) nhanh chóng, mạnh mẽ trên hàng ngàn/hàng triệu bản ghi.
   - **Data Volume**: `es_data`
   - **Cấu hình**: Chạy dạng `single-node` và tắt bảo mật x-pack (cho mục đích dev cục bộ).

## Cách chạy
1. Đảm bảo đã cài Docker Desktop và đang mở.
2. Từ thư mục gốc dự án, chạy lệnh:
   ```bash
   docker compose --env-file .env.docker up -d
   ```
3. Lệnh này sẽ kéo các image về và chạy ở chế độ ngầm (detached mode).
4. Để xem trạng thái:
   ```bash
   docker compose ps
   ```
5. Để tắt:
   ```bash
   docker compose down
   ```

## Tương lai (Planned)
Sẽ containerize thêm các service:
- Next.js web application
- FastAPI ML gateway
- Playwright BullMQ Worker
