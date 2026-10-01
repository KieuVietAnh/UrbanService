export interface FeedbackFilters {
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  areaId?: string;
}

export interface CreateFeedbackPayload {
  categoryId: string;
  title: string;
  description: string;
  locationText: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  geoSource?: string;
  areaId?: string;
  priority?: string;
  attachments?: Array<{ uri: string; name: string; type: string }>;
}

export type CreateFeedbackDraft = {
  category: string;
  description: string;
  location: string;
  evidence: string[];
};

export type CreateFeedbackActions = {
  setCategory: (category: string) => void;
  setDescription: (description: string) => void;
  setLocation: (location: string) => void;
  setEvidence: (evidence: string[]) => void;
  addEvidence: (uri: string) => void;
  removeEvidence: (index: number) => void;
  reset: () => void;
};
