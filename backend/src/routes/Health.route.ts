import { Request, Response, NextFunction } from 'express';
export const HealthCheck = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
 res.send('Ok')
};