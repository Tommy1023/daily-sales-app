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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const navItems = [
    { id: 'daily', label: '📝 填寫日報' },
    { id: 'history', label: '📜 歷史查詢' },
    { id: 'admin', label: '⚙️ 商品維護' },
    { id: 'loc_admin', label: '📍 地點維護' }
  ];


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
     <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo 或標題 (可以留空或放 App 名稱) */}
            <div className="text-xl font-bold text-slate-700">
               市場帳務系統
            </div>

            {/* 🟢 手機版漢堡按鈕 (md:hidden) */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-600 hover:text-blue-600 focus:outline-none p-2"
              >
                {/* 簡單的漢堡 icon SVG */}
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

            {/* 🟢 電腦版導覽 (hidden md:flex) */}
            <div className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === view) return;
                    setView(item.id);
                    if (item.id !== 'daily' && !isEditMode) setEditData(null);
                    if (item.id === 'history' && editData) {
                      setHistoryQuery({ date: editData.date, location: editData.location });
                    }
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-lg transition-all ${
                    view === item.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 🟢 手機版下拉選單 (md:hidden) */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 shadow-lg">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === view) {
                      setIsMenuOpen(false); // 點擊當前頁面也要收合
                      return;
                    }
                    setView(item.id);
                    if (item.id !== 'daily' && !isEditMode) setEditData(null);
                    if (item.id === 'history' && editData) {
                      setHistoryQuery({ date: editData.date, location: editData.location });
                    }
                    setIsMenuOpen(false); // 點擊後收合選單
                  }}
                  className={`block w-full text-left px-4 py-4 rounded-lg font-bold text-lg transition-all ${
                    view === item.id 
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                    : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
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