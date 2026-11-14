// ========================================
// CONEXÃO COM O POSTGRESQL (OPCIONAL)
// ========================================
// Pool de conexões + contexto de RLS por request.
// Neste template o login é simulado, então nada aqui é usado por padrão.
// Só entra em ação quando você preencher DATABASE_URL no .env e passar a
// consultar o banco de verdade nas suas rotas.

import pkg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';

const { Pool } = pkg;

export const dbContext = new AsyncLocalStorage();

function normalizeDatabaseUrl(rawUrl) {
    if (!rawUrl) return rawUrl;

    try {
        const parsed = new URL(rawUrl);
        const sslmode = parsed.searchParams.get('sslmode');

        // O `pg` atual emite um SECURITY WARNING porque trata 'prefer'/'require'/
        // 'verify-ca' como aliases de 'verify-full'. Em versões futuras esse
        // comportamento muda. A forma recomendada pela própria lib para manter o
        // comportamento seguro atual e silenciar o aviso é optar explicitamente
        // pela compatibilidade com libpq. Fazemos isso quando o sslmode é um dos
        // modos afetados e o opt-in ainda não foi informado na URL.
        const modosAfetados = ['prefer', 'require', 'verify-ca'];
        const jaOptou = parsed.searchParams.get('uselibpqcompat') === 'true';

        if (!jaOptou && modosAfetados.includes(sslmode)) {
            parsed.searchParams.set('uselibpqcompat', 'true');
        }

        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

// Cria um pool de conexões usando a DATABASE_URL do .env
const pool = new Pool({
    connectionString,
    max: 20,
    min: 0,
    // o pooler do Neon fecha conexões ociosas; descartar antes evita usar uma conexão já morta
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000,
    statement_timeout: 60000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (error, client) => {
    console.error('❌ Erro no pool de conexões PostgreSQL:', error.message);
    if (client) {
        console.error(`   Database: ${client.database}`);
        console.error(`   User: ${client.user}`);
        console.error(`   Host: ${client.host}`);
    }
});

//#region => verificação da conexão no startup
//testa a conexão uma vez e devolve só o necessário para o banner (sem host, usuário nem senha)
async function verificarConexaoBanco() {
    //1º passo: sem URL não há o que testar
    if (!process.env.DATABASE_URL) {
        return { conectado: false, motivo: 'DATABASE_URL ausente' };
    }

    try {
        //2º passo: abre uma conexão e confere se o role respeita o RLS
        const client = await pool.connect();

        try {
            const resultado = await client.query(`
                SELECT rolbypassrls AS ignora_rls
                FROM pg_roles
                WHERE rolname = current_user
            `);

            return { conectado: true, ignoraRls: resultado.rows[0]?.ignora_rls === true };
        } finally {
            client.release();
        }
    } catch (error) {
        //só o código do erro: a mensagem do driver pode trazer o host do banco
        return { conectado: false, motivo: error.code || 'erro de conexão' };
    }
}
//#endregion

export async function openDb() {
    const store = dbContext.getStore();

    if (store?.client) {
        return store.client;
    }

    return pool;
}

export { pool, verificarConexaoBanco };