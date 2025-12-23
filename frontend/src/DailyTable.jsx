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

function DailyTable({editData, onClearEdit}) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [location, setLocation] = useState('');
  const [items, setItems] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);


  // 1. 專門負責抓取地點清單的 useEffect (唯獨載入一次)
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/locations');
        setLocationOptions(res.data);
        
        // 💡 重點：如果不是編輯模式，預設選取第一個地點
        if (!editData && res.data.length > 0) {
          setLocation(res.data[0].name);
        }
      } catch (err) {
        console.error("抓取地點失敗", err);
      }
    };
    fetchLocations();
  }, []); // 空陣列確保只在組件掛載時執行一次

  useEffect(() => {   
    if (editData && editData.items) {
      // 1. 先處理日期與地點
      if (editData.date) setDate(editData.date);
      if (editData.location) setLocation(editData.location);
      if (editData.date) {
      // 確保只取 YYYY-MM-DD 這部分
      const formattedDate = new Date(editData.date).toISOString().split('T')[0];
      setDate(formattedDate);
      }
      // 2. 處理表格內容
      const formattedItems = (editData.items || []).map(r => {
        const isWeight = r.unit_type === 'weight';
        const pTotal = Number(r.purchase_total_units || 0);
        const sTotal = Number(r.sale_total_units || 0);
      
        return {
          product_name: r.product_name,
          unit_type: r.unit_type,
          // 修正：編輯模式下，優先使用歷史快照價格
          unit_price: r.snapshot_retail_price || r.unit_price || 0,
          cost_price: r.snapshot_cost_price || r.cost_price || 0,
          p_jin: isWeight ? Math.floor(pTotal / 16) : pTotal,
          p_tael: isWeight ? (pTotal % 16) : 0,
          s_jin: isWeight ? Math.floor(sTotal / 16) : sTotal,
          s_tael: isWeight ? (sTotal % 16) : 0
        };
      });
      setItems(formattedItems);
    } else {
      // --- 模式 B：正常新增模式 ---
      const fetchProducts = async () => {
        try {
          const res = await axios.get('http://localhost:3001/api/products');
          const initialRows = res.data.map(p => ({
            product_id: p.id,
            product_name: p.name,
            unit_type: p.unit_type || 'weight',
            unit_price: p.retail_price_tael,
            cost_price: p.cost_price_tael,
            p_jin: '', p_tael: '', 
            s_jin: '', s_tael: ''
          }));
          setItems(initialRows);
        } catch (err) {
          console.error("載入失敗", err);
        }
      };
      fetchProducts();
    }
  }, [editData]);

  const handleUpdate = (index, field, value) => {
  const newItems = [...items];
  const numValue = Number(value);
    // 1. 驗證：兩不能超過 15 (因為 16 兩就該進位到斤了)
    if ((field === 'p_tael' || field === 's_tael') && numValue >= 16) {
      alert("「兩」的數值不能超過 15，請增加「斤」的數值。");
      return; // 攔截，不更新狀態
    }
    // 2. 驗證：數值不能為負數
    if (numValue < 0) return;
    newItems[index][field] = value;
    setItems(newItems);
  };
  const handleSave = async () => {
    if (items.length === 0) return alert("沒有資料可以儲存");
    if (!date || !location) {
      console.error("目前的 State 內容:", { date, location });
      alert("錯誤：日期或地點丟失，請重新選擇。");
      return;
    }
    // --- 銷售量驗證邏輯 ---
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let p_total, s_total;

      if (item.unit_type === 'weight') {
        p_total = (Number(item.p_jin || 0) * 16) + Number(item.p_tael || 0);
        s_total = (Number(item.s_jin || 0) * 16) + Number(item.s_tael || 0);
      } else {
        p_total = Number(item.p_jin || 0);
        s_total = Number(item.s_jin || 0);
      }

      if (s_total > p_total) {
        alert(`錯誤：【${item.product_name}】的銷售量大於進貨量！\n進貨：${p_total} 兩/個\n銷售：${s_total} 兩/個`);
        return; // 終止儲存
      }
    }
  try {
    // --- 1. 如果是編輯模式，先刪除舊資料 ---
    if (editData && editData.post_time) {
      console.log("正在替換舊紀錄...", editData.post_time);
      await axios.delete('http://localhost:3001/api/sales/batch', {
        params: { 
          date: editData.date, 
          location: editData.location, 
          post_time: editData.post_time 
        }
      });
    }

  // --- 2. 準備新的 Payload ---
  const payload = {
    date: date,
    location: location,
    items: items.map(item => ({
      product_name: item.product_name,
      unit_price: Number(item.unit_price || 0),
      cost_price: Number(item.cost_price || 0),
      p_jin: Number(item.p_jin || 0),
      p_tael: Number(item.p_tael || 0),
      s_jin: Number(item.s_jin || 0),
      s_tael: Number(item.s_tael || 0),
      unit_type: item.unit_type
    }))
  };

  // --- 3. 儲存新資料 ---
  const res = await axios.post('http://localhost:3001/api/sales/bulk', payload);
  alert("✅ 紀錄已更新！");

  if (onClearEdit) onClearEdit(); // 清除編輯狀態，跳回正常模式
} catch (err) {
  console.error("儲存失敗:", err);
  alert("❌ 更新失敗，請檢查網路或後端");
}
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
          {locationOptions.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
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
      <div style={{padding: '20px'}}>
      {editData && <div style={{color: '#ff9800', marginBottom: '10px'}}>⚠️ 正在重新編輯歷史紀錄</div>}
      {/* Date, Location, Table... */}
    </div>    
      <div style={{ marginTop: '20px' }}>
        <button onClick={handleSave} style={styles.saveBtn}>儲存今日所有紀錄</button>
        <button onClick={() => window.location.reload()} style={styles.cancelBtn}>重置表格</button>
      </div>
    </div>
  );
}

export default DailyTable;