import { axiosClient } from './axiosClient.js';

const unwrap = (response) => response?.data ?? response ?? {};

const normalizePagedUsers = (response, fallbackPageSize = 10) => {
  const payload = unwrap(response);
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];
  const pageNumber = Number(payload?.pageNumber ?? payload?.data?.pageNumber ?? 1);
  const pageSize = Number(payload?.pageSize ?? payload?.data?.pageSize ?? fallbackPageSize);
  const totalItems = Number(payload?.totalItems ?? payload?.totalCount ?? payload?.data?.totalItems ?? payload?.data?.totalCount ?? items.length);
  const calculatedTotalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const totalPages = Number(payload?.totalPages ?? payload?.data?.totalPages ?? calculatedTotalPages);

  return {
    items,
    pageNumber: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : fallbackPageSize,
    totalItems: Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : items.length,
    totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : calculatedTotalPages,
    hasPreviousPage: typeof payload?.hasPreviousPage === 'boolean' ? payload.hasPreviousPage : pageNumber > 1,
    hasNextPage: typeof payload?.hasNextPage === 'boolean' ? payload.hasNextPage : pageNumber < totalPages,
  };
};

const toUserListParams = (params = {}) => {
  const next = {
    PageNumber: params.pageNumber ?? params.PageNumber ?? 1,
    PageSize: params.pageSize ?? params.PageSize ?? 10,
  };

  const search = params.search ?? params.Search;
  const roleName = params.roleName ?? params.RoleName;
  const roleId = params.roleId ?? params.RoleId;
  const isActive = params.isActive ?? params.IsActive;
  const isVerified = params.isVerified ?? params.IsVerified;

  if (String(search ?? '').trim()) next.Search = String(search).trim();
  if (String(roleName ?? '').trim()) next.RoleName = String(roleName).trim();
  if (roleId !== undefined && roleId !== null && roleId !== '') next.RoleId = roleId;
  if (typeof isActive === 'boolean') next.IsActive = isActive;
  if (typeof isVerified === 'boolean') next.IsVerified = isVerified;

  return next;
};

const getCount = async (params = {}) => {
  const response = await axiosClient.get('/api/admin/users', {
    params: toUserListParams({ ...params, pageNumber: 1, pageSize: 1 }),
  });
  return normalizePagedUsers(response, 1).totalItems;
};

const getUsersPageRequest = async (params = {}) => {
  const requestParams = toUserListParams(params);
  const response = await axiosClient.get('/api/admin/users', { params: requestParams });
  return normalizePagedUsers(response, Number(requestParams.PageSize) || 10);
};

export const userApi = {
  async getProfile() {
    try {
      const response = await axiosClient.get('/api/profile');
      return response?.data || response || null;
    } catch (error) {
      console.error('userApi.getProfile failed', error);
      throw error;
    }
  },

  async updateProfile(data) {
    try {
      const response = await axiosClient.put('/api/profile', data);
      return response?.data || response || null;
    } catch (error) {
      console.error('userApi.updateProfile failed', error);
      throw error;
    }
  },

  async getUsersPage(params = {}) {
    try {
      return await getUsersPageRequest(params);
    } catch (error) {
      console.error('userApi.getUsersPage failed', error);
      throw error;
    }
  },

  async getUsers(params = {}) {
    try {
      const pageSize = Number(params?.pageSize ?? params?.PageSize ?? 100);
      const firstPage = await getUsersPageRequest({ ...params, pageNumber: 1, pageSize });
      if (firstPage.totalPages <= 1) return firstPage.items;

      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) => (
          getUsersPageRequest({ ...params, pageNumber: index + 2, pageSize })
        )),
      );
      return [firstPage, ...remainingPages].flatMap((page) => page.items || []);
    } catch (error) {
      console.error('userApi.getUsers failed', error);
      throw error;
    }
  },

  async getUserStats() {
    try {
      const [total, active, locked, staff, provider, manager, admin] = await Promise.all([
        getCount(),
        getCount({ isActive: true }),
        getCount({ isActive: false }),
        getCount({ roleName: 'SYSTEMSTAFF' }),
        getCount({ roleName: 'SERVICEPROVIDER' }),
        getCount({ roleName: 'INTERACTIONMANAGER' }),
        getCount({ roleName: 'SYSTEMADMIN' }),
      ]);

      return {
        total,
        active,
        locked,
        operatorCount: staff + provider + manager + admin,
      };
    } catch (error) {
      console.error('userApi.getUserStats failed', error);
      throw error;
    }
  },

  async updateUser(userId, data) {
    try {
      const response = await axiosClient.put(`/api/admin/users/${userId}`, data);
      return response?.data || response || null;
    } catch (error) {
      console.warn('userApi.updateUser failed', error);
      throw error;
    }
  },

  async updateUserStatus(userId, isActive) {
    try {
      const response = await axiosClient.patch(`/api/admin/users/${userId}/active`, {
        isActive,
      });
      return response?.data || response || null;
    } catch (error) {
      console.warn('userApi.updateUserStatus failed', error);
      throw error;
    }
  },

  async resetUserPassword(userId, newPassword) {
    try {
      await axiosClient.patch(`/api/admin/users/${userId}/reset-password`, {
        newPassword,
      });
      return true;
    } catch (error) {
      console.warn('userApi.resetUserPassword failed', error);
      throw error;
    }
  },

  async createUser(data) {
    try {
      const response = await axiosClient.post('/api/admin/users', data);
      return response?.data || response || data;
    } catch (error) {
      console.warn('userApi.createUser failed', error);
      throw error;
    }
  },

  async getUserRoles() {
    try {
      const response = await axiosClient.get('/api/admin/users/roles');
      const roles = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
        ? response
        : [];
      return roles;
    } catch (error) {
      console.warn('userApi.getUserRoles failed', error);
      throw error;
    }
  }
};
