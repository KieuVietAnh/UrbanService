/** Staff-only, platform-independent geometry. All dimensions are logical points. */
export type StaffInsets = { top: number; right: number; bottom: number; left: number };
export type StaffBottomSafeArea = 'auto' | 'always' | 'never';
export const STAFF_FIXED_CHROME_MAX_FONT_SCALE = 1.4;

export type StaffContentOptions = {
  bottomSafeArea?: StaffBottomSafeArea;
  /** Maximum readable content width, excluding safe area and page gutters. */
  contentMaxWidth?: number;
  contentGutter?: number;
  extraBottomSpace?: number;
};

const positive = (value: number, fallback = 0) => Number.isFinite(value) ? Math.max(0, value) : fallback;

/**
 * React Native scales fontSize in SP, while a numeric lineHeight remains a
 * layout-point value on Android. Keep the line box in step with the rendered
 * glyphs so accessibility text cannot be vertically clipped.
 */
export function getStaffTextScale({
  fontScale,
  allowFontScaling = true,
  maxFontSizeMultiplier,
}: {
  fontScale: number;
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number | null;
}) {
  if (!allowFontScaling) return 1;
  const scale = Math.max(1, positive(fontScale, 1));
  const maximum = typeof maxFontSizeMultiplier === 'number' && Number.isFinite(maxFontSizeMultiplier) && maxFontSizeMultiplier > 0
    ? Math.max(1, maxFontSizeMultiplier)
    : scale;
  return Math.min(scale, maximum);
}

export function getStaffLineHeight({
  fontSize,
  fontScale,
  ratio = 1.5,
  allowFontScaling = true,
  maxFontSizeMultiplier,
}: {
  fontSize: number;
  fontScale: number;
  ratio?: number;
  allowFontScaling?: boolean;
  maxFontSizeMultiplier?: number | null;
}) {
  return Math.ceil(positive(fontSize) * Math.max(1, positive(ratio, 1.5)) * getStaffTextScale({ fontScale, allowFontScaling, maxFontSizeMultiplier }));
}

export function getStaffContentLayout({
  width, insets, bottomInsetConsumed = false, headerShown = true, platform = 'android',
  bottomSafeArea = 'auto', contentMaxWidth = 760, contentGutter, extraBottomSpace = 32,
}: StaffContentOptions & {
  width: number;
  insets: StaffInsets;
  bottomInsetConsumed?: boolean;
  headerShown?: boolean;
  platform?: string;
}) {
  // iOS ScrollView's automatic adjustment owns its system insets. Android does not
  // implement contentInsetAdjustmentBehavior, so it needs explicit measured insets.
  const automaticInsets = platform === 'ios';
  const left = automaticInsets ? 0 : positive(insets.left);
  const right = automaticInsets ? 0 : positive(insets.right);
  const safeWidth = Math.max(1, positive(width) - left - right);
  const gutter = contentGutter === undefined ? (safeWidth < 360 ? 16 : 20) : positive(contentGutter);
  const maxWidth = Math.max(1, positive(contentMaxWidth, 760));
  const centerSpace = Math.max(0, (safeWidth - 2 * gutter - maxWidth) / 2);
  const ownsBottomInset = bottomSafeArea === 'always' || (bottomSafeArea === 'auto' && !bottomInsetConsumed);
  const bottomInset = !automaticInsets && ownsBottomInset ? positive(insets.bottom) : 0;
  const topInset = !automaticInsets && !headerShown ? positive(insets.top) : 0;
  return {
    paddingTop: 24 + topInset,
    paddingLeft: left + gutter + centerSpace,
    paddingRight: right + gutter + centerSpace,
    paddingBottom: positive(extraBottomSpace, 32) + bottomInset,
    bottomInset,
    gutter,
    readableWidth: Math.max(0, safeWidth - 2 * gutter - 2 * centerSpace),
    contentInsetAdjustmentBehavior: automaticInsets ? 'automatic' as const : 'never' as const,
  };
}

export function getStaffTabLayout({ width, fontScale, insets, count = 5, labelCharacters = 9 }: {
  width: number;
  fontScale: number;
  insets: StaffInsets;
  count?: number;
  labelCharacters?: number;
}) {
  const scale = Math.max(1, positive(fontScale, 1));
  // A bottom navigation bar has fixed horizontal geometry. Keep the visible
  // labels moderately enlarged and expose their full wording to accessibility
  // services, instead of letting 200% text push a destination off-screen.
  const labelFontScale = Math.min(scale, STAFF_FIXED_CHROME_MAX_FONT_SCALE);
  const itemCount = Math.max(1, Math.floor(positive(count, 5)));
  const viewportWidth = Math.max(1, positive(width) - positive(insets.left) - positive(insets.right));
  // Android phones and normal split-screen widths can show five 48dp targets.
  // Only an impossible-to-fit viewport (< 5 * 48dp) falls back to scrolling.
  const minimumItemWidth = 48;
  const rowWidth = Math.max(viewportWidth, minimumItemWidth * itemCount);
  const itemWidth = rowWidth / itemCount;
  const estimatedLabelWidth = positive(labelCharacters, 9) * 11 * 0.58 * labelFontScale;
  const labelLines = Math.min(2, Math.max(1, Math.ceil(estimatedLabelWidth / Math.max(1, itemWidth - 8))));
  const labelLineHeight = getStaffLineHeight({ fontSize: 11, fontScale: labelFontScale, ratio: 16 / 11, maxFontSizeMultiplier: STAFF_FIXED_CHROME_MAX_FONT_SCALE });
  const controlHeight = Math.max(68, Math.ceil(28 + labelLineHeight * labelLines + 20));
  return {
    viewportWidth,
    rowWidth,
    itemWidth,
    controlHeight,
    height: controlHeight + positive(insets.bottom),
    scrollable: rowWidth > viewportWidth + 0.5,
    labelLines,
    labelFontScale,
    labelLineHeight,
  };
}
