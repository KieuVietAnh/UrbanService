// src/pages/community/CommunityFeedPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const CommunityFeedPage = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [supportedList, setSupportedList] = useState({});

  useEffect(() => {
    // Fetch all public tickets (excluding drafted/closed ones or just show all for feed)
    setTickets(mockDb.getTickets());
  }, []);

  const handleSupportToggle = (feedbackId, e) => {
    e.stopPropagation(); // Stop card click navigation
    
    const isSupported = supportedList[feedbackId];
    setSupportedList(prev => ({ ...prev, [feedbackId]: !isSupported }));
    
    // Update count in database
    const allTickets = mockDb.getTickets();
    const ticket = allTickets.find(t => t.feedbackId === feedbackId);
    if (ticket) {
      const history = mockDb.get('urbanmind_history') || [];
      if (!isSupported) {
        // Mock Upvote
        ticket.confidenceScore = (ticket.confidenceScore || 0.9) + 0.01; // increase visibility score
        // Create an audit logs
        mockDb.addAudit('anonymous', 'Support Ticket', 'Feedback', feedbackId);
      }
      mockDb.updateTickets(allTickets);
      setTickets(allTickets);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-black">Bảng Tin Ý Kiến Đô Thị</h2>
        <p className="text-xs text-gray-500 font-semibold">Theo dõi phản ánh công cộng của cộng đồng dân cư và cùng nhau biểu quyết giám sát chất lượng giải quyết.</p>
      </div>

      {/* Feed list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets.map((t) => {
          const isSupported = !!supportedList[t.feedbackId];
          const mockUpvoteCount = isSupported ? 25 : 24;

          return (
            <div 
              key={t.feedbackId}
              onClick={() => navigate(`/tickets/${t.feedbackId}`)}
              className="card bg-base-100 border border-base-300 hover:border-primary p-5 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4"
            >
              {/* Image if exists */}
              {t.attachments && t.attachments.length > 0 && (
                <div className="w-full aspect-video rounded-2xl overflow-hidden border border-base-300">
                  <img src={t.attachments[0]} alt="Complaint" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[9px] font-bold text-gray-400">
                  <span>{t.feedbackId}</span>
                  <span className="badge badge-xs bg-base-200 text-gray-500 py-1.5 px-2">
                    {mockDb.getCategories().find(c => c.categoryId === t.categoryId)?.categoryName}
                  </span>
                </div>
                <h4 className="font-extrabold text-sm text-base-content line-clamp-1">{t.title}</h4>
                <p className="text-xs text-gray-500 font-medium line-clamp-3 leading-relaxed">{t.description}</p>
              </div>

              {/* Bottom interaction row */}
              <div className="border-t border-base-300 pt-3 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold max-w-[150px] min-w-0">
                  <Lucide.MapPin size={12} className="text-primary shrink-0" />
                  <span className="truncate">{t.locationText}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => handleSupportToggle(t.feedbackId, e)}
                    className={`btn btn-xs rounded-xl font-bold flex gap-1 ${
                      isSupported ? 'btn-primary' : 'btn-ghost hover:bg-base-200'
                    }`}
                  >
                    <Lucide.Heart size={12} fill={isSupported ? 'currentColor' : 'none'} className={isSupported ? 'scale-110' : ''} />
                    <span>Hỗ trợ ({mockUpvoteCount})</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
