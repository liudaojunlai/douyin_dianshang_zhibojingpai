-- 插入测试用户
INSERT INTO users (phone, nickname, password, role, balance, created_at, updated_at)
VALUES 
('13800138001', '数码达人小王', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'seller', 0, NOW(), NOW()),
('13800138002', '竞拍者小李', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'user', 10000000, NOW(), NOW());

-- 插入测试商品
INSERT INTO products (seller_id, name, description, images, created_at, updated_at)
VALUES 
(1, '限量版 AirPods Max 星空银', '苹果官方全新未拆封，经典配色', '["https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400"]', NOW(), NOW()),
(1, '索尼 PS5 光驱版', '99新，带两个原装手柄', '["https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400"]', NOW(), NOW()),
(1, '戴森 V15 吸尘器', '全新正品，官方保修两年', '["https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400"]', NOW(), NOW());

-- 插入测试拍卖（进行中）
INSERT INTO auctions (product_id, seller_id, status, start_price, increment, cap_price, duration, delay_seconds, current_price, version, start_time, end_time, extend_count, created_at, updated_at)
VALUES 
(1, 1, 'active', 399900, 1000, 499900, 3600, 10, 429900, 0, NOW(), DATE_ADD(NOW(), INTERVAL 1 HOUR), 0, NOW(), NOW()),
(2, 1, 'active', 299900, 1000, 399900, 7200, 10, 319900, 0, NOW(), DATE_ADD(NOW(), INTERVAL 2 HOUR), 0, NOW(), NOW()),
(3, 1, 'active', 349900, 1000, 449900, 1800, 10, 359900, 0, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE), 0, NOW(), NOW());

-- 插入出价记录
INSERT INTO bids (auction_id, user_id, amount, created_at)
VALUES 
(1, 2, 429900, NOW());
