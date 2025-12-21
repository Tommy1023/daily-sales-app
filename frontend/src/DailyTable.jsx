import { useState, useEffect } from 'react';
import axios from 'axios';

const styles = {
  container: { padding: '30px', backgroundColor: '#1a1a1a', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif' },
  input: { backgroundColor: '#333', color: '#fff', border: '1px solid #555', padding: '5px', borderRadius: '4px' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px', color: '#fff' },
  th: { backgroundColor: '#444', padding: '10px', border: '1px solid #666' },
  td: { padding: '8px', border: '1px solid #666', textAlign: 'center' },
  saveBtn: { backgroundColor: '#2e7d32', color: 'white', padding: '10px 20px', border: 'none', cursor: 'pointer', marginRight: '10px' },
  cancelBtn: { backgroundColor: '#c62828', color: 'white', padding: '10px 20px', border: 'none', cursor: 'pointer' },
};

function App() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('台北市場');
  const [items, setItems] = useState([]);
  const locations = ['台北市場', '板橋市場', '新莊市場'];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/products');
        const initialRows = res.data.map(p => ({
          product_id: p.id,
          product_name: p.name,
          unit_type: p.unit_type || 'weight',
          unit_price: p.retail_price_tael, // 零售價
          cost_price: p.cost_price_tael,   // 進貨價
          p_jin: '', p_tael: '', 
          s_jin: '', s_tael: ''
        }));
        setItems(initialRows);
      } catch (err) {
        console.error("載入失敗", err);
      }
    };
    fetchProducts();
  }, []);

  const handleUpdate = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const getCalc = (item) => {
    let p_total_units = 0;
    let s_total_units = 0;

    // 確保單價存在，若不存在則設為 0 避免運算出錯
    const rPrice = item.unit_price || 0;
    const cPrice = item.cost_price || 0;

    if (item.unit_type === 'weight') {
      p_total_units = (Number(item.p_jin || 0) * 16) + Number(item.p_tael || 0);
      s_total_units = (Number(item.s_jin || 0) * 16) + Number(item.s_tael || 0);
    } else {
      // 個數類：統一使用 p_jin / s_jin
      p_total_units = Number(item.p_jin || 0);
      s_total_units = Number(item.s_jin || 0);
    }
    
    const cost = p_total_units * cPrice;
    const revenue = s_total_units * rPrice;
    const diff = cost - revenue;
    const comm = revenue * 0.1;

    return { rev: Math.round(revenue), dif: Math.round(diff), com: comm.toFixed(1) };
  };

 const handleSave = async () => {
  // 1. 先檢查是否有空品名（防呆）
  if (items.length === 0) return alert("沒有資料可以儲存");

  try {
    // 2. 整理要送出的資料 (Payload)
    const payload = {
      date: date,
      location: location,
      // 確保這裡的每一個 Key 都要在後端對應到
      items: items.map(item => ({
        product_name: item.product_name,
        // 💡 這裡最容易出錯：請確認名稱是否與 useEffect 載入時一致
        unit_price: Number(item.unit_price || 0), 
        cost_price: Number(item.cost_price || 0), 
        p_jin: Number(item.p_jin || 0),
        p_tael: Number(item.p_tael || 0),
        s_jin: Number(item.s_jin || 0),
        s_tael: Number(item.s_tael || 0),
        unit_type: item.unit_type
      }))
    };

    console.log("準備送出的資料：", payload); // 👈 儲存前先看一眼

    const res = await axios.post('http://localhost:3001/api/sales/bulk', payload);
    alert("✅ " + res.data.message);
  } catch (err) {
    console.error("儲存出錯內容：", err.response?.data || err.message);
    alert("❌ 儲存失敗，請檢查控制台錯誤訊息");
  }
};
  const totals = items.reduce((acc, item) => {
    const { rev, dif, com } = getCalc(item);
    acc.totalRevenue += rev;
    acc.totalDiff += dif;
    acc.totalCommission += Number(com);
    return acc;
  }, { totalRevenue: 0, totalDiff: 0, totalCommission: 0 });

  return (
    <div style={styles.container}>
      <h2>📅 每日營業紀錄編輯 (全商品列表)</h2>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <input type="date" style={styles.input} value={date} onChange={e => setDate(e.target.value)} />
        <select style={styles.input} value={location} onChange={e => setLocation(e.target.value)}>
          {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>品名</th>
            <th style={styles.th}>零售單價</th>
            <th colSpan='2' style={styles.th}>進貨 (斤兩 / 個)</th>
            <th colSpan='2' style={styles.th}>銷售 (斤兩 / 個)</th>
            <th style={styles.th}>銷售金額</th>
            <th style={styles.th}>差額</th>
            <th style={styles.th}>抽成(10%)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const { rev, dif, com } = getCalc(item);
            const isWeight = item.unit_type === 'weight';
            
            return (
              <tr key={item.product_id || index} style={{ borderBottom: '1px solid #333' }}>
                <td style={styles.td}>{item.product_name}</td>
                <td style={styles.td}>{item.unit_price}</td>

                {/* --- 進貨區 --- */}
                {isWeight ? (
                  <>
                    <td style={styles.td}>
                      <input type="number" placeholder="0" style={{ ...styles.input, width: '60px' }} 
                        value={item.p_jin} onChange={(e) => handleUpdate(index, 'p_jin', e.target.value)} /> 斤
                    </td>
                    <td style={styles.td}>
                      <input type="number" placeholder="0" style={{ ...styles.input, width: '60px' }} 
                        value={item.p_tael} onChange={(e) => handleUpdate(index, 'p_tael', e.target.value)} /> 兩
                    </td>
                  </>
                ) : (
                  <td colSpan={2} style={styles.td}>
                    <input type="number" placeholder="0" style={{ ...styles.input, width: '60px', borderColor: '#4fc3f7' }} 
                      value={item.p_jin} onChange={(e) => handleUpdate(index, 'p_jin', e.target.value)} /> 數量 (個/支)
                  </td>
                )}

                {/* --- 銷售區 --- */}
                {isWeight ? (
                  <>
                    <td style={styles.td}>
                      <input type="number" placeholder="0" style={{ ...styles.input, width: '60px' }} 
                        value={item.s_jin} onChange={(e) => handleUpdate(index, 's_jin', e.target.value)} /> 斤
                    </td>
                    <td style={styles.td}>
                      <input type="number" placeholder="0" style={{ ...styles.input, width: '60px' }} 
                        value={item.s_tael} onChange={(e) => handleUpdate(index, 's_tael', e.target.value)} /> 兩
                    </td>
                  </>
                ) : (
                  <td colSpan={2} style={styles.td}>
                    <input type="number" placeholder="0" style={{ ...styles.input, width: '60px', borderColor: '#66bb6a' }} 
                      value={item.s_jin} onChange={(e) => handleUpdate(index, 's_jin', e.target.value)} /> 數量 (個/支)
                  </td>
                )}

                <td style={{ ...styles.td, color: '#ffeb3b', fontWeight: 'bold' }}>${rev}</td>
                <td style={{ ...styles.td, color: dif >= 0 ? '#66bb6a' : '#ef5350' }}>${dif}</td>
                <td style={{ ...styles.td, color: '#29b6f6' }}>${com}</td>
              </tr>
            );
          })}
        </tbody>
        {/* 底部總計列 */}
        <tfoot style={{ backgroundColor: '#111', fontWeight: 'bold' }}>
          <tr>
            <td colSpan="6" style={{ ...styles.td, textAlign: 'right', borderTop: '2px solid #555' }}>今日總結：</td>
            <td style={{ ...styles.td, color: '#ffeb3b', borderTop: '2px solid #555' }}>
              ${totals.totalRevenue.toLocaleString()}
            </td>
            <td style={{ ...styles.td, color: totals.totalDiff >= 0 ? '#66bb6a' : '#ef5350', borderTop: '2px solid #555' }}>
              ${totals.totalDiff.toLocaleString()}
            </td>
            <td style={{ ...styles.td, color: '#29b6f6', borderTop: '2px solid #555' }}>
              ${totals.totalCommission.toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: '20px' }}>
        <button onClick={handleSave} style={styles.saveBtn}>儲存今日所有紀錄</button>
        <button onClick={() => window.location.reload()} style={styles.cancelBtn}>重置表格</button>
      </div>
    </div>
  );
}

export default App;