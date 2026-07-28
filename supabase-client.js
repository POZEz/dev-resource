
/**
 * ============================================================================
 * CLIENTE CENTRAL SUPABASE & AUTENTICAÇÃO
 * ============================================================================
 * Este ficheiro deve ser importado em todas as páginas do projeto após a CDN do Supabase.
 */

// ⚠️ IMPORTANTE: Substitua pela URL real do seu projeto Supabase
const SUPABASE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const SUPABASE_KEY = 'sb_publishable_JnDv-fxHXPTzNaFX9n3Z0w_4mqt47Js';

// Inicializa a instância Global do Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.PortalDB = {
    // Instância pronta para ser usada nos outros ficheiros (ex: PortalDB.supabase.from('...'))
    supabase: supabase,
    
    /**
     * Verifica automaticamente se há uma sessão ativa salva no navegador
     */
    async getSession() {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data?.session;
        } catch (error) {
            console.error("Erro ao recuperar sessão:", error);
            return null;
        }
    },
    
    /**
     * Fluxo Transparente: Tenta fazer Login. Se a conta não existir, regista e faz login.
     */
    async loginOrRegister(chaveAcesso) {
        // Validação de segurança básica antes de enviar à nuvem
        if (chaveAcesso.length < 8 || chaveAcesso.length > 25) {
            throw new Error('A chave deve ter entre 8 e 25 caracteres.');
        }
        if (!/[a-zA-Z]/.test(chaveAcesso) || !/[0-9]/.test(chaveAcesso)) {
            throw new Error('A chave precisa conter pelo menos uma letra e um número.');
        }
        if (!/^[\x20-\x7E]+$/.test(chaveAcesso)) {
            throw new Error('Caracteres inválidos. Use apenas símbolos do teclado padrão.');
        }

        // Conversão para o formato interno exigido pelo Supabase
        const internalEmail = `${chaveAcesso}@portal.internal`;
        const internalPassword = chaveAcesso;

        // 1. TENTA FAZER O LOGIN PRIMEIRO
        let { data, error } = await supabase.auth.signInWithPassword({
            email: internalEmail,
            password: internalPassword
        });

        // 2. SE FALHAR PORQUE NÃO EXISTE, CRIA A CONTA
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                // Registo Transparente
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: internalEmail,
                    password: internalPassword
                });

                if (signUpError) {
                    // Trata colisão (caso a chave já exista noutro contexto ou erro de rede)
                    if (signUpError.message.includes('already registered')) {
                        throw new Error('Esta chave já está em uso por outro utilizador. Escolha outra.');
                    }
                    throw new Error('Erro ao criar sua nuvem: ' + signUpError.message);
                }
                
                return signUpData.user;
            }
            
            // Outros erros (rede, bloqueio, etc)
            throw new Error('Falha de conexão: ' + error.message);
        }
        
        return data.user;
    },
    
    /**
     * Desconecta o utilizador e limpa a sessão local
     */
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Erro ao desconectar:", error);
            throw error;
        }
    }
};
