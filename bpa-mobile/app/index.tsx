import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'

/**
 * Entry point — runs once on app launch.
 * Reads the persisted session from SecureStore and redirects:
 *   No session      → Login screen
 *   Session + onboarding incomplete → Onboarding
 *   Session + onboarding complete   → Tabs (dashboard)
 */
export default function Index() {
  const { user, loading, deactivated } = useAuth()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace(deactivated ? '/(auth)/login?deactivated=1' : '/(auth)/login')
      return
    }

    // Explicitly check if onboarding is not completed (0 or falsy)
    if (!user.onboarding_completed || user.onboarding_completed === 0) {
      router.replace('/onboarding')
      return
    }

    router.replace('/(tabs)')
  }, [user, loading, deactivated])

  // Show a splash-style loader while the session is being read
  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
