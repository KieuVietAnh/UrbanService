const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withGoogleMapsAndroidManifest(config) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    const application = manifest.application && manifest.application[0];

    if (!application) {
      return configWithManifest;
    }

    // Set Google Maps API key
    if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
      const existingMetadata = Array.isArray(application['meta-data']) ? application['meta-data'] : [];
      const keyName = 'com.google.android.geo.API_KEY';
      const existingKey = existingMetadata.find(
        (meta) => meta && meta.$ && meta.$['android:name'] === keyName,
      );

      if (existingKey) {
        existingKey.$['android:value'] = apiKey;
      } else {
        existingMetadata.push({
          $: {
            'android:name': keyName,
            'android:value': apiKey,
          },
        });
      }

      application['meta-data'] = existingMetadata;
    }

    // Set windowSoftInputMode to adjustPan to prevent keyboard from pushing bottom bar
    const activities = Array.isArray(application.activity) ? application.activity : [];
    activities.forEach((activity) => {
      if (activity && activity.$) {
        activity.$['android:windowSoftInputMode'] = 'adjustPan';
      }
    });

    return configWithManifest;
  });
};

