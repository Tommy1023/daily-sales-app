import { useState, useEffect } from 'react';
import axios from 'axios';

const styles = {
  container: { padding: '20px' },
  addBox: { backgroundColor: '#333', padding: '20px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #444' },
  table: { width: '100%', borderCollapse: 'collapse', color: '#fff' },
  th: { backgroundColor: '#444', padding: '12px', border: '1px solid #666' },
  td: { padding: '10px', border: '1px solid #444', textAlign: 'center' },
  input: { backgroundColor: '#222', color: '#fff', border: '1px solid #555', padding: '8px', borderRadius: '4px', marginRight: '10px' },
  btnEdit: { backgroundColor: '#0288d1', color: 'white', border: 'none', padding: '5px 12px', cursor: 'pointer', borderRadius: '4px' },
  btnSave: { backgroundColor: '#2e7d32', color: 'white', border: 'none', padding: '5px 12px', cursor: 'pointer', borderRadius: '4px' },
  btnDel: { backgroundColor: '#d32f2f', color: 'white', border: 'none', padding: '5px 12px', cursor: 'pointer', borderRadius: '4px', marginLeft: '5px' },
  btnAdd: { backgroundColor: '#ff9800', color: 'white', border: 'none', padding: '8px 20px', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }
};

function ProductAdmin() {
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  
  // 新增商品的暫存狀態
  const [newP, setNewP] = useState({ name: '', cost: '', retail: '', type: 'weight' });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const res = await axios.get('http://localhost:3001/api/products');
    setProducts(res.data);
  };

  // --- 核心功能：新增 ---
  const handleAdd = async () => {
    if (!newP.name || !newP.cost || !newP.retail) return alert("請填寫完整資訊");
    try {
      await axios.post('http://localhost:3001/api/products', {
        name: newP.name,
        cost_price_tael: newP.cost,
        retail_price_tael: newP.retail,
        unit_type: newP.type
      });
      setNewP({ name: '', cost: '', retail: '', type: 'weight' }); // 清空
      fetchProducts(); // 重新整理
      alert("新增成功！");
    } catch (err) { alert("新增失敗"); }
  };

  // --- 核心功能：更新 ---
  const handleSave = async (p) => {
    try {
      await axios.put(`http://localhost:3001/api/products/${p.id}`, p);
      setEditingId(null);
      alert("更新成功");
    } catch (err) { alert("更新失敗"); }
  };

  // --- 核心功能：刪除 ---
  const handleDel = async (id) => {
    if (!window.confirm("確定要刪除這項商品嗎？這將影響歷史紀錄顯示。")) return;
    try {
      await axios.delete(`http://localhost:3001/api/products/${id}`);
      fetchProducts();
    } catch (err) { alert("刪除失敗"); }
  };

  return (
    <div style={styles.container}>
      <h3 style={{ color: '#4fc3f7' }}>⚙️ 商品資料維護</h3>

      {/* 1. 新增商品區 */}
      <div style={styles.addBox}>
        <h4 style={{ marginTop: 0 }}>➕ 新增品項</h4>
        <input placeholder="品名" style={styles.input} value={newP.name} onChange={e => setNewP({...newP, name: e.target.value})} />
        <input type="number" placeholder="進價" style={{...styles.input, width: '80px'}} value={newP.cost} onChange={e => setNewP({...newP, cost: e.target.value})} />
        <input type="number" placeholder="零售價" style={{...styles.input, width: '80px'}} value={newP.retail} onChange={e => setNewP({...newP, retail: e.target.value})} />
        <select style={styles.input} value={newP.type} onChange={e => setNewP({...newP, type: e.target.value})}>
          <option value="weight">斤兩</option>
          <option value="count">個數</option>
        </select>
        <button style={styles.btnAdd} onClick={handleAdd}>加入清單</button>
      </div>

      {/* 2. 商品列表區 */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>品名</th>
            <th style={styles.th}>進價</th>
            <th style={styles.th}>零售價</th>
            <th style={styles.th}>單位</th>
            <th style={styles.th}>管理</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td style={styles.td}>
                {editingId === p.id ? 
                  <input style={styles.input} value={p.name} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, name: e.target.value} : x))} /> 
                  : p.name}
              </td>
              <td style={styles.td}>
                {editingId === p.id ? 
                  <input type="number" style={{...styles.input, width: '60px'}} value={p.cost_price_tael} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, cost_price_tael: e.target.value} : x))} /> 
                  : p.cost_price_tael}
              </td>
              <td style={styles.td}>
                {editingId === p.id ? 
                  <input type="number" style={{...styles.input, width: '60px'}} value={p.retail_price_tael} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, retail_price_tael: e.target.value} : x))} /> 
                  : p.retail_price_tael}
              </td>
              <td style={styles.td}>
                {editingId === p.id ? (
                  <select style={styles.input} value={p.unit_type} onChange={e => setProducts(products.map(x => x.id === p.id ? {...x, unit_type: e.target.value} : x))}>
                    <option value="weight">斤兩</option>
                    <option value="count">個數</option>
                  </select>
                ) : (p.unit_type === 'weight' ? '斤兩' : '個數')}
              </td>
              <td style={styles.td}>
                {editingId === p.id ? 
                  <button style={styles.btnSave} onClick={() => handleSave(p)}>儲存</button>
                  : (
                    <>
                      <button style={styles.btnEdit} onClick={() => setEditingId(p.id)}>編輯</button>
                      <button style={styles.btnDel} onClick={() => handleDel(p.id)}>刪除</button>
                    </>
                  )
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProductAdmin;