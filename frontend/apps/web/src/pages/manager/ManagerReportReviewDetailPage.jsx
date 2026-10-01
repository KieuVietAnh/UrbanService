import { Navigate, useParams } from 'react-router-dom';

export const ManagerReportReviewDetailPage = () => {
  const { feedbackId } = useParams();

  return (
    <Navigate
      replace
      to="/manager/reports/review"
      state={{ mapState: { focusFeedbackId: feedbackId || '' } }}
    />
  );
};
