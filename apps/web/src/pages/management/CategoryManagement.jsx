// src/pages/management/CategoryManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { slaApi } from '../../services/api/slaApi';
import { mockDb } from '../../store/mockStore';
import * as Lucide from 'lucide-react';

export const CategoryManagement = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states to create category
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchCats = async () => {
    setLoading(true);
    try {
      const res = await slaApi.getCategories();
      setCategories(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName || !catDesc) return;
    setCreateLoading(true);
    try {
      await slaApi.createCategory({
        categoryName: catName,
        description: catDesc
      }, user.userId);
      alert('Tạo danh mục mới thành công!');
      setShowCreateModal(false);
      setCatName('');
      setCatDesc('');
      fetchCats();
    } catch (err) {
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black">Cấu Hình Danh Mục Dịch Vụ</h2>
          <p className="text-xs text-gray-500 font-semibold">Tạo, cập nhật và liên kết các ngành dịch vụ công ích với đơn vị kỹ thuật xử lý tương ứng.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="btn btn-primary rounded-xl font-bold text-xs gap-2"
        >
          <Lucide.PlusCircle size={16} />
          Thêm Danh Mục Dịch Vụ
        </button>
      </div>

      {/* Categories Grid list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          categories.map((cat) => {
            // Find operator assigned to this category
            const operator = mockDb.getOperators().find(o => o.categoryId === cat.categoryId);
            
            return (
              <div 
                key={cat.categoryId}
                className="card bg-base-100 border border-base-300 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex items-center justify-between border-b border-base-300 pb-2">
                  <span className="text-[10px] font-black text-gray-400">ID: #{cat.categoryId}</span>
                  <span className={`badge badge-xs font-bold py-1.5 px-2 ${
                    cat.isActive ? 'badge-success text-white' : 'badge-neutral'
                  }`}>
                    {cat.isActive ? 'Active' : 'Locked'}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-base-content">{cat.categoryName}</h4>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed min-h-[48px]">{cat.description}</p>
                </div>

                <div className="bg-base-200 p-3 rounded-2xl border border-base-300 text-xs space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Đơn vị chủ quản</span>
                  <span className="font-extrabold text-primary block truncate">
                    {operator ? operator.operatorName : 'Chưa gắn đơn vị'}
                  </span>
                  {operator && (
                    <span className="text-[10px] text-gray-500 block font-semibold">
                      Hotline: {operator.contactPhone}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE CATEGORY MODAL */}
      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box rounded-3xl border border-base-300 max-w-md p-6 space-y-4">
            <h3 className="font-extrabold text-base text-primary flex items-center gap-2">
              <Lucide.PlusCircle size={20} />
              Thêm Danh Mục Dịch Vụ
            </h3>
            
            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs">Tên danh mục mới *</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Ví dụ: Công viên cây xanh &amp; Chiếu sáng"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="input input-bordered w-full text-xs font-semibold rounded-xl h-10"
                  required
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-xs">Mô tả dịch vụ chi tiết *</span>
                </label>
                <textarea 
                  rows="4"
                  placeholder="Mô tả cụ thể phạm vi tiếp nhận các vấn đề thuộc nhóm danh mục này..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="textarea textarea-bordered text-xs font-semibold p-2.5 rounded-xl"
                  required
                ></textarea>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-sm btn-ghost rounded-xl text-[10px]"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-sm btn-primary rounded-xl text-[10px] font-bold"
                  disabled={createLoading}
                >
                  {createLoading ? <span className="loading loading-spinner"></span> : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
