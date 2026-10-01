export interface CommunityIncidentParams {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  categoryId?: string | number;
  areaId?: string | number;
  sort?: string;
}

export interface CommunityIncidentResponse {
  items: PublicIncidentItem[];
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
}

export interface PublicIncidentMedia {
  incidentMediaId?: string | number;
  fileUrl?: string;
  thumbnailUrl?: string;
  mediaType?: string;
}

export interface PublicIncidentItem {
  incidentId: string;
  id: string;
  areaId?: number | null;
  areaName?: string;
  categoryId?: number | null;
  categoryName?: string;
  title?: string;
  description?: string;
  locationText?: string;
  latitude?: number | null;
  longitude?: number | null;
  priority?: string;
  severity?: string;
  status?: string;
  reportCount?: number;
  subscriberCount?: number;
  commentCount?: number;
  supportCount?: number;
  isSubscribedByCurrentUser?: boolean;
  isSupportedByCurrentUser?: boolean;
  engagementScore?: number;
  coverImageUrl?: string;
  coverImageThumbnailUrl?: string;
  imageUrl?: string;
  media?: PublicIncidentMedia[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PublicIncidentDetail extends PublicIncidentItem {
  dueDate?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
}

export interface PublicIncidentResolution {
  resolutionSummary?: string;
  actionTaken?: string;
  resolvedAt?: string;
  completionDocuments?: Array<{
    documentId?: string | number;
    fileUrl?: string;
    thumbnailUrl?: string;
    documentType?: string;
  }>;
}

export interface PublicIncidentEvent {
  incidentEventId?: string | number;
  eventType?: string;
  createdAt?: string;
}

export interface IncidentComment {
  incidentCommentId?: string;
  commentId?: string;
  id: string;
  authorName?: string;
  userName?: string;
  content: string;
  createdAt: string;
}

export interface CommunityIncidentCardProps {
  item: PublicIncidentItem;
  onPress: () => void;
  onCommentPress: () => void;
}

export type CommunityFeedCache = {
  items?: PublicIncidentItem[];
};
