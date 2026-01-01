import { useState, useEffect } from 'react';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function ProductAdmin() {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newP, setNewP] = useState({ name: '', price: '', type: 'weight' });

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/products`);
      setProducts(res.data);
    } catch (err) { console.error("載入失敗", err); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts();
  });

  const handleAdd = async () => {
    if (!newP.name || !newP.price) return alert("請填寫完整資訊");
    try {
      await axios.post(`${API_URL}/api/products`, {
        name: newP.name,
        cost_price_tael: 0,
        retail_price_tael: newP.price, 
        unit_type: newP.type
      });
      setNewP({ name: '', price: '', type: 'weight' });
      fetchProducts();
      alert("新增成功！");
    // eslint-disable-next-line no-unused-vars
    } catch (err) { alert("新增失敗"); }
  };

  const handleSave = async (p) => {
    try {
      await axios.put(`${API_URL}/api/products/${p.id}`, p);
      setEditingId(null);
      alert("更新成功");
    // eslint-disable-next-line no-unused-vars
    } catch (err) { alert("更新失敗"); }
  };

  const handleCancel = async () => {
    setEditingId(null);
    fetchProducts();
  };

  const handleDel = async (id) => {
    if (!window.confirm("確定要刪除這項商品嗎？")) return;
    try {
      await axios.delete(`${API_URL}/api/products/${id}`);
      fetchProducts();
    // eslint-disable-next-line no-unused-vars
    } catch (err) { alert("刪除失敗"); }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h3 className="text-3xl font-bold text-slate-800 border-l-8 border-blue-500 pl-4">⚙️ 商品資料維護</h3>

      {/* 新增商品區：卡片式設計 */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-lg">
        <h4 className="text-slate-500 font-bold mb-4 uppercase text-sm tracking-widest">➕ 新增品項</h4>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
             <label className="block text-sm font-bold text-slate-600 mb-1">品名</label>
             <input className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="例如：紅豆餅" value={newP.name} onChange={e => setNewP({...newP, name: e.target.value})} />
          </div>
          <div className="w-32">
             <label className="block text-sm font-bold text-slate-600 mb-1">單價</label>
             <input type="number" className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              placeholder="$" value={newP.price} onChange={e => setNewP({...newP, price: e.target.value})} />
          </div>
          <div className="w-32">
             <label className="block text-sm font-bold text-slate-600 mb-1">單位</label>
             <select className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              value={newP.type} onChange={e => setNewP({...newP, type: e.target.value})}>
              <option value="weight">斤兩</option>
              <option value="count">個數</option>
             </select>
          </div>
          <button className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-3.5 rounded-xl text-lg shadow-lg active:scale-95 transition-all w-full md:w-auto" onClick={handleAdd}>加入</button>
        </div>
      </div>

      {/* 商品列表 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl bg-white">
        <table className="w-full text-center">
          <thead className="bg-slate-100 text-slate-600 text-sm md:text-base font-bold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-4 px-2">品名</th>
              <th className="py-4 px-2">單價 (零售)</th>
              <th className="py-4 px-2">單位</th>
              <th className="py-4 px-2">管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group text-lg">
                <td className="p-4">
                  {editingId === p.id ? 
                    <input className="bg-white border-2 border-blue-400 rounded px-3 py-2 outline-none w-full text-slate-900" value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} /> 
                    : <span className="font-bold text-slate-800">{p.name}</span>}
                </td>
                <td className="p-4">
                  {editingId === p.id ? 
                    <input type="number" className="bg-white border-2 border-blue-400 rounded px-3 py-2 w-24 outline-none text-slate-900" value={p.retail_price_tael} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, retail_price_tael: e.target.value} : x))} /> 
                    : <span className="font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-full">${p.retail_price_tael}</span>}
                </td>
                <td className="p-4">
                  {editingId === p.id ? (
                    <select className="bg-white border-2 border-blue-400 rounded px-2 py-2 outline-none text-base text-slate-900" value={p.unit_type} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, unit_type: e.target.value} : x))}>
                      <option value="weight">斤兩</option>
                      <option value="count">個數</option>
                    </select>
                  ) : <span className={`text-base px-3 py-1 rounded-full ${p.unit_type === 'weight' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{p.unit_type === 'weight' ? '斤兩' : '個數'}</span>}
                </td>
                <td className="text-center p-4">
                  <div className="flex justify-center gap-2">
                    {editingId === p.id ? 
                      <>
                        <button className="bg-green-100 text-green-700 hover:bg-green-200 font-bold px-4 py-2 rounded-lg" onClick={() => handleSave(p)}>儲存</button>
                        <button className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold px-4 py-2 rounded-lg" onClick={() => handleCancel(p)}>取消</button>
                      </>
                      : (
                        <>
                          <button className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold px-4 py-2 rounded-lg" onClick={() => setEditingId(p.id)}>編輯</button>
                          <button className="bg-red-50 text-red-600 hover:bg-red-100 font-bold px-4 py-2 rounded-lg" onClick={() => handleDel(p.id)}>刪除</button>
                        </>
                      )
                    }
                  </div>
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