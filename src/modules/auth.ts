import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import { UserPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const hashPassword = (password: User["password"]) => {
  return bcrypt.hash(password, 5);
};

export const comparePasswords = (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

export const createJWT = (user: User) => {
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      avatar: user.avatar,
    },
    JWT_SECRET
  );
  return token;
};

export const protect = (req: Request, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;

  if (!bearer) {
    res.status(401);
    res.json({ message: "not authorized" });
    return;
  }

  const [, token] = bearer.split(" ");

  if (!token) {
    res.status(401);
    res.json({ message: "not valid token" });
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = user;
    next();
  } catch (e) {
    console.error(e);
    res.status(401);
    res.json({ message: "not valid token" });
    return;
  }
};

export const permission = (req: Request, res: Response, next: NextFunction) => {
  const bearer = req.headers.authorization;

  if (!bearer) {
    res.status(401);
    res.json({ message: "not valid token" });
    return;
  }

  const [, token] = bearer.split(" ");

  if (!token) {
    res.status(401);
    res.json({ message: "not valid token" });
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as UserPayload;
    if (user.role === "ADMIN") {
      return next();
    } else {
      res.status(401);
      res.json({ message: "admin only" });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(401);
    res.json({ message: "not valid token" });
    return;
  }
};
