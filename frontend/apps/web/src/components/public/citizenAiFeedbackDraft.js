export const parseCitizenAiFeedbackDraft = (rawDraft, validSteps = []) => {
  if (!rawDraft) return null;

  try {
    const parsed = typeof rawDraft === 'string' ? JSON.parse(rawDraft) : rawDraft;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    return {
      draftStep: validSteps.includes(parsed.draftStep) ? parsed.draftStep : validSteps[0],
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      categoryText: typeof parsed.categoryText === 'string' ? parsed.categoryText : '',
      reflection: typeof parsed.reflection === 'string' ? parsed.reflection : '',
      locationText: typeof parsed.locationText === 'string' ? parsed.locationText : '',
      latitude: parsed.latitude == null ? '' : String(parsed.latitude),
      longitude: parsed.longitude == null ? '' : String(parsed.longitude),
      hadImages: Boolean(parsed.hadImages),
      imageNames: Array.isArray(parsed.imageNames) ? parsed.imageNames.map(String) : [],
    };
  } catch {
    return null;
  }
};

export const buildCitizenFeedbackSubmission = ({
  title,
  description,
  suggestedCategory,
  location,
  latitude,
  longitude,
  attachments = [],
}) => {
  const latitudeNumber = latitude === '' || latitude == null ? NaN : Number(latitude);
  const longitudeNumber = longitude === '' || longitude == null ? NaN : Number(longitude);
  const hasCoordinates = Number.isFinite(latitudeNumber) && Number.isFinite(longitudeNumber);

  // Citizen submission must not assign category or priority before the
  // post-submission AI review. Keep AI suggestions as draft-only context.
  return {
    type: 'complete-in-form',
    draft: {
      title,
      description,
      suggestedCategory,
      location,
      latitude: hasCoordinates ? latitudeNumber : null,
      longitude: hasCoordinates ? longitudeNumber : null,
    },
    attachments,
  };
};
