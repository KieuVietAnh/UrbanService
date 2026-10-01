export interface User {
  id: string;
  email: string;
  role: string;
  token: string;
  fullName?: string;
  phone?: string;
  isVerified?: boolean;
  avatarUrl?: string | null;
}