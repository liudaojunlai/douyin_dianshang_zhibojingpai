# ---- 构建阶段 ----
FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o auction-server ./cmd/server

# ---- 运行阶段（最小镜像）----
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Shanghai

WORKDIR /app
COPY --from=builder /app/auction-server .

EXPOSE 8080
CMD ["./auction-server"]
