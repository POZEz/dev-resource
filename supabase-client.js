/**
 * ============================================================================
 * CLIENTE CENTRAL SUPABASE, AUTENTICAÇÃO E CACHE LOCAL (My Hub)
 * ============================================================================
 * Importe este script em todas as páginas após carregar a CDN do Supabase.
 */

const SUPABASE_URL = 'https://zlsdlcvtcsrykfacjvhf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JnDv-fxHXPTzNaFX9n3Z0w_4mqt47Js';

// Inicializa a instância Global do Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// IndexedDB para armazenamento seguro de mídias pesadas (vídeos, áudios, imagens locais)
let localMediaDB = null;
const idbReq = indexedDB.open("MyHubLocalMedia", 1);

idbReq.onupgradeneeded = (e) => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains("heavy_files")) {
    db.createObjectStore("heavy_files", { keyPath: "id" });
  }
};
idbReq.onsuccess = (e) => {
  localMediaDB = e.target.result;
};

// PortalDB exposto globalmente para o Hub e todos os iframes
window.PortalDB = {
  supabase: supabase,

  /**
   * Recupera a sessão ativa do usuário
   */
  async getSession() {
    try {
      if (!supabase) return null;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data?.session;
    } catch (err) {
      console.error("Erro ao obter sessão:", err);
      return null;
    }
  },

  /**
   * Login convencional com e-mail e senha
   */
  async login(email, password) {
    if (!supabase) throw new Error("Supabase não inicializado.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  /**
   * Registro convencional com e-mail e senha
   */
  async register(email, password) {
    if (!supabase) throw new Error("Supabase não inicializado.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  },

  /**
   * Login ou Registro Transparente com Chave de Acesso (legado/rápido)
   */
  async loginOrRegister(chaveAcesso) {
    if (!supabase) throw new Error("Supabase não inicializado.");
    if (chaveAcesso.length < 6) throw new Error("A chave precisa ter pelo menos 6 caracteres.");

    const internalEmail = `${chaveAcesso.toLowerCase().replace(/[^a-z0-9]/g, '')}@myhub.internal`;
    const internalPass = chaveAcesso;

    let { data, error } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: internalPass
    });

    if (error) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: internalEmail,
        password: internalPass
      });
      if (signUpErr) throw signUpErr;
      return signUpData.user;
    }

    return data.user;
  },

  /**
   * Encerra a sessão
   */
  async logout() {
    if (supabase) {
      await supabase.auth.signOut();
      window.location.reload();
    }
  },

  /**
   * Chamada segura ao Gemini via Supabase Edge Function
   */
  async callGeminiEdge(prompt, context = {}) {
    const session = await this.getSession();
    if (!session) throw new Error("Usuário não autenticado.");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/gemini-assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ prompt, context })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Erro ao processar requisição com a IA.");
    }

    return await response.json();
  },

  /**
   * Salva mídia grande (Blob) no IndexedDB local do usuário
   */
  async saveHeavyFileLocal(id, blob, metadata = {}) {
    if (!localMediaDB) return;
    return new Promise((resolve, reject) => {
      const tx = localMediaDB.transaction("heavy_files", "readwrite");
      const store = tx.objectStore("heavy_files");
      const req = store.put({ id, blob, metadata, updated_at: new Date().toISOString() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * Recupera mídia grande do IndexedDB local do usuário
   */
  async getHeavyFileLocal(id) {
    if (!localMediaDB) return null;
    return new Promise((resolve) => {
      const tx = localMediaDB.transaction("heavy_files", "readonly");
      const store = tx.objectStore("heavy_files");
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }
};

// Monitoramento de Conexão e Estado de Sincronização
window.PortalSync = {
  updateUI(status) {
    const el = document.getElementById('global-sync-badge') || document.getElementById('sync-status');
    if (!el) return;

    if (status === 'saving') {
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span> <span class="text-amber-400">Salvando...</span>`;
    } else if (status === 'saved') {
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> <span class="text-emerald-400">Salvo</span>`;
    } else if (status === 'offline') {
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-zinc-500"></span> <span class="text-zinc-400">Offline</span>`;
    } else if (status === 'error') {
      el.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> <span class="text-red-400">Erro ao sincronizar</span>`;
    }
  }
};
