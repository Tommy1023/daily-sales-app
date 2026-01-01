import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const formatToMySQLDateTime = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;

  const pad = (n) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 🟢 修改 1: 接收 isError 參數，控制背景顏色
const QtyInputGroup = ({ item, idx, type, colorClass, onItemChange, isError }) => {
  const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
  const prefix = type === 'ship' ? 'p' : 'r';
  
  // 如果有錯誤，強制使用紅色背景，否則使用傳入的顏色
  const finalColorClass = isError 
    ? "bg-red-200 border-2 border-red-500 animate-pulse" // 錯誤時：紅色背景 + 邊框 + 呼吸燈效果
    : colorClass;

  return (
    <div className={`flex gap-2 justify-center items-center w-full rounded-lg p-2 transition-colors duration-300 ${finalColorClass}`}>
      {isWeight ? (
        <>
          <div className="relative flex-1">
              <input placeholder="0" type="number" 
                value={item[`${prefix}_jin`]} 
                onChange={e => onItemChange(idx, `${prefix}_jin`, e.target.value)} 
                className={`w-full h-12 border rounded px-1 text-center text-xl text-slate-900 focus:ring-2 outline-none ${isError ? 'border-red-500 bg-red-50 focus:ring-red-400' : 'border-slate-300 bg-white focus:ring-blue-400'}`} />
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">斤</span>
          </div>
          <div className="relative flex-1">
            <input placeholder="0" type="number" 
              value={item[`${prefix}_tael`]} 
              onChange={e => onItemChange(idx, `${prefix}_tael`, e.target.value)} 
              className={`w-full h-12 border rounded px-1 text-center text-xl text-slate-900 focus:ring-2 outline-none ${isError ? 'border-red-500 bg-red-50 focus:ring-red-400' : 'border-slate-300 bg-white focus:ring-blue-400'}`} />
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">兩</span>
          </div>
        </>
      ) : (
        <input placeholder="個" type="number" 
          value={item[`${prefix}_qty`]} 
          onChange={e => onItemChange(idx, `${prefix}_qty`, e.target.value)} 
          className={`w-full h-12 border rounded px-2 text-center text-xl text-slate-900 focus:ring-2 outline-none ${isError ? 'border-red-500 bg-red-50 focus:ring-red-400' : 'border-slate-300 bg-white focus:ring-blue-400'}`} />
      )}
    </div>
  );
}

function DailyTable({ editData, onClearEdit, onSaveSuccess }) {
  
  const getInitialState = () => {
    if (editData && editData.items) {
      return {
        date: editData.date ? editData.date.split('T')[0] : new Date().toLocaleDateString('en-CA'),
        location: editData.location || '',
        rate: editData.items.length > 0 ? Number(editData.items[0].commission_rate) : 0.16,
        items: editData.items.map(item => {
          const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
          return {
            ...item,
            price: item.snapshot_retail_price,
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
  const originalItems = useRef(editData);

  useEffect(() => {
    const init = async () => {
      try {
        const [locRes, prodRes] = await Promise.all([
          axios.get(`${API_URL}/api/locations`),
          axios.get(`${API_URL}/api/products`)
        ]);
        
        setLocationOptions(locRes.data);
        
        if (!editData && locRes.data.length > 0 && !location) {
            setLocation(locRes.data[0].name);
        }

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

  const handleItemChange = (index, field, value) => {
    if ((field === 'p_tael' || field === 'r_tael') && value !== '') {
      if (Number(value) >= 16) {
        alert('兩的數值必須小於 16');
        return;
      }
    }
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleReset = () => {
    if (editData) {
      if (confirm('確定要還原至原始紀錄嗎？目前的修改將會消失。')) {
        const originalState = getInitialState();
        setItems(originalState.items);
        setCommissionRate(originalState.rate);
        setDate(originalState.date);
        setLocation(originalState.location);
      }
    } else {
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

  const calculateRow = (item) => {
    const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
    const price = parseFloat(item.price) || 0;
    
    const shipQty = isWeight 
      ? (parseFloat(item.p_jin) || 0) * 16 + (parseFloat(item.p_tael) || 0)
      : (parseFloat(item.p_qty) || 0);
      
    const returnQty = isWeight
      ? (parseFloat(item.r_jin) || 0) * 16 + (parseFloat(item.r_tael) || 0)
      : (parseFloat(item.r_qty) || 0);

    const shipVal = shipQty * price;
    const returnVal = returnQty * price;
    const netSales = shipVal - returnVal;
    const commission = netSales * commissionRate;
    const revenue = netSales - commission;

    // 回傳值多加了 qty 資訊供判斷
    return { shipVal, returnVal, netSales, commission, revenue, shipQty, returnQty };
  };

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

  const handleSave = async () => {
    if (!date || !location) return alert("請選擇日期與地點");
    
    // 儲存前做最終防守：檢查是否有任何一個項目的回收大於出貨
    for (const item of items) {
      const rowData = calculateRow(item); // 這裡會拿到換算好的 shipQty 和 returnQty
      
      // 只有當有輸入數值且回收大於出貨時才報錯
      if (rowData.returnQty > rowData.shipQty) {
        alert(`錯誤：【${item.product_name}】的回收數量 (${rowData.returnQty}) 不能大於出貨數量 (${rowData.shipQty})！`);
        return; // 中斷儲存
      }
    }

    const validItems = items.map(i => ({ 
      ...i, 
      commission_rate: commissionRate,
      p_jin: i.p_jin || 0,
      p_tael: i.p_tael || 0,
      p_qty: i.p_qty || 0,
      r_jin: i.r_jin || 0,
      r_tael: i.r_tael || 0,
      r_qty: i.r_qty || 0
    }));

    if (validItems.length === 0) return alert("請至少輸入一項數據");

    try {
      if (editData) {
        const rawCreatedAt = originalItems.current.created_at || (originalItems.current.items[0] && originalItems.current.items[0].created_at);
        const formattedCreatedAt = formatToMySQLDateTime(rawCreatedAt);

        if (!formattedCreatedAt) throw new Error("找不到原始資料的時間戳記，無法更新");

        await axios.delete(`${API_URL}/api/sales/batch`, { 
          data: { 
            date: originalItems.current.date,
            location: originalItems.current.location,
            created_at: formattedCreatedAt 
          } 
        });
      }

      await axios.post(`${API_URL}/api/sales/bulk`, {
        date,
        location,
        items: validItems
      });

      alert("儲存成功！");
      if (editData) {
        onSaveSuccess();
      } else {
        setItems(items.map(i => ({...i, p_jin:'', p_tael:'', p_qty:'', r_jin:'', r_tael:'', r_qty:''}))); 
      }

    } catch (err) {
      console.error(err);
      alert("儲存失敗：" + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xl border border-slate-200 text-slate-900">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          <label className="block text-lg font-bold text-slate-700 mb-2">日期 (Date)</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} 
            className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-3 text-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-lg font-bold text-slate-700 mb-2">地點 (Location)</label>
          <select value={location} onChange={e => setLocation(e.target.value)}
            className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-3 text-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-lg font-bold text-slate-700 mb-2">抽成比例 (Rate)</label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.01" value={commissionRate} onChange={e => setCommissionRate(parseFloat(e.target.value))}
              className="w-28 h-12 bg-white border-2 border-slate-300 rounded-lg px-3 text-xl text-right focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none" />
            <span className="text-xl font-bold text-slate-500">= {(commissionRate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-xl border-slate-200 mb-6">
        <table className="w-full text-base md:text-lg">
          <thead className="bg-orange-500 text-slate-600 border-b-2 border-slate-200">
            <tr>
              <th className="p-4 text-left md:text-center whitespace-nowrap md:w-1/6">品項</th>
              
              <th className="hidden md:table-cell p-4 text-center md:w-1/6">單價</th>
              <th className="hidden md:table-cell p-4 text-center md:w-1/6">出貨數量</th> 
              <th className="hidden md:table-cell p-4 text-center md:w-1/6">回收數量</th>
              <th className="hidden md:table-cell p-4 text-center md:w-1/6">出貨金額</th>
              <th className="hidden md:table-cell p-4 text-center md:w-1/6">回收金額</th>

              <th className="md:hidden p-4 text-center">出貨 / 回收</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => {
              const calcs = calculateRow(item);
              
              // 🟢 修改 2: 即時判斷是否有錯誤 (回收 > 出貨)
              // 只要回收大於出貨，isReturnError 就會是 true
              const isReturnError = calcs.returnQty > calcs.shipQty;

              return (
                <tr key={item.id || idx} className="hover:bg-yellow-50 even:bg-slate-50 transition-colors">
                  <td className="p-4 align-top md:align-middle md:text-center">
                    <div className="font-bold text-lg md:text-xl text-slate-800">{item.product_name}</div>
                    
                    <div className="md:hidden text-slate-500 text-sm mt-1 font-mono">
                      單價: ${item.price}
                    </div>
                  </td>
                  
                  <td className="hidden md:table-cell p-4 text-center text-slate-600 font-mono">${item.price}</td>
                  <td className="hidden md:table-cell p-3">
                    <QtyInputGroup item={item} idx={idx} type="ship" colorClass="bg-blue-50/50" onItemChange={handleItemChange} />
                  </td>
                  <td className="hidden md:table-cell p-3">
                    {/* 將 isReturnError 傳給回收欄位 */}
                    <QtyInputGroup 
                      item={item} 
                      idx={idx} 
                      type="return" 
                      colorClass="bg-red-50/50" 
                      onItemChange={handleItemChange} 
                      isError={isReturnError} // 如果有錯，這個欄位會變紅
                    />
                  </td>
                  <td className="hidden md:table-cell p-4 text-center text-blue-600 font-mono font-bold">{calcs.shipVal > 0 ? calcs.shipVal.toLocaleString() : '-'}</td>
                  <td className="hidden md:table-cell p-4 text-center text-red-500 font-mono font-bold">{calcs.returnVal > 0 ? calcs.returnVal.toLocaleString() : '-'}</td>

                  <td className="md:hidden p-2">
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <span className="absolute left-1 top-0 text-[20px] text-blue-600 font-bold z-10 px-1 bg-blue-50 rounded">出貨</span>
                        <QtyInputGroup item={item} idx={idx} type="ship" colorClass="bg-blue-50 border border-blue-200 pt-5" onItemChange={handleItemChange} />
                      </div>
                      
                      <div className="relative">
                         <span className="absolute left-1 top-0 text-[20px] text-red-600 font-bold z-10 px-1 bg-red-50 rounded">回收</span>
                        <QtyInputGroup 
                          item={item} 
                          idx={idx} 
                          type="return" 
                          colorClass="bg-red-50 border border-red-200 pt-5" 
                          onItemChange={handleItemChange}
                          isError={isReturnError}
                        />
                      </div>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
          
          <tfoot className="bg-slate-100 font-bold border-t-4 border-slate-300">
            <tr>
              <td colSpan={2} className="md:hidden p-4 text-right text-slate-500 text-lg">總計詳情請見下方</td>
              <td colSpan={4} className="hidden md:table-cell p-4 text-right text-slate-500 text-lg">出/回 總計：</td>
              
              <td className="hidden md:table-cell p-4 text-center text-blue-600 text-xl">${totals.shipVal.toLocaleString()}</td>
              <td className="hidden md:table-cell p-4 text-center text-red-500 text-xl">${totals.returnVal.toLocaleString()}</td>
            </tr>
            <tr className="bg-slate-800 text-white">
              
              <td colSpan={2} className="md:hidden p-4">
                 <div className="flex flex-col gap-4">
                    <div className="bg-emerald-800 p-2 rounded-xl border-4 border-emerald-500 text-center shadow-lg">
                      <div className="text-sm text-emerald-200 mb-1">營業額 (Revenue)</div>
                      <div className="text-2xl text-white font-mono font-black">${Math.round(totals.revenue).toLocaleString()}</div>
                    </div>

                    <div className="bg-slate-700 p-2 rounded-xl text-center border border-slate-600">
                      <div className="text-sm text-slate-300 mb-1">應賣 (Net Sales)</div>
                      <div className="text-2xl text-yellow-400 font-mono tracking-wider">${totals.netSales.toLocaleString()}</div>
                    </div>

                    <div className="bg-slate-700 p-2 rounded-xl text-center border border-slate-600">
                      <div className="text-sm text-slate-300 mb-1">差額/抽成 (Commission)</div>
                      <div className="text-2xl text-pink-300 font-mono tracking-wider">${Math.round(totals.commission).toLocaleString()}</div>
                    </div>
                 </div>
              </td>

              <td colSpan={2} className="hidden md:table-cell"></td>
              <td colSpan={4} className="hidden md:table-cell p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-700 p-4 rounded-xl">
                    <div className="text-sm text-slate-300 mb-1">應賣 (Net Sales)</div>
                    <div className="text-2xl text-yellow-400 font-mono tracking-wider">${totals.netSales.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-700 p-4 rounded-xl">
                    <div className="text-sm text-slate-300 mb-1">差額/抽成 (Commission)</div>
                    <div className="text-2xl text-pink-300 font-mono tracking-wider">${Math.round(totals.commission).toLocaleString()}</div>
                  </div>
                  <div className="bg-emerald-800 p-4 rounded-xl border-2 border-emerald-500 shadow-lg transform scale-110">
                    <div className="text-sm text-emerald-200 mb-1">營業額 (Revenue)</div>
                    <div className="text-4xl text-white font-mono font-black">${Math.round(totals.revenue).toLocaleString()}</div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col md:flex-row justify-end gap-4 mt-8">
        <button onClick={handleReset} className="px-8 py-4 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 font-bold text-lg">
          {editData ? '還原數值' : '重置表格'}
        </button>
        {editData && (
          <button onClick={onClearEdit} className="px-8 py-4 bg-slate-500 hover:bg-slate-400 rounded-xl text-white font-bold text-lg">
            取消編輯
          </button>
        )}
        <button onClick={handleSave} className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white text-xl shadow-lg shadow-emerald-600/30 transform active:scale-95 transition-all w-full md:w-auto">
          {editData ? '更新紀錄' : '儲存今日帳務'}
        </button>
      </div>
    </div>
  );
}

export default DailyTable;