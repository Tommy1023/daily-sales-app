require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  },
  timezone: '+08:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// 測試連線
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ message: "資料庫連線成功！", data: rows });
  } catch (error) {
    res.status(500).json({ message: "資料庫連線失敗", error: error.message });
  }
});

// 取得所有商品
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE is_active = 1');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取得歷史記錄
app.get('/api/sales/report', async (req, res) => {
  const { date, location } = req.query;
  const sql = `
    SELECT *, 
    DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+08:00'), '%H:%i') as post_time,
    DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+08:00'), '%H:%i:%s') as precise_time
    FROM sales_records 
    WHERE record_date = ? AND location = ? 
    ORDER BY created_at DESC
  `;
  try {
    const [results] = await db.query(sql, [date, location]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 批次儲存銷售紀錄
app.post('/api/sales/bulk', async (req, res) => {
  const { date, location, items } = req.body;
  try {
    const values = items.map(item => [
      date, location, item.product_name, item.unit_price, item.cost_price,
      item.unit_type === 'weight' ? (Number(item.p_jin) * 16 + Number(item.p_tael)) : Number(item.p_jin),
      item.unit_type === 'weight' ? (Number(item.s_jin) * 16 + Number(item.s_tael)) : Number(item.s_jin),
      item.unit_type
    ]);
    const sql = `INSERT INTO sales_records 
      (record_date, location, product_name, snapshot_retail_price, snapshot_cost_price, purchase_total_units, sale_total_units, unit_type) 
      VALUES ?`;
    await db.query(sql, [values]);
    res.json({ message: "儲存成功" });
  } catch (err) {
    res.status(500).json({ error: err.sqlMessage });
  }
});

// 修正：刪除路由接收名稱統一為 post_time
app.delete('/api/sales/batch', async (req, res) => {
  const { date, location, post_time } = req.query;
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
    res.status(500).json({ error: err.message });
  }
});

// --- 以下為補回的商品與地點維護 API ---
app.post('/api/products', async (req, res) => {
  const { name, cost_price_tael, retail_price_tael, unit_type } = req.body;
  try {
    await db.query('INSERT INTO products (name, cost_price_tael, retail_price_tael, unit_type) VALUES (?, ?, ?, ?)', [name, cost_price_tael, retail_price_tael, unit_type]);
    res.json({ message: "商品新增成功" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, cost_price_tael, retail_price_tael, unit_type } = req.body;
  try {
    await db.query('UPDATE products SET name=?, cost_price_tael=?, retail_price_tael=?, unit_type=? WHERE id=?', [name, cost_price_tael, retail_price_tael, unit_type, id]);
    res.json({ message: "更新成功" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: "商品已下架" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/locations', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM locations');
    res.send(rows);
  } catch (err) { res.status(500).send(err); }
});

app.post('/api/locations', async (req, res) => {
  const { name } = req.body;
  try {
    const [result] = await db.query('INSERT INTO locations (name) VALUES (?)', [name]);
    res.send({ message: "新增成功", id: result.insertId });
  } catch (err) { res.status(500).send({ message: "名稱可能重複了" }); }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM locations WHERE id = ?', [req.params.id]);
    res.send({ message: "刪除成功" });
  } catch (err) { res.status(500).send({ message: "刪除失敗" }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ 伺服器正在 http://localhost:${PORT} 運行`));