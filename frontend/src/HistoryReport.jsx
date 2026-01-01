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
    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 text-neutral-200">
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">日期</label>
          <input 
            type="date" 
            value={query.date} 
            onChange={e => setQuery({...query, date: e.target.value})}
            className="block bg-neutral-800 border border-neutral-700 rounded p-2 text-white" 
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500 mb-1">地點</label>
          <select 
            value={query.location}
            onChange={e => setQuery({...query, location: e.target.value})}
            className="block bg-neutral-800 border border-neutral-700 rounded p-2 w-32 text-white"
          >
            <option value="" disabled>請選擇地點</option>
            {locationOptions.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <button 
            onClick={handleSearch}
            className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded shadow-lg transition-all"
          >
            查詢
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {groupedRecords.length === 0 ? (
          <div className="text-center text-neutral-500 py-10">查無資料</div>
        ) : (
          groupedRecords.map((group, gIdx) => (
            <div key={gIdx} className="bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800">
              <div className="bg-neutral-800 p-3 flex justify-between items-center">
                <div className="flex gap-4 items-center">
                  <span className="text-emerald-400 font-bold text-lg">時間: {group.time}</span>
                  <span className="text-xs text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                    抽成: {(group.items[0]?.commission_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEditRequest({
                      date: query.date, 
                      location: query.location, 
                      ...group 
                    })
                    }
                    className="px-3 py-1 bg-blue-900/50 text-blue-200 text-sm rounded hover:bg-blue-800"
                  >
                    編輯
                  </button>
                  <button 
                    onClick={() => handleDeleteBatch(group)}
                    className="px-3 py-1 bg-red-900/50 text-red-200 text-sm rounded hover:bg-red-800"
                  >
                    刪除
                  </button>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-neutral-500">
                  <tr>
                    <th className="p-2 text-left">品項</th>
                    {/* 🟢 修正 2：新增單價欄位標題 */}
                    <th className="p-2 text-right">單價</th> 
                    <th className="p-2 text-right">出貨量</th>
                    <th className="p-2 text-right">回收量</th>
                    <th className="p-2 text-right text-blue-300">出貨金額</th>
                    <th className="p-2 text-right text-red-300">存貨金額</th>
                    <th className="p-2 text-right">應賣</th>
                    <th className="p-2 text-right">差額</th>
                    <th className="p-2 text-right text-emerald-400">營業額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {group.items.map(item => {
                    const isWeight = item.unit_type === 'weight' || item.unit_type === '兩';
                    const formatQty = (val) => isWeight ? `${Math.floor(val/16)}斤${val%16}兩` : `${val}個`;
                    
                    return (
                      <tr key={item.id} className="hover:bg-neutral-900">
                        <td className="p-2">{item.product_name}</td>
                        {/* 🟢 修正 2：顯示單價資料 */}
                        <td className="p-2 text-right text-neutral-400">${Number(item.snapshot_retail_price).toLocaleString()}</td>
                        <td className="p-2 text-right text-neutral-400">{formatQty(item.purchase_total_units)}</td>
                        <td className="p-2 text-right text-neutral-400">{formatQty(item.return_total_units)}</td>
                        <td className="p-2 text-right text-blue-300/80">${item.shipped_value.toLocaleString()}</td>
                        <td className="p-2 text-right text-red-300/80">${item.returned_value.toLocaleString()}</td>
                        <td className="p-2 text-right text-yellow-100/60">${item.net_sales_value.toLocaleString()}</td>
                        <td className="p-2 text-right text-pink-300/60">${Math.round(item.commission_amount).toLocaleString()}</td>
                        <td className="p-2 text-right text-emerald-400 font-bold">${Math.round(item.net_revenue).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-neutral-900 font-bold border-t border-neutral-700">
                  <tr>
                    <td colSpan={4} className="p-3 text-right">總結：</td>
                    <td className="p-3 text-right text-blue-400">${group.totalShippedValue.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-400">${group.totalReturnValue.toLocaleString()}</td>
                    <td className="p-3 text-right text-yellow-400">${group.totalNetSales.toLocaleString()}</td>
                    <td className="p-3 text-right text-pink-400">${Math.round(group.totalCommission).toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-400 text-lg">${Math.round(group.totalRevenue).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default HistoryReport;