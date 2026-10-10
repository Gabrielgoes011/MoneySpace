//   PUT    /contas/:id
//   DELETE /contas/:id   (arquivar / soft delete)

import { Router } from 'express';
import verificaToken from '../../../middleware/auth/verificaToken.js';
import {
  listarFamiliasController,
  criarFamiliaController,
} from './cadFamilia.controller.js';

const router = Router();

router.get('/familias', verificaToken, listarFamiliasController);

//cadastra familia, exige token e chama o controller
router.post('/familias', verificaToken, criarFamiliaController);
/* body deve conter: { id, nome, descricao, id_usuario_criador }
exemplo {"nome": "Família 1" }

*/

export default router;
