import { useState } from 'react';
import DailyTable from './DailyTable';
import ProductAdmin from './ProductAdmin';
import HistoryReport from '../HistoryReport';
import LocationAdmin from './LocationAdmin';

function App() {
  const [view, setView] = useState('daily'); // 'daily', 'admin', 'history'
  const [editData, setEditData] = useState(null);

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

  // 提供給 HistoryReport 呼叫的函式
  const handleEditRequest = (records, date, location, time) => {
    // records 是該時段的所有商品紀錄
    setEditData({
      date: date,
      location: location,
      items: records,
      post_time: time
    });
    setView('daily'); // 自動跳轉回填寫頁面
  };

  return (
    <div style={{ backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      {/* // 導覽列增加按鈕 */}
      <nav style={navStyle}>
        <button style={btnStyle(view === 'daily')} onClick={() => setView('daily')}>📝 填寫日報</button>
        <button style={btnStyle(view === 'history')} onClick={() => setView('history')}>📜 歷史查詢</button>
        <button style={btnStyle(view === 'admin')} onClick={() => setView('admin')}>⚙️ 商品維護</button>
        <button style={btnStyle(view === 'loc_admin')} onClick={() => setView('loc_admin')}>📍 地點維護</button>
      </nav>

      {/* // 內容區域切換 */}
    <main>
        {view === 'daily' && (
          <DailyTable 
            editData={editData} 
            onClearEdit={() => setEditData(null)} 
          />
        )}
        {view === 'history' && (
          <HistoryReport onEditRequest={handleEditRequest} />
        )}
        {view === 'admin' && <ProductAdmin />}
        {view === 'loc_admin' && <LocationAdmin />}
      </main>
    </div>
  );
}

export default App;