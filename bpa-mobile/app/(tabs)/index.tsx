import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, Image,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

interface Application {
  id: number; application_number: string
  business_name: string; status: string; created_at: string
}
interface Notification {
  id: number; title: string; message: string; type?: string; is_read: number; created_at: string
}

const STATUS: Record<string, { color: string; bg: string; label: string }> = {
  pending:      { color: '#D97706', bg: '#FEF3C7', label: 'Pending' },
  under_review: { color: '#2563EB', bg: '#DBEAFE', label: 'Under Review' },
  approved:     { color: '#059669', bg: '#D1FAE5', label: 'Approved' },
  rejected:     { color: '#DC2626', bg: '#FEE2E2', label: 'Rejected' },
  cancelled:    { color: '#6B7280', bg: '#F3F4F6', label: 'Cancelled' },
}

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(18)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start()
  }, [])
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  )
}

export default function Home() {
  const { user, refreshUser } = useAuth()
  const insets = useSafeAreaInsets()
  const [apps, setApps]       = useState<Application[]>([])
  const [notifs, setNotifs]   = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = async (silent = false) => {
    try {
      const [appsRes, notifsRes] = await Promise.all([
        api.get('/applications'),
        api.get('/notifications'),
      ])
      setApps(appsRes.data.data?.slice(0, 3) ?? [])
      setNotifs(notifsRes.data.data?.filter((n: Notification) => !n.is_read).slice(0, 3) ?? [])
      if (silent) { try { await refreshUser() } catch {} }
    } catch {}
    finally { if (!silent) { setLoading(false); setRefreshing(false) } }
  }

  useEffect(() => {
    fetchData(false)
    pollRef.current = setInterval(() => fetchData(true), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const onRefresh = () => { setRefreshing(true); fetchData(false) }
  const isVerified = user?.verification_status === 'verified'

  const quickActions = [
    { label: 'Apply',        icon: 'document-text-outline' as const, route: '/(tabs)/apply',        disabled: !isVerified, color: Colors.secondary },
    { label: 'Map',          icon: 'map-outline'           as const, route: '/(tabs)/map',          disabled: false,       color: Colors.accent },
    { label: 'Transactions', icon: 'receipt-outline'       as const, route: '/(tabs)/transactions', disabled: false,       color: Colors.primary },
  ]

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Banner ── */}
      <FadeIn delay={0}>
        <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
          <View style={s.heroContent}>
            <View style={s.heroLeft}>
              <Text style={s.heroGreeting}>Good day,</Text>
              <Text style={s.heroName}>{user?.first_name} {user?.last_name}</Text>
              <View style={[s.verBadge, { backgroundColor: isVerified ? 'rgba(33,211,117,0.2)' : 'rgba(245,158,11,0.2)' }]}>
                <View style={[s.verDot, { backgroundColor: isVerified ? Colors.emerald : '#F59E0B' }]} />
                <Text style={[s.verText, { color: isVerified ? Colors.emerald : '#F59E0B' }]}>
                  {isVerified ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
            </View>
            <Image source={require('@/assets/images/logo.png')} style={s.heroLogo} resizeMode="contain" />
          </View>

          {!isVerified && (
            <View style={s.heroBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
              <Text style={s.heroBannerText}>Awaiting admin verification to apply for permits</Text>
            </View>
          )}
        </View>
      </FadeIn>

      {/* ── Quick Actions ── */}
      <FadeIn delay={80}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionsRow}>
            {quickActions.map((a, i) => (
              <TouchableOpacity
                key={a.label}
                style={[s.actionCard, a.disabled && s.actionCardOff]}
                onPress={() => !a.disabled && router.push(a.route as any)}
                disabled={a.disabled}
                activeOpacity={0.75}
              >
                <View style={[s.actionIcon, { backgroundColor: a.color + '18' }]}>
                  <Ionicons name={a.icon} size={22} color={a.disabled ? Colors.textLight : a.color} />
                </View>
                <Text style={[s.actionLabel, a.disabled && { color: Colors.textLight }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </FadeIn>

      {/* ── Notifications ── */}
      {notifs.length > 0 && (
        <FadeIn delay={160}>
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Notifications</Text>
              <View style={s.notifBadge}><Text style={s.notifBadgeText}>{notifs.length}</Text></View>
              <TouchableOpacity 
                onPress={() => router.push('/notifications')}
                style={{ marginLeft: 'auto' }}
                activeOpacity={0.7}
              >
                <Text style={s.viewAllText}>View All →</Text>
              </TouchableOpacity>
            </View>
            {notifs.map(n => (
              <TouchableOpacity 
                key={n.id} 
                style={s.notifCard}
                onPress={() => router.push({
                  pathname: '/notification-detail',
                  params: {
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    type: (n as any).type || 'system',
                    created_at: n.created_at,
                  }
                })}
                activeOpacity={0.7}
              >
                <View style={s.notifDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.notifTitle}>{n.title}</Text>
                  <Text style={s.notifMsg} numberOfLines={2}>{n.message}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </FadeIn>
      )}

      {/* ── Recent Applications ── */}
      <FadeIn delay={240}>
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Recent Applications</Text>
          </View>
          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={Colors.accent} />
              <Text style={s.loadingText}>Loading...</Text>
            </View>
          ) : apps.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="document-outline" size={40} color={Colors.border} />
              <Text style={s.emptyTitle}>No applications yet</Text>
              <Text style={s.emptyMsg}>Submit your first permit application to get started.</Text>
              {isVerified && (
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)/apply')}>
                  <Text style={s.emptyBtnText}>Apply Now →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : apps.map(a => {
            const st = STATUS[a.status] ?? STATUS.pending
            return (
              <View key={a.id} style={s.appCard}>
                <View style={[s.appStatusBar, { backgroundColor: st.color }]} />
                <View style={s.appBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.appNum}>{a.application_number}</Text>
                    <Text style={s.appBiz} numberOfLines={1}>{a.business_name}</Text>
                    <Text style={s.appDate}>{new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: st.bg }]}>
                    <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </FadeIn>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },

  // Hero
  hero:           { backgroundColor: Colors.primary, paddingBottom: 16, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroContent:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLeft:       { flex: 1 },
  heroGreeting:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  heroName:       { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 1, letterSpacing: -0.2 },
  heroLogo:       { width: 44, height: 44, opacity: 0.9 },
  verBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  verDot:         { width: 5, height: 5, borderRadius: 3 },
  verText:        { fontSize: 10, fontWeight: '700' },
  heroBanner:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, padding: 9 },
  heroBannerText: { fontSize: 11, color: '#F59E0B', flex: 1, lineHeight: 15 },

  // Sections
  section:        { paddingHorizontal: 16, marginTop: 20 },
  sectionRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:   { fontSize: 16, fontWeight: '700', color: Colors.text },
  viewAllText:    { fontSize: 12, fontWeight: '600', color: Colors.accent },
  notifBadge:     { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  notifBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // Quick actions
  actionsRow:     { flexDirection: 'row', gap: 10 },
  actionCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  actionCardOff:  { opacity: 0.45 },
  actionIcon:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel:    { fontSize: 12, fontWeight: '600', color: Colors.text },

  // Notifications
  notifCard:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  notifDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 4, flexShrink: 0 },
  notifTitle:     { fontSize: 13, fontWeight: '700', color: Colors.text },
  notifMsg:       { fontSize: 12, color: Colors.textMuted, marginTop: 2, lineHeight: 17 },

  // Loading / empty
  loadingBox:     { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', gap: 10 },
  loadingText:    { fontSize: 13, color: Colors.textMuted },
  emptyCard:      { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  emptyTitle:     { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 8 },
  emptyMsg:       { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  emptyBtn:       { marginTop: 12, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  emptyBtnText:   { color: '#fff', fontWeight: '700', fontSize: 13 },

  // App cards
  appCard:        { backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, overflow: 'hidden', flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  appStatusBar:   { width: 4 },
  appBody:        { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  appNum:         { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace' },
  appBiz:         { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 2 },
  appDate:        { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  statusPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
})
