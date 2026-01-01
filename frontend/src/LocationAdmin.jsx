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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLocations(); }, []);

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
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <span className="text-emerald-500">📍 地點維護管理</span> 
      </h2>
      
      <div className="bg-neutral-800 p-3 rounded-2xl border border-neutral-700 shadow-xl flex gap-4">
        <input 
          className="bg-neutral-900 border border-neutral-700 rounded-xl px-1 py-2 flex-1 outline-none focus:ring-2 focus:ring-emerald-500 text-white"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="例如：淡水市場"
        />
        <button className="bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-bold px-3 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95" onClick={handleAdd}>➕ 新增地點</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map(loc => (
          <div key={loc.id} className="bg-neutral-800 border border-neutral-700 p-4 rounded-2xl flex justify-between items-center group hover:border-emerald-500/50 transition-all shadow-md">
            <span className="text-white font-bold">{loc.name}</span>
            <button 
              className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all text-xs font-bold"
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