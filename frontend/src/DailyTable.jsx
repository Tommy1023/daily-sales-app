import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function DailyTable({ editData, onClearEdit, onSaveSuccess, isEditMode, onCancelEdit }) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [location, setLocation] = useState('');
  const [items, setItems] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const originalItems = useRef([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/locations`);
        setLocationOptions(res.data);
        if (!editData && res.data.length > 0) setLocation(res.data[0].name);
      } catch (err) { console.error("抓取地點失敗", err); }
    };
    fetchLocations();
  }, [editData]);

  useEffect(() => {   
    if (editData && editData.items) {
      if (editData.location) setLocation(editData.location);
      if (editData.date) {
        // 修正日期顯示問題：避免 UTC 跨日少一天
        const d = new Date(editData.date);
        const formattedDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        setDate(formattedDate);
      }
      const formattedItems = (editData.items || []).map(r => {
        const isWeight = r.unit_type === 'weight';
        const pTotal = Number(r.purchase_total_units || 0);
        const sTotal = Number(r.sale_total_units || 0);
        return {
          product_name: r.product_name, unit_type: r.unit_type,
          unit_price: r.snapshot_retail_price || 0, cost_price: r.snapshot_cost_price || 0,
          p_jin: isWeight ? Math.floor(pTotal / 16) : pTotal,
          p_tael: isWeight ? (pTotal % 16) : 0,
          s_jin: isWeight ? Math.floor(sTotal / 16) : sTotal,
          s_tael: isWeight ? (sTotal % 16) : 0
        };
      });
      setItems(formattedItems);
      originalItems.current = JSON.parse(JSON.stringify(formattedItems));
    } else {
      const fetchProducts = async () => {
        try {
          const res = await axios.get(`${API_URL}/api/products`);
          setItems(res.data.map(p => ({
            product_name: p.name, unit_type: p.unit_type || 'weight',
            unit_price: p.retail_price_tael, cost_price: p.cost_price_tael,
            p_jin: '', p_tael: '', s_jin: '', s_tael: ''
          })));
        } catch (err) { console.error("載入失敗", err); }
      };
      fetchProducts();
    }
  }, [editData]);

  const handleSave = async () => {
    if (items.length === 0 || !date || !location || isSaving) return;

    for (let item of items) {
      let p_total = item.unit_type === 'weight' ? (Number(item.p_jin || 0) * 16) + Number(item.p_tael || 0) : Number(item.p_jin || 0);
      let s_total = item.unit_type === 'weight' ? (Number(item.s_jin || 0) * 16) + Number(item.s_tael || 0) : Number(item.s_jin || 0);
      if (s_total > p_total) return alert(`錯誤：【${item.product_name}】銷售大於進貨！`);
    }

    setIsSaving(true);
    try {
      if (editData && editData.post_time) {
        // 核心修正：將參數名從 precise_time 改為 post_time 以對應後端
        await axios.delete(`${API_URL}/api/sales/batch`, {
          params: { date: editData.date, location: editData.location, post_time: editData.post_time }
        });
      }
      const payload = {
        date, location,
        items: items.map(item => ({
          product_name: item.product_name, unit_price: Number(item.unit_price), cost_price: Number(item.cost_price),
          p_jin: Number(item.p_jin), p_tael: Number(item.p_tael), s_jin: Number(item.s_jin), s_tael: Number(item.s_tael), unit_type: item.unit_type
        }))
      };
      await axios.post(`${API_URL}/api/sales/bulk`, payload);
      alert("✅ 儲存成功！");
      onClearEdit();
      onSaveSuccess();
    } catch (err) { alert("❌ 儲存失敗"); } finally { setIsSaving(false); }
  };

  const handleUpdate = (idx, field, val) => {
    const newItems = [...items];
    if (field.includes('tael') && Number(val) >= 16) return alert("兩不可超過 15");
    newItems[idx][field] = val; setItems(newItems);
  };

  const handleReset = () => {
    if (editData) {
      if (window.confirm("還原編輯前狀態？")) setItems(JSON.parse(JSON.stringify(originalItems.current)));
    } else {
      if (window.confirm("重置表格？")) window.location.reload(); 
    }
  };

  const handleCancel = () => {
    onClearEdit();
    onSaveSuccess();
    onCancelEdit();
  }
  
  const getCalc = (item) => {
    const isW = item.unit_type === 'weight';
    const p = isW ? (Number(item.p_jin)*16 + Number(item.p_tael)) : Number(item.p_jin);
    const s = isW ? (Number(item.s_jin)*16 + Number(item.s_tael)) : Number(item.s_jin);
    const rev = s * item.unit_price; const cost = p * item.cost_price;
    return { rev: Math.round(rev), dif: Math.round(cost - rev), com: (rev * 0.1).toFixed(1) };
  };

  const totals = items.reduce((acc, item) => {
    const { rev, dif, com } = getCalc(item);
    acc.totalRevenue += rev; acc.totalDiff += dif; acc.totalCommission += Number(com);
    return acc;
  }, { totalRevenue: 0, totalDiff: 0, totalCommission: 0 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-white">
        <h2 className="text-2xl font-bold">📝 每日營業紀錄編輯</h2> 
        {editData && <span className="bg-orange-500/20 text-orange-400 px-4 py-1 rounded-full animate-pulse">正在編輯歷史紀錄</span>}
      </div>

      <div className="flex flex-wrap gap-4 bg-neutral-800 p-4 rounded-2xl border border-neutral-700">
        <input type="date" className="bg-neutral-900 border rounded-xl px-4 py-2 text-white outline-none" value={date} onChange={e => setDate(e.target.value)} />
        <select className="bg-neutral-900 border rounded-xl px-4 py-2 text-white outline-none" value={location} onChange={e => setLocation(e.target.value)}>
          {locationOptions.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-700 shadow-xl bg-neutral-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-widest border-b border-neutral-700">
              <th className="p-4">品名</th>
              <th className="p-4">零售價</th>
              <th colSpan="2" className="p-4 text-center bg-sky-500/5 text-sky-400">進貨 (斤兩 / 個)</th>
              <th colSpan="2" className="p-4 text-center bg-emerald-500/5 text-emerald-400">銷售 (斤兩 / 個)</th>
              <th className="p-4 text-right">銷售額</th>
              <th className="p-4 text-right">差額</th>
              <th className="p-4 text-right text-sky-400">抽成</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {items.map((item, index) => {
              const { rev, dif, com } = getCalc(item); const isW = item.unit_type === 'weight';
              return (
                <tr key={index} className="hover:bg-white/5 text-white">
                  <td className="p-4 font-bold">{item.product_name}</td><td className="p-4 text-neutral-400">${item.unit_price}</td>
                  {isW ? (
                    <><td className="p-2"><input type="number" className="w-16 bg-neutral-900 border rounded p-1 text-center" value={item.p_jin} onChange={e => handleUpdate(index,'p_jin',e.target.value)} />斤</td><td className="p-2"><input type="number" className="w-16 bg-neutral-900 border rounded p-1 text-center" value={item.p_tael} onChange={e => handleUpdate(index,'p_tael',e.target.value)} />兩</td></>
                  ) : (
                    <td colSpan={2} className="p-2 text-center"><input type="number" className="w-20 bg-neutral-900 border rounded p-1 text-center" value={item.p_jin} onChange={e => handleUpdate(index,'p_jin',e.target.value)} />個</td>
                  )}
                  {isW ? (
                    <><td className="p-2"><input type="number" className="w-16 bg-neutral-900 border rounded p-1 text-center" value={item.s_jin} onChange={e => handleUpdate(index,'s_jin',e.target.value)} />斤</td><td className="p-2"><input type="number" className="w-16 bg-neutral-900 border rounded p-1 text-center" value={item.s_tael} onChange={e => handleUpdate(index,'s_tael',e.target.value)} />兩</td></>
                  ) : (
                    <td colSpan={2} className="p-2 text-center"><input type="number" className="w-20 bg-neutral-900 border rounded p-1 text-center" value={item.s_jin} onChange={e => handleUpdate(index,'s_jin',e.target.value)} />個</td>
                  )}
                  <td className="p-4 text-right text-yellow-400 font-mono">${rev}</td><td className={`p-4 text-right font-mono ${dif >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${dif}</td><td className="p-4 text-right text-sky-400 font-mono">${com}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-900/50 font-bold border-t-2 border-neutral-700 text-white">
            <tr>
              <td colSpan="6" className="p-5 text-right text-neutral-400">總結：</td>
              <td className="p-5 text-right text-yellow-400 text-lg">${totals.totalRevenue.toLocaleString()}</td>
              <td className={`p-5 text-right text-lg ${totals.totalDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${totals.totalDiff.toLocaleString()}</td>
              <td className="p-5 text-right text-sky-400 text-lg">${totals.totalCommission.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end gap-4 mt-8">
        <button onClick={handleReset} className="px-6 py-2.5 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded-xl font-bold border border-neutral-700 transition-all">{ editData ? '還原原始數值': '重置表格'}</button>
        {isEditMode && <button onClick={handleCancel} className="px-6 py-2.5 bg-sky-500 text-neutral-900 rounded-xl font-bold">取消編輯</button>}
        <button onClick={handleSave} className="px-10 py-2.5 bg-green-500 text-neutral-900 rounded-xl font-bold shadow-lg">儲存紀錄</button>
      </div>
    </div>
  );
}

export default DailyTable;