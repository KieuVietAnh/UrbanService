const normalizeNotificationText = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase('vi-VN');

export const getNotificationCategory = (notification) => {
  const type = normalizeNotificationText(notification?.type).replace(/[^a-z0-9]/g, '');
  const text = normalizeNotificationText(
    `${notification?.title || ''} ${notification?.message || ''} ${notification?.type || ''}`,
  );

  if (
    type.includes('rework') ||
    type.includes('requestinfo') ||
    text.includes('làm lại') ||
    text.includes('bổ sung') ||
    text.includes('request info') ||
    text.includes('yêu cầu thêm')
  ) return 'rework';

  if (
    type.includes('resolution') ||
    type.includes('resolved') ||
    type.includes('approved') ||
    text.includes('kết quả') ||
    text.includes('hoàn tất') ||
    text.includes('phê duyệt')
  ) return 'resolution';

  if (
    type.includes('community') ||
    type.includes('comment') ||
    type.includes('support') ||
    text.includes('cộng đồng') ||
    text.includes('bình luận')
  ) return 'community';

  return 'status';
};
