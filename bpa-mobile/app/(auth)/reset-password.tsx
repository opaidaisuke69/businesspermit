import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, Animated, Dimensions,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

const { width: W } = Dimensions.get('window')

export default function ResetPassword() {
  const { email, method } = useLocalSearchParams<{ email: string; method: string }>()
  const insets = useSafeAreaInsets()

  const [otp, setOtp]           = useState(['', '', '', '', '', ''])
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputs = useRef<(TextInput | null)[]>([])
  const successAnim = useRef(new Animated.Value(0)).current
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startCountdown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current!); return 0 } return c - 1 })
    }, 1000)
  }

  const handleOtpChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]; next[idx] = val.slice(-1); setOtp(next); setError('')
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
    if (!val && idx > 0) inputs.current[idx - 1]?.focus()
  }

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) inputs.current[idx - 1]?.focus()
  }

  const handleReset = async () => {
    setError('')
    const code = otp.join('')
    if (code.length < 6) { setError('Enter all 6 digits of the code'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      await api.post('/auth/reset-password-code', {
        email: email?.trim().toLowerCase(),
        otp: code,
        new_password: newPw,
      })
      setSuccess(true)
      Animated.spring(successAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start()
      setTimeout(() => router.replace('/(auth)/login'), 2500)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Reset failed. Please try again.')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  const resend = async () => {
    if (countdown > 0) return
    setResending(true)
    try {
      await api.post('/auth/forgot-password', { email: email?.trim().toLowerCase(), method: method ?? 'code' })
      startCountdown()
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to resend')
    } finally { setResending(false) }
  }

  if (method === 'link') {
    return (
      <View style={[st.root, { paddingTop: insets.top + 20 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <View style={st.linkCard}>
          <Text style={st.linkIcon}>📧</Text>
          <Text style={st.linkTitle}>Check Your Email</Text>
          <Text style={st.linkMsg}>We sent a password reset link to{'\n'}<Text style={st.linkEmail}>{email}</Text></Text>
          <Text style={st.linkSub}>Click the link to reset your password, then come back to sign in.</Text>
          <TouchableOpacity style={st.backBtn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={st.backBtnText}>← Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <ScrollView contentContainerStyle={[st.scroll, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={st.backRow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          <Text style={st.backText}>Back</Text>
        </TouchableOpacity>

        <View style={st.header}>
          <View style={st.iconCircle}>
            <Ionicons name="lock-open-outline" size={32} color={Colors.emerald} />
          </View>
          <Text style={st.title}>Reset Password</Text>
          <Text style={st.sub}>Enter the code sent to</Text>
          <Text style={st.emailText}>{email}</Text>
        </View>

        {success ? (
          <Animated.View style={[st.successBox, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
            <Text style={st.successIcon}>🎉</Text>
            <Text style={st.successText}>Password Reset!</Text>
            <Text style={st.successSub}>Redirecting to login...</Text>
          </Animated.View>
        ) : (
          <View style={st.card}>
            {!!error && (
              <View style={st.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={st.errorText}>{error}</Text>
              </View>
            )}

            {/* OTP */}
            <Text style={st.fieldLabel}>Reset Code</Text>
            <View style={st.otpRow}>
              {otp.map((digit, i) => (
                <TextInput key={i} ref={r => { inputs.current[i] = r }}
                  style={[st.otpInput, digit && st.otpInputFilled]}
                  value={digit} onChangeText={v => handleOtpChange(v, i)}
                  onKeyPress={e => handleKeyPress(e, i)}
                  keyboardType="number-pad" maxLength={1} selectTextOnFocus editable={!loading} />
              ))}
            </View>

            {/* New password */}
            <Text style={[st.fieldLabel, { marginTop: 4 }]}>New Password</Text>
            <View style={st.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
              <TextInput style={st.input} value={newPw} onChangeText={v => { setError(''); setNewPw(v) }}
                placeholder="Min. 8 characters" secureTextEntry={!showPw} placeholderTextColor={Colors.textLight} editable={!loading} />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ padding: 6 }}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={st.fieldLabel}>Confirm Password</Text>
            <View style={st.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} />
              <TextInput style={st.input} value={confirmPw} onChangeText={v => { setError(''); setConfirmPw(v) }}
                placeholder="Repeat password" secureTextEntry={!showPw} placeholderTextColor={Colors.textLight} editable={!loading} />
            </View>

            <TouchableOpacity style={[st.btn, loading && st.btnOff]} onPress={handleReset} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={[st.btnText, { marginLeft: 8 }]}>Resetting...</Text></>
                : <Text style={st.btnText}>Reset Password →</Text>
              }
            </TouchableOpacity>

            <View style={st.resendRow}>
              <Text style={st.resendLabel}>Didn't receive it? </Text>
              <TouchableOpacity onPress={resend} disabled={countdown > 0 || resending}>
                {resending ? <ActivityIndicator size="small" color={Colors.accent} />
                  : <Text style={[st.resendBtn, countdown > 0 && st.resendBtnOff]}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll:       { flexGrow: 1, backgroundColor: Colors.primary, padding: 24 },
  backRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backText:     { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  header:       { alignItems: 'center', marginBottom: 28 },
  iconCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(33,211,117,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(33,211,117,0.3)' },
  title:        { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  sub:          { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  emailText:    { fontSize: 14, fontWeight: '700', color: Colors.emerald, marginTop: 2 },
  card:         { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  errorBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  errorText:    { flex: 1, fontSize: 13, color: '#DC2626' },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  otpRow:       { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 18 },
  otpInput:     { width: (W - 48 - 48 - 40) / 6, height: 52, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, backgroundColor: Colors.bg, textAlign: 'center', fontSize: 20, fontWeight: '800', color: Colors.text },
  otpInputFilled: { borderColor: Colors.accent, backgroundColor: Colors.accent + '10' },
  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg, paddingHorizontal: 14, marginBottom: 14 },
  input:        { flex: 1, paddingVertical: 12, fontSize: 14, color: Colors.text },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  btnOff:       { opacity: 0.6, shadowOpacity: 0 },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  resendRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  resendLabel:  { fontSize: 13, color: Colors.textMuted },
  resendBtn:    { fontSize: 13, color: Colors.accent, fontWeight: '700' },
  resendBtnOff: { color: Colors.textLight },
  successBox:   { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  successIcon:  { fontSize: 52 },
  successText:  { fontSize: 22, fontWeight: '800', color: Colors.text },
  successSub:   { fontSize: 13, color: Colors.textMuted },
  linkCard:     { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 10, width: '100%' },
  linkIcon:     { fontSize: 52 },
  linkTitle:    { fontSize: 22, fontWeight: '800', color: Colors.text },
  linkMsg:      { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  linkEmail:    { color: Colors.primary, fontWeight: '700' },
  linkSub:      { fontSize: 12, color: Colors.textLight, textAlign: 'center', lineHeight: 17 },
  backBtn:      { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  backBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
})
