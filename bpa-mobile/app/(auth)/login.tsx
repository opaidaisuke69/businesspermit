import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, StatusBar, Dimensions, Modal,
} from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

const { width: W, height: H } = Dimensions.get('window')

export default function Login() {
  const { login } = useAuth()
  const params = useLocalSearchParams<{ deactivated?: string }>()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [deactivatedModal, setDeactivatedModal] = useState(
    params.deactivated === '1'  // show immediately if redirected from session expiry
  )

  const handleLogin = async () => {
    setError('')
    if (!email.trim() || !password) { setError('Email and password are required'); return }
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/')
    } catch (err: any) {
      // Deactivated account — show modal
      if (err.response?.data?.account_deactivated) {
        setDeactivatedModal(true)
        return
      }
      if (err.response?.data?.email_unverified) {
        const userEmail = email.trim().toLowerCase()
        try { await api.post('/auth/send-verification', { email: userEmail, method: 'code' }) } catch {}
        router.push({ pathname: '/(auth)/verify-email', params: { email: userEmail, method: 'code' } })
        return
      }
      setError(
        err.response?.data?.error ??
        (err.code === 'ECONNABORTED' ? 'Request timed out. Check your connection.' :
         err.message?.includes('Network') ? 'Cannot reach server. Check your Wi-Fi.' :
         'Login failed. Please try again.')
      )
    } finally { setLoading(false) }
  }

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Background blobs */}
        <View style={s.blob1} />
        <View style={s.blob2} />

        {/* ── Hero section ── */}
        <View style={s.hero}>
          {/* Logo */}
          <View style={s.logoWrap}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={s.appName}>LCC BPA</Text>
          <Text style={s.appFull}>La Carlota City</Text>
          <Text style={s.appFull2}>Business Permit Application</Text>

          {/* Decorative pills */}
          <View style={s.pillRow}>
            {['🏛️ Government', '🔒 Secure', '📱 Digital'].map(p => (
              <View key={p} style={s.pill}>
                <Text style={s.pillText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          {/* Card top accent */}
          <View style={s.cardAccent} />

          <Text style={s.cardTitle}>Welcome Back</Text>
          <Text style={s.cardSub}>Sign in to your peddler account</Text>

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorIcon}>⚠</Text>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Email Address</Text>
            <View style={[s.inputRow, error && !email && s.inputErr]}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={s.fieldIcon} />
              <TextInput
                style={[s.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                value={email}
                onChangeText={v => { setError(''); setEmail(v) }}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={Colors.textLight}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Password</Text>
            <View style={[s.inputRow, error && !password && s.inputErr]}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={s.fieldIcon} />
              <TextInput
                style={[s.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                value={password}
                onChangeText={v => { setError(''); setPassword(v) }}
                placeholder="••••••••"
                secureTextEntry={!showPw}
                placeholderTextColor={Colors.textLight}
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn}>
                <Ionicons
                  name={showPw ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In button */}
          <TouchableOpacity
            style={[s.btn, loading && s.btnOff]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <View style={s.btnRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[s.btnText, { marginLeft: 8 }]}>Signing in...</Text>
                </View>
              : <Text style={s.btnText}>Sign In →</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Forgot password */}
          <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')} disabled={loading}>
            <Ionicons name="key-outline" size={14} color={Colors.textMuted} />
            <Text style={s.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Register link */}
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={s.registerBtn} disabled={loading}>
              <Text style={s.registerText}>Create New Account</Text>
            </TouchableOpacity>
          </Link>

          <Text style={s.disclaimer}>
            For peddlers of La Carlota City only
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>

    {/* ── Deactivated Account Modal ── */}
    <Modal visible={deactivatedModal} transparent animationType="fade" statusBarTranslucent>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <View style={s.modalIconWrap}>
            <Ionicons name="ban" size={40} color="#DC2626" />
          </View>
          <Text style={s.modalTitle}>Account Deactivated</Text>
          <Text style={s.modalBody}>
            Your account has been deactivated by the admin. You cannot log in at this time.
          </Text>
          <Text style={s.modalContact}>
            Please contact the market office for assistance.
          </Text>
          <TouchableOpacity style={s.modalBtn} onPress={() => setDeactivatedModal(false)} activeOpacity={0.85}>
            <Text style={s.modalBtnText}>OK, I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  )
}

const s = StyleSheet.create({
  scroll:       { flexGrow: 1, backgroundColor: Colors.primary, minHeight: H },

  // Background decorative blobs
  blob1:        { position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: Colors.secondary, opacity: 0.35 },
  blob2:        { position: 'absolute', top: 120, left: -100, width: 220, height: 220, borderRadius: 110, backgroundColor: Colors.accent, opacity: 0.15 },

  // Hero
  hero:         { alignItems: 'center', paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 },
  logoWrap:     { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logo:         { width: 160, height: 160 },
  appName:      { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  appFull:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  appFull2:     { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  hallWrap:     { width: W - 48, borderRadius: 16, overflow: 'hidden', marginTop: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  hall:         { width: '100%', height: 140 },
  pillRow:      { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  pill:         { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pillText:     { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  // Card
  card:         { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  cardAccent:   { height: 4, backgroundColor: Colors.accent },
  cardTitle:    { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 24, marginHorizontal: 24, letterSpacing: -0.3 },
  cardSub:      { fontSize: 13, color: Colors.textMuted, marginTop: 4, marginHorizontal: 24, marginBottom: 20 },

  // Error
  errorBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginHorizontal: 24, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  errorIcon:       { fontSize: 14, marginTop: 1 },
  errorText:       { flex: 1, fontSize: 13, color: '#DC2626', lineHeight: 18 },

  // Deactivated banner
  deactivatedBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginHorizontal: 24, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#D97706' },
  deactivatedText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  // Fields
  fieldWrap:    { marginHorizontal: 24, marginBottom: 14 },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:        { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: Colors.text },
  inputErr:     { borderColor: '#FCA5A5' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg, paddingHorizontal: 14, gap: 8 },
  fieldIcon:    { marginRight: 2 },
  eyeBtn:       { padding: 6 },

  // Button
  btn:          { marginHorizontal: 24, marginTop: 8, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  btnOff:       { opacity: 0.65, shadowOpacity: 0 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  btnRow:       { flexDirection: 'row', alignItems: 'center' },

  // Divider
  divider:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 16, gap: 10 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText:  { fontSize: 12, color: Colors.textLight, fontWeight: '500' },

  // Forgot
  forgotBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 24, marginBottom: 4, paddingVertical: 8 },
  forgotText:   { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },

  // Register
  registerBtn:  { marginHorizontal: 24, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary },
  registerText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  disclaimer:   { fontSize: 11, color: Colors.textLight, textAlign: 'center', marginTop: 16, marginBottom: 24, marginHorizontal: 24 },

  // Deactivated modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard:     { backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 16 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: '#DC2626', marginBottom: 10, textAlign: 'center' },
  modalBody:     { fontSize: 14, color: Colors.text, textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  modalContact:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  modalBtn:      { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' },
  modalBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
})
