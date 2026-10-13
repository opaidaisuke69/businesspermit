import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Modal, Image, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '@/context/AuthContext'
import { Colors } from '@/constants/theme'
import api from '@/lib/api'
import { storage } from '@/lib/storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.8.148/lccsystem/bpa-backend/api'

interface Permit { id: number; permit_number: string; business_name: string; issued_date: string; expiry_date: string; status: string }
interface Assistant { id: number; first_name: string; last_name: string; relationship: string; phone: string; address: string; photo_url: string }

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

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const insets = useSafeAreaInsets()
  const [editing, setEditing]   = useState(false)
  const [form, setForm]         = useState({ first_name: '', middle_name: '', last_name: '', phone: '', address: '', civil_status: '', gender: '' })
  const [civilStatusOpen, setCivilStatusOpen] = useState(false)
  const [permits, setPermits]   = useState<Permit[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [asstModal, setAsstModal] = useState(false)
  const [editAsst, setEditAsst] = useState<Assistant | null>(null)
  const [asstForm, setAsstForm] = useState({ first_name: '', last_name: '', relationship: '', phone: '', address: '', photo_url: '' })
  const [savingAsst, setSavingAsst] = useState(false)
  const [upPhoto, setUpPhoto]   = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = async (silent = false) => {
    try {
      const [userRes, permitsRes, asstRes] = await Promise.all([
        api.get(`/users/${user?.id}`),
        api.get('/permits'),
        api.get('/assistants'),
      ])
      const u = userRes.data
      if (!editing) setForm({ first_name: u.first_name, middle_name: u.middle_name ?? '', last_name: u.last_name, phone: u.phone ?? '', address: u.address ?? '', civil_status: u.civil_status ?? '', gender: u.gender ?? '' })
      // Filter out revoked permits
      const activePermits = (permitsRes.data.data ?? []).filter((p: any) => p.status !== 'revoked')
      setPermits(activePermits)
      setAssistants(asstRes.data.data ?? [])
      if (silent) { try { await refreshUser() } catch {} }
    } catch {}
    finally { if (!silent) setLoading(false) }
  }

  useEffect(() => {
    fetchAll(false)
    pollRef.current = setInterval(() => fetchAll(true), 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const set  = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const setA = (k: string) => (v: string) => setAsstForm(f => ({ ...f, [k]: v }))

  const saveProfile = async () => {
    setSaving(true)
    try { await api.put(`/users/${user?.id}`, form); await refreshUser(); setEditing(false) }
    catch (err: any) { Alert.alert('Error', err.response?.data?.error ?? 'Update failed') }
    finally { setSaving(false) }
  }

  const handleLogout = () => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login') } },
  ])

  // ── Permit PDF — generate natively with expo-print ─────────
  const openPermit = async (id: number) => {
    setPdfLoading(true)
    try {
      const token = await storage.getItem('lcc_token')
      const res = await fetch(`${API_URL}/permits/${id}/download?token=${token ?? ''}&source=mobile`)
      const html = await res.text()
      const { uri } = await Print.printToFileAsync({ html, base64: false })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save or Share Business Permit',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('PDF Saved', `Saved to: ${uri}`)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to generate PDF')
    } finally { setPdfLoading(false) }
  }

  const openAddAsst = () => {
    setEditAsst(null)
    setAsstForm({ first_name: '', last_name: '', relationship: '', phone: '', address: '', photo_url: '' })
    setAsstModal(true)
  }
  const openEditAsst = (a: Assistant) => {
    setEditAsst(a)
    setAsstForm({ first_name: a.first_name, last_name: a.last_name, relationship: a.relationship, phone: a.phone, address: a.address, photo_url: a.photo_url })
    setAsstModal(true)
  }

  const pickAsstPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] })
    if (r.canceled) return
    setUpPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', { uri: r.assets[0].uri, name: `asst_${Date.now()}.jpg`, type: 'image/jpeg' } as any)
      const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 })
      setAsstForm(f => ({ ...f, photo_url: data.url ?? '' }))
    } catch (e: any) { Alert.alert('Upload Failed', e.message) }
    finally { setUpPhoto(false) }
  }

  const saveAsst = async () => {
    if (!asstForm.first_name || !asstForm.last_name) { Alert.alert('Required', 'First and last name are required'); return }
    setSavingAsst(true)
    try {
      if (editAsst) await api.put(`/assistants/${editAsst.id}`, asstForm)
      else await api.post('/assistants', asstForm)
      setAsstModal(false); fetchAll(false)
    } catch (e: any) { Alert.alert('Error', e.response?.data?.error ?? e.message) }
    finally { setSavingAsst(false) }
  }

  const deleteAsst = (id: number) => Alert.alert('Remove', 'Remove this assistant?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { await api.delete(`/assistants/${id}`); fetchAll(false) } },
  ])

  if (loading) return <View style={s.root}><ActivityIndicator style={{ flex: 1 }} color={Colors.accent} /></View>

  const verStatus = user?.verification_status ?? 'pending'
  const verMeta = {
    verified: { color: Colors.emerald, bg: 'rgba(33,211,117,0.15)', label: '✓ Verified', icon: 'shield-checkmark-outline' as const },
    pending:  { color: '#F59E0B',      bg: 'rgba(245,158,11,0.15)', label: '⏳ Pending',  icon: 'time-outline' as const },
    rejected: { color: Colors.danger,  bg: 'rgba(239,68,68,0.15)',  label: '✗ Rejected', icon: 'close-circle-outline' as const },
  }[verStatus] ?? { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: '⏳ Pending', icon: 'time-outline' as const }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <FadeIn delay={0}>
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarText}>{user?.first_name?.[0]}{user?.last_name?.[0]}</Text>
          </View>
          <Text style={s.headerName}>{user?.first_name} {user?.last_name}</Text>
          <Text style={s.headerEmail}>{user?.email}</Text>
          <View style={[s.verBadge, { backgroundColor: verMeta.bg }]}>
            <Ionicons name={verMeta.icon} size={13} color={verMeta.color} />
            <Text style={[s.verText, { color: verMeta.color }]}>{verMeta.label}</Text>
          </View>
        </View>
      </FadeIn>

      {/* ── Personal Info ── */}
      <FadeIn delay={80}>
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
              <Text style={s.cardTitle}>Personal Information</Text>
            </View>
            <TouchableOpacity onPress={() => editing ? saveProfile() : setEditing(true)} disabled={saving} style={s.editBtn}>
              {saving ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={s.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>}
            </TouchableOpacity>
          </View>
          {[
            { k: 'first_name',   label: 'First Name',   kb: 'default'    as const },
            { k: 'middle_name',  label: 'Middle Name',  kb: 'default'    as const },
            { k: 'last_name',    label: 'Last Name',    kb: 'default'    as const },
            { k: 'phone',        label: 'Phone',        kb: 'phone-pad'  as const },
            { k: 'address',      label: 'Address',      kb: 'default'    as const },
          ].map(f => (
            <View key={f.k} style={s.field}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              {editing
                ? <TextInput style={s.input} value={form[f.k as keyof typeof form]} onChangeText={set(f.k)} keyboardType={f.kb} placeholderTextColor={Colors.textLight} />
                : <Text style={s.fieldValue}>{form[f.k as keyof typeof form] || '—'}</Text>
              }
            </View>
          ))}

          {/* Gender */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Gender</Text>
            {editing ? (
              <View style={s.genderRow}>
                {(['male','female','other'] as const).map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[s.genderBtn, form.gender === g && s.genderBtnOn]}
                    onPress={() => set('gender')(g)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.genderBtnText, form.gender === g && s.genderBtnTextOn]}>
                      {g === 'male' ? '♂ Male' : g === 'female' ? '♀ Female' : '⚧ Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={s.fieldValue}>
                {form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : '—'}
              </Text>
            )}
          </View>

          {/* Civil Status */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Civil Status</Text>
            {editing ? (
              <TouchableOpacity
                style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setCivilStatusOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, color: form.civil_status ? Colors.text : Colors.textLight }}>
                  {form.civil_status ? form.civil_status.charAt(0).toUpperCase() + form.civil_status.slice(1) : 'Select civil status'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <Text style={s.fieldValue}>
                {form.civil_status ? form.civil_status.charAt(0).toUpperCase() + form.civil_status.slice(1) : '—'}
              </Text>
            )}
          </View>

          {/* Civil Status Modal */}
          <Modal visible={civilStatusOpen} transparent animationType="fade" onRequestClose={() => setCivilStatusOpen(false)}>
            <TouchableOpacity style={s.pickerBackdrop} activeOpacity={1} onPress={() => setCivilStatusOpen(false)}>
              <View style={s.pickerSheet}>
                <Text style={s.pickerTitle}>Select Civil Status</Text>
                {['single','married','widowed','separated'].map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[s.pickerOption, form.civil_status === opt && s.pickerOptionOn]}
                    onPress={() => { set('civil_status')(opt); setCivilStatusOpen(false) }}
                  >
                    <Text style={[s.pickerOptionText, form.civil_status === opt && s.pickerOptionTextOn]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                    {form.civil_status === opt && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
          {editing && (
            <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </FadeIn>

      {/* ── Assistants ── */}
      <FadeIn delay={160}>
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <Ionicons name="people-outline" size={18} color={Colors.primary} />
              <Text style={s.cardTitle}>Assistants</Text>
            </View>
            <TouchableOpacity onPress={openAddAsst} style={s.addBtn}>
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={s.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {assistants.length === 0
            ? <View style={s.emptyRow}><Ionicons name="people-outline" size={24} color={Colors.border} /><Text style={s.emptyText}>No assistants added yet</Text></View>
            : assistants.map(a => (
              <View key={a.id} style={s.asstRow}>
                {a.photo_url
                  ? <Image source={{ uri: a.photo_url }} style={s.asstPhoto} />
                  : <View style={[s.asstPhoto, s.asstPhotoEmpty]}><Ionicons name="person" size={20} color={Colors.textLight} /></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={s.asstName}>{a.first_name} {a.last_name}</Text>
                  <Text style={s.asstSub}>{[a.relationship, a.phone].filter(Boolean).join(' · ')}</Text>
                </View>
                <View style={s.asstBtns}>
                  <TouchableOpacity onPress={() => openEditAsst(a)} style={s.asstIconBtn}>
                    <Ionicons name="pencil-outline" size={16} color={Colors.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteAsst(a.id)} style={s.asstIconBtn}>
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          }
        </View>
      </FadeIn>

      {/* ── Permits ── */}
      <FadeIn delay={240}>
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardTitleRow}>
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
              <Text style={s.cardTitle}>My Permits</Text>
            </View>
          </View>
          {permits.length === 0
            ? <View style={s.emptyRow}><Ionicons name="document-outline" size={24} color={Colors.border} /><Text style={s.emptyText}>No permits issued yet</Text></View>
            : permits.map(p => (
              <View key={p.id} style={s.permitRow}>
                <View style={s.permitLeft}>
                  <View style={s.permitIconBox}>
                    <Ionicons name="ribbon-outline" size={20} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.permitNum}>{p.permit_number}</Text>
                    <Text style={s.permitBiz} numberOfLines={1}>{p.business_name}</Text>
                    <Text style={s.permitDate}>{p.issued_date} — {p.expiry_date}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[s.pdfBtn, pdfLoading && { opacity: 0.6 }]} onPress={() => openPermit(p.id)} activeOpacity={0.8} disabled={pdfLoading}>
                  {pdfLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Ionicons name="download-outline" size={16} color="#fff" />
                      <Text style={s.pdfBtnText}>PDF</Text></>
                  }
                </TouchableOpacity>
              </View>
            ))
          }
        </View>
      </FadeIn>

      {/* ── Logout ── */}
      <FadeIn delay={320}>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </FadeIn>

      {/* ── Assistant Modal ── */}
      <Modal visible={asstModal} animationType="slide" transparent onRequestClose={() => setAsstModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editAsst ? 'Edit Assistant' : 'Add Assistant'}</Text>
              <TouchableOpacity onPress={() => setAsstModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { k: 'first_name', label: 'First Name *', ph: 'Juan' },
                { k: 'last_name',  label: 'Last Name *',  ph: 'Dela Cruz' },
                { k: 'relationship', label: 'Relationship', ph: 'Spouse, Child, Helper...' },
                { k: 'phone',      label: 'Phone',         ph: '09XXXXXXXXX' },
                { k: 'address',    label: 'Address',       ph: 'Barangay...' },
              ].map(f => (
                <View key={f.k} style={{ marginBottom: 12 }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput style={s.input} value={asstForm[f.k as keyof typeof asstForm]}
                    onChangeText={setA(f.k)} placeholder={f.ph} placeholderTextColor={Colors.textLight} />
                </View>
              ))}
              <TouchableOpacity style={s.photoBtn} onPress={pickAsstPhoto} disabled={upPhoto}>
                {upPhoto ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <><Ionicons name="camera-outline" size={16} color={Colors.primary} />
                    <Text style={s.photoBtnText}>{asstForm.photo_url ? '✓ Photo uploaded' : 'Upload Photo (optional)'}</Text></>
                }
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border }]} onPress={() => setAsstModal(false)}>
                  <Text style={[s.modalBtnText, { color: Colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalBtn} onPress={saveAsst} disabled={savingAsst}>
                  {savingAsst ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.modalBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },

  // Header
  header:         { backgroundColor: Colors.primary, alignItems: 'center', paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatarWrap:     { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  avatarText:     { fontSize: 28, fontWeight: '800', color: '#fff' },
  headerName:     { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerEmail:    { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  verBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  verText:        { fontSize: 12, fontWeight: '700' },

  // Cards
  card:           { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: Colors.text },
  editBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  editBtnText:    { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border },
  addBtnText:     { fontSize: 13, color: Colors.primary, fontWeight: '700' },

  // Fields
  field:          { marginBottom: 12 },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldValue:     { fontSize: 14, color: Colors.text, fontWeight: '500' },
  input:          { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg },
  cancelBtn:      { alignItems: 'center', marginTop: 8 },
  cancelText:     { fontSize: 13, color: Colors.danger, fontWeight: '600' },

  // Gender toggle
  genderRow:      { flexDirection: 'row', gap: 8 },
  genderBtn:      { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg },
  genderBtnOn:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderBtnText:  { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  genderBtnTextOn:{ color: '#fff' },

  // Civil status picker
  pickerBackdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  pickerSheet:        { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  pickerTitle:        { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 14, textAlign: 'center' },
  pickerOption:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 6 },
  pickerOptionOn:     { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.primary },
  pickerOptionText:   { fontSize: 15, color: Colors.text, fontWeight: '500' },
  pickerOptionTextOn: { color: Colors.primary, fontWeight: '700' },

  // Empty
  emptyRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptyText:      { fontSize: 13, color: Colors.textMuted },

  // Assistants
  asstRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  asstPhoto:      { width: 44, height: 44, borderRadius: 22 },
  asstPhotoEmpty: { backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  asstName:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  asstSub:        { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  asstBtns:       { flexDirection: 'row', gap: 4 },
  asstIconBtn:    { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },

  // Permits
  permitRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  permitLeft:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  permitIconBox:  { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.accent + '18', alignItems: 'center', justifyContent: 'center' },
  permitNum:      { fontSize: 11, fontFamily: 'monospace', color: Colors.textMuted },
  permitBiz:      { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: 1 },
  permitDate:     { fontSize: 11, color: Colors.textLight, marginTop: 1 },
  pdfBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pdfBtnText:     { color: '#fff', fontWeight: '700', fontSize: 12 },

  // PDF viewer
  pdfHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16 },
  pdfBack:        { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  pdfTitle:       { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Logout
  logoutBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, marginTop: 14, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.danger },
  logoutText:     { color: Colors.danger, fontWeight: '700', fontSize: 15 },

  // Modal
  modalBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHandle:    { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalClose:     { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  photoBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  photoBtnText:   { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  modalBtn:       { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
})
