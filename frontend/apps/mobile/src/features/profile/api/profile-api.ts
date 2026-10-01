import { userApi } from '@urbanmind/shared-api';

type ProfileUpdateInput = {
  fullName: string;
  phone?: string;
  phoneNumber?: string;
  address?: string;
};

type MobileProfile = Record<string, unknown> & {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  role?: string;
};

const normalizeProfile = (profile: unknown): MobileProfile | null => {
  if (typeof profile !== 'object' || profile === null) return null;

  const value = profile as Record<string, unknown>;
  const phone = typeof value.phoneNumber === 'string'
    ? value.phoneNumber
    : typeof value.phone === 'string'
      ? value.phone
      : '';
  return {
    ...value,
    // Keep the existing mobile view-model stable while honoring the Swagger DTO.
    phone,
  };
};

export const profileApi = {
  getProfile: async () => normalizeProfile(await userApi.getProfile()),
  updateProfile: async ({ phone, phoneNumber, ...data }: ProfileUpdateInput) =>
    normalizeProfile(await userApi.updateProfile({
      ...data,
      phoneNumber: phoneNumber ?? phone,
    })),
};
