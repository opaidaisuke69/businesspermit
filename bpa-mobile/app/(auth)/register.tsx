import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, StatusBar, Dimensions, Modal, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

const { height: H } = Dimensions.get('window')

const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated']

const FIELDS = [
  { key: 'first_name',   label: 'First Name',   ph: 'Juan',                      kb: 'default'       as const, icon: '👤' },
  { key: 'middle_name',  label: 'Middle Name',  ph: 'Santos',                    kb: 'default'       as const, icon: '👤' },
  { key: 'last_name',    label: 'Last Name',    ph: 'Dela Cruz',                  kb: 'default'       as const, icon: '👤' },
  { key: 'age',          label: 'Age',          ph: 'e.g. 35',                    kb: 'numeric'       as const, icon: '🎂' },
  { key: 'email',        label: 'Email',        ph: 'juan@email.com',             kb: 'email-address' as const, icon: '✉️' },
  { key: 'phone',        label: 'Phone',        ph: '09XXXXXXXXX',                kb: 'phone-pad'     as const, icon: '📱' },
  { key: 'address',      label: 'Address',      ph: 'Barangay, La Carlota City',  kb: 'default'       as const, icon: '📍' },
  { key: 'password',     label: 'Password',     ph: 'Min. 8 characters',          kb: 'default'       as const, icon: '🔑', secure: true },
]

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', age: '', civil_status: '',
    ctc_number: '', email: '', phone: '', address: '', password: '', gender: '',
  })
  const [showPw, setShowPw]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [step, setStep]           = useState(1)
  const [successModal, setSuccessModal] = useState(false)
  const [methodModal, setMethodModal]   = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [civilStatusOpen, setCivilStatusOpen] = useState(false)
  const methodAnim = useRef(new Animated.Value(0)).current

  // Animation values for the success modal
  const backdropOpacity = useRef(new Animated.Value(0)).current
  const cardScale       = useRef(new Animated.Value(0.7)).current
  const cardOpacity     = useRef(new Animated.Value(0)).current
  const checkScale      = useRef(new Animated.Value(0)).current
  const checkOpacity    = useRef(new Animated.Value(0)).current

  const showSuccess = () => {
    setSuccessModal(true)
    // Staggered entrance animation
    Animated.sequence([
      // 1. Fade in backdrop
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      // 2. Card pops in with spring
      Animated.parallel([
        Animated.spring(cardScale,   { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      // 3. Checkmark bounces in
      Animated.parallel([
        Animated.spring(checkScale,   { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
    ]).start()
  }

  const handleGoToLogin = () => {
    // Fade out then navigate
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardOpacity,     { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cardScale,       { toValue: 0.85, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setSuccessModal(false)
      router.replace('/(auth)/login')
    })
  }

  const sendVerification = async (method: 'code' | 'link') => {
    setMethodModal(false)
    setLoading(true)
    try {
      await api.post('/auth/pre-register', { ...form, method })
      // Go directly to verify screen — no success modal here
      // Success modal only shows AFTER email is verified (in verify-email.tsx)
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: registeredEmail, method },
      })
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Failed to send verification. Please try again.')
    } finally { setLoading(false) }
  }

  const validateStep1 = () => {
    if (!form.first_name.trim())    { setError('First name is required');    return false }
    if (!form.middle_name.trim())   { setError('Middle name is required');   return false }
    if (!form.last_name.trim())     { setError('Last name is required');     return false }
    if (!form.age.trim())           { setError('Age is required');           return false }
    if (!form.gender)               { setError('Gender is required');        return false }
    if (!form.civil_status.trim())  { setError('Civil status is required');  return false }
    return true
  }

  const handleNext = () => {
    if (!validateStep1()) return
    setError('')
    setStep(2)
  }

  const handleRegister = async () => {
    setError('')
    if (!form.email.trim())    { setError('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address'); return }
    if (!form.phone.trim())    { setError('Phone is required'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }

    // Just open the method modal — API call happens in sendVerification()
    setRegisteredEmail(form.email.trim().toLowerCase())
    setMethodModal(true)
    Animated.spring(methodAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start()
  }

  const step1Fields = FIELDS.slice(0, 4)  // first_name, middle_name, last_name, age
  const step2Fields = FIELDS.slice(4)     // email, phone, address, password

  const set = (k: string) => (v: string) => { setError(''); setForm(f => ({ ...f, [k]: v })) }

  return (
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

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.logoWrap}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={s.appName}>Create Account</Text>
          <Text style={s.appSub}>Register as a peddler in La Carlota City</Text>

          {/* Step indicator */}
          <View style={s.stepRow}>
            {[1, 2].map(n => (
              <View key={n} style={s.stepItem}>
                <View style={[s.stepCircle, step >= n && s.stepCircleOn]}>
                  {step > n
                    ? <Text style={s.stepCheckText}>✓</Text>
                    : <Text style={[s.stepNum, step === n && s.stepNumOn]}>{n}</Text>
                  }
                </View>
                <Text style={[s.stepLabel, step >= n && s.stepLabelOn]}>
                  {n === 1 ? 'Personal' : 'Contact'}
                </Text>
              </View>
            ))}
            <View style={[s.stepConnector, step >= 2 && s.stepConnectorOn]} />
          </View>
        </View>

        {/* ── Card ── */}
        <View style={s.card}>
          <View style={s.cardAccent} />

          <Text style={s.cardTitle}>{step === 1 ? 'Personal Information' : 'Contact & Security'}</Text>
          <Text style={s.cardSub}>{step === 1 ? 'Tell us about yourself' : 'How can we reach you?'}</Text>

          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorIcon}>⚠</Text>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* Step 1 fields */}
          {step === 1 && (
            <>
              {step1Fields.map(f => (
                <View key={f.key} style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>
                    {f.label} <Text style={s.req}>*</Text>
                  </Text>
                  <TextInput
                    style={s.input}
                    value={form[f.key as keyof typeof form]}
                    onChangeText={set(f.key)}
                    placeholder={f.ph}
                    keyboardType={f.kb}
                    autoCapitalize={f.key === 'age' ? 'none' : 'words'}
                    placeholderTextColor={Colors.textLight}
                    editable={!loading}
                  />
                </View>
              ))}

              {/* Gender toggle */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Gender <Text style={s.req}>*</Text></Text>
                <View style={s.genderRow}>
                  {(['male','female','other'] as const).map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[s.genderBtn, form.gender === g && s.genderBtnOn]}
                      onPress={() => { setError(''); setForm(f => ({ ...f, gender: g })) }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.genderBtnText, form.gender === g && s.genderBtnTextOn]}>
                        {g === 'male' ? '♂ Male' : g === 'female' ? '♀ Female' : '⚧ Other'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Civil Status dropdown */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Civil Status <Text style={s.req}>*</Text></Text>
                <TouchableOpacity
                  style={[s.input, s.pickerBtn]}
                  onPress={() => setCivilStatusOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.pickerBtnText, !form.civil_status && { color: Colors.textLight }]}>
                    {form.civil_status || 'Select civil status'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* CTC Number — optional, after civil status */}
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>CTC Number <Text style={{ color: Colors.textLight, fontWeight: '400' }}>(optional)</Text></Text>
                <TextInput
                  style={s.input}
                  value={form.ctc_number}
                  onChangeText={set('ctc_number')}
                  placeholder="Community Tax Certificate No."
                  placeholderTextColor={Colors.textLight}
                  editable={!loading}
                />
              </View>

              {/* Civil Status Modal */}
              <Modal visible={civilStatusOpen} transparent animationType="fade" onRequestClose={() => setCivilStatusOpen(false)}>
                <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={() => setCivilStatusOpen(false)}>
                  <View style={s.pickerSheet}>
                    <Text style={s.pickerTitle}>Select Civil Status</Text>
                    {CIVIL_STATUS_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[s.pickerOption, form.civil_status === opt && s.pickerOptionOn]}
                        onPress={() => { set('civil_status')(opt); setCivilStatusOpen(false) }}
                      >
                        <Text style={[s.pickerOptionText, form.civil_status === opt && s.pickerOptionTextOn]}>{opt}</Text>
                        {form.civil_status === opt && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableOpacity>
              </Modal>
            </>
          )}

          {/* Step 2 fields */}
          {step === 2 && step2Fields.map(f => (
            <View key={f.key} style={s.fieldWrap}>
              <Text style={s.fieldLabel}>
                {f.label} {f.key !== 'address' && <Text style={s.req}>*</Text>}
              </Text>
              {f.key === 'email' ? (
                <View style={s.inputRow}>
                  <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={s.fieldIcon} />
                  <TextInput
                    style={[s.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                    value={form[f.key as keyof typeof form]}
                    onChangeText={set(f.key)}
                    placeholder={f.ph}
                    keyboardType={f.kb}
                    autoCapitalize="none"
                    placeholderTextColor={Colors.textLight}
                    editable={!loading}
                  />
                </View>
              ) : f.secure ? (
                <View style={s.inputRow}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={s.fieldIcon} />
                  <TextInput
                    style={[s.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                    value={form[f.key as keyof typeof form]}
                    onChangeText={set(f.key)}
                    placeholder={f.ph}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
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
              ) : (
                <TextInput
                  style={s.input}
                  value={form[f.key as keyof typeof form]}
                  onChangeText={set(f.key)}
                  placeholder={f.ph}
                  keyboardType={f.kb}
                  autoCapitalize={f.key === 'email' ? 'none' : 'sentences'}
                  placeholderTextColor={Colors.textLight}
                  editable={!loading}
                />
              )}
            </View>
          ))}

          {/* Action button */}
          {step === 1 ? (
            <TouchableOpacity style={s.btn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={s.btnText}>Continue →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.btn, loading && s.btnOff]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <View style={s.btnRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={[s.btnText, { marginLeft: 8 }]}>Creating account...</Text>
                  </View>
                : <Text style={s.btnText}>Create Account ✓</Text>
              }
            </TouchableOpacity>
          )}

          {step === 2 && (
            <TouchableOpacity style={s.backBtn} onPress={() => { setError(''); setStep(1) }} disabled={loading}>
              <Text style={s.backText}>← Back</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>Already Registered?</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.loginBtn} onPress={() => router.replace('/(auth)/login')} disabled={loading}>
            <Text style={s.loginText}>Sign In Instead</Text>
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            By registering, you agree to provide accurate information for permit processing.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Verification Method Modal ── */}
      <Modal visible={methodModal} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View style={m.backdrop}>
          <Animated.View style={[m.card, { opacity: methodAnim, transform: [{ scale: methodAnim }] }]}>
            <View style={m.handle} />
            <Text style={m.methodTitle}>Verify Your Email</Text>
            <Text style={m.methodSub}>Choose how to verify your email address</Text>

            <TouchableOpacity style={m.methodBtn} onPress={() => sendVerification('code')} activeOpacity={0.85}>
              <View style={[m.methodIcon, { backgroundColor: Colors.accent + '18' }]}>
                <Ionicons name="keypad-outline" size={24} color={Colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.methodBtnTitle}>Send OTP Code</Text>
                <Text style={m.methodBtnSub}>6-digit code · expires in 15 min</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={m.methodBtn} onPress={() => sendVerification('link')} activeOpacity={0.85}>
              <View style={[m.methodIcon, { backgroundColor: Colors.secondary + '18' }]}>
                <Ionicons name="link-outline" size={24} color={Colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.methodBtnTitle}>Send Verification Link</Text>
                <Text style={m.methodBtnSub}>Secure link · expires in 30 min</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal visible={successModal} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[m.backdrop, { opacity: backdropOpacity }]}>
          <Animated.View style={[m.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>

            {/* Animated checkmark circle */}
            <Animated.View style={[m.checkCircle, { opacity: checkOpacity, transform: [{ scale: checkScale }] }]}>
              <View style={m.checkRing} />
              <Ionicons name="checkmark" size={44} color="#fff" />
            </Animated.View>

            <Text style={m.title}>Account Created!</Text>
            <Text style={m.subtitle}>Welcome to LCC BPA</Text>
            <Text style={m.body}>
              {'Your account has been created successfully.\nPlease wait for admin verification before applying for a permit.'}
            </Text>

            {/* Info chips */}
            <View style={m.chips}>
              <View style={m.chip}>
                <Ionicons name="time-outline" size={14} color={Colors.secondary} />
                <Text style={m.chipText}>Verification pending</Text>
              </View>
              <View style={m.chip}>
                <Ionicons name="notifications-outline" size={14} color={Colors.secondary} />
                <Text style={m.chipText}>You'll be notified</Text>
              </View>
            </View>

            <TouchableOpacity style={m.btn} onPress={handleGoToLogin} activeOpacity={0.85}>
              <Text style={m.btnText}>Go to Login</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scroll:         { flexGrow: 1, backgroundColor: Colors.primary, minHeight: H },

  blob1:          { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: Colors.secondary, opacity: 0.3 },
  blob2:          { position: 'absolute', top: 200, left: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: Colors.emerald, opacity: 0.12 },

  // Header
  header:         { alignItems: 'center', paddingTop: 52, paddingBottom: 24, paddingHorizontal: 24 },
  logoWrap:       { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logo:           { width: 100, height: 100 },
  appName:        { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  appSub:         { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, textAlign: 'center' },

  // Step indicator
  stepRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 0, position: 'relative' },
  stepConnector:  { position: 'absolute', left: '25%', right: '25%', height: 2, backgroundColor: 'rgba(255,255,255,0.2)', top: 16, zIndex: 0 },
  stepConnectorOn:{ backgroundColor: Colors.emerald },
  stepItem:       { alignItems: 'center', gap: 6, flex: 1, zIndex: 1 },
  stepCircle:     { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  stepCircleOn:   { backgroundColor: Colors.emerald, borderColor: Colors.emerald },
  stepNum:        { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  stepNumOn:      { color: '#fff' },
  stepCheckText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  stepLabel:      { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  stepLabelOn:    { color: 'rgba(255,255,255,0.9)' },

  // Card
  card:           { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  cardAccent:     { height: 4, backgroundColor: Colors.accent },
  cardTitle:      { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 22, marginHorizontal: 24, letterSpacing: -0.3 },
  cardSub:        { fontSize: 13, color: Colors.textMuted, marginTop: 3, marginHorizontal: 24, marginBottom: 18 },

  // Error
  errorBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginHorizontal: 24, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  errorIcon:      { fontSize: 14, marginTop: 1 },
  errorText:      { flex: 1, fontSize: 13, color: '#DC2626', lineHeight: 18 },

  // Fields
  fieldWrap:      { marginHorizontal: 24, marginBottom: 12 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  req:            { color: Colors.accent, fontWeight: '700' },
  input:          { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: Colors.text },
  inputRow:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, backgroundColor: Colors.bg, paddingHorizontal: 14, gap: 8 },
  fieldIcon:      { marginRight: 2 },
  eyeBtn:         { padding: 6 },

  // Buttons
  btn:            { marginHorizontal: 24, marginTop: 8, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  btnOff:         { opacity: 0.65, shadowOpacity: 0 },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  btnRow:         { flexDirection: 'row', alignItems: 'center' },
  backBtn:        { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  backText:       { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },

  // Divider
  divider:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginVertical: 14, gap: 10 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText:    { fontSize: 11, color: Colors.textLight, fontWeight: '500' },

  loginBtn:       { marginHorizontal: 24, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary },
  loginText:      { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  disclaimer:     { fontSize: 11, color: Colors.textLight, textAlign: 'center', marginTop: 14, marginBottom: 22, marginHorizontal: 24, lineHeight: 16 },

  // Gender toggle
  genderRow:        { flexDirection: 'row', gap: 8 },
  genderBtn:        { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  genderBtnOn:      { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderBtnText:    { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  genderBtnTextOn:  { color: '#fff' },

  // Civil status picker
  pickerBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerBtnText:     { fontSize: 14, color: Colors.text, flex: 1 },
  pickerBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  pickerSheet:       { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  pickerTitle:       { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 14, textAlign: 'center' },
  pickerOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 6 },
  pickerOptionOn:    { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.primary },
  pickerOptionText:  { fontSize: 15, color: Colors.text, fontWeight: '500' },
  pickerOptionTextOn:{ color: Colors.primary, fontWeight: '700' },
})

// ── Success Modal Styles ──────────────────────────────────────
const m = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(7,59,58,0.75)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card:       { backgroundColor: '#fff', borderRadius: 28, padding: 28, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 32, elevation: 16 },

  // Animated checkmark
  checkCircle:{ width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: Colors.accent, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8 },
  checkRing:  { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: Colors.emerald, opacity: 0.4 },

  title:      { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.3, textAlign: 'center' },
  subtitle:   { fontSize: 14, color: Colors.accent, fontWeight: '700', marginTop: 4, marginBottom: 12, textAlign: 'center' },
  body:       { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  chips:      { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0F7F4', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  chipText:   { fontSize: 12, color: Colors.secondary, fontWeight: '600' },

  btn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Method selection modal
  handle:         { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center' as const, marginBottom: 16 },
  methodTitle:    { fontSize: 20, fontWeight: '800' as const, color: Colors.text, letterSpacing: -0.3 },
  methodSub:      { fontSize: 13, color: Colors.textMuted, marginTop: 4, marginBottom: 18 },
  methodBtn:      { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, backgroundColor: Colors.bg, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: Colors.border },
  methodIcon:     { width: 48, height: 48, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  methodBtnTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text },
  methodBtnSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
})


