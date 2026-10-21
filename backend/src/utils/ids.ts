import { ObjectId } from "mongodb";
import { badRequest } from "./errors";

export function parseObjectId(value: string): ObjectId {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) throw badRequest("Invalid id", "invalid_id");
  return new ObjectId(value);
}

export function validateUid(value: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw badRequest("Invalid user id", "invalid_id");
  return value;
}
