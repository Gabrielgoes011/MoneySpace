// ========================================
// CARREGAMENTO DE VARIÁVEIS DE AMBIENTE
// ========================================
// Lê o arquivo .env.{NODE_ENV} (padrão: .env.development) e injeta tudo
// em process.env. Precisa ser importado ANTES de qualquer uso de process.env
// (por isso é a primeira linha do server.js).

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sobe dois níveis (config → src → raiz do backend) para encontrar os arquivos .env
const rootDir = resolve(__dirname, '../../');

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: resolve(rootDir, `.env.${env}`) });
