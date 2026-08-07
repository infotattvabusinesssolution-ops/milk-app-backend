import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
export function requireAuth(...roles) {
  return (req,res,next) => {
    const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
    if(!token) throw new ApiError(401,'Authentication required');
    try { req.auth=jwt.verify(token,env.jwtSecret); }
    catch { throw new ApiError(401,'Invalid or expired token'); }
    if(roles.length && !roles.includes(req.auth.role)) throw new ApiError(403,'Access denied');
    next();
  };
}
