import { create } from 'zustand';
import type { CreateFeedbackActions, CreateFeedbackDraft } from '../types/reporting.types';

export type { CreateFeedbackActions, CreateFeedbackDraft } from '../types/reporting.types';

export const useCreateFeedbackStore = create<CreateFeedbackDraft & CreateFeedbackActions>()((set) => ({
  category: '',
  description: '',
  location: '',
  evidence: [],
  setCategory: (category: string) => set({ category }),
  setDescription: (description: string) => set({ description }),
  setLocation: (location: string) => set({ location }),
  setEvidence: (evidence: string[]) => set({ evidence }),
  addEvidence: (uri: string) => set((state) => ({ evidence: [...state.evidence, uri] })),
  removeEvidence: (index: number) => set((state) => {
    const newEvidence = [...state.evidence];
    newEvidence.splice(index, 1);
    return { evidence: newEvidence };
  }),
  reset: () => set({ category: '', description: '', location: '', evidence: [] }),
}));
