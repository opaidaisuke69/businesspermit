import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

interface Notification {
  id: number
  title: string
  message: string
  type: string
  is_read: number
  created_at: string
}

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  application: { icon: 'document-text', color: '#0B6E4F', label: 'Application' },
  payment:     { icon: 'card', color: '#21D375', label: 'Payment' },
  permit:      { icon: 'ribbon', color: '#08A045', label: 'Permit' },
  system:      { icon: 'notifications', color: '#4A7A72', label: 'System' },
}

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const anim  = useRef(new Animated.Value(0)).current
  const slide = useRef(new Animated.Value(16)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start()
  }, [])
  return <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>{children}</Animated.View>
}

function NotificationCard({ notif, index }: { notif: Notification; index: number }) {
  const meta = TYPE_META[notif.type] || TYPE_META.system

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
  }

  return (
    <FadeIn delay={index * 40}>
      <TouchableOpacity
        style={[s.card, !notif.is_read && s.cardUnread]}
        onPress={() => router.push({
          pathname: '/notification-detail',
          params: {
            id: notif.id,
            title: notif.title,
            message: notif.message,
            type: notif.type,
            created_at: notif.created_at,
          }
        })}
        activeOpacity={0.7}
      >
        <View style={[s.iconBox, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={s.content}>
          <View style={s.header}>
            <Text style={s.title} numberOfLines={1}>{notif.title}</Text>
            {!notif.is_read && <View style={s.unreadDot} />}
          </View>
          <Text style={s.message} numberOfLines={2}>{notif.message}</Text>
          <View style={s.footer}>
            <View style={[s.typeBadge, { backgroundColor: meta.color + '15' }]}>
              <Text style={[s.typeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Text style={s.time}>{timeAgo(notif.created_at)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
      </TouchableOpacity>
    </FadeIn>
  )
}

export default function Notifications() {
  const insets = useSafeAreaInsets()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [refreshing, setRefreshing]       = useState(false)
  const [filter, setFilter]               = useState<'all' | 'unread'>('all')

  const fetchNotifications = async (silent = false) => {
    try {
      const res = await api.get('/notifications')
      setNotifications(res.data.data ?? [])
    } catch {}
    finally {
      if (!silent) { setLoading(false); setRefreshing(false) }
    }
  }

  useEffect(() => { fetchNotifications(false) }, [])

  const onRefresh = () => { setRefreshing(true); fetchNotifications(false) }

  const filteredNotifs = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.headerContainer, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity 
          style={s.backBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Notifications</Text>
          <Text style={s.headerSub}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </Text>
        </View>
        <View style={s.headerBadge}>
          <Ionicons name="notifications" size={20} color="#fff" />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={s.filterContainer}>
        <TouchableOpacity
          style={[s.filterTab, filter === 'all' && s.filterTabActive]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterText, filter === 'all' && s.filterTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterTab, filter === 'unread' && s.filterTabActive]}
          onPress={() => setFilter('unread')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterText, filter === 'unread' && s.filterTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={s.centerText}>Loading notifications...</Text>
          </View>
        ) : filteredNotifs.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-outline" size={48} color={Colors.border} />
            <Text style={s.emptyTitle}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </Text>
            <Text style={s.emptyMsg}>
              {filter === 'unread' 
                ? "You're all caught up! Check back later for updates."
                : 'Notifications about your applications and permits will appear here.'}
            </Text>
          </View>
        ) : (
          filteredNotifs.map((notif, i) => (
            <NotificationCard key={notif.id} notif={notif} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  headerContainer: {
    backgroundColor: Colors.primary,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  message: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
    color: Colors.textLight,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  centerText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyMsg: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 19,
  },
})
