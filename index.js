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
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
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

// 新增計帳紀錄 API
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

    // 2. 套用你的公式：換算總兩數
    // 強制轉成 Number 確保運算正確
    const total_tael = (Number(jin) * 16) + Number(tael);

    // 3. 準備 SQL 語法
    const sql = `
      INSERT INTO sales_records 
      (record_date, location, product_name, unit_price, purchase_total_tael, sale_quantity) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

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
// 取得所有商品資訊 (供下拉選單使用)
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE is_active = 1');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取得所有銷售紀錄 (包含計算邏輯)
app.get('/api/sales', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sales_records ORDER BY record_date DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批次儲存銷售紀錄 (處理你表格中多行商品的資料)
app.post('/api/sales/bulk', async (req, res) => {
  const { date, location, items } = req.body;

  try {
    // 1. 整理資料陣列 (必須對齊下方 SQL 的順序)
    const values = items.map(item => [
      date,
      location,
      item.product_name,
      Number(item.unit_price || 0),   // 對應 snapshot_retail_price
      Number(item.cost_price || 0),   // 對應 snapshot_cost_price
      // 根據單位計算總量
      item.unit_type === 'weight'
        ? (Number(item.p_jin || 0) * 16 + Number(item.p_tael || 0))
        : Number(item.p_jin || 0),
      item.unit_type === 'weight'
        ? (Number(item.s_jin || 0) * 16 + Number(item.s_tael || 0))
        : Number(item.s_jin || 0)
    ]);

    // 2. 撰寫 SQL (欄位順序要跟上面 values 裡的一模一樣)
    const sql = `INSERT INTO sales_records 
      (record_date, location, product_name, snapshot_retail_price, snapshot_cost_price, purchase_total_units, sale_total_units) 
      VALUES ?`;

    await db.query(sql, [values]);
    res.json({ message: "儲存成功" });

  } catch (error) {
    console.error("❌ MySQL 報錯了：", error.sqlMessage); // 這裡會印出具體原因
    res.status(500).json({ error: error.sqlMessage });
  }
});
// 更新商品資訊 (單價、單位)
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

// 2. 刪除商品
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

app.listen(PORT, () => {
  console.log(`✅ 伺服器正在 http://localhost:${PORT} 運行`);
});