import { useState } from 'react';
import DailyTable from './DailyTable';
import ProductAdmin from './ProductAdmin';

function App() {
  const [view, setView] = useState('daily'); // 'daily' 或 'admin'

  const navStyle = {
    display: 'flex',
    gap: '10px',
    padding: '20px',
    backgroundColor: '#333',
    borderBottom: '1px solid #444'
  };

  const btnStyle = (active) => ({
    padding: '10px 20px',
    backgroundColor: active ? '#4fc3f7' : '#555',
    color: active ? '#000' : '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  });

  return (
    <div style={{ backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* 導覽列 */}
      <nav style={navStyle}>
        <button style={btnStyle(view === 'daily')} onClick={() => setView('daily')}>📝 填寫日報</button>
        <button style={btnStyle(view === 'admin')} onClick={() => setView('admin')}>⚙️ 商品維護</button>
      </nav>

      {/* 內容區域 */}
      {view === 'daily' ? <DailyTable /> : <ProductAdmin />}
    </div>
  );
}

export default App;