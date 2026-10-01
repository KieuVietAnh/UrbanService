import type { ComponentProps } from 'react';
import type Icon from '@expo/vector-icons/Feather';

export type RouterLike = { push: (path: any) => void };

export type TicketLike = {
  incidentId?: string | number;
  feedbackId?: string | number;
  id?: string | number;
  title?: string;
  status?: string;
  createdAt?: string | Date;
  code?: string;
  feedbackCode?: string;
  locationText?: string;
  slaRemainingHours?: number;
  supportCount?: number;
  supporters?: number;
  categoryName?: string;
  priority?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  coverImageUrl?: string;
  imageUrls?: string[];
  images?: Array<string | Record<string, unknown>>;
  mediaUrls?: string[];
  media?: Array<string | Record<string, unknown>>;
  attachments?: Array<string | Record<string, unknown>>;
  attachmentList?: Array<string | Record<string, unknown>>;
};

export type QuickAction = {
  id: string;
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  sub: string;
  href: string;
  accent: string;
  bg: string;
  iconBg: string;
  textColor: string;
  subColor: string;
};
