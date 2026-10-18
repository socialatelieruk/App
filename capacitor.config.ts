import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'uk.socialatelier.planner',
  appName: 'Content Planner',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#faf8f5',
    },
  },
}

export default config
