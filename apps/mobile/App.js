import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { chatbotApi } from '@urbanmind/shared-api';

export default function App() {
  useEffect(() => {
    console.log('Shared API layer initialized for mobile:', typeof chatbotApi.sendMessage === 'function');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>UrbanMind Mobile App</Text>
      <Text style={styles.subtitle}>Citizen & Helper Portal Placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0052CC',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
