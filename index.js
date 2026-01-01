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
  rejectUnauthorized: false,
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

// 取得歷史記錄
app.get('/api/sales/report', async (req, res) => {
  const { date, location } = req.query;
  try {
    let sql = `
      SELECT 
        id, 
        record_date, 
        location, 
        product_name, 
        unit_type, 
        snapshot_retail_price, 
        purchase_total_units, 
        return_total_units, 
        commission_rate,
        DATE_FORMAT(created_at, '%H:%i:%s') as precise_time,
        created_at
      FROM sales_records 
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      sql += ' AND record_date = ?';
      params.push(date);
    }
    if (location) {
      sql += ' AND location = ?';
      params.push(location);
    }

    sql += ' ORDER BY created_at DESC, id ASC';

    const [rows] = await db.query(sql, params);

    // 後端進行財務計算，減輕前端負擔並確保邏輯一致
    const processedData = rows.map(row => {
      const price = Number(row.snapshot_retail_price);
      const shippedQty = Number(row.purchase_total_units);
      const returnedQty = Number(row.return_total_units);
      const rate = Number(row.commission_rate);

      // F欄: 出貨總價值
      const shippedValue = shippedQty * price;

      // G欄: 退貨總價值
      const returnedValue = returnedQty * price;

      // 應賣總價值 (出貨 - 存貨)
      const netSalesValue = shippedValue - returnedValue;

      // 抽成金額 (差額)
      const commissionAmount = netSalesValue * rate;

      // 淨營業額 (實際入袋)
      const netRevenue = netSalesValue - commissionAmount;

      return {
        ...row,
        shipped_value: shippedValue,
        returned_value: returnedValue,
        net_sales_value: netSalesValue,
        commission_amount: commissionAmount,
        net_revenue: netRevenue
      };
    });

    res.json(processedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 批次儲存銷售紀錄
app.post('/api/sales/bulk', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 前端傳來的結構: { date, location, items: [ { product_name, unit_type, price, p_jin, p_tael, r_jin, r_tael, commission_rate ... } ] }
    const { date, location, items } = req.body;
    const createdAt = new Date(); // 統一建立時間作為批次識別

    for (const item of items) {
      // 1. 計算出貨總量 (最小單位)
      let purchase_units = 0;
      if (item.unit_type === 'weight' || item.unit_type === '兩') {
        purchase_units = (Number(item.p_jin || 0) * 16) + Number(item.p_tael || 0);
      } else {
        purchase_units = Number(item.p_qty || 0);
      }

      // 2. 計算回收總量 (最小單位) - 新增邏輯
      let return_units = 0;
      if (item.unit_type === 'weight' || item.unit_type === '兩') {
        return_units = (Number(item.r_jin || 0) * 16) + Number(item.r_tael || 0);
      } else {
        return_units = Number(item.r_qty || 0);
      }

      await connection.query(
        `INSERT INTO sales_records 
        (record_date, location, product_name, unit_type, snapshot_retail_price, purchase_total_units, return_total_units, commission_rate, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date,
          location,
          item.product_name,
          item.unit_type,
          item.price,
          purchase_units,
          return_units,
          item.commission_rate || 0.16, // 預設 16%
          createdAt
        ]
      );
    }

    await connection.commit();
    res.json({ message: "儲存成功" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});
// 刪除銷售紀錄
app.delete('/api/sales/batch', async (req, res) => {
  const { date, location, created_at } = req.body;

  if (!date || !location || !created_at) {
    return res.status(400).json({ error: "缺少必要參數 (date, location, created_at)" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 使用 DATE_FORMAT 確保時間秒數比對正確，忽略微秒差異
    await connection.query(
      `DELETE FROM sales_records 
       WHERE record_date = ? 
       AND location = ? 
       AND created_at = ?`, // 若前端已格式化好，這裡直接比對即可
      [date, location, created_at]
    );

    await connection.commit();
    res.json({ message: "批次刪除成功" });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// --- 商品與地點維護 API ---
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE is_active = 1');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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