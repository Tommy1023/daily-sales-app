import { useState, useEffect } from 'react';
import axios from 'axios';

const styles = {
  container: { padding: '20px' },
  searchBar: { display: 'flex', gap: '15px', marginBottom: '20px', backgroundColor: '#333', padding: '15px', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', color: '#fff' },
  th: { backgroundColor: '#444', padding: '12px', border: '1px solid #666' },
  td: { padding: '12px', border: '1px solid #444', textAlign: 'center' },
  input: { backgroundColor: '#222', color: '#fff', border: '1px solid #555', padding: '8px' },
  btnSearch: { backgroundColor: '#4fc3f7', color: '#000', border: 'none', padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold' },
  };

function HistoryReport({onEditRequest}) {
  const [query, setQuery] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    location: ''
  });
  const [records, setRecords] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/locations');
        setLocationOptions(res.data);
        // 如果有地點，預設選第一個
        if (res.data.length > 0) {
          setQuery(prev => ({ ...prev, location: res.data[0].name }));
        }
      } catch (err) {
        console.error("載入地點失敗", err);
      }
    };
    fetchLocations();
  }, []);

  const handleSearch = async () => {
    try {
      const res = await axios.get(`http://localhost:3001/api/sales/history`, { params: query });
      setRecords(res.data);
      if (res.data.length === 0) alert("該日期無任何紀錄");
    } catch (err) {
      alert("查詢失敗");
    }
  };

  const grouped = records.reduce((acc, r) => {
    const time = r.post_time || '未知時段';
    if (!acc[time]) acc[time] = [];
    acc[time].push(r);
    return acc;
  }, {});

  const calculateGroupTotals = (group) => {
    return group.reduce((acc, r) => {
      const rev = r.sale_total_units * r.snapshot_retail_price;
      const cost = r.purchase_total_units * r.snapshot_cost_price;
      acc.rev += rev;
      acc.diff += (cost - rev);
      return acc;
    }, { rev: 0, diff: 0 });
  };

  /// 輔助函式：根據單位類型格式化顯示
  const formatUnits = (units, type) => {
    if (units === 0) return '--';
    
    if (type === 'weight') {
      const jin = Math.floor(units / 16);
      const tael = units % 16;
      let result = '';
      if (jin > 0) result += `${jin}斤`;
      if (tael > 0) result += `${tael}兩`;
      return result || '0兩';
    } else {
      // 個數類直接顯示數值
      return `${units} 個/支`;
    }
  };

  // 計算總計
  const totals = records.reduce((acc, r) => {
    const rev = r.sale_total_units * r.snapshot_retail_price;
    const cost = r.purchase_total_units * r.snapshot_cost_price;
    acc.rev += rev;
    acc.diff += (rev - cost);
    acc.comm += (rev * 0.1);
    return acc;
  }, { rev: 0, diff: 0, comm: 0 });

  const groupedRecords = records.reduce((groups, record) => {
    const time = record.post_time || "未知時段";
    if (!groups[time]) {
      groups[time] = [];
    }
    groups[time].push(record);
    return groups;
  }, {});

 return (
    <div style={styles.container}>
      <h3 style={{ color: '#81c784' }}>📜 歷史營業紀錄查詢</h3>
      
      {/* 搜尋列 */}
      <div style={styles.searchBar}>
        <input type="date" style={styles.input} value={query.date} onChange={e => setQuery({...query, date: e.target.value})} />
        <select style={styles.input} value={query.location} onChange={e => setQuery({...query, location: e.target.value})}>
        {locationOptions.map(loc => (
          <option key={loc.id} value={loc.name}>
            {loc.name}
          </option>
        ))}
        </select>
        <button style={styles.btnSearch} onClick={handleSearch}>搜尋報表</button>
      </div>

      {/* 2. 【分組渲染】 */}
      {Object.keys(grouped).map((time) => {
        const groupItems = grouped[time];
        const groupTotals = calculateGroupTotals(groupItems);
        // 刪除功能
        const handleDeleteBatch = async () => {
          if (!window.confirm(`確定要刪除 ${time} 的這批紀錄嗎？`)) return;
          try {
            await axios.delete('http://localhost:3001/api/sales/batch', {
              params: { date: query.date, location: query.location, post_time: time }
            });
            handleSearch(); // 重新整理列表
          } catch (err) { alert("刪除失敗"); }
        };

        // 編輯功能 (這裡需要透過 props 傳遞功能回 App.jsx)
        const handleEditBatch = (time,groupItems) => {
          // 邏輯：將 groupItems 轉換回 DailyTable 需要的格式
          // 然後切換到填寫頁面
          onEditRequest(
            groupItems,
            query.date,
            query.location,
            time
          ); 
        };

        return (
          <div key={time} style={{ marginBottom: '50px', backgroundColor: '#252525', padding: '15px', borderRadius: '10px' }}>
            <h4 style={{ color: '#ff9800', margin: '0 0 10px 0' }}>🕒 存檔時間：{time}
            </h4>
            <div>
              <button onClick={()=>handleEditBatch(time,groupItems)} style={styles.btnEdit}>✏️ 重新編輯</button>
              <button onClick={handleDeleteBatch} style={styles.btnDelete}>🗑️ 刪除</button>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>品名</th>
                  <th style={styles.th}>零售價</th>
                  <th style={styles.th}>進貨量</th>
                  <th style={styles.th}>銷售量</th>
                  <th style={styles.th}>銷售額</th>
                  <th style={styles.th}>利潤</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((r, i) => {
                  const rev = r.sale_total_units * r.snapshot_retail_price;
                  const diff =  (r.purchase_total_units * r.snapshot_cost_price) - rev;
                  return (
                    <tr key={i}>
                      <td style={styles.td}>{r.product_name}</td>
                      <td style={styles.td}>${r.snapshot_retail_price}</td>
                      <td style={styles.td}>{formatUnits(r.purchase_total_units, r.unit_type)}</td>
                      <td style={styles.td}>{formatUnits(r.sale_total_units, r.unit_type)}</td>
                      <td style={styles.td}>${Math.round(rev).toLocaleString()}</td>
                      <td style={{...styles.td, color: diff >= 0 ? '#66bb6a' : '#ef5350'}}>
                        ${Math.round(diff).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {/* 該時段的小計列 */}
                <tr style={{ backgroundColor: '#333', fontWeight: 'bold' }}>
                  <td colSpan="4" style={{...styles.td, textAlign: 'right'}}>此時段小計：</td>
                  <td style={styles.td}>${Math.round(groupTotals.rev).toLocaleString()}</td>
                  <td style={styles.td}>${Math.round(groupTotals.diff).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default HistoryReport;