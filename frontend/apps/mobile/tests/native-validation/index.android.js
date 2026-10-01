// Test-only bundle entry. Keeping the entry inside the mobile project avoids
// Expo Router's hoisted package entry being relativized against two different
// Metro/React Gradle monorepo roots on Windows.
import 'expo-router/entry';
