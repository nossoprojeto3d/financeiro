// Avisos de vencimento no iPhone (Web Push): pedir permissão, registrar este aparelho no banco
// (tabela push_inscricoes) e desligar. Quem manda as notificações é a função "avisos" do Supabase.
import { CONFIG } from './config.js'
import { Api } from './api.js'

const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
const suporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// 'instalar' = no iPhone só funciona aberto pela tela de início; 'semsuporte' = navegador sem notificações;
// 'bloqueado' = a pessoa negou (só libera nos Ajustes do iPhone); 'pronto' = dá para ligar
export function situacaoAvisos() {
  if (!suporta()) return /iPhone|iPad/.test(navigator.userAgent) && !instalado() ? 'instalar' : 'semsuporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  return 'pronto'
}

async function registro() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('Abra o app instalado (pela tela de início) para ligar os avisos.')
  return reg
}

export async function avisosLigados() {
  if (situacaoAvisos() !== 'pronto' || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

const bytes = b64 => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

// Tem que ser chamada direto do toque (o iPhone só mostra o pedido de permissão depois de um toque)
export async function ligarAvisos() {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Sem permissão para notificações. Libere em Ajustes do iPhone › Notificações › Financeiro NP3D.')
  const reg = await registro()
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(CONFIG.VAPID_PUBLICA) })
  const { endpoint, keys } = sub.toJSON()
  try { await Api.salvarAviso({ endpoint, p256dh: keys.p256dh, auth: keys.auth }) }
  catch (e) {
    if (!e.auth && /push_inscricoes/i.test(e.message)) throw new Error('Os avisos ainda não foram instalados no banco (falta rodar o v5-avisos.sql no Supabase).')
    throw e
  }
}

export async function desligarAvisos() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await Api.excluirAviso(sub.endpoint).catch(e => { if (e.auth) throw e })
  await sub.unsubscribe()
}

export const testarAvisos = () => Api.testarAviso()
