const CATEGORY_LABELS = {
  drainage: 'Thoát nước',
  'garbage collection': 'Thu gom rác',
  'public safety': 'An toàn công cộng',
  'road maintenance': 'Bảo trì đường bộ',
  'street lighting': 'Chiếu sáng đô thị',
  'water supply': 'Cấp nước',
  'environmental sanitation': 'Vệ sinh môi trường',
  sanitation: 'Vệ sinh môi trường',
  'tree and greenery': 'Cây xanh',
  'traffic safety': 'An toàn giao thông',
  traffic: 'An toàn giao thông',
  lighting: 'Điện chiếu sáng',
  roads: 'Đường sá',
  water: 'Cấp thoát nước',
  waste: 'Thu gom rác',
};

export const getCategoryLabel = (value, fallback = 'Chưa phân loại') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const text = String(value).trim();
  if (!text) {
    return fallback;
  }

  const directMatch = CATEGORY_LABELS[text.toLowerCase()];
  if (directMatch) {
    return directMatch;
  }

  return text;
};
