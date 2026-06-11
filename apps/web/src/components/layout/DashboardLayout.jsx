// src/components/layout/DashboardLayout.jsx
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import * as Lucide from 'lucide-react';
import { mockDb } from '../../store/mockStore';
import { useAuth } from '../../contexts/AuthContext';

export const DashboardLayout = ({ children }) => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: 'Chào bạn! Tôi là Trợ lý Pháp lý & Giải quyết Sự cố Đô thị UrbanMind. Bạn có câu hỏi nào cần giải đáp về quy định đô thị hoặc quy trình tiếp nhận xử lý phản ánh không?' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleChat = () => setChatOpen(!chatOpen);

  const handleSendMessage = () => {
    if (!inputVal.trim() || loadingReply) return;
    
    const userMsg = inputVal;
    setInputVal('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoadingReply(true);

    // Simulate AI response delay
    setTimeout(() => {
      const replyText = mockDb.getAiChatReply(userMsg);
      setChatMessages(prev => [...prev, { sender: 'ai', text: replyText }]);
      setLoadingReply(false);
    }, 800);
  };

  const handleQuickQuestion = (question) => {
    setInputVal(question);
  };

  return (
    <div className="flex h-screen w-screen bg-base-300 overflow-hidden text-base-content font-sans">
      {/* Sidebar navigation */}
      {user?.role !== 'service-user' && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      {/* Main container */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-base-100">
        <Header onMenuToggle={toggleSidebar} />
        
        {/* Main scrollable workspace */}
        <main className="flex-1 overflow-y-auto p-6 bg-base-200">
          <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* PERSISTENT AI COPILOT FLOATING BUTTON */}
      <button 
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-40 btn btn-circle btn-primary btn-lg shadow-xl shadow-primary/20 group hover:scale-105 transition-transform"
      >
        <Lucide.Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
      </button>

      {/* AI COPILOT CHAT PANEL (Slide out Drawer) */}
      <div 
        className={`fixed inset-y-0 right-0 z-50 w-96 bg-base-100 border-l border-base-300 shadow-2xl transform transition-transform duration-300 ${
          chatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-primary text-primary-content">
            <div className="flex items-center gap-2">
              <Lucide.Sparkles className="animate-pulse" size={20} />
              <div>
                <h3 className="font-bold text-sm">UrbanMind AI Copilot</h3>
                <p className="text-[10px] opacity-75">Tư vấn pháp lý & phản ánh đô thị</p>
              </div>
            </div>
            <button onClick={toggleChat} className="btn btn-sm btn-ghost btn-circle text-primary-content hover:bg-primary-focus">
              <Lucide.X size={18} />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-base-200/50">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`chat ${msg.sender === 'ai' ? 'chat-start' : 'chat-end'}`}>
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full bg-base-300 p-1 flex items-center justify-center">
                    {msg.sender === 'ai' ? (
                      <Lucide.Cpu className="text-primary w-full h-full" />
                    ) : (
                      <img src={user?.avatarUrl} alt="User" />
                    )}
                  </div>
                </div>
                <div className={`chat-bubble text-xs font-medium leading-relaxed max-w-[85%] ${
                  msg.sender === 'ai' 
                    ? 'bg-base-100 text-base-content border border-base-300 shadow-sm' 
                    : 'bg-primary text-primary-content shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loadingReply && (
              <div className="chat chat-start">
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full bg-base-300 p-1">
                    <Lucide.Cpu className="text-primary w-full h-full animate-bounce" />
                  </div>
                </div>
                <div className="chat-bubble bg-base-100 border border-base-300 flex items-center gap-1.5 py-3">
                  <span className="loading loading-dots loading-xs"></span>
                </div>
              </div>
            )}
          </div>

          {/* Quick recommendations */}
          <div className="px-4 py-2 bg-base-100 border-t border-base-300 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-gray-500 font-bold w-full mb-1">Gợi ý câu hỏi nhanh:</span>
            <button 
              onClick={() => handleQuickQuestion('Mức xử phạt vứt rác bừa bãi?')}
              className="badge badge-outline hover:badge-primary text-[10px] py-2 cursor-pointer transition-colors"
            >
              Mức phạt vứt rác?
            </button>
            <button 
              onClick={() => handleQuickQuestion('Quy định SLA sửa bóng đèn cháy?')}
              className="badge badge-outline hover:badge-primary text-[10px] py-2 cursor-pointer transition-colors"
            >
              SLA sửa đèn đường?
            </button>
            <button 
              onClick={() => handleQuickQuestion('Lỗi mất nắp cống hố ga báo thế nào?')}
              className="badge badge-outline hover:badge-primary text-[10px] py-2 cursor-pointer transition-colors"
            >
              Báo mất nắp hố ga?
            </button>
          </div>

          {/* Input form */}
          <div className="p-4 border-t border-base-300 bg-base-100 flex gap-2">
            <input 
              type="text" 
              placeholder="Hỏi AI về luật, thủ tục phản ánh..." 
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="input input-bordered input-sm flex-1 text-xs rounded-xl"
            />
            <button 
              onClick={handleSendMessage}
              className="btn btn-sm btn-primary btn-square rounded-xl"
              disabled={loadingReply}
            >
              <Lucide.SendHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        ></div>
      )}
    </div>
  );
};
