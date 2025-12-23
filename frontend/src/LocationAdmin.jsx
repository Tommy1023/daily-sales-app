import { useState, useEffect } from 'react';
import axios from 'axios';

const styles = {
  container: { padding: '30px', backgroundColor: '#1a1a1a', color: '#e0e0e0', minHeight: '100vh' },
  input: { backgroundColor: '#333', color: '#fff', border: '1px solid #555', padding: '10px', borderRadius: '4px', width: '250px' },
  addBtn: { backgroundColor: '#4fc3f7', color: '#000', border: 'none', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px' },
  table: { width: '100%', marginTop: '20px', borderCollapse: 'collapse' },
  td: { padding: '12px', borderBottom: '1px solid #333' },
  delBtn: { backgroundColor: '#ef5350', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }
};

function LocationAdmin() {
  const [locations, setLocations] = useState([]);
  const [newName, setNewName] = useState('');

  // 取得最新地點列表
  const fetchLocations = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/locations');
      setLocations(res.data);
    } catch (err) {
      console.error("載入地點失敗", err);
    }
  };

  useEffect(() => { fetchLocations(); }, []);

  // 新增地點
  const handleAdd = async () => {
    if (!newName.trim()) return alert("請輸入地點名稱");
    try {
      await axios.post('http://localhost:3001/api/locations', { name: newName });
      setNewName('');
      fetchLocations();
    } catch (err) {
      alert("新增失敗，可能名稱重複");
    }
  };

  // 刪除地點
  const handleDelete = async (id, name) => {
    if (!window.confirm(`確定要刪除「${name}」嗎？\n注意：如果該地點已有歷史紀錄，可能會刪除失敗。`)) return;
    try {
      await axios.delete(`http://localhost:3001/api/locations/${id}`);
      fetchLocations(); // 重新整理
    } catch (err) {
      alert("刪除失敗：該地點可能正在被歷史紀錄使用中。");
    }
  };

  return (
    <div style={styles.container}>
      <h2>📍 地點維護管理</h2>
      
      <div style={{ marginBottom: '30px', backgroundColor: '#252525', padding: '20px', borderRadius: '8px' }}>
        <input 
          style={styles.input}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="例如：淡水市場"
        />
        <button style={styles.addBtn} onClick={handleAdd}>➕ 新增地點</button>
      </div>

      <table style={styles.table}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#888' }}>
            <th style={{ padding: '10px' }}>地點名稱</th>
            <th style={{ padding: '10px', textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {locations.map(loc => (
            <tr key={loc.id}>
              <td style={styles.td}>{loc.name}</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                <button 
                  style={styles.delBtn} 
                  onClick={() => handleDelete(loc.id, loc.name)}
                >
                  🗑️ 刪除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LocationAdmin;