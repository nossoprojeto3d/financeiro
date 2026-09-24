// Trava do app com Face ID / Touch ID (WebAuthn, recurso nativo do Safari).
// Funciona no app instalado (PWA) em https — ex.: GitHub Pages.
// É uma trava do aparelho: a sessão continua protegida pelo login do Supabase.
const Lock = (() => {
  const CHAVE = 'caixa_faceid';
  const paraB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));

  // Só no celular: no computador (Touch ID do Mac, Windows Hello) a trava não faz sentido.
  const celular = () => matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

  async function disponivel() {
    try {
      return !!(celular() && window.isSecureContext && window.PublicKeyCredential &&
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
    } catch (_) { return false; }
  }

  const ativo = () => celular() && !!localStorage.getItem(CHAVE);

  async function ativar(nome, email) {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: aleatorio(32),
        rp: { name: 'Caixa Nosso Projeto 3D' },
        user: { id: aleatorio(16), name: email, displayName: nome },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged'
        },
        attestation: 'none',
        timeout: 60000
      }
    });
    localStorage.setItem(CHAVE, paraB64(cred.rawId));
  }

  async function verificar() {
    const id = localStorage.getItem(CHAVE);
    if (!id) return true;
    await navigator.credentials.get({
      publicKey: {
        challenge: aleatorio(32),
        allowCredentials: [{ type: 'public-key', id: deB64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return true;
  }

  const desativar = () => localStorage.removeItem(CHAVE);

  return { celular, disponivel, ativo, ativar, verificar, desativar };
})();
