import { useState, useEffect } from 'react';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function LocationAdmin() {
  const [locations, setLocations] = useState([]);
  const [newName, setNewName] = useState('');

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/locations`);
      setLocations(res.data);
    } catch (err) { console.error("載入地點失敗", err); }
  };

  useEffect(() => { 
    const init = async () => { await fetchLocations(); };
    init();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return alert("請輸入地點名稱");
    try {
      await axios.post(`${API_URL}/api/locations`, { name: newName });
      setNewName('');
      fetchLocations();
    } catch (err) {
      console.log("ErrorMsg:", err);
      alert("新增失敗");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`確定要刪除「${name}」嗎？`)) return;
    try {
      await axios.delete(`${API_URL}/api/locations/${id}`);
      fetchLocations();
    } catch (err) {
      console.log("ErrorMsg:", err);
      alert("刪除失敗");
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* 標題區：統一風格，加上強調邊框 */}
      <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3 border-l-8 border-emerald-500 pl-4">
        <span>📍 地點維護管理</span> 
      </h2>
      
      {/* 新增區塊：卡片式設計，輸入框加大 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row gap-4">
        <input 
          className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-xl text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400 transition-all"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="例如：淡水市場"
        />
        <button 
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl text-lg transition-all shadow-lg shadow-emerald-600/20 active:scale-95 whitespace-nowrap" 
          onClick={handleAdd}
        >
          ➕ 新增地點
        </button>
      </div>

      {/* 列表區塊：改為 Grid 排版，卡片更清晰 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map(loc => (
          <div key={loc.id} className="bg-white border-2 border-slate-200 p-5 rounded-xl flex justify-between items-center shadow-sm hover:shadow-md hover:border-emerald-400 transition-all">
            <span className="text-slate-800 font-bold text-xl">{loc.name}</span>
            {/* 刪除按鈕改為常駐顯示，方便手機操作 */}
            <button 
              className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors text-base font-bold border border-red-100"
              onClick={() => handleDelete(loc.id, loc.name)}
            >
              🗑️ 刪除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LocationAdmin;