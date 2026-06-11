// src/services/api/slaApi.js
import { apiClient } from './apiClient';
import { mockDb } from '../../store/mockStore';

export const slaApi = {
  getSlaConfig() {
    return apiClient.request(() => {
      return mockDb.getSlaConfig();
    });
  },

  updateSlaConfig(slaCode, hours, adminUserId) {
    return apiClient.request(() => {
      const config = mockDb.getSlaConfig();
      if (!config[slaCode]) throw new Error('Cấu hình SLA không hợp lệ.');
      
      const oldVal = config[slaCode].hours;
      config[slaCode].hours = Number(hours);
      mockDb.updateSlaConfig(config);
      
      mockDb.addAudit(adminUserId, 'Update SLA Settings', 'SLA', slaCode, { hours: oldVal }, { hours });
      return config[slaCode];
    });
  },

  getCategories() {
    return apiClient.request(() => {
      return mockDb.getCategories();
    });
  },

  createCategory(catData, adminUserId) {
    return apiClient.request(() => {
      const cats = mockDb.getCategories();
      const newCat = {
        categoryId: cats.length + 1,
        categoryName: catData.categoryName,
        description: catData.description,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      cats.push(newCat);
      mockDb.updateCategories(cats);
      
      mockDb.addAudit(adminUserId, 'Create Service Category', 'Category', String(newCat.categoryId));
      return newCat;
    });
  },

  updateCategory(categoryId, catData, adminUserId) {
    return apiClient.request(() => {
      const cats = mockDb.getCategories();
      const cat = cats.find(c => c.categoryId === Number(categoryId));
      if (!cat) throw new Error('Không tìm thấy danh mục.');

      cat.categoryName = catData.categoryName;
      cat.description = catData.description;
      cat.isActive = catData.isActive;
      mockDb.updateCategories(cats);
      
      mockDb.addAudit(adminUserId, 'Update Service Category', 'Category', String(categoryId));
      return cat;
    });
  }
};
