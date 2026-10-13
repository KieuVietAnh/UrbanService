const DEFAULT_COUNTRY_CODE = '84';

/**
 * Chuẩn hoá số điện thoại về E.164, mặc định mã quốc gia Việt Nam.
 * "0901 234 567" / "84901234567" / "+84901234567" -> "+84901234567".
 * Trả về null nếu không hợp lệ.
 *
 * Frontend và backend cùng lưu số ở dạng E.164 để so sánh và hiển thị nhất quán.
 * Bản C# nằm ở UrbanService.BLL/Common/Helpers/PhoneNumberHelper.cs.
 */
export function normalizePhone(input) {
  const trimmed = String(input ?? '').trim();
  if (!/^\+?[0-9 ().-]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');
  let e164;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (digits.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.startsWith('0')) e164 = `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  else if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length >= 11) e164 = `+${digits}`;
  else e164 = `+${DEFAULT_COUNTRY_CODE}${digits}`;

  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

/** "+84901234567" -> "0901 234 567" để hiển thị; số nước ngoài giữ nguyên. */
export function formatPhone(e164) {
  const value = String(e164 ?? '');
  if (!value.startsWith(`+${DEFAULT_COUNTRY_CODE}`)) return value;
  const local = `0${value.slice(DEFAULT_COUNTRY_CODE.length + 1)}`;
  return local.replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3');
}
