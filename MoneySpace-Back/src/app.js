import express from 'express'; //importa a biblioteca express
import cors from 'cors'; // importa a biblioteca cors
import healthRoutes from './routes/health.routes.js'; // importa as rotas de health check
import cookieParser from 'cookie-parser'; // importa a biblioteca cookie-parser

//cria uma instância do express
const app = express(); 

// Configura o CORS para permitir solicitações de qualquer origem
// Configura o Express para analisar o corpo das requisições como JSON
// Configura o express para analisar cookies
app.use(cors());
app.use(express.json());
app.use(cookieParser());

//==== Incicios das rotas do backend ====//
app.use('/health', healthRoutes);

export default app; //exporta a instância do express para ser usada em outros arquivos
