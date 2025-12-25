import { useState, useEffect } from 'react';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ProductAdmin() {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newP, setNewP] = useState({ name: '', cost: '', retail: '', type: 'weight' });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/products`);
      setProducts(res.data);
    } catch (err) { console.error("載入失敗", err); }
  };

  const handleAdd = async () => {
    if (!newP.name || !newP.cost || !newP.retail) return alert("請填寫完整資訊");
    try {
      await axios.post(`${API_URL}/api/products`, {
        name: newP.name,
        cost_price_tael: newP.cost,
        retail_price_tael: newP.retail,
        unit_type: newP.type
      });
      setNewP({ name: '', cost: '', retail: '', type: 'weight' });
      fetchProducts();
      alert("新增成功！");
    } catch (err) { alert("新增失敗"); }
  };

  const handleSave = async (p) => {
    try {
      await axios.put(`${API_URL}/api/products/${p.id}`, p);
      setEditingId(null);
      alert("更新成功");
    } catch (err) { alert("更新失敗"); }
  };

  const handleCancel = async (p) => {
    setEditingId(null);
  };

  const handleDel = async (id) => {
    if (!window.confirm("確定要刪除這項商品嗎？")) return;
    try {
      await axios.delete(`${API_URL}/api/products/${id}`);
      fetchProducts();
    } catch (err) { alert("刪除失敗"); }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-2xl font-bold text-sky-400">⚙️ 商品資料維護</h3>

      {/* 新增商品區 */}
      <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700 shadow-xl">
        <h4 className="text-neutral-400 font-bold mb-4 uppercase text-xs tracking-widest">➕ 新增品項</h4>
        <div className="flex flex-wrap gap-4">
          <input className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 flex-1 min-w-[200px] outline-none focus:ring-2 focus:ring-sky-500" placeholder="品名" value={newP.name} onChange={e => setNewP({...newP, name: e.target.value})} />
          <input type="number" className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 w-28 outline-none focus:ring-2 focus:ring-sky-500" placeholder="進價" value={newP.cost} onChange={e => setNewP({...newP, cost: e.target.value})} />
          <input type="number" className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 w-28 outline-none focus:ring-2 focus:ring-sky-500" placeholder="零售價" value={newP.retail} onChange={e => setNewP({...newP, retail: e.target.value})} />
          <select className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500" value={newP.type} onChange={e => setNewP({...newP, type: e.target.value})}>
            <option value="weight">斤兩</option>
            <option value="count">個數</option>
          </select>
          <button className="bg-orange-500 hover:bg-orange-400 text-neutral-900 font-bold px-8 py-2 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-95" onClick={handleAdd}>加入清單</button>
        </div>
      </div>

      {/* 商品列表 */}
      <div className="overflow-hidden rounded-2xl border border-neutral-700 shadow-xl bg-neutral-800">
        <table className="w-full text-left">
          <thead className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-widest">
            <tr>
              <th className="p-4">品名</th>
              <th className="p-4">進價</th>
              <th className="p-4">零售價</th>
              <th className="p-4">單位</th>
              <th className="p-4 text-right">管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                <td className="p-4">
                  {editingId === p.id ? 
                    <input className="bg-neutral-900 border border-sky-500 rounded px-3 py-1 outline-none w-full" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} /> 
                    : <span className="font-bold text-white">{p.name}</span>}
                </td>
                <td className="p-4">
                  {editingId === p.id ? 
                    <input type="number" className="bg-neutral-900 border border-sky-500 rounded px-2 py-1 w-20 outline-none" value={p.cost_price_tael} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, cost_price_tael: e.target.value} : x))} /> 
                    : <span className="font-mono text-neutral-400">${p.cost_price_tael}</span>}
                </td>
                <td className="p-4">
                  {editingId === p.id ? 
                    <input type="number" className="bg-neutral-900 border border-sky-500 rounded px-2 py-1 w-20 outline-none" value={p.retail_price_tael} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, retail_price_tael: e.target.value} : x))} /> 
                    : <span className="font-mono text-white">${p.retail_price_tael}</span>}
                </td>
                <td className="p-4">
                  {editingId === p.id ? (
                    <select className="bg-neutral-900 border border-sky-500 rounded px-2 py-1 outline-none text-sm" value={p.unit_type} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, unit_type: e.target.value} : x))}>
                      <option value="weight">斤兩</option>
                      <option value="count">個數</option>
                    </select>
                  ) : <span className="text-xs px-2 py-1 bg-neutral-700 rounded text-neutral-300">{p.unit_type === 'weight' ? '斤兩' : '個數'}</span>}
                </td>
                <td className="p-4 text-right space-x-2">
                  {editingId === p.id ? 
                    <>
                      <button className="text-green-400 hover:text-green-300 font-bold text-sm px-2 py-1 transition-colors" onClick={() => handleSave(p)}>儲存</button>
                      <button className="text-neutral-200 hover:text-neutral-300 font-bold text-sm px-2 py-1 transition-colors" onClick={() => handleCancel(p)}>取消</button>
                    </>
                    : (
                      <>
                        <button className="text-sky-400 hover:text-sky-300 font-bold text-sm px-2 py-1 transition-colors" onClick={() => setEditingId(p.id)}>編輯</button>
                        <button className="text-red-500 hover:text-red-400 font-bold text-sm px-2 py-1 transition-colors" onClick={() => handleDel(p.id)}>刪除</button>
                      </>
                    )
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductAdmin;