import { RequestHandler } from "express";
import { validationResult } from "express-validator";

export const inputValidate: RequestHandler = function (req, res, next) {
  const result = validationResult(req);
  console.log(result.isEmpty());
  if (!result.isEmpty()) {
    return res.send({ errors: result.array(), code: 400 });
  }
  next();
};