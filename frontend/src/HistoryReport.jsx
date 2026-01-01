import { useState, useEffect } from 'react';
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

function HistoryReport({ onEditRequest, initialQuery }) {
  const [query, setQuery] = useState({ 
    date: initialQuery?.date || new Date().toLocaleDateString('en-CA'), 
    location: initialQuery?.location || '' 
  });
  
  const [groupedRecords, setGroupedRecords] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/locations`);
        setLocationOptions(res.data);
        
        if (!initialQuery?.location && !query.location && res.data.length > 0) {
          setQuery(prev => ({ ...prev, location: res.data[0].name }));
        }
      } catch (err) { console.error(err); }
    };
    fetchLocations();
    
    if (initialQuery?.location) {
        setQuery(prev => ({
            ...prev,
            date: initialQuery.date,
            location: initialQuery.location
        }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    if (query.date && query.location) handleSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]); 

  const handleSearch = async () => {
    if (!query.location) return;
    try {
      const res = await axios.get(`${API_URL}/api/sales/report`, { params: query });
      
      const groups = {};
      res.data.forEach(item => {
        const timeKey = item.precise_time; 
        if (!groups[timeKey]) {
          groups[timeKey] = {
            time: timeKey,
            created_at: item.created_at,
            items: [],
            totalShippedValue: 0,
            totalReturnValue: 0,
            totalNetSales: 0,
            totalCommission: 0,
            totalRevenue: 0
          };
        }
        groups[timeKey].items.push(item);
        
        groups[timeKey].totalShippedValue += item.shipped_value;
        groups[timeKey].totalReturnValue += item.returned_value;
        groups[timeKey].totalNetSales += item.net_sales_value;
        groups[timeKey].totalCommission += item.commission_amount;
        groups[timeKey].totalRevenue += item.net_revenue;
      });

      setGroupedRecords(Object.values(groups).sort((a,b) => b.time.localeCompare(a.time)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBatch = async (group) => {
    if (!confirm("確定要刪除這整筆紀錄嗎？此動作無法復原。")) return;
    try {
      const formattedCreatedAt = formatToMySQLDateTime(group.created_at);
      await axios.delete(`${API_URL}/api/sales/batch`, {
        data: { date: query.date, location: query.location, created_at: formattedCreatedAt}
      });
      handleSearch(); 
    } catch (err) {
      alert("刪除失敗");
      console.log("ErrorMsg:", err)
    }
  };

  return (
    <div className="space-y-6">
      {/* 查詢條件區 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">日期</label>
          <input 
            type="date" 
            value={query.date} 
            onChange={e => setQuery({...query, date: e.target.value})}
            className="block h-12 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 text-lg text-slate-900 focus:border-blue-500 outline-none" 
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-500 mb-1">地點</label>
          <select 
            value={query.location}
            onChange={e => setQuery({...query, location: e.target.value})}
            className="block h-12 w-40 bg-slate-50 border-2 border-slate-300 rounded-lg px-3 text-lg text-slate-900 focus:border-blue-500 outline-none"
          >
            <option value="" disabled>請選擇地點</option>
            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>
        <button 
          onClick={handleSearch}
          className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg text-lg transition-all"
        >
          查詢
        </button>
      </div>

      <div className="space-y-8">
        {groupedRecords.length === 0 ? (
          <div className="text-center text-slate-400 py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">查無資料</div>
        ) : (
          groupedRecords.map((group, gIdx) => (
            <div key={gIdx} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
              {/* 卡片標題區 */}
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-4 items-center">
                  <span className="text-blue-800 font-bold text-xl">🕒 時間: {group.time}</span>
                  <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                    抽成: {(group.items[0]?.commission_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => onEditRequest({
                      date: query.date, 
                      location: query.location, 
                      ...group 
                    })
                    }
                    className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    編輯
                  </button>
                  <button 
                    onClick={() => handleDeleteBatch(group)}
                    className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition-colors"
                  >
                    刪除
                  </button>
                </div>
              </div>

              {/* 內容表格：RWD */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-base md:text-lg">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left">品項</th>
                      <th className="p-3 text-right">單價</th> 
                      <th className="p-3 text-right">出貨量</th>
                      <th className="p-3 text-right">回收量</th>
                      <th className="p-3 text-right text-blue-600">出貨金額</th>
                      <th className="p-3 text-right text-red-600">存貨金額</th>
                      <th className="p-3 text-right">應賣</th>
                      <th className="p-3 text-right">差額</th>
                      <th className="p-3 text-right text-emerald-600">營業額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map(item => {
                      const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
                      const formatQty = (val) => isWeight ? `${Math.floor(val/16)}斤${val%16}兩` : `${val}個`;
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{item.product_name}</td>
                          <td className="p-3 text-right text-slate-500">${Number(item.snapshot_retail_price).toLocaleString()}</td>
                          <td className="p-3 text-right text-slate-600">{formatQty(item.purchase_total_units)}</td>
                          <td className="p-3 text-right text-slate-600">{formatQty(item.return_total_units)}</td>
                          <td className="p-3 text-right text-blue-600 font-medium">${item.shipped_value.toLocaleString()}</td>
                          <td className="p-3 text-right text-red-600 font-medium">${item.returned_value.toLocaleString()}</td>
                          <td className="p-3 text-right text-yellow-600 font-bold">${item.net_sales_value.toLocaleString()}</td>
                          <td className="p-3 text-right text-pink-500 font-bold">${Math.round(item.commission_amount).toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-600 font-black text-xl">${Math.round(item.net_revenue).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <tr className="text-lg">
                      <td colSpan={4} className="p-4 text-right text-slate-600">總結：</td>
                      <td className="p-4 text-right text-blue-700">${group.totalShippedValue.toLocaleString()}</td>
                      <td className="p-4 text-right text-red-700">${group.totalReturnValue.toLocaleString()}</td>
                      <td className="p-4 text-right text-yellow-700">${group.totalNetSales.toLocaleString()}</td>
                      <td className="p-4 text-right text-pink-600">${Math.round(group.totalCommission).toLocaleString()}</td>
                      <td className="p-4 text-right text-emerald-700 text-2xl">${Math.round(group.totalRevenue).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default HistoryReport;