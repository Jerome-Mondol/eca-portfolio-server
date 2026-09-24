import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { achievementSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/achievementStore.js";
export async function list(req: AuthedRequest,res:Response){res.json({data:await store.listAchievements(req.user!.sub)});}
export async function getOne(req: AuthedRequest,res:Response){const item=await store.getAchievement(req.params.id,req.user!.sub);if(!item)return res.status(404).json({message:"Not found"});res.json({data:item});}
export async function create(req: AuthedRequest,res:Response){const p=achievementSchema.safeParse(req.body);if(!p.success)return res.status(400).json({message:zodErrorMessage(p.error)});const item=await store.createAchievement(req.user!.sub,p.data);res.status(201).json({data:item});}
export async function update(req: AuthedRequest,res:Response){const p=achievementSchema.partial().safeParse(req.body);if(!p.success)return res.status(400).json({message:zodErrorMessage(p.error)});const item=await store.updateAchievement(req.params.id,req.user!.sub,p.data);if(!item)return res.status(404).json({message:"Not found"});res.json({data:item});}
export async function remove(req: AuthedRequest,res:Response){const ok=await store.deleteAchievement(req.params.id,req.user!.sub);if(!ok)return res.status(404).json({message:"Not found"});res.json({message:"Deleted"});}
