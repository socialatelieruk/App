import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.socialatelier.app',
  appName: 'Social Atelier',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      // Show notifications even while the app is open.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#faf5ef',
    },
  },
}

export default config
