import { Router } from 'express';
import { JerarquiasController } from '../controllers/JerarquiasController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/authorization';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Rutas principales
router.get('/', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.obtenerJerarquias
);

router.get('/:id', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.obtenerJerarquia
);

router.post('/', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.crearJerarquia
);

router.put('/:id', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.actualizarJerarquia
);

router.delete('/:id', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.eliminarJerarquia
);

// Get subordinados and jefe routes
router.get('/jefe/:subordinadoId', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.obtenerJefe
);

router.get('/subordinados/:jefeId', 
  requirePermission('gestionar_jerarquias'),
  JerarquiasController.obtenerSubordinados
);

export default router;