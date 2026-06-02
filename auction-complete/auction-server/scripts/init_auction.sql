-- 先把旧的测试数据清掉
UPDATE auctions SET status='cancelled' WHERE 1;

-- 插入新的正在运行的竞拍商品（持续60分钟，延时30秒）
INSERT INTO auctions (
  name, image_url, description, start_price, current_price, increment, 
  cap_price, status, start_time, end_time, delay_seconds, 
  extend_count, created_at, updated_at
) VALUES (
  '超级测试手机', 
  'https://picsum.photos/800/400', 
  '千人实时在线竞拍测试专用商品', 
  100000,  -- 起拍价1000元，单位分
  100000,  -- 当前价
  10000,   -- 加价幅度100元
  99999999, -- 封顶价99万
  'active',
  NOW(),
  DATE_ADD(NOW(), INTERVAL 60 MINUTE), -- 剩余60分钟结束
  30,
  0,
  NOW(),
  NOW()
);

SELECT LAST_INSERT_ID() as new_auction_id;
