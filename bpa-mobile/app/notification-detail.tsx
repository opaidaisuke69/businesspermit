import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/theme'
import { useEffect } from 'react'
import api from '@/lib/api'

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  application: { icon: 'document-text', color: '#0B6E4F', label: 'Application' },
  payment:     { icon: 'card', color: '#21D375', label: 'Payment' },
  permit:      { icon: 'ribbon', color: '#08A045', label: 'Permit' },
  system:      { icon: 'notifications', color: '#4A7A72', label: 'System' },
}

export default function NotificationDetail() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams()
  
  const notification = {
    id: Number(params.id),
    title: params.title as string,
    message: params.message as string,
    type: (params.type as string) || 'system',
    created_at: params.created_at as string,
  }

  const meta = TYPE_META[notification.type] || TYPE_META.system

  useEffect(() => {
    // Mark as read when opened
    const markAsRead = async () => {
      try {
        await api.post(`/notifications/${notification.id}/read`)
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }
    }
    markAsRead()
  }, [notification.id])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-PH', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity 
          style={s.backBtn} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={s.content}
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Type Badge */}
        <View style={[s.typeBadge, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
          <Text style={[s.typeText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{notification.title}</Text>

        {/* Date */}
        <View style={s.dateRow}>
          <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
          <Text style={s.date}>{formatDate(notification.created_at)}</Text>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Message */}
        <Text style={s.message}>{notification.message}</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 30,
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  date: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 20,
  },
  message: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
  },
})
