import { Response } from 'express';
import { JerarquiaUsuarios } from '../models/JerarquiaUsuarios';
import { Usuario } from '../models/Usuario';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from '../types';
import { RolUsuario } from '../models/Usuario';
import mongoose from 'mongoose';

export class JerarquiasController {
  // Obtener jerarquías
  static async obtenerJerarquias(req: AuthRequest, res: Response) {
    try {
      const { page = 1, limit = 10, jefeId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const filter: any = {};

      // Filtrar por jefe si se proporciona
      if (jefeId) {
        filter.jefeId = jefeId;
      }

      // Si es comercial, solo puede ver sus propias jerarquías (donde él es el jefe)
      if (req.user?.rol === RolUsuario.COMERCIAL) {
        filter.jefeId = req.user.userId;
      }

      const jerarquias = await JerarquiaUsuarios.find(filter)
        .populate('jefeId', 'nombre email rol')
        .populate('subordinadoId', 'nombre email rol estado')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await JerarquiaUsuarios.countDocuments(filter);

      res.json({
        jerarquias,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('Error al obtener jerarquías:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener jerarquía por ID
  static async obtenerJerarquia(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'ID de jerarquía inválido' });
      }

      const jerarquia = await JerarquiaUsuarios.findById(id)
        .populate('jefeId', 'nombre email rol')
        .populate('subordinadoId', 'nombre email rol estado');

      if (!jerarquia) {
        return res.status(404).json({ error: 'Jerarquía no encontrada' });
      }

      // Verificar permisos
      if (req.user?.rol === RolUsuario.COMERCIAL && 
          jerarquia.jefeId._id.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ 
          error: 'No tienes permisos para ver esta jerarquía' 
        });
      }

      res.json(jerarquia);
    } catch (error) {
      console.error('Error al obtener jerarquía:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear nueva jerarquía (asignar un subordinado a un jefe)
  static async crearJerarquia(req: AuthRequest, res: Response) {
    try {
      const { jefeId, subordinadoId } = req.body;

      // Solo admins pueden crear jerarquías
      if (req.user?.rol !== RolUsuario.ADMIN) {
        return res.status(403).json({ 
          error: 'No tienes permisos para crear jerarquías' 
        });
      }

      if (!jefeId || !subordinadoId) {
        return res.status(400).json({ 
          error: 'Jefe y subordinado son obligatorios' 
        });
      }

      // Verificar que el jefe existe y es comercial
      const jefe = await Usuario.findById(jefeId);
      if (!jefe) {
        return res.status(400).json({ error: 'Jefe no encontrado' });
      }

      if (jefe.rol !== RolUsuario.COMERCIAL) {
        return res.status(400).json({ 
          error: 'El jefe debe tener rol comercial' 
        });
      }

      // Verificar que el subordinado existe
      const subordinado = await Usuario.findById(subordinadoId);
      if (!subordinado) {
        return res.status(400).json({ error: 'Subordinado no encontrado' });
      }

      // Verificar que no existe ya una jerarquía para este subordinado
      const jerarquiaExistente = await JerarquiaUsuarios.findOne({ subordinadoId });
      if (jerarquiaExistente) {
        return res.status(400).json({ 
          error: 'Este usuario ya tiene un jefe asignado' 
        });
      }

      // Verificar que no se está asignando a sí mismo
      if (jefeId === subordinadoId) {
        return res.status(400).json({ 
          error: 'Un usuario no puede ser jefe de sí mismo' 
        });
      }

      // Crear la jerarquía
      const nuevaJerarquia = new JerarquiaUsuarios({
        jefeId,
        subordinadoId
      });

      await nuevaJerarquia.save();

      // Registrar en audit log
      await AuditLog.create({
        usuarioId: req.user!.userId,
        accion: 'CREAR_JERARQUIA',
        recurso: 'JerarquiaUsuarios',
        recursoId: nuevaJerarquia._id,
        detalles: {
          jefeId,
          subordinadoId
        }
      });

      const jerarquiaCompleta = await JerarquiaUsuarios.findById(nuevaJerarquia._id)
        .populate('jefeId', 'nombre email rol')
        .populate('subordinadoId', 'nombre email rol estado');

      res.status(201).json({
        message: 'Jerarquía creada exitosamente',
        jerarquia: jerarquiaCompleta
      });
    } catch (error) {
      console.error('Error al crear jerarquía:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar jerarquía (cambiar jefe de un subordinado)
  static async actualizarJerarquia(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { jefeId } = req.body;

      // Solo admins pueden actualizar jerarquías
      if (req.user?.rol !== RolUsuario.ADMIN) {
        return res.status(403).json({ 
          error: 'No tienes permisos para actualizar jerarquías' 
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'ID de jerarquía inválido' });
      }

      const jerarquia = await JerarquiaUsuarios.findById(id);
      if (!jerarquia) {
        return res.status(404).json({ error: 'Jerarquía no encontrada' });
      }

      if (!jefeId) {
        return res.status(400).json({ error: 'Nuevo jefe es obligatorio' });
      }

      // Verificar que el nuevo jefe existe y es comercial
      const nuevoJefe = await Usuario.findById(jefeId);
      if (!nuevoJefe) {
        return res.status(400).json({ error: 'Nuevo jefe no encontrado' });
      }

      if (nuevoJefe.rol !== RolUsuario.COMERCIAL) {
        return res.status(400).json({ 
          error: 'El nuevo jefe debe tener rol comercial' 
        });
      }

      // Verificar que no se está asignando a sí mismo
      if (jefeId === jerarquia.subordinadoId.toString()) {
        return res.status(400).json({ 
          error: 'Un usuario no puede ser jefe de sí mismo' 
        });
      }

      const jefeAnterior = jerarquia.jefeId;
      jerarquia.jefeId = jefeId;
      await jerarquia.save();

      // Registrar en audit log
      await AuditLog.create({
        usuarioId: req.user!.userId,
        accion: 'ACTUALIZAR_JERARQUIA',
        recurso: 'JerarquiaUsuarios',
        recursoId: jerarquia._id,
        detalles: {
          jefeAnterior,
          jefeNuevo: jefeId,
          subordinadoId: jerarquia.subordinadoId
        }
      });

      const jerarquiaActualizada = await JerarquiaUsuarios.findById(id)
        .populate('jefeId', 'nombre email rol')
        .populate('subordinadoId', 'nombre email rol estado');

      res.json({
        message: 'Jerarquía actualizada exitosamente',
        jerarquia: jerarquiaActualizada
      });
    } catch (error) {
      console.error('Error al actualizar jerarquía:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Eliminar jerarquía
  static async eliminarJerarquia(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Solo admins pueden eliminar jerarquías
      if (req.user?.rol !== RolUsuario.ADMIN) {
        return res.status(403).json({ 
          error: 'No tienes permisos para eliminar jerarquías' 
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'ID de jerarquía inválido' });
      }

      const jerarquia = await JerarquiaUsuarios.findById(id);
      if (!jerarquia) {
        return res.status(404).json({ error: 'Jerarquía no encontrada' });
      }

      await JerarquiaUsuarios.findByIdAndDelete(id);

      // Registrar en audit log
      await AuditLog.create({
        usuarioId: req.user!.userId,
        accion: 'ELIMINAR_JERARQUIA',
        recurso: 'JerarquiaUsuarios',
        recursoId: id,
        detalles: {
          jefeId: jerarquia.jefeId,
          subordinadoId: jerarquia.subordinadoId
        }
      });

      res.json({ message: 'Jerarquía eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar jerarquía:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener subordinados de un jefe
  static async obtenerSubordinados(req: AuthRequest, res: Response) {
    try {
      const { jefeId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(jefeId)) {
        return res.status(400).json({ error: 'ID de jefe inválido' });
      }

      // Verificar permisos
      if (req.user?.rol === RolUsuario.COMERCIAL && req.user.userId !== jefeId) {
        return res.status(403).json({ 
          error: 'No tienes permisos para ver subordinados de otros usuarios' 
        });
      }

      const jerarquias = await JerarquiaUsuarios.find({ jefeId })
        .populate('subordinadoId', 'nombre email rol estado');

      const subordinados = jerarquias.map(j => j.subordinadoId);

      res.json({ subordinados });
    } catch (error) {
      console.error('Error al obtener subordinados:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener jefe de un subordinado
  static async obtenerJefe(req: AuthRequest, res: Response) {
    try {
      const { subordinadoId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(subordinadoId)) {
        return res.status(400).json({ error: 'ID de subordinado inválido' });
      }

      // Verificar permisos
      if (req.user?.rol === RolUsuario.COMERCIAL && req.user.userId !== subordinadoId) {
        return res.status(403).json({ 
          error: 'No tienes permisos para ver el jefe de otros usuarios' 
        });
      }

      const jerarquia = await JerarquiaUsuarios.findOne({ subordinadoId })
        .populate('jefeId', 'nombre email rol');

      if (!jerarquia) {
        return res.json({ jefe: null });
      }

      res.json({ jefe: jerarquia.jefeId });
    } catch (error) {
      console.error('Error al obtener jefe:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}