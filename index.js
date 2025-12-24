require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// 中間件 (Middleware)
app.use(cors());          // 允許跨網域請求 (之後前端 React 串接用)
app.use(express.json());  // 讓 Express 可以解析 JSON 格式的資料

// 1. 建立資料庫連線池 (Pool)
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized:false
  },
  timezone: '+08:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise(); // 使用 Promise 版本，才能用 async/await

// 2. 測試連線路由：檢查 Node.js 是否成功連上 MySQL
app.get('/api/test-db', async (req, res) => {
  try {
    // 嘗試從資料表抓一筆資料
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ message: "資料庫連線成功！", data: rows });
  } catch (error) {
    console.error("連線出錯：", error);
    res.status(500).json({ message: "資料庫連線失敗", error: error.message });
  }
});

// 3. 啟動伺服器
const PORT = process.env.PORT || 3001;


// 取得所有商品資訊(產生表單用)
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE is_active = 1');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 新增計帳紀錄
app.post('/api/sales', async (req, res) => {
  try {
    // 1. 從前端 req.body 取得資料
    const {
      record_date,
      location,
      product_name,
      unit_price,
      jin,    // 前端傳來的斤
      tael,   // 前端傳來的兩
      sale_quantity
    } = req.body;

    // 2. 套用你的公式：換算總兩數，強制轉成 Number 確保運算正確
    const total_tael = (Number(jin) * 16) + Number(tael);

    // 3. 準備 SQL 語法
    const sql = `
      INSERT INTO sales_records 
      (record_date, location, product_name, snapshot_retail_price, snapshot_cost_price, purchase_total_units, sale_total_units) 
      VALUES ?`;
        // 注意：批次寫入用 VALUES ? (不帶括號)，單筆才用 VALUES (?,?,...)

    // 4. 執行查詢
    const [result] = await db.execute(sql, [
      record_date,
      location,
      product_name,
      unit_price,
      total_tael,
      sale_quantity
    ]);

    // 5. 回傳成功訊息
    res.status(201).json({
      message: '紀錄新增成功',
      insertedId: result.insertId
    });

  } catch (error) {
    console.error('新增失敗：', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
});
// 取得歷史記錄
app.get('/api/sales/report', async (req, res) => {
  const { date, location } = req.query;

  // 使用 CONVERT_TZ(欄位, 源時區, 目標時區)
  // 將 UTC 轉為台北時間 (+08:00)
  const sql = `
    SELECT *, 
    DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+08:00'), '%H:%i') as post_time,
    CONVERT_TZ(created_at, '+00:00', '+08:00') as precise_time
    FROM sales_records 
    WHERE record_date = ? AND location = ? 
    ORDER BY created_at DESC
  `;

  try {
    const [results] = await db.query(sql, [date, location]);
    res.json(results);
  } catch (err) {
    console.error("報表查詢失敗:", err);
    res.status(500).json({ error: err.message });
  }
});
// 批次儲存銷售紀錄 (更新歷史紀錄)
app.post('/api/sales/bulk', async (req, res) => {
  const { date, location, items } = req.body;

  try {
    const values = items.map(item => [
      date,                         // 1. record_date
      location,                     // 2. location
      item.product_name,            // 3. product_name
      item.unit_price,              // 4. snapshot_retail_price
      item.cost_price,              // 5. snapshot_cost_price
      // 判斷單位並存入總單位數
      item.unit_type === 'weight'
        ? (Number(item.p_jin) * 16 + Number(item.p_tael))
        : Number(item.p_jin),       // 6. purchase_total_units
      item.unit_type === 'weight'
        ? (Number(item.s_jin) * 16 + Number(item.s_tael))
        : Number(item.s_jin),       // 7. sale_total_units
      item.unit_type                // 8. unit_type (建議加上，歷史報表才好判斷)
    ]);

    // 更新後的 SQL (共 8 個欄位)
    const sql = `INSERT INTO sales_records 
      (record_date, location, product_name, snapshot_retail_price, snapshot_cost_price, purchase_total_units, sale_total_units, unit_type) 
      VALUES ?`;

    await db.query(sql, [values]);
    res.json({ message: "儲存成功！已記錄價格快照與單位類型。" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.sqlMessage });
  }
});
// 刪除特定時段的整批紀錄
app.delete('/api/sales/batch', async (req, res) => {
  // 這裡我們統一用 post_time 這個名稱接收
  const { date, location, post_time } = req.query;

  // 使用 LIKE 或是根據長度判斷。最簡單的方法是讓 SQL 支援精確比對
  const sql = `
    DELETE FROM sales_records 
    WHERE record_date = ? 
    AND location = ? 
    AND DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+08:00'), 
        IF(LENGTH(?) > 5, '%H:%i:%s', '%H:%i')) = ?
  `;

  try {
    const [result] = await db.query(sql, [date, location, post_time, post_time]);
    res.json({ message: "刪除成功", affectedRows: result.affectedRows });
  } catch (err) {
    console.error("刪除失敗:", err);
    res.status(500).json({ error: err.message });
  }
});


// 商品維護API
// 1. 新增商品
app.post('/api/products', async (req, res) => {
  const { name, cost_price_tael, retail_price_tael, unit_type } = req.body;
  try {
    await db.query(
      'INSERT INTO products (name, cost_price_tael, retail_price_tael, unit_type) VALUES (?, ?, ?, ?)',
      [name, cost_price_tael, retail_price_tael, unit_type]
    );
    res.json({ message: "商品新增成功" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 2. 更新商品資訊
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cost_price_tael, retail_price_tael, unit_type } = req.body;
  try {
    await db.query(
      'UPDATE products SET name=?, cost_price_tael=?, retail_price_tael=?, unit_type=? WHERE id=?',
      [name, cost_price_tael, retail_price_tael, unit_type, id]
    );
    res.json({ message: "更新成功" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 3. 刪除商品(軟刪除)
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 改為將狀態設為 0 (停用)
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: "商品已下架（不影響歷史資料）" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//地點維護API
// 取得所有地點
app.get('/api/locations', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM locations');
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
});
// 新增地點
app.post('/api/locations', async (req, res) => {
  const { name } = req.body;
  try {
    const [result] = await db.query('INSERT INTO locations (name) VALUES (?)', [name]);
    res.send({ message: "新增成功", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "名稱可能重複了" });
  }
});
// 刪除地點
app.delete('/api/locations/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM locations WHERE id = ?', [req.params.id]);
    res.send({ message: "刪除成功" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "刪除失敗，該地點可能已被歷史紀錄使用" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 伺服器正在 http://localhost:${PORT} 運行`);
});