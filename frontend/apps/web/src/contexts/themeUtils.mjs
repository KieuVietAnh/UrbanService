export const normalizeThemeValue = (value) => {
  if (value === 'dark') return 'dark';
  if (value === 'light' || value === 'corporate') return 'light';
  return 'light';
};
