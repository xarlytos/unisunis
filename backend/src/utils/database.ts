import mongoose from 'mongoose';

export interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export class DatabaseUtils {
  /**
   * Registra una acción de auditoría
   */
  static async logAuditAction(auditData: AuditLog): Promise<void> {
    try {
      const AuditLogModel = mongoose.model('AuditLog');
      await AuditLogModel.create({
        ...auditData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  }

  /**
   * Limpia logs de auditoría antiguos (más de 90 días)
   */
  static async cleanOldAuditLogs(): Promise<void> {
    try {
      const AuditLogModel = mongoose.model('AuditLog');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      const result = await AuditLogModel.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      console.log(`Cleaned ${result.deletedCount} old audit logs`);
    } catch (error) {
      console.error('Error cleaning old audit logs:', error);
    }
  }

  /**
   * Verifica el estado de salud de la base de datos
   */
  static async checkDatabaseHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      // Verificar conexión
      if (mongoose.connection.readyState !== 1) {
        return {
          status: 'unhealthy',
          details: {
            error: 'Database not connected',
            connectionState: mongoose.connection.readyState
          }
        };
      }

      // Obtener estadísticas básicas
      const dbStats = await mongoose.connection.db.stats();
      
      return {
        status: 'healthy',
        details: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          indexSize: dbStats.indexSize
        }
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          connectionState: mongoose.connection.readyState
        }
      };
    }
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  static async getDatabaseStats(): Promise<Record<string, any>> {
    try {
      const db = mongoose.connection.db;
      const collections = ['usuarios', 'contactos', 'universidades', 'titulaciones', 'audit_logs'];
      
      const stats: Record<string, any> = {};
      
      for (const collection of collections) {
        const count = await db.collection(collection).countDocuments();
        stats[collection] = { count };
      }
      
      return stats;
    } catch (error: unknown) {
      console.error('Error getting database stats:', error);
      return {};
    }
  }
}

export default DatabaseUtils;