import { mockDb } from './mockStore.js';

export const userApi = {
  async getProfile(userId) {
    const users = mockDb.getUsers();
    const user = users.find((u) => u.userId === userId);
    if (!user) throw new Error('User not found.');
    return user;
  },

  async updateProfile(userId, data) {
    const users = mockDb.getUsers();
    const userIndex = users.findIndex((u) => u.userId === userId);
    if (userIndex < 0) throw new Error('User not found.');

    const updatedUser = { ...users[userIndex], ...data, updatedAt: new Date().toISOString() };
    users[userIndex] = updatedUser;
    mockDb.updateUsers(users);
    mockDb.addAudit(userId, 'Update Profile', 'User', userId, users[userIndex], updatedUser);
    return updatedUser;
  },

  async getUserRoles() {
    const users = mockDb.getUsers();
    return users.map((u) => ({ userId: u.userId, role: u.role }));
  }
};
