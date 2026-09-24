import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { courseSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/courseStore.js";
export async function list(req: AuthedRequest, res: Response){ res.json({ data: await store.listCourses(req.user!.sub) });}
export async function getOne(req: AuthedRequest, res: Response){ const item=await store.getCourse(req.params.id, req.user!.sub); if(!item) return res.status(404).json({message:"Not found"}); res.json({data:item});}
export async function create(req: AuthedRequest, res: Response){ const parsed=courseSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({message:zodErrorMessage(parsed.error)}); const item=await store.createCourse(req.user!.sub, parsed.data); res.status(201).json({data:item});}
export async function update(req: AuthedRequest, res: Response){ const parsed=courseSchema.partial().safeParse(req.body); if(!parsed.success) return res.status(400).json({message:zodErrorMessage(parsed.error)}); const item=await store.updateCourse(req.params.id, req.user!.sub, parsed.data); if(!item) return res.status(404).json({message:"Not found"}); res.json({data:item});}
export async function remove(req: AuthedRequest, res: Response){ const ok=await store.deleteCourse(req.params.id, req.user!.sub); if(!ok) return res.status(404).json({message:"Not found"}); res.json({message:"Deleted"});}
