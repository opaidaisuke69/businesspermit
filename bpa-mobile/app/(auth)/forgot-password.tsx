import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Modal, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

export default function ForgotPassword() {
  const insets = useSafeAreaInsets()
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [methodModal, setMethodModal] = useState(false)
  const modalAnim = useRef(new Animated.Value(0)).current

  const openModal = () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setError('')
    setMethodModal(true)
    Animated.spring(modalAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start()
  }

  const send = async (method: 'code' | 'link') => {
    setMethodModal(false)
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase(), method })
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email: email.trim().toLowerCase(), method },
      })
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to send. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView contentContainerStyle={[st.scroll, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={st.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={st.backText}>Back to Login</Text>
        </TouchableOpacity>

        <View style={st.header}>
          <View style={st.iconCircle}>
            <Ionicons name="key-outline" size={32} color={Colors.emerald} />
          </View>
          <Text style={st.title}>Forgot Password?</Text>
          <Text style={st.sub}>Enter your registered email and we'll send you a reset code or link.</Text>
        </View>

        <View style={st.card}>
          {!!error && (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={st.errorText}>{error}</Text>
            </View>
          )}

          <Text style={st.fieldLabel}>Email Address</Text>
          <View style={st.inputRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={st.input}
              value={email}
              onChangeText={v => { setError(''); setEmail(v) }}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={Colors.textLight}
              editable={!loading}
            />
          </View>

          <TouchableOpacity style={[st.btn, loading && st.btnOff]} onPress={openModal} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={[st.btnText, { marginLeft: 8 }]}>Sending...</Text></>
              : <Text style={st.btnText}>Continue →</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Method selection modal */}
      <Modal visible={methodModal} transparent animationType="none" onRequestClose={() => setMethodModal(false)}>
        <View style={st.backdrop}>
          <Animated.View style={[st.sheet, { opacity: modalAnim, transform: [{ scale: modalAnim }] }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>How to receive reset?</Text>
            <Text style={st.sheetSub}>Choose how you want to reset your password</Text>

            <TouchableOpacity style={st.methodBtn} onPress={() => send('code')} activeOpacity={0.85}>
              <View style={[st.methodIcon, { backgroundColor: Colors.accent + '18' }]}>
                <Ionicons name="keypad-outline" size={24} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.methodTitle}>Send OTP Code</Text>
                <Text style={st.methodSub}>6-digit code sent to your email · expires in 15 min</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={st.methodBtn} onPress={() => send('link')} activeOpacity={0.85}>
              <View style={[st.methodIcon, { backgroundColor: Colors.secondary + '18' }]}>
                <Ionicons name="link-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.methodTitle}>Send Reset Link</Text>
                <Text style={st.methodSub}>Secure link sent to your email · expires in 30 min</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={st.cancelBtn} onPress={() => setMethodModal(false)}>
              <Text style={st.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  scroll:       { flexGrow: 1, backgroundColor: Colors.primary, padding: 24 },
  backRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backText:     { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  header:       { alignItems: 'center', marginBottom: 28 },
  iconCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(33,211,117,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(33,211,117,0.3)' },
  title:        { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  card:         { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  errorText:    { flex: 1, fontSize: 13, color: '#DC2626' },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg, paddingHorizontal: 14, marginBottom: 16 },
  input:        { flex: 1, paddingVertical: 13, fontSize: 14, color: Colors.text },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  btnOff:       { opacity: 0.6, shadowOpacity: 0 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Modal
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:        { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 32, elevation: 16 },
  sheetHandle:  { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:   { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  sheetSub:     { fontSize: 13, color: Colors.textMuted, marginTop: 4, marginBottom: 20 },
  methodBtn:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.bg, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: Colors.border },
  methodIcon:   { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodTitle:  { fontSize: 15, fontWeight: '700', color: Colors.text },
  methodSub:    { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cancelBtn:    { alignItems: 'center', marginTop: 8, paddingVertical: 10 },
  cancelText:   { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
})
