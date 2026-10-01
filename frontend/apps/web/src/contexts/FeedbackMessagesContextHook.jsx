import { useContext } from 'react';
import { FeedbackMessagesContext } from './FeedbackMessagesContextBase';

export const useFeedbackMessages = () => {
  const context = useContext(FeedbackMessagesContext);
  if (!context) {
    throw new Error('useFeedbackMessages must be used within a FeedbackMessagesProvider');
  }
  return context;
};
