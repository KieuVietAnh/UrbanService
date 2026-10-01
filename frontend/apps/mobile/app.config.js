const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envFilePath = path.resolve(__dirname, '.env');
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

module.exports = ({ config }) => {
  const localGoogleServicesFile = path.resolve(__dirname, 'google-services.json');
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim()
    || (fs.existsSync(localGoogleServicesFile) ? './google-services.json' : '');
  const googleServiceInfoPlist = process.env.GOOGLE_SERVICE_INFO_PLIST?.trim();

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    ios: {
      ...config.ios,
      ...(googleServiceInfoPlist ? { googleServicesFile: googleServiceInfoPlist } : {}),
    },
    plugins: [
      './plugins/withGoogleMapsAndroidManifest.js',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#EFF6FF',
          image: './assets/icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
        },
      ],
      ['expo-system-ui', { userInterfaceStyle: 'light' }],
    ],
    extra: {
      ...config.extra,
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.urbanservice.me',

      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '353963599123-ofbl3aoivkest6llsjh68qqrimp8p6eg.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '353963599123-7vtdpcp0okkrhrr2va9q4p4lbsndl6si.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
    },
  };
};
