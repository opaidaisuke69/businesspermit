import { Tabs, router } from 'expo-router'
import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import { Ionicons } from '@expo/vector-icons'

export default function TabLayout() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace('/(auth)/login')
  }, [user, loading])

  // Don't render tabs if user hasn't completed onboarding
  if (loading || !user || !user.onboarding_completed || user.onboarding_completed === 0) return null

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textLight,
      tabBarStyle: { borderTopColor: Colors.border, backgroundColor: '#fff' },
    }}>
      {/* Home — no header, screen owns its own hero */}
      <Tabs.Screen name="index" options={{
        title: 'Home',
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
      }} />

      {/* Apply — no header, screen has custom header */}
      <Tabs.Screen name="apply" options={{
        title: 'Apply',
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
      }} />

      {/* Map — no header, screen has custom header */}
      <Tabs.Screen name="map" options={{
        title: 'Map',
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
      }} />

      {/* Profile — no header, screen owns its own hero */}
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
      }} />

      {/* Transactions — hidden from tab bar, accessible via Quick Actions */}
      <Tabs.Screen name="transactions" options={{
        title: 'Transactions',
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        href: null, // hide from tab bar
      }} />
    </Tabs>
  )
}
