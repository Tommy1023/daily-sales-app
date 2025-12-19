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
    const [rows] = await db.query('SELECT * FROM products');
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
  try {
    const { date, location, items } = req.body;

    // 過濾掉沒填品名的空行
    const validItems = items.filter(item => item.product_name !== '');

    if (validItems.length === 0) return res.status(400).json({ message: "無有效資料" });

    const values = validItems.map(item => [
      date,
      location,
      item.product_name,
      item.unit_price,
      (Number(item.p_jin) * 16) + Number(item.p_tael), // 轉成總兩數
      (Number(item.s_jin) * 16) + Number(item.s_tael)  // 轉成總兩數
    ]);

    const sql = `INSERT INTO sales_records 
      (record_date, location, product_name, unit_price, purchase_total_tael, sale_quantity) 
      VALUES ?`;

    await db.query(sql, [values]);
    res.json({ message: "儲存成功" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "儲存失敗" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 伺服器正在 http://localhost:${PORT} 運行`);
});