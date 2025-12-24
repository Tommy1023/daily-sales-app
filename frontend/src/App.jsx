import { useState } from 'react';
import DailyTable from './DailyTable';
import ProductAdmin from './ProductAdmin';
import HistoryReport from '../HistoryReport';
import LocationAdmin from './LocationAdmin';

function App() {
  const [view, setView] = useState('daily');
  const [editData, setEditData] = useState(null);
  const [historyQuery, setHistoryQuery] = useState(null);

  const handleEditRequest = (records, date, location, time) => {
    setEditData({
      date: date,
      location: location,
      items: records,
      post_time: time
    });
    setHistoryQuery({ date, location });
    setView('daily');
  };

  const handleSaveSuccess = () => {
    setEditData(null);
    setView('history'); // 儲存後自動跳轉
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans">
      {/* 導覽列 */}
      <nav className="bg-neutral-800 border-b border-neutral-700 p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-3">
          {[
            { id: 'daily', label: '📝 填寫日報' },
            { id: 'history', label: '📜 歷史查詢' },
            { id: 'admin', label: '⚙️ 商品維護' },
            { id: 'loc_admin', label: '📍 地點維護' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                if (item.id !== 'daily') setEditData(null);
              }}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all transform active:scale-95 ${
                view === item.id 
                ? 'bg-sky-500 text-neutral-900 shadow-lg shadow-sky-500/20' 
                : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 內容區域 */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
        {view === 'daily' && (
          <DailyTable 
            editData={editData} 
            onSaveSuccess={handleSaveSuccess}
            onClearEdit={() => setEditData(null)} 
          />
        )}
        {view === 'history' && (
          <HistoryReport
            onEditRequest={handleEditRequest}
            initialQuery={historyQuery}
          />
        )}
        {view === 'admin' && <ProductAdmin />}
        {view === 'loc_admin' && <LocationAdmin />}
      </main>
    </div>
  );
}

export default App;