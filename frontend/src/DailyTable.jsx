import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 🛠️ 輔助函式：將 ISO 時間轉為 MySQL 格式 (YYYY-MM-DD HH:mm:ss)
const formatToMySQLDateTime = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString; // 若轉換失敗則回傳原值

  const pad = (n) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

function DailyTable({ editData, onClearEdit, onSaveSuccess }) {
  
  // 1. 初始化狀態邏輯
  const getInitialState = () => {
    if (editData && editData.items) {
      // 編輯模式
      return {
        date: editData.date ? editData.date.split('T')[0] : new Date().toLocaleDateString('en-CA'),
        location: editData.location || '',
        rate: editData.items.length > 0 ? Number(editData.items[0].commission_rate) : 0.16,
        items: editData.items.map(item => {
          const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
          return {
            ...item,
            price: item.snapshot_retail_price,
            // 編輯時還原資料，若無值則預設為 '' (空字串) 以便顯示 placeholder
            p_jin: isWeight ? Math.floor(item.purchase_total_units / 16) : '',
            p_tael: isWeight ? item.purchase_total_units % 16 : '',
            p_qty: !isWeight ? item.purchase_total_units : '',
            r_jin: isWeight ? Math.floor(item.return_total_units / 16) : '',
            r_tael: isWeight ? item.return_total_units % 16 : '',
            r_qty: !isWeight ? item.return_total_units : '',
          };
        })
      };
    }
    
    // 新增模式
    return {
      date: new Date().toLocaleDateString('en-CA'),
      location: '',
      rate: 0.16,
      items: [] 
    };
  };

  const initialState = getInitialState();

  const [date, setDate] = useState(initialState.date);
  const [location, setLocation] = useState(initialState.location);
  const [commissionRate, setCommissionRate] = useState(initialState.rate);
  const [items, setItems] = useState(initialState.items);
  
  const [locationOptions, setLocationOptions] = useState([]);
  const originalItems = useRef(editData); // 紀錄原始資料供刪除用

  // 2. 載入地點與商品 (僅在組件掛載時執行一次)
  useEffect(() => {
    const init = async () => {
      try {
        const [locRes, prodRes] = await Promise.all([
          axios.get(`${API_URL}/api/locations`),
          axios.get(`${API_URL}/api/products`)
        ]);
        
        setLocationOptions(locRes.data);
        
        // 若為新增模式且無地點，預設選第一個
        if (!editData && locRes.data.length > 0 && !location) {
            setLocation(locRes.data[0].name);
        }

        // 若為新增模式，載入商品列表建立空表格
        if (!editData && items.length === 0) {
          const defaultItems = prodRes.data.map(p => ({
            id: p.id,
            product_name: p.name,
            unit_type: p.unit_type,
            price: p.retail_price_tael,
            p_jin: '', p_tael: '', p_qty: '',
            r_jin: '', r_tael: '', r_qty: '',
          }));
          setItems(defaultItems);
        }
      } catch (err) { console.error("初始化失敗", err); }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. 輸入處理 (含防呆)
  const handleItemChange = (index, field, value) => {
    // 防呆：兩的數值需小於 16
    if ((field === 'p_tael' || field === 'r_tael') && value !== '') {
      if (Number(value) >= 16) {
        alert('兩的數值必須小於 16');
        return; // 阻止更新
      }
    }

    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // 重置表格功能
  const handleReset = () => {
    if (editData) {
      // 情況 A：編輯模式 -> 還原到原始資料 (Undo)
      if (confirm('確定要還原至原始紀錄嗎？目前的修改將會消失。')) {
        const originalState = getInitialState(); // 重新呼叫初始化函式抓取 editData
        setItems(originalState.items);
        setCommissionRate(originalState.rate);
        setDate(originalState.date);
        setLocation(originalState.location);
      }
    } else {
      // 情況 B：新增模式 -> 清空所有欄位 (Clear)
      if (confirm('確定要清空所有輸入嗎？')) {
        const resetItems = items.map(item => ({
          ...item,
          p_jin: '', p_tael: '', p_qty: '',
          r_jin: '', r_tael: '', r_qty: ''
        }));
        setItems(resetItems);
      }
    }
  };
  // 即時計算邏輯
  const calculateRow = (item) => {
    const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
    const price = parseFloat(item.price) || 0;
    
    // 計算出貨量
    const shipQty = isWeight 
      ? (parseFloat(item.p_jin) || 0) * 16 + (parseFloat(item.p_tael) || 0)
      : (parseFloat(item.p_qty) || 0);
      
    // 計算回收量
    const returnQty = isWeight
      ? (parseFloat(item.r_jin) || 0) * 16 + (parseFloat(item.r_tael) || 0)
      : (parseFloat(item.r_qty) || 0);

    const shipVal = shipQty * price;
    const returnVal = returnQty * price;
    const netSales = shipVal - returnVal;
    const commission = netSales * commissionRate;
    const revenue = netSales - commission;

    return { shipVal, returnVal, netSales, commission, revenue };
  };

  // 總計
  const totals = items.reduce((acc, item) => {
    const row = calculateRow(item);
    return {
      shipVal: acc.shipVal + row.shipVal,
      returnVal: acc.returnVal + row.returnVal,
      netSales: acc.netSales + row.netSales,
      commission: acc.commission + row.commission,
      revenue: acc.revenue + row.revenue
    };
  }, { shipVal: 0, returnVal: 0, netSales: 0, commission: 0, revenue: 0 });

  // 4. 儲存功能 (關鍵修正)
  const handleSave = async () => {
    if (!date || !location) return alert("請選擇日期與地點");
    
    // 準備要送出的資料：將空值轉為 0
    const validItems = items.map(i => ({ 
      ...i, 
      commission_rate: commissionRate,
      // 將空字串轉為 0，避免後端收到 NaN 或 null
      p_jin: i.p_jin || 0,
      p_tael: i.p_tael || 0,
      p_qty: i.p_qty || 0,
      r_jin: i.r_jin || 0,
      r_tael: i.r_tael || 0,
      r_qty: i.r_qty || 0
    }));

    if (validItems.length === 0) return alert("請至少輸入一項數據");

    try {
      // 若是編輯模式，先執行「刪除舊資料」
      if (editData) {
        // 🔥 關鍵修正：確保 created_at 格式為 MySQL 可接受的字串
        const rawCreatedAt = originalItems.current.created_at || (originalItems.current.items[0] && originalItems.current.items[0].created_at);
        const formattedCreatedAt = formatToMySQLDateTime(rawCreatedAt);

        if (!formattedCreatedAt) {
          throw new Error("找不到原始資料的時間戳記，無法更新");
        }

        await axios.delete(`${API_URL}/api/sales/batch`, { 
          data: { 
            date: originalItems.current.date, // 舊的日期
            location: originalItems.current.location, // 舊的地點
            created_at: formattedCreatedAt // 格式化後的時間
          } 
        });
      }

      // 新增資料
      await axios.post(`${API_URL}/api/sales/bulk`, {
        date,
        location,
        items: validItems
      });

      alert("儲存成功！");
      if (editData) {
        onSaveSuccess(); // 通知父元件儲存成功，跳轉頁面
      } else {
        // 若在新增模式，清空表單
        setItems(items.map(i => ({...i, p_jin:'', p_tael:'', p_qty:'', r_jin:'', r_tael:'', r_qty:''}))); 
      }

    } catch (err) {
      console.error(err);
      alert("儲存失敗：" + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="bg-neutral-900 p-6 rounded-xl text-neutral-200 shadow-2xl border border-neutral-800">
      {/* 頂部控制列 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">日期 (Date)</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} 
            className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-white" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">地點 (Location)</label>
          <select value={location} onChange={e => setLocation(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded p-2 text-white">
            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">抽成比例 (Rate)</label>
          <div className="flex items-center">
            <input type="number" step="0.01" value={commissionRate} onChange={e => setCommissionRate(parseFloat(e.target.value))}
              className="w-24 bg-neutral-800 border border-neutral-700 rounded p-2 text-white mr-2 text-right" />
            <span className="text-neutral-400">= {(commissionRate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* 表格區 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-800 text-neutral-400">
              <th className="p-2 text-left">品項</th>
              <th className="p-2 w-20">單價</th>
              <th className="p-2 text-center bg-blue-900/20">出貨數量</th> 
              <th className="p-2 text-center bg-red-900/20">回收數量</th>
              <th className="p-2 text-right text-blue-300">出貨</th>
              <th className="p-2 text-right text-red-300">存貨</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {items.map((item, idx) => {
              const calcs = calculateRow(item);
              const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';

              return (
                <tr key={item.id || idx} className="hover:bg-neutral-800/50">
                  <td className="p-2 font-bold">{item.product_name}</td>
                  <td className="p-2 text-neutral-400">{item.price}</td>
                  
                  {/* 出貨輸入區 */}
                  <td className="p-2 bg-blue-900/10">
                    <div className="flex gap-1 justify-center">
                      {isWeight ? (
                        <>
                          <input placeholder="斤" value={item.p_jin} onChange={e => handleItemChange(idx, 'p_jin', e.target.value)} 
                            className="w-12 bg-neutral-700 rounded px-1 text-center text-white" />
                          <input placeholder="兩" value={item.p_tael} onChange={e => handleItemChange(idx, 'p_tael', e.target.value)} 
                            className="w-12 bg-neutral-700 rounded px-1 text-center text-white" />
                        </>
                      ) : (
                        <input placeholder="個" value={item.p_qty} onChange={e => handleItemChange(idx, 'p_qty', e.target.value)} 
                          className="w-20 bg-neutral-700 rounded px-1 text-center text-white" />
                      )}
                    </div>
                  </td>

                  {/* 回收輸入區 */}
                  <td className="p-2 bg-red-900/10">
                    <div className="flex gap-1 justify-center">
                      {isWeight ? (
                        <>
                          <input placeholder="斤" value={item.r_jin} onChange={e => handleItemChange(idx, 'r_jin', e.target.value)} 
                            className="w-12 bg-neutral-700 rounded px-1 text-center text-white" />
                          <input placeholder="兩" value={item.r_tael} onChange={e => handleItemChange(idx, 'r_tael', e.target.value)} 
                            className="w-12 bg-neutral-700 rounded px-1 text-center text-white" />
                        </>
                      ) : (
                        <input placeholder="個" value={item.r_qty} onChange={e => handleItemChange(idx, 'r_qty', e.target.value)} 
                          className="w-20 bg-neutral-700 rounded px-1 text-center text-white" />
                      )}
                    </div>
                  </td>

                  <td className="p-2 text-right text-blue-300 font-mono">{calcs.shipVal > 0 ? calcs.shipVal.toLocaleString() : '-'}</td>
                  <td className="p-2 text-right text-red-300 font-mono">{calcs.returnVal > 0 ? calcs.returnVal.toLocaleString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-950 font-bold border-t-2 border-neutral-700">
            <tr>
              <td colSpan={4} className="p-3 text-right text-neutral-400">總計：</td>
              <td className="p-3 text-right text-blue-400">{totals.shipVal.toLocaleString()}</td>
              <td className="p-3 text-right text-red-400">{totals.returnVal.toLocaleString()}</td>
            </tr>
            <tr className="bg-neutral-900">
              <td colSpan={2}></td>
              <td colSpan={4} className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-neutral-800 p-2 rounded">
                    <div className="text-xs text-neutral-500">應賣 (Net Sales)</div>
                    <div className="text-xl text-yellow-400 font-mono">${totals.netSales.toLocaleString()}</div>
                  </div>
                  <div className="bg-neutral-800 p-2 rounded">
                    <div className="text-xs text-neutral-500">差額/抽成 (Commission)</div>
                    <div className="text-xl text-pink-400 font-mono">${Math.round(totals.commission).toLocaleString()}</div>
                  </div>
                  <div className="bg-neutral-800 p-2 rounded border border-emerald-900">
                    <div className="text-xs text-emerald-500">營業額 (Revenue)</div>
                    <div className="text-2xl text-emerald-400 font-mono font-black">${Math.round(totals.revenue).toLocaleString()}</div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button onClick={handleReset} className="px-6 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300">
          {editData ? '還原數值' : '重置表格'}
        </button>
        {editData && (
          <button onClick={onClearEdit} className="px-6 py-2 bg-gray-600 rounded text-white">
            取消編輯
          </button>
        )}
        <button onClick={handleSave} className="px-8 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white shadow-lg transform active:scale-95 transition-all">
          {editData ? '更新紀錄' : '儲存今日帳務'}
        </button>
      </div>
    </div>
  );
}

export default DailyTable;