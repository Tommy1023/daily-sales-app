import { useState } from 'react';
import DailyTable from './DailyTable';
import ProductAdmin from './ProductAdmin';
import HistoryReport from './HistoryReport';
import LocationAdmin from './LocationAdmin';

function App() {
  const [view, setView] = useState('daily');
  const [editData, setEditData] = useState(null);
  const [historyQuery, setHistoryQuery] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const handleEditRequest = (groupData) => {
    setEditData({
      date: groupData.date,
      location: groupData.location,
      items: groupData.items,
      post_time: groupData.time,
      created_at: groupData.created_at
    });

    setHistoryQuery({
      date: groupData.date,
      location: groupData.location
    });
    setIsEditMode(true)
    setView('daily');
  };

  const handleSaveSuccess = () => {
    setEditData(null)
    setView('history');
  };

  const handleClearEdit = () => {
    setEditData(null);
    setIsEditMode(false)
    setView('history');
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* 導覽列：手機版 2x2 Grid，電腦版 Flex */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto p-2 md:p-4">
          {/* 🟢 修改重點：grid grid-cols-2 (手機) vs md:flex (電腦) */}
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-nowrap md:gap-4 md:overflow-x-auto pb-1">
            {[
              { id: 'daily', label: '📝 填寫日報' },
              { id: 'history', label: '📜 歷史查詢' },
              { id: 'admin', label: '⚙️ 商品維護' },
              { id: 'loc_admin', label: '📍 地點維護' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === view) return;
                  setView(item.id);
                  if (item.id !== 'daily' && !isEditMode) setEditData(null);
                  if (item.id === 'history' && editData) {
                    setHistoryQuery({
                      date: editData.date,
                      location: editData.location
                    })
                  }
                }}
                className={`flex-shrink-0 px-4 py-3 md:px-6 md:py-3 rounded-lg font-bold text-lg transition-all ${
                  view === item.id 
                  ? 'bg-orange-500 text-slate-600 shadow-lg ring-2 ring-blue-300' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-20">
        {view === 'daily' && (
          <DailyTable 
            key={editData ? `edit-${editData.post_time}` : 'new-daily'}
            editData={editData} 
            onSaveSuccess={handleSaveSuccess}
            onClearEdit={handleClearEdit}
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