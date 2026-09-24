import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { experienceSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/experienceStore.js";
export async function list(req: AuthedRequest,res:Response){res.json({data:await store.listExperiences(req.user!.sub)});}
export async function getOne(req: AuthedRequest,res:Response){const item=await store.getExperience(req.params.id,req.user!.sub);if(!item)return res.status(404).json({message:"Not found"});res.json({data:item});}
export async function create(req: AuthedRequest,res:Response){const p=experienceSchema.safeParse(req.body);if(!p.success)return res.status(400).json({message:zodErrorMessage(p.error)});const item=await store.createExperience(req.user!.sub,p.data);res.status(201).json({data:item});}
export async function update(req: AuthedRequest,res:Response){const p=experienceSchema.partial().safeParse(req.body);if(!p.success)return res.status(400).json({message:zodErrorMessage(p.error)});const item=await store.updateExperience(req.params.id,req.user!.sub,p.data);if(!item)return res.status(404).json({message:"Not found"});res.json({data:item});}
export async function remove(req: AuthedRequest,res:Response){const ok=await store.deleteExperience(req.params.id,req.user!.sub);if(!ok)return res.status(404).json({message:"Not found"});res.json({message:"Deleted"});}
