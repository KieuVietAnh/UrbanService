// src/services/api/userApi.js
import { apiClient } from './apiClient';
import { mockDb } from '../../store/mockStore';

export const userApi = {
  getUsers() {
    return apiClient.request(() => {
      return mockDb.getUsers();
    });
  },

  updateUserStatus(userId, isActive, adminUserId) {
    return apiClient.request(() => {
      const users = mockDb.getUsers();
      const user = users.find(u => u.userId === userId);
      if (!user) throw new Error('Không tìm thấy người dùng.');
      
      const oldVal = user.isActive;
      user.isActive = isActive;
      user.updatedAt = new Date().toISOString();
      mockDb.updateUsers(users);
      
      mockDb.addAudit(adminUserId, isActive ? 'Unlock Account' : 'Lock Account', 'User', userId, { isActive: oldVal }, { isActive });
      return user;
    });
  },

  assignRole(userId, role, operatorId, adminUserId) {
    return apiClient.request(() => {
      const users = mockDb.getUsers();
      const user = users.find(u => u.userId === userId);
      if (!user) throw new Error('Không tìm thấy người dùng.');
      
      const oldRole = user.role;
      user.role = role;
      user.operatorId = role === 'service-provider' ? Number(operatorId) : null;
      user.updatedAt = new Date().toISOString();
      mockDb.updateUsers(users);
      
      mockDb.addAudit(adminUserId, 'Update User Role', 'User', userId, { role: oldRole }, { role, operatorId });
      return user;
    });
  },

  createUser(userData, adminUserId) {
    return apiClient.request(() => {
      const users = mockDb.getUsers();
      const existing = users.find(u => u.email === userData.email);
      if (existing) throw new Error('Email đã tồn tại trong hệ thống.');

      const newUser = {
        userId: `u-${Date.now()}`,
        fullName: userData.fullName,
        email: userData.email,
        passwordHash: '123456', // default password
        phoneNumber: userData.phoneNumber,
        address: userData.address || '',
        role: userData.role,
        operatorId: userData.role === 'service-provider' ? Number(userData.operatorId) : null,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
        isActive: true,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      mockDb.updateUsers(users);
      mockDb.addAudit(adminUserId, 'Create User', 'User', newUser.userId);
      return newUser;
    });
  }
};
