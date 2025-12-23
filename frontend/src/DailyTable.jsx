import { useState, useEffect } from 'react';
import axios from 'axios';

function DailyTable({ editData, onClearEdit }) {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [location, setLocation] = useState('');
  const [items, setItems] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/locations');
        setLocationOptions(res.data);
        if (!editData && res.data.length > 0) {
          setLocation(res.data[0].name);
        }
      } catch (err) {
        console.error("抓取地點失敗", err);
      }
    };
    fetchLocations();
  }, [editData]);

  useEffect(() => {   
    if (editData && editData.items) {
      if (editData.location) setLocation(editData.location);
      if (editData.date) {
        const formattedDate = new Date(editData.date).toISOString().split('T')[0];
        setDate(formattedDate);
      }
      const formattedItems = (editData.items || []).map(r => {
        const isWeight = r.unit_type === 'weight';
        const pTotal = Number(r.purchase_total_units || 0);
        const sTotal = Number(r.sale_total_units || 0);
        return {
          product_name: r.product_name,
          unit_type: r.unit_type,
          unit_price: r.snapshot_retail_price || r.unit_price || 0,
          cost_price: r.snapshot_cost_price || r.cost_price || 0,
          p_jin: isWeight ? Math.floor(pTotal / 16) : pTotal,
          p_tael: isWeight ? (pTotal % 16) : 0,
          s_jin: isWeight ? Math.floor(sTotal / 16) : sTotal,
          s_tael: isWeight ? (sTotal % 16) : 0
        };
      });
      setItems(formattedItems);
    } else {
      const fetchProducts = async () => {
        try {
          const res = await axios.get('http://localhost:3001/api/products');
          const initialRows = res.data.map(p => ({
            product_id: p.id,
            product_name: p.name,
            unit_type: p.unit_type || 'weight',
            unit_price: p.retail_price_tael,
            cost_price: p.cost_price_tael,
            p_jin: '', p_tael: '', 
            s_jin: '', s_tael: ''
          }));
          setItems(initialRows);
        } catch (err) {
          console.error("載入失敗", err);
        }
      };
      fetchProducts();
    }
  }, [editData]);

  const handleUpdate = (index, field, value) => {
    const newItems = [...items];
    const numValue = Number(value);
    if ((field === 'p_tael' || field === 's_tael') && numValue >= 16) {
      alert("「兩」的數值不能超過 15，請增加「斤」的數值。");
      return;
    }
    if (numValue < 0) return;
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSave = async () => {
    if (items.length === 0) return alert("沒有資料可以儲存");
    if (!date || !location) return alert("錯誤：日期或地點丟失");

    for (let item of items) {
      let p_total = item.unit_type === 'weight' ? (Number(item.p_jin || 0) * 16) + Number(item.p_tael || 0) : Number(item.p_jin || 0);
      let s_total = item.unit_type === 'weight' ? (Number(item.s_jin || 0) * 16) + Number(item.s_tael || 0) : Number(item.s_jin || 0);
      if (s_total > p_total) {
        alert(`錯誤：【${item.product_name}】的銷售量大於進貨量！`);
        return;
      }
    }

    try {
      if (editData && editData.post_time) {
        await axios.delete('http://localhost:3001/api/sales/batch', {
          params: { date: editData.date, location: editData.location, post_time: editData.post_time }
        });
      }
      const payload = {
        date: date,
        location: location,
        items: items.map(item => ({
          product_name: item.product_name,
          unit_price: Number(item.unit_price || 0),
          cost_price: Number(item.cost_price || 0),
          p_jin: Number(item.p_jin || 0),
          p_tael: Number(item.p_tael || 0),
          s_jin: Number(item.s_jin || 0),
          s_tael: Number(item.s_tael || 0),
          unit_type: item.unit_type
        }))
      };
      await axios.post('http://localhost:3001/api/sales/bulk', payload);
      alert("✅ 紀錄已更新！");
      if (onClearEdit) onClearEdit();
    } catch (err) {
      alert("❌ 儲存失敗");
    }
  };
  
  const getCalc = (item) => {
    const rPrice = item.unit_price || 0;
    const cPrice = item.cost_price || 0;
    let p_total = item.unit_type === 'weight' ? (Number(item.p_jin || 0) * 16) + Number(item.p_tael || 0) : Number(item.p_jin || 0);
    let s_total = item.unit_type === 'weight' ? (Number(item.s_jin || 0) * 16) + Number(item.s_tael || 0) : Number(item.s_jin || 0);
    const cost = p_total * cPrice;
    const revenue = s_total * rPrice;
    return { rev: Math.round(revenue), dif: Math.round(cost - revenue), com: (revenue * 0.1).toFixed(1) };
  };

  const totals = items.reduce((acc, item) => {
    const { rev, dif, com } = getCalc(item);
    acc.totalRevenue += rev;
    acc.totalDiff += dif;
    acc.totalCommission += Number(com);
    return acc;
  }, { totalRevenue: 0, totalDiff: 0, totalCommission: 0 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
          <span className="text-sky-400 font-mono">📝 每日營業紀錄編輯</span> 
        </h2>
        {editData && <span className="bg-orange-500/20 text-orange-400 px-4 py-1 rounded-full text-sm border border-orange-500/30 animate-pulse">⚠️ 正在編輯歷史紀錄</span>}
      </div>

      <div className="flex flex-wrap gap-4 bg-neutral-800 p-4 rounded-2xl border border-neutral-700">
        <input type="date" className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500" value={date} onChange={e => setDate(e.target.value)} />
        <select className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-sky-500" value={location} onChange={e => setLocation(e.target.value)}>
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
              const { rev, dif, com } = getCalc(item);
              const isWeight = item.unit_type === 'weight';
              return (
                <tr key={index} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 font-bold">{item.product_name}</td>
                  <td className="p-4 text-neutral-400">${item.unit_price}</td>
                  {isWeight ? (
                    <>
                      <td className="p-2 pl-4"><input type="number" className="w-16 bg-neutral-900 border border-neutral-700 rounded p-1 text-center outline-none focus:border-sky-500" value={item.p_jin} onChange={(e) => handleUpdate(index, 'p_jin', e.target.value)} /> <span className="text-xs text-neutral-500">斤</span></td>
                      <td className="p-2"><input type="number" className="w-16 bg-neutral-900 border border-neutral-700 rounded p-1 text-center outline-none focus:border-sky-500" value={item.p_tael} onChange={(e) => handleUpdate(index, 'p_tael', e.target.value)} /> <span className="text-xs text-neutral-500">兩</span></td>
                    </>
                  ) : (
                    <td colSpan={2} className="p-2 text-center"><input type="number" className="w-20 bg-neutral-900 border border-neutral-600 rounded p-1 text-center outline-none focus:border-sky-500" value={item.p_jin} onChange={(e) => handleUpdate(index, 'p_jin', e.target.value)} /> <span className="text-xs text-neutral-500">個</span></td>
                  )}
                  {isWeight ? (
                    <>
                      <td className="p-2 pl-4"><input type="number" className="w-16 bg-neutral-900 border border-neutral-700 rounded p-1 text-center outline-none focus:border-emerald-500" value={item.s_jin} onChange={(e) => handleUpdate(index, 's_jin', e.target.value)} /> <span className="text-xs text-neutral-500">斤</span></td>
                      <td className="p-2"><input type="number" className="w-16 bg-neutral-900 border border-neutral-700 rounded p-1 text-center outline-none focus:border-emerald-500" value={item.s_tael} onChange={(e) => handleUpdate(index, 's_tael', e.target.value)} /> <span className="text-xs text-neutral-500">兩</span></td>
                    </>
                  ) : (
                    <td colSpan={2} className="p-2 text-center"><input type="number" className="w-20 bg-neutral-900 border border-neutral-600 rounded p-1 text-center outline-none focus:border-emerald-500" value={item.s_jin} onChange={(e) => handleUpdate(index, 's_jin', e.target.value)} /> <span className="text-xs text-neutral-500">個</span></td>
                  )}
                  <td className="p-4 text-right font-bold text-yellow-400 font-mono">${rev}</td>
                  <td className={`p-4 text-right font-bold font-mono ${dif >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${dif}</td>
                  <td className="p-4 text-right text-sky-400 font-mono">${com}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-neutral-900/50 font-bold border-t-2 border-neutral-700">
            <tr>
              <td colSpan="6" className="p-5 text-right text-neutral-400">今日總結：</td>
              <td className="p-5 text-right text-yellow-400 text-lg">${totals.totalRevenue.toLocaleString()}</td>
              <td className={`p-5 text-right text-lg ${totals.totalDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>${totals.totalDiff.toLocaleString()}</td>
              <td className="p-5 text-right text-sky-400 text-lg">${totals.totalCommission.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end gap-4 mt-8">
        <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded-xl font-bold border border-neutral-700 transition-all">重置表格</button>
        <button onClick={handleSave} className="px-10 py-2.5 bg-sky-500 text-neutral-900 hover:bg-sky-400 rounded-xl font-bold shadow-lg shadow-sky-500/20 transition-all transform active:scale-95">儲存紀錄</button>
      </div>
    </div>
  );
}

export default DailyTable;