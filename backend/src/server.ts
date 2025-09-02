import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';
import contactosRoutes from './routes/contactosRoutes';
import estadisticasRoutes from './routes/estadisticasRoutes';
import usuariosRoutes from './routes/usuariosRoutes';
import universidadesRoutes from './routes/universidadesRoutes';
import titulacionesRoutes from './routes/titulacionesRoutes';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de todas las peticiones
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Body:`, req.body);
  next();
});

// Conectar a la base de datos
connectDB();

// Rutas públicas
app.use('/api/auth', authRoutes);

// Ruta de usuarios (incluye ruta pública para crear admin)
console.log('🔧 Configurando ruta de usuarios');
app.use('/api/usuarios', usuariosRoutes);

// Middleware de autenticación para rutas protegidas
console.log('🔒 Aplicando middleware de autenticación');
app.use('/api', authenticateToken);

// Rutas protegidas
app.use('/api/contactos', contactosRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/universidades', universidadesRoutes);
app.use('/api/titulaciones', titulacionesRoutes);

// Middleware de manejo de errores
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});

export default app;