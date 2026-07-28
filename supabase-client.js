
// ============================================================================
// CONFIGURAÇÃO DO SUPABASE
// ============================================================================
// ⚠️ SUBSTITUA a string abaixo pela Project URL do seu Supabase.
const SUPABASE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; 
const SUPABASE_KEY = 'sb_publishable_JnDv-fxHXPTzNaFX9n3Z0w_4mqt47Js';

// Inicializa a instância Global usando a biblioteca carregada via CDN no HTML
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================================
// GERENCIADOR CENTRAL DO BANCO DE DADOS (PortalDB)
// ============================================================================
window.PortalDB = {
    // Exporta a instância para ser usada em consultas (select, insert, etc)
    supabase: supabase,
    
    /**
     * Verifica se existe uma sessão ativa
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
     * Lógica unificada: Faz login se a conta existir, cria a conta se não existir.
     * Tudo utilizando apenas a "Chave de Acesso".
     */
    async loginOrRegister(chave) {
        // Converte a chave num e-mail interno invisível para o utilizador
        const internalEmail = `${chave}@portal.internal`;
        const internalPassword = chave;

        // 1. Tentativa de Login
        const { data, error } = await supabase.auth.signInWithPassword({
            email: internalEmail,
            password: internalPassword
        });

        // 2. Tratamento de Erros e Registo
        if (error) {
            // "Invalid login credentials" significa que a conta não existe, 
            // pois a password é sempre igual ao e-mail interno nesta arquitetura.
            if (error.message.includes('Invalid login credentials')) {
                
                // Tentativa de Registo (Criação de Conta Automática)
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: internalEmail,
                    password: internalPassword
                });

                if (signUpError) {
                    // Prevenção extra caso haja colisão de dados no Supabase
                    if (signUpError.message.includes('already registered')) {
                        throw new Error('Esta chave já está registrada. Se for sua, verifique letras maiúsculas e minúsculas.');
                    }
                    throw new Error('Erro ao criar conta: ' + signUpError.message);
                }
                
                return signUpData.user;
            }
            
            // Qualquer outro erro de login (ex: limite de tentativas, rede)
            throw new Error('Falha na comunicação com a nuvem. Tente novamente.');
        }
        
        // Retorna o utilizador logado
        return data.user;
    },
    
    /**
     * Termina a sessão do utilizador em todos os módulos
     */
    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Erro ao sair:", error);
    }
};


