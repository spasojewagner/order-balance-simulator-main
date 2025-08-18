// src/middleware/auth.ts
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../controllers/UserController";

export const protectRoute = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    console.log('🔐 Auth middleware - Checking authentication...');
    
    // Get token from cookies
    const token = req.cookies.jwt;
    
    if (!token) {
      console.log('❌ No JWT token found in cookies');
      return res.status(401).json({ error: "Niste autentifikovani - nema tokena" });
    }

    console.log('🎫 JWT token found, verifying...');
    
    // Verify token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "tajna-koja-bi-trebala-biti-u-env-fajlu"
    ) as { id: string; role: string };

    console.log('✅ Token verified successfully');
    console.log('👤 User ID:', decoded.id);
    console.log('🔑 User Role:', decoded.role);

    // Add user info to request
    req.user = { 
      id: decoded.id, 
      role: decoded.role 
    };

    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Nevažeći token" });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Token je istekao" });
    }
    
    return res.status(401).json({ error: "Greška pri autentifikaciji" });
  }
};

// Additional middleware for role-based access
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    
    console.log('🔍 Role check - Required roles:', roles);
    console.log('👤 User role:', userRole);
    
    if (!userRole || !roles.includes(userRole)) {
      console.log('❌ Access denied - insufficient permissions');
      return res.status(403).json({ 
        error: "Nemate dozvolu za pristup ovim podacima",
        required: roles,
        current: userRole 
      });
    }
    
    console.log('✅ Role check passed');
    next();
  };
};