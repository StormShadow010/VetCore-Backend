import { Response } from 'express';
import { ApiResponse } from '../types';

export const ok = <T>(res: Response, data: T, message?: string) =>
  res.status(200).json({ success: true, data, message } as ApiResponse<T>);

export const created = <T>(res: Response, data: T) =>
  res.status(201).json({ success: true, data } as ApiResponse<T>);

export const noContent = (res: Response) => res.status(204).send();

export const badRequest = (res: Response, errors: string[]) =>
  res.status(400).json({ success: false, errors } as ApiResponse);

export const unauthorized = (res: Response, message = 'No autorizado') =>
  res.status(401).json({ success: false, message } as ApiResponse);

export const forbidden = (res: Response, message = 'Acceso denegado') =>
  res.status(403).json({ success: false, message } as ApiResponse);

export const notFound = (res: Response, message = 'Recurso no encontrado') =>
  res.status(404).json({ success: false, message } as ApiResponse);

export const conflict = (res: Response, message: string) =>
  res.status(409).json({ success: false, message } as ApiResponse);

export const serverError = (res: Response, message = 'Error interno del servidor') =>
  res.status(500).json({ success: false, message } as ApiResponse);
