import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, TextInput, Modal as RNModal,
  Dimensions, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'

const { width: W } = Dimensions.get('window')

const PRIMARY_IDS = [
  'Philippine National ID (PhilSys ID)',
  'Philippine Passport',
  "Driver's License (LTO)",
  'Unified Multi-Purpose ID (UMID)',
  'Professional Regulation Commission (PRC) ID',
  'Postal ID (PHLPost)',
  "Voter's ID / Voter's Certification",
]

interface VStatus {
  onboarding_step: number
  onboarding_completed: boolean
  phase1_complete: boolean
  phase2_complete: boolean
  phase3_complete: boolean
  has_primary_id: boolean
  has_barangay: boolean
  has_selfie: boolean
  documents: any[]
  assistants: any[]
}

interface Assistant {
  id?: number
  first_name: string
  last_name: string
  relationship: string
  phone: string
  address: string
  photo_url: string
}

async function uploadFile(uri: string, name: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', { uri, name, type: 'image/jpeg' } as any)

  // Small delay to let the camera modal fully dismiss before reading the file
  await new Promise(r => setTimeout(r, 400))

  const attempt = async () => {
    const { data } = await api.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })
    if (!data.url) throw new Error(data.error ?? 'No URL returned')
    return data.url
  }

  try {
    return await attempt()
  } catch (err: any) {
    // Retry once on network error (file may not be ready yet)
    if (err.message?.includes('Network') || err.code === 'ERR_NETWORK') {
      await new Promise(r => setTimeout(r, 800))
      try { return await attempt() } catch {}
    }
    const msg = err.response?.data?.error
      ?? (err.code === 'ECONNABORTED' ? 'Upload timed out. Check your connection.'
        : err.message?.includes('Network') ? 'Cannot reach server. Check your WiFi.'
        : err.message ?? 'Upload failed')
    throw new Error(msg)
  }
}

// ─── Camera Modal ─────────────────────────────────────────────
function CameraModal({ visible, idType, captureType, onComplete, onClose }: {
  visible: boolean
  idType: string
  captureType: 'id' | 'selfie' | 'doc'
  onComplete: (front: string, back?: string) => void
  onClose: () => void
}) {
  const [perm, requestPerm] = useCameraPermissions()
  const [captured, setCaptured] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const stepRef = useRef<'front' | 'back' | 'single'>(captureType === 'id' ? 'front' : 'single')
  const frontRef = useRef<string | null>(null)
  const camRef = useRef<CameraView>(null)

  useEffect(() => {
    if (visible) {
      stepRef.current = captureType === 'id' ? 'front' : 'single'
      frontRef.current = null
      setCaptured(null)
    }
  }, [visible, captureType])

  const shoot = async () => {
    if (!camRef.current || capturing) return
    setCapturing(true)
    try {
      const p = await camRef.current.takePictureAsync({ quality: 0.85 })
      if (p?.uri) setCaptured(p.uri)
    } catch { Alert.alert('Error', 'Could not take photo.') }
    finally { setCapturing(false) }
  }

  const confirm = () => {
    if (!captured) return
    if (stepRef.current === 'front') {
      frontRef.current = captured
      setCaptured(null)
      stepRef.current = 'back'
    } else if (stepRef.current === 'back') {
      const front = frontRef.current!
      const back = captured
      setCaptured(null)
      // Delay so modal fully dismisses before file URIs are read
      setTimeout(() => onComplete(front, back), 150)
    } else {
      const uri = captured
      setCaptured(null)
      setTimeout(() => onComplete(uri), 150)
    }
  }

  if (!visible) return null

  if (!perm?.granted) {
    return (
      <RNModal visible animationType="slide" onRequestClose={onClose}>
        <View style={cm.permBox}>
          <Text style={cm.permIcon}>📷</Text>
          <Text style={cm.permTitle}>Camera Access Needed</Text>
          <Text style={cm.permSub}>We need camera access to photograph your documents.</Text>
          <TouchableOpacity style={cm.permBtn} onPress={requestPerm}>
            <Text style={cm.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cm.cancelBtn} onPress={onClose}>
            <Text style={cm.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </RNModal>
    )
  }

  const isSelfie = captureType === 'selfie'
  const stepLabel = stepRef.current === 'front' ? 'Front Side' : stepRef.current === 'back' ? 'Back Side' : ''

  return (
    <RNModal visible animationType="slide" onRequestClose={onClose}>
      {!captured ? (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={isSelfie ? 'front' : 'back'} />
          <View style={cm.overlay}>
            {/* Top */}
            <SafeAreaView style={cm.topBar}>
              <TouchableOpacity onPress={onClose} style={cm.closeBtn}>
                <Text style={cm.closeBtnText}>✕</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={cm.topTitle} numberOfLines={1}>{idType}</Text>
                {stepLabel ? <Text style={cm.topStep}>{stepLabel}</Text> : null}
              </View>
              {captureType === 'id' && (
                <View style={cm.dots}>
                  <View style={[cm.dot, stepRef.current === 'front' && cm.dotOn]} />
                  <View style={[cm.dot, stepRef.current === 'back' && cm.dotOn]} />
                </View>
              )}
            </SafeAreaView>

            {/* Frame */}
            <View style={cm.frameArea}>
              {isSelfie
                ? <View style={cm.selfieFrame} />
                : <View style={cm.idFrame}>
                    <View style={[cm.corner, cm.cTL]} />
                    <View style={[cm.corner, cm.cTR]} />
                    <View style={[cm.corner, cm.cBL]} />
                    <View style={[cm.corner, cm.cBR]} />
                  </View>
              }
              <Text style={cm.hint}>
                {isSelfie ? '👤 Center your face in the oval' : '🪪 Align your ID within the frame'}
              </Text>
            </View>

            {/* Shutter */}
            <View style={cm.shutterBar}>
              <TouchableOpacity style={cm.shutter} onPress={shoot} disabled={capturing}>
                {capturing ? <ActivityIndicator color="#000" /> : <View style={cm.shutterInner} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={cm.previewTop}>
            <Text style={cm.previewTitle}>
              {stepRef.current === 'front' ? 'Front Side — Confirm'
               : stepRef.current === 'back' ? 'Back Side — Confirm'
               : 'Confirm Photo'}
            </Text>
          </SafeAreaView>
          <Image source={{ uri: captured }} style={{ flex: 1, resizeMode: 'contain' }} />
          <View style={cm.previewActions}>
            <TouchableOpacity style={cm.retakeBtn} onPress={() => setCaptured(null)}>
              <Text style={cm.retakeText}>↩ Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cm.useBtn} onPress={confirm}>
              <Text style={cm.useText}>
                {stepRef.current === 'front' ? 'Next: Back Side →' : '✓ Use Photo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </RNModal>
  )
}

const cm = StyleSheet.create({
  permBox:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  permIcon:     { fontSize: 48, marginBottom: 16 },
  permTitle:    { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  permSub:      { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 28 },
  permBtn:      { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  permBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn:    { marginTop: 14, padding: 12 },
  cancelText:   { color: Colors.textMuted, fontSize: 14 },
  overlay:      { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, backgroundColor: 'rgba(0,0,0,0.65)' },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topTitle:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  topStep:      { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  dots:         { flexDirection: 'row', gap: 6 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn:        { backgroundColor: '#22c55e', width: 10, height: 10, borderRadius: 5 },
  frameArea:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  selfieFrame:  { width: W * 0.65, height: W * 0.65 * 1.25, borderRadius: W * 0.65 / 2, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)' },
  idFrame:      { width: W * 0.84, height: W * 0.84 * 0.63, borderRadius: 12, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.85)', position: 'relative' },
  corner:       { position: 'absolute', width: 22, height: 22, borderWidth: 3, borderColor: '#fff' },
  cTL:          { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cTR:          { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cBL:          { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cBR:          { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  hint:         { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' },
  shutterBar:   { alignItems: 'center', paddingBottom: 48, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.65)' },
  shutter:      { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  previewTop:   { backgroundColor: '#111', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8 },
  previewTitle: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  previewActions: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 40, backgroundColor: '#000' },
  retakeBtn:    { flex: 1, borderWidth: 1.5, borderColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  retakeText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
  useBtn:       { flex: 2, backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  useText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
})

// ─── Review Modal ─────────────────────────────────────────────
function ReviewModal({ visible, status, onConfirm, onClose, submitting }: {
  visible: boolean
  status: VStatus | null
  onConfirm: () => void
  onClose: () => void
  submitting: boolean
}) {
  const docs = status?.documents ?? []
  const assistants = status?.assistants ?? []

  const sections = [
    {
      icon: '🪪', title: 'Primary ID',
      items: docs.filter(d => d.doc_category === 'primary_id').map(d => d.id_type),
      done: status?.has_primary_id,
    },
    {
      icon: '📋', title: 'Barangay Clearance',
      items: docs.filter(d => d.doc_category === 'barangay_clearance').map(() => 'Uploaded'),
      done: status?.has_barangay,
    },
    {
      icon: '📄', title: 'Old Business Permit',
      items: docs.filter(d => d.doc_category === 'old_business_permit').map(() => 'Uploaded'),
      done: docs.some(d => d.doc_category === 'old_business_permit'),
      optional: true,
    },
    {
      icon: '👥', title: 'Assistants',
      items: assistants.map((a: any) => `${a.first_name} ${a.last_name}`),
      done: assistants.length > 0,
    },
    {
      icon: '🤳', title: 'Selfie',
      items: docs.filter(d => d.doc_category === 'selfie').map(() => 'Uploaded'),
      done: status?.has_selfie,
    },
  ]

  return (
    <RNModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={rv.backdrop}>
        <View style={rv.sheet}>
          <View style={rv.handle} />
          <Text style={rv.title}>Review Your Submission</Text>
          <Text style={rv.sub}>Please confirm all information is correct before submitting.</Text>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {sections.map(sec => (
              <View key={sec.title} style={rv.section}>
                <View style={rv.sectionHeader}>
                  <Text style={rv.sectionIcon}>{sec.icon}</Text>
                  <Text style={rv.sectionTitle}>{sec.title}</Text>
                  {sec.optional && <View style={rv.optBadge}><Text style={rv.optText}>Optional</Text></View>}
                  <View style={[rv.statusDot, sec.done ? rv.dotGreen : rv.dotGray]} />
                </View>
                {sec.items.length > 0
                  ? sec.items.map((item, i) => (
                      <Text key={i} style={rv.item}>• {item}</Text>
                    ))
                  : <Text style={rv.itemEmpty}>{sec.optional ? 'Not provided' : 'Missing'}</Text>
                }
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={[rv.confirmBtn, submitting && { opacity: 0.6 }]} onPress={onConfirm} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={rv.confirmText}>✓ Submit for Review</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={rv.backBtn} onPress={onClose} disabled={submitting}>
            <Text style={rv.backText}>← Go Back & Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  )
}

const rv = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:        { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:         { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sub:           { fontSize: 13, color: Colors.textMuted, marginBottom: 20, lineHeight: 18 },
  section:       { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  sectionIcon:   { fontSize: 18 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: Colors.text, flex: 1 },
  optBadge:      { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  optText:       { fontSize: 10, color: '#92400e', fontWeight: '600' },
  statusDot:     { width: 10, height: 10, borderRadius: 5 },
  dotGreen:      { backgroundColor: '#22c55e' },
  dotGray:       { backgroundColor: '#cbd5e1' },
  item:          { fontSize: 13, color: Colors.textMuted, marginLeft: 26, marginBottom: 2 },
  itemEmpty:     { fontSize: 13, color: '#94a3b8', marginLeft: 26, fontStyle: 'italic' },
  confirmBtn:    { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  confirmText:   { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn:       { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  backText:      { color: Colors.textMuted, fontSize: 14 },
})

// ─── Main Screen ──────────────────────────────────────────────
export default function Onboarding() {
  const { refreshUser, logout } = useAuth()
  const [phase, setPhase] = useState(1)
  const [status, setStatus] = useState<VStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const initialLoadDone = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = async (autoSwitch = false) => {
    try {
      const { data } = await api.get('/verification/status')
      setStatus(data)
      // Only auto-switch phase on first load, not after uploads
      if (autoSwitch || !initialLoadDone.current) {
        initialLoadDone.current = true
        if (!data.phase1_complete) setPhase(1)
        else if (!data.phase2_complete) setPhase(2)
        else if (!data.phase3_complete) setPhase(3)
        else setPhase(4)
      }
    } catch {
      // Silent fail on background polls — only show error on initial load
      if (!initialLoadDone.current) {
        Alert.alert('Error', 'Failed to load verification status')
      }
    } finally { setLoading(false) }
  }

  useEffect(() => {
    fetch(true)
    // Poll every 5s — silently updates data without any visual refresh
    pollRef.current = setInterval(() => fetch(false), 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const completePhase = async (p: number) => {
    try {
      await api.post('/verification/complete-phase', { phase: p })
      await fetch(false) // refresh status data
      if (p === 3) {
        setReviewOpen(true)
      } else {
        setPhase(p + 1) // advance to next phase
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      await refreshUser()
      setReviewOpen(false)
      Alert.alert('Submitted!', "Your verification is under admin review. You'll be notified once approved.", [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={st.loadingText}>Loading...</Text>
      </View>
    )
  }

  const p1Done = status?.phase1_complete
  const p2Done = status?.phase2_complete
  const p3Done = status?.phase3_complete

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Account Verification</Text>
          <Text style={st.headerSub}>Complete all 3 phases to access the app</Text>
        </View>
        <TouchableOpacity
          style={st.logoutBtn}
          onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: async () => {
              await logout()
              router.replace('/(auth)/login')
            }},
          ])}
        >
          <Text style={st.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={st.progress}>
        {[1, 2, 3].map(p => {
          const done = (p === 1 && p1Done) || (p === 2 && p2Done) || (p === 3 && p3Done)
          const active = phase === p || (p === 3 && phase === 4) // phase 4 = all done, show phase 3 as active
          const locked = (p === 2 && !p1Done) || (p === 3 && !p2Done)
          return (
            <TouchableOpacity key={p} style={st.progressItem}
              onPress={() => !locked && setPhase(p)} disabled={locked}>
              <View style={[st.circle, done && st.circleDone, active && !done && st.circleActive, locked && st.circleLocked]}>
                <Text style={[st.circleNum, (done || active) && !locked && { color: '#fff' }]}>
                  {done ? '✓' : locked ? '🔒' : p}
                </Text>
              </View>
              <Text style={[st.progressLabel, active && !locked && st.progressLabelActive, locked && st.progressLabelLocked]}>
                {p === 1 ? 'Documents' : p === 2 ? 'Assistants' : 'Selfie'}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {phase === 1 && <Phase1 status={status} onRefresh={fetch} onNext={() => completePhase(1)} />}
        {phase === 2 && <Phase2 status={status} onRefresh={fetch} onNext={() => completePhase(2)} />}
        {(phase === 3 || phase === 4) && <Phase3 status={status} onRefresh={fetch} onNext={() => completePhase(3)} />}
      </ScrollView>

      <ReviewModal visible={reviewOpen} status={status} onConfirm={submit} onClose={() => setReviewOpen(false)} submitting={submitting} />
    </View>
  )
}

// ─── Phase 1 ──────────────────────────────────────────────────
function Phase1({ status, onRefresh, onNext }: { status: VStatus | null; onRefresh: () => void; onNext: () => void }) {
  const [selected, setSelected] = useState('')
  const [camTarget, setCamTarget] = useState<{ idType: string; category: string } | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  const docs        = status?.documents ?? []
  const primaryDocs = docs.filter((d: any) => d.doc_category === 'primary_id')
  const barangayDocs= docs.filter((d: any) => d.doc_category === 'barangay_clearance')
  const oldDocs     = docs.filter((d: any) => d.doc_category === 'old_business_permit')

  const uploadedTypes = [...new Set(primaryDocs.map((d: any) =>
    (d.id_type ?? '').replace(/ \((Front|Back)\)$/i, '').trim()
  ))]
  const primaryFull = uploadedTypes.length >= 1
  const canProceed  = status?.has_primary_id && status?.has_barangay

  const handleCapture = async (front: string, back?: string) => {
    if (!camTarget) return
    const { idType, category } = camTarget
    setCamTarget(null)
    setUploading(idType)
    try {
      const fUrl = await uploadFile(front, `${category}_front_${Date.now()}.jpg`)
      await api.post('/verification/documents', { doc_category: category, id_type: back ? `${idType} (Front)` : idType, file_url: fUrl })
      if (back) {
        const bUrl = await uploadFile(back, `${category}_back_${Date.now()}.jpg`)
        await api.post('/verification/documents', { doc_category: category, id_type: `${idType} (Back)`, file_url: bUrl })
      }
      setSelected('')
      onRefresh()
    } catch (e: any) { Alert.alert('Upload Failed', e.message) }
    finally { setUploading(null) }
  }

  const removeDoc = (id: number, label?: string) => Alert.alert(
    'Remove Document',
    label ? `Remove "${label}" and its paired photo?` : 'Remove this document?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/verification/documents/${id}`)
          onRefresh()
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.error ?? e.message)
        }
      }},
    ]
  )

  return (
    <View style={st.phase}>
      {/* Section: Primary ID */}
      <View style={st.card}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#eff6ff' }]}><Text style={st.iconText}>🪪</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Primary ID</Text>
            <Text style={st.cardSub}>Select 1 valid government-issued ID</Text>
          </View>
          {primaryFull && <View style={st.doneBadge}><Text style={st.doneText}>✓ Done</Text></View>}
        </View>

        {!primaryFull && (
          <>
            <Text style={st.label}>Choose your ID type</Text>
            <View style={st.chipGrid}>
              {PRIMARY_IDS.map(id => {
                const sel = selected === id
                return (
                  <TouchableOpacity key={id} style={[st.chip, sel && st.chipSel]}
                    onPress={() => setSelected(prev => prev === id ? '' : id)}>
                    <Text style={[st.chipText, sel && st.chipTextSel]}>{id}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            {selected ? (
              <TouchableOpacity style={[st.actionBtn, !!uploading && st.btnOff]}
                onPress={() => setCamTarget({ idType: selected, category: 'primary_id' })} disabled={!!uploading}>
                {uploading === selected
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={st.actionBtnText}>📷 Take Photo of {selected}</Text>
                }
              </TouchableOpacity>
            ) : null}
          </>
        )}

        {primaryDocs.map((d: any) => <DocItem key={d.id} doc={d} onRemove={() => removeDoc(d.id, d.id_type)} />)}
      </View>

      {/* Section: Barangay Clearance */}
      <View style={st.card}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#f0fdf4' }]}><Text style={st.iconText}>📋</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Barangay Clearance</Text>
            <Text style={st.cardSub}>Required for verification</Text>
          </View>
          {status?.has_barangay && <View style={st.doneBadge}><Text style={st.doneText}>✓ Done</Text></View>}
        </View>
        {barangayDocs.length === 0 ? (
          <TouchableOpacity style={[st.actionBtn, uploading === 'barangay' && st.btnOff]}
            onPress={() => setCamTarget({ idType: 'Barangay Clearance', category: 'barangay_clearance' })} disabled={!!uploading}>
            {uploading === 'barangay'
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={st.actionBtnText}>📷 Take Photo</Text>
            }
          </TouchableOpacity>
        ) : barangayDocs.map((d: any) => <DocItem key={d.id} doc={d} onRemove={() => removeDoc(d.id, 'Barangay Clearance')} />)}
      </View>

      {/* Section: Old Business Permit (optional) */}
      <View style={[st.card, st.cardOptional]}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#fefce8' }]}><Text style={st.iconText}>📄</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Old Business Permit</Text>
            <Text style={st.cardSub}>Optional — speeds up verification</Text>
          </View>
          <View style={st.optBadge}><Text style={st.optText}>Optional</Text></View>
        </View>
        {oldDocs.length === 0 ? (
          <TouchableOpacity style={[st.actionBtnOutline, uploading === 'permit' && st.btnOff]}
            onPress={() => setCamTarget({ idType: 'Old Business Permit', category: 'old_business_permit' })} disabled={!!uploading}>
            <Text style={st.actionBtnOutlineText}>📷 Take Photo</Text>
          </TouchableOpacity>
        ) : oldDocs.map((d: any) => <DocItem key={d.id} doc={d} onRemove={() => removeDoc(d.id, 'Old Business Permit')} />)}
      </View>

      <TouchableOpacity style={[st.nextBtn, !canProceed && st.nextBtnOff]} onPress={onNext} disabled={!canProceed}>
        <Text style={st.nextBtnText}>{canProceed ? 'Continue to Assistants →' : 'Upload Primary ID & Barangay Clearance to continue'}</Text>
      </TouchableOpacity>

      {camTarget && (
        <CameraModal visible={!!camTarget} idType={camTarget.idType}
          captureType={camTarget.category === 'barangay_clearance' || camTarget.category === 'old_business_permit' ? 'doc' : 'id'}
          onComplete={handleCapture} onClose={() => setCamTarget(null)} />
      )}
    </View>
  )
}

// ─── Phase 2 ──────────────────────────────────────────────────
function Phase2({ status, onRefresh, onNext }: { status: VStatus | null; onRefresh: () => void; onNext: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Assistant>({ first_name: '', last_name: '', relationship: '', phone: '', address: '', photo_url: '' })
  const [saving, setSaving] = useState(false)
  const [upPhoto, setUpPhoto] = useState(false)
  const [upProduct, setUpProduct] = useState(false)
  const [numEmployees, setNumEmployees] = useState('')
  const [savingEmployees, setSavingEmployees] = useState(false)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const { user, refreshUser } = useAuth()

  const assistants  = status?.assistants ?? []
  const productDocs = status?.documents?.filter((d: any) => d.doc_category === 'product_photo') ?? []
  const canProceed  = assistants.length > 0
  const userNumEmployees = (user as any)?.num_employees ?? 1
  const maxAssistants = userNumEmployees > 0 ? userNumEmployees - 1 : 0
  const canAddMore = assistants.length < userNumEmployees

  const set = (k: keyof Assistant) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  const saveEmployeeCount = async () => {
    const count = parseInt(numEmployees, 10)
    if (isNaN(count) || count < 1) {
      Alert.alert('Invalid', 'Please enter a valid number (minimum 1)')
      return
    }
    setSavingEmployees(true)
    try {
      await api.put(`/users/${(user as any)?.id}`, { num_employees: count })
      await refreshUser()
      setShowEmployeeForm(false)
      setNumEmployees('')
      Alert.alert('Updated', `Employee count set to ${count}. You can now add up to ${count - 1} assistant(s).`)
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message)
    } finally {
      setSavingEmployees(false)
    }
  }

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] })
    if (r.canceled) return
    setUpPhoto(true)
    try { const url = await uploadFile(r.assets[0].uri, `asst_${Date.now()}.jpg`); setForm(f => ({ ...f, photo_url: url })) }
    catch (e: any) { Alert.alert('Upload Failed', e.message) }
    finally { setUpPhoto(false) }
  }

  const pickProduct = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    if (r.canceled) return
    setUpProduct(true)
    try {
      const url = await uploadFile(r.assets[0].uri, `product_${Date.now()}.jpg`)
      await api.post('/verification/documents', { doc_category: 'product_photo', id_type: 'Product Photo', file_url: url })
      onRefresh()
    } catch (e: any) { Alert.alert('Upload Failed', e.message) }
    finally { setUpProduct(false) }
  }

  const save = async () => {
    if (!form.first_name || !form.last_name) { Alert.alert('Required', 'First and last name are required'); return }
    setSaving(true)
    try {
      await api.post('/assistants', form)
      setForm({ first_name: '', last_name: '', relationship: '', phone: '', address: '', photo_url: '' })
      setShowForm(false)
      onRefresh()
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error ?? e.message) }
    finally { setSaving(false) }
  }

  const remove = (id: number) => Alert.alert('Remove', 'Remove this assistant?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { await api.delete(`/assistants/${id}`); onRefresh() } },
  ])

  return (
    <View style={st.phase}>
      {/* Employee Count Info */}
      <View style={st.card}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#fef3c7' }]}><Text style={st.iconText}>👔</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Number of Employees</Text>
            <Text style={st.cardSub}>Including yourself and assistants</Text>
          </View>
          <View style={st.doneBadge}>
            <Text style={st.doneText}>{userNumEmployees} {userNumEmployees === 1 ? 'person' : 'people'}</Text>
          </View>
        </View>
        
        <View style={{ backgroundColor: '#fef9c3', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: '#854d0e', lineHeight: 18 }}>
            💡 You can add up to <Text style={{ fontWeight: '700' }}>{maxAssistants} assistant(s)</Text> based on your employee count of {userNumEmployees}.
          </Text>
        </View>

        {showEmployeeForm ? (
          <View style={st.formBox}>
            <Text style={st.label}>Update Employee Count</Text>
            <TextInput
              style={st.input}
              value={numEmployees}
              onChangeText={setNumEmployees}
              placeholder={`Current: ${userNumEmployees}`}
              placeholderTextColor={Colors.textLight}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[st.nextBtn, { flex: 1, backgroundColor: '#e2e8f0' }]}
                onPress={() => { setShowEmployeeForm(false); setNumEmployees('') }}
              >
                <Text style={[st.nextBtnText, { color: Colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.nextBtn, { flex: 1 }]}
                onPress={saveEmployeeCount}
                disabled={savingEmployees}
              >
                {savingEmployees ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={st.nextBtnText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={st.actionBtnOutline}
            onPress={() => setShowEmployeeForm(true)}
          >
            <Text style={st.actionBtnOutlineText}>✏️ Update Employee Count</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Assistants */}
      <View style={st.card}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#fdf4ff' }]}><Text style={st.iconText}>👥</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Assistants</Text>
            <Text style={st.cardSub}>Add at least 1 person who helps you vend</Text>
          </View>
          {canProceed && <View style={st.doneBadge}><Text style={st.doneText}>✓ {assistants.length} added</Text></View>}
        </View>

        {assistants.map((a: any) => (
          <View key={a.id} style={st.asstRow}>
            {a.photo_url
              ? <Image source={{ uri: a.photo_url }} style={st.asstPhoto} />
              : <View style={[st.asstPhoto, st.asstPhotoEmpty]}><Text>👤</Text></View>
            }
            <View style={{ flex: 1 }}>
              <Text style={st.asstName}>{a.first_name} {a.last_name}</Text>
              <Text style={st.asstSub}>{[a.relationship, a.phone].filter(Boolean).join(' · ')}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(a.id)} style={st.removeBtn}>
              <Text style={st.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!canAddMore && assistants.length > 0 && (
          <View style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 12, marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: '#991b1b', lineHeight: 18 }}>
              ⚠️ You've reached the maximum number of assistants ({maxAssistants}) for your employee count. Update your employee count above to add more.
            </Text>
          </View>
        )}

        {showForm ? (
          <View style={st.formBox}>
            {[
              { k: 'first_name', label: 'First Name *', ph: 'Juan' },
              { k: 'last_name',  label: 'Last Name *',  ph: 'Dela Cruz' },
              { k: 'relationship', label: 'Relationship', ph: 'Spouse, Child, Helper...' },
              { k: 'phone',      label: 'Phone',         ph: '09XXXXXXXXX' },
              { k: 'address',    label: 'Address',       ph: 'Barangay...' },
            ].map(f => (
              <View key={f.k} style={{ marginBottom: 10 }}>
                <Text style={st.label}>{f.label}</Text>
                <TextInput style={st.input} value={String(form[f.k as keyof Assistant] ?? '')}
                  onChangeText={set(f.k as keyof Assistant)} placeholder={f.ph} placeholderTextColor={Colors.textLight} />
              </View>
            ))}
            <TouchableOpacity style={st.actionBtnOutline} onPress={pickPhoto} disabled={upPhoto}>
              {upPhoto ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={st.actionBtnOutlineText}>{form.photo_url ? '✓ Photo uploaded' : '📷 Upload Photo (optional)'}</Text>}
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[st.nextBtn, { flex: 1, backgroundColor: '#e2e8f0' }]} onPress={() => setShowForm(false)}>
                <Text style={[st.nextBtnText, { color: Colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.nextBtn, { flex: 1 }]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.nextBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[st.addBtn, !canAddMore && st.btnOff]}
            onPress={() => setShowForm(true)}
            disabled={!canAddMore}
          >
            <Text style={st.addBtnText}>
              {canAddMore ? '+ Add Assistant' : `Maximum ${maxAssistants} assistant(s) reached`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Product Photos (optional) */}
      <View style={[st.card, st.cardOptional]}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#fff7ed' }]}><Text style={st.iconText}>🛒</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Product / Price List</Text>
            <Text style={st.cardSub}>Optional — speeds up verification</Text>
          </View>
          <View style={st.optBadge}><Text style={st.optText}>Optional</Text></View>
        </View>
        {productDocs.map((d: any) => <DocItem key={d.id} doc={d} onRemove={() => {}} />)}
        <TouchableOpacity style={st.actionBtnOutline} onPress={pickProduct} disabled={upProduct}>
          {upProduct ? <ActivityIndicator size="small" color={Colors.primary} />
            : <Text style={st.actionBtnOutlineText}>📷 Upload Product Photo</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[st.nextBtn, !canProceed && st.nextBtnOff]} onPress={onNext} disabled={!canProceed}>
        <Text style={st.nextBtnText}>{canProceed ? 'Continue to Selfie →' : 'Add at least 1 assistant to continue'}</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Phase 3 ──────────────────────────────────────────────────
function Phase3({ status, onRefresh, onNext }: { status: VStatus | null; onRefresh: () => void; onNext: () => void }) {
  const [camOpen, setCamOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const docs = status?.documents ?? []
  const selfieDoc = docs.find((d: any) => d.doc_category === 'selfie')
  const hasSelfie = !!selfieDoc

  const handleSelfie = async (uri: string) => {
    setCamOpen(false)
    setUploading(true)
    try {
      // If there's an existing selfie, delete it first
      if (selfieDoc) {
        await api.delete(`/verification/documents/${selfieDoc.id}`)
      }
      const url = await uploadFile(uri, `selfie_${Date.now()}.jpg`)
      await api.post('/verification/documents', { doc_category: 'selfie', id_type: 'Selfie', file_url: url })
      onRefresh()
    } catch (e: any) { Alert.alert('Upload Failed', e.message) }
    finally { setUploading(false) }
  }

  const deleteSelfie = () => {
    Alert.alert('Remove Selfie', 'Are you sure you want to remove your selfie?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (!selfieDoc) return
        setDeleting(true)
        try {
          await api.delete(`/verification/documents/${selfieDoc.id}`)
          onRefresh()
        } catch (e: any) { Alert.alert('Error', e.message) }
        finally { setDeleting(false) }
      }},
    ])
  }

  return (
    <View style={st.phase}>
      <View style={st.card}>
        <View style={st.cardHeader}>
          <View style={[st.iconBox, { backgroundColor: '#fdf2f8' }]}><Text style={st.iconText}>🤳</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.cardTitle}>Selfie Verification</Text>
            <Text style={st.cardSub}>Take a clear photo of your face</Text>
          </View>
          {hasSelfie && <View style={st.doneBadge}><Text style={st.doneText}>✓ Done</Text></View>}
        </View>

        {hasSelfie ? (
          <View>
            {/* Show selfie thumbnail */}
            {selfieDoc?.file_url ? (
              <Image
                source={{ uri: selfieDoc.file_url }}
                style={st.selfieThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={st.selfieSuccess}>
                <Text style={st.selfieSuccessText}>✓ Selfie uploaded</Text>
              </View>
            )}
            {/* Retake / Delete buttons */}
            <View style={st.selfieActions}>
              <TouchableOpacity
                style={[st.selfieActionBtn, st.selfieRetakeBtn, (uploading || deleting) && st.btnOff]}
                onPress={() => setCamOpen(true)}
                disabled={uploading || deleting}
              >
                {uploading
                  ? <ActivityIndicator color={Colors.primary} size="small" />
                  : <Text style={st.selfieRetakeText}>📷 Retake</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.selfieActionBtn, st.selfieDeleteBtn, (uploading || deleting) && st.btnOff]}
                onPress={deleteSelfie}
                disabled={uploading || deleting}
              >
                {deleting
                  ? <ActivityIndicator color={Colors.danger} size="small" />
                  : <Text style={st.selfieDeleteText}>🗑 Remove</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[st.actionBtn, uploading && st.btnOff]} onPress={() => setCamOpen(true)} disabled={uploading}>
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={st.actionBtnText}>📷 Open Camera for Selfie</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {hasSelfie && (
        <TouchableOpacity style={[st.nextBtn, st.finishBtn]} onPress={onNext}>
          <Text style={st.nextBtnText}>🎉 Finished — Review & Submit</Text>
        </TouchableOpacity>
      )}

      <CameraModal visible={camOpen} idType="Selfie" captureType="selfie"
        onComplete={handleSelfie} onClose={() => setCamOpen(false)} />
    </View>
  )
}

// ─── DocItem ──────────────────────────────────────────────────
function DocItem({ doc, onRemove }: { doc: any; onRemove: () => void }) {
  return (
    <View style={st.docRow}>
      <Text style={st.docIcon}>📎</Text>
      <View style={{ flex: 1 }}>
        <Text style={st.docName}>{doc.id_type || doc.doc_category.replace(/_/g, ' ')}</Text>
        <Text style={st.docCat}>{doc.doc_category.replace(/_/g, ' ')}</Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={st.removeBtn}>
        <Text style={st.removeBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const st = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f1f5f9' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:    { color: Colors.textMuted, fontSize: 14 },

  // Header
  header:         { backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  seal:           { width: 56, height: 56, backgroundColor: Colors.gold, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sealText:       { fontSize: 28 },
  headerTitle:    { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:      { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  logoutBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.1)' },
  logoutBtnText:  { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },

  // Progress stepper
  progress:       { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  progressItem:   { alignItems: 'center', gap: 6 },
  circle:         { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  circleActive:   { borderColor: Colors.primary, backgroundColor: Colors.primary },
  circleDone:     { borderColor: '#22c55e', backgroundColor: '#22c55e' },
  circleLocked:   { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  circleNum:      { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  progressLabel:  { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  progressLabelActive: { color: Colors.primary, fontWeight: '700' },
  progressLabelLocked: { color: '#cbd5e1' },

  // Phase container
  phase:          { padding: 16, gap: 12 },

  // Card
  card:           { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardOptional:   { borderWidth: 1, borderColor: '#e2e8f0', shadowOpacity: 0 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBox:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText:       { fontSize: 22 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  doneBadge:      { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  doneText:       { fontSize: 11, color: '#166534', fontWeight: '700' },
  optBadge:       { backgroundColor: '#fef9c3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  optText:        { fontSize: 11, color: '#854d0e', fontWeight: '600' },

  // ID chip grid
  label:          { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip:           { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipSel:        { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  chipTextSel:    { color: '#fff', fontWeight: '700' },

  // Buttons
  actionBtn:      { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  actionBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionBtnOutline: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  actionBtnOutlineText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  btnOff:         { opacity: 0.5 },
  nextBtn:        { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  nextBtnOff:     { backgroundColor: '#94a3b8' },
  nextBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  finishBtn:      { backgroundColor: '#16a34a' },
  addBtn:         { borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  addBtnText:     { color: Colors.primary, fontWeight: '700', fontSize: 14 },

  // Doc row
  docRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginTop: 8, gap: 10 },
  docIcon:        { fontSize: 18 },
  docName:        { fontSize: 13, fontWeight: '600', color: Colors.text },
  docCat:         { fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize', marginTop: 1 },
  removeBtn:      { padding: 6 },
  removeBtnText:  { color: Colors.danger, fontWeight: '700', fontSize: 14 },

  // Assistant row
  asstRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 8, gap: 12 },
  asstPhoto:      { width: 44, height: 44, borderRadius: 22 },
  asstPhotoEmpty: { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  asstName:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  asstSub:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  // Form
  formBox:        { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginTop: 8 },
  input:          { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, backgroundColor: '#fff' },

  // Selfie
  selfieThumb:    { width: '100%', height: 200, borderRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  selfieActions:  { flexDirection: 'row', gap: 0, borderTopWidth: 0 },
  selfieActionBtn:{ flex: 1, borderRadius: 0, paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  selfieRetakeBtn:{ borderRightWidth: 0.5, borderRightColor: '#e2e8f0', borderBottomLeftRadius: 12 },
  selfieRetakeText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  selfieDeleteBtn:{ borderLeftWidth: 0.5, borderLeftColor: '#e2e8f0', borderBottomRightRadius: 12 },
  selfieDeleteText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  selfieSuccess:  { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 14, alignItems: 'center' },
  selfieSuccessText: { color: '#166534', fontWeight: '700', fontSize: 14 },
})
