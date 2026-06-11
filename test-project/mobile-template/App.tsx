import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [pressed, setPressed] = React.useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SleekMobile Portal</Text>
      <Text style={styles.subtitle}>Expo / React Native Mock Mobile Template</Text>
      
      <TouchableOpacity 
        style={[styles.button, pressed && styles.buttonPressed]} 
        onPress={() => setPressed(!pressed)}
        testID="btn-mobile-interact"
      >
        <Text style={styles.buttonText}>{pressed ? 'Status: Active' : 'Press Me'}</Text>
      </TouchableOpacity>
      
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonPressed: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
