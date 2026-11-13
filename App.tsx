import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerApp } from './src/LedgerApp';
import { LedgerProvider } from './src/state/LedgerProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <LedgerProvider>
        <LedgerApp />
      </LedgerProvider>
    </SafeAreaProvider>
  );
}
