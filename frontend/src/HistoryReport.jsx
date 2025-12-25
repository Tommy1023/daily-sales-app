import { useState, useEffect } from 'react';
import axios from 'axios';

function HistoryReport({ onEditRequest, initialQuery }) {
  const [query, setQuery] = useState({ 
    date: initialQuery?.date || new Date().toLocaleDateString('en-CA'), 
    location: initialQuery?.location || '' 
  });
  const [records, setRecords] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/locations');
        setLocationOptions(res.data);
        if (!initialQuery?.location && res.data.length > 0) {
          setQuery(prev => ({ ...prev, location: res.data[0].name }));
        }
      } catch (err) {
        console.error("載入地點失敗", err);
      }
    };
    fetchLocations();
  }, [initialQuery]);

  useEffect(() => {
    if (initialQuery?.location && initialQuery?.date) {
      handleSearch(); 
    }
  }, []); 

  const handleSearch = async () => {
    if (!query.location) return; 
    try {
      const res = await axios.get('http://localhost:3001/api/sales/report', { params: query });
      setRecords(res.data);
    } catch (err) {
      console.error(err);
      alert("搜尋失敗");
    }
  };

  const handleDeleteBatch = async (preciseTime) => {
    if (!window.confirm(`確定要刪除這批紀錄嗎？`)) return;
    try {
      await axios.delete('http://localhost:3001/api/sales/batch', {
        params: { 
          date: query.date, 
          location: query.location, 
          post_time: preciseTime 
        }
      });
      handleSearch();
    } catch (err) {
      alert("刪除失敗");
    }
  };

  // 1. 修改分組邏輯：使用精確時間分組，避免同一分鐘合併
  const grouped = records.reduce((acc, r) => {
    // 優先從後端抓取 precise_time，並處理成 HH:mm:ss 格式字串
    let timeKey = r.precise_time;
    if (timeKey && typeof timeKey === 'string' && timeKey.includes('T')) {
      timeKey = timeKey.split('T')[1].substring(0, 8);
    }
    
    if (!timeKey) return acc;
    if (!acc[timeKey]) acc[timeKey] = [];
    acc[timeKey].push(r);
    return acc;
  }, {});

  const getCalc = (item) => {
    const rPrice = item.snapshot_retail_price || 0;
    const cPrice = item.snapshot_cost_price || 0;
    const pTotal = Number(item.purchase_total_units || 0);
    const sTotal = Number(item.sale_total_units || 0);
    const cost = pTotal * cPrice;
    const revenue = sTotal * rPrice;
    const diff = cost - revenue;
    const comm = revenue * 0.1;
    return { rev: Math.round(revenue), dif: Math.round(diff), com: comm.toFixed(1) };
  };

  const calculateGroupTotals = (items) => {
    return items.reduce((acc, item) => {
      const { rev, dif, com } = getCalc(item);
      acc.totalRevenue += rev;
      acc.totalDiff += dif;
      acc.totalCommission += Number(com);
      return acc;
    }, { totalRevenue: 0, totalDiff: 0, totalCommission: 0 });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">📜 歷史營業紀錄查詢</h2>
      
      <div className="flex gap-4 mb-5 items-end">
        <div>
          <label className="block text-xs text-neutral-100 px-2 mb-1">日期</label>
          <input 
            type="date" 
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500" 
            value={query.date} 
            onChange={e => setQuery({...query, date: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-100 px-2 mb-1">地點</label>
          <select 
            className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500" 
            value={query.location} 
            onChange={e => setQuery({...query, location: e.target.value})}
          >
            {locationOptions.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
          </select>
        </div>
        <button 
          className="px-10 py-2.5 bg-sky-500 text-neutral-900 hover:bg-sky-400 rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all transform active:scale-95"
          onClick={handleSearch}
        >
          搜尋報表
        </button>
      </div>

      <div className="space-y-10">
        {/* 2. 確保在這裡使用 preciseKey 當作變數名稱，並正確範圍化 */}
        {Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map((preciseKey) => {
          const groupItems = grouped[preciseKey];
          const totals = calculateGroupTotals(groupItems);
          const displayTime = preciseKey.substring(0, 5); // 顯示 HH:mm

          return (
            <div key={preciseKey} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="p-4 bg-neutral-800 flex justify-between items-center">
                <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sky-400">🕒 {displayTime}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEditRequest(groupItems, query.date, query.location, preciseKey)} 
                    className="bg-sky-700 hover:bg-sky-600 text-white px-3 py-1 rounded text-sm"
                  >
                    ✏️ 編輯
                  </button>
                  <button 
                    onClick={() => handleDeleteBatch(preciseKey)} 
                    className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                  >
                    🗑️ 刪除
                  </button>
                </div>
              </div>

              <table className="w-full text-left border-collapse">
                <thead className="bg-neutral-950 text-neutral-400 text-sm">
                  <tr>
                    <th className="p-3 border-b border-neutral-800">品名</th>
                    <th className="p-3 border-b border-neutral-800">零售單價</th>
                    <th colSpan="2" className="p-3 border-b border-neutral-800 text-center">進貨</th>
                    <th colSpan="2" className="p-3 border-b border-neutral-800 text-center">銷售</th>
                    <th className="p-3 border-b border-neutral-800 text-right">銷售金額</th>
                    <th className="p-3 border-b border-neutral-800 text-right">差額</th>
                    <th className="p-3 border-b border-neutral-800 text-right">抽成</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {groupItems.map((item, index) => {
                    const { rev, dif, com } = getCalc(item);
                    const isWeight = item.unit_type === 'weight';
                    const p = Number(item.purchase_total_units);
                    const s = Number(item.sale_total_units);
                    return (
                      <tr key={index} className="border-b border-neutral-800 hover:bg-white/5">
                        <td className="p-3 font-bold">{item.product_name}</td>
                        <td className="p-3">${item.snapshot_retail_price}</td>
                        {isWeight ? (
                          <>
                            <td className="p-3 text-right">{Math.floor(p / 16)}斤</td>
                            <td className="p-3 text-left">{p % 16}兩</td>
                            <td className="p-3 text-right">{Math.floor(s / 16)}斤</td>
                            <td className="p-3 text-left">{s % 16}兩</td>
                          </>
                        ) : (
                          <>
                            <td colSpan="2" className="p-3 text-center">{p}個</td>
                            <td colSpan="2" className="p-3 text-center">{s}個</td>
                          </>
                        )}
                        <td className="p-3 text-right text-yellow-400 font-bold">${rev}</td>
                        <td className={`p-3 text-right font-bold ${dif >= 0 ? 'text-green-500' : 'text-red-500'}`}>${dif}</td>
                        <td className="p-3 text-right text-sky-400">${com}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-neutral-950 font-bold">
                  <tr>
                    <td colSpan="6" className="p-4 text-right">今日總結：</td>
                    <td className="p-4 text-right text-yellow-400">${totals.totalRevenue.toLocaleString()}</td>
                    <td className={`p-4 text-right ${totals.totalDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>${totals.totalDiff.toLocaleString()}</td>
                    <td className="p-4 text-right text-sky-400">${totals.totalCommission.toFixed(1)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HistoryReport;