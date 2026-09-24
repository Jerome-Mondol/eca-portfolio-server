import { getPool } from "../config/db.js";
export type Skill={id:string;userId:string;name:string;category?:string|null;visibility?:string;createdAt?:string;updatedAt?:string}
const mem=new Map<string,Skill>();
function useDb(){return !!getPool();}
function rowTo(row:any):Skill{return {id:row.id,userId:row.user_id,name:row.name,category:row.category,visibility:row.visibility,createdAt:row.created_at?.toISOString?.(),updatedAt:row.updated_at?.toISOString?.()};}
export async function listSkills(userId:string):Promise<Skill[]>{if(useDb()){const r=await getPool()!.query("SELECT * FROM skills WHERE user_id=$1 ORDER BY created_at DESC",[userId]);return r.rows.map(rowTo);}return Array.from(mem.values()).filter(s=>s.userId===userId).sort((a,b)=>(b.createdAt??"").localeCompare(a.createdAt??""));}
export async function getSkill(id:string,userId:string):Promise<Skill|null>{if(useDb()){const r=await getPool()!.query("SELECT * FROM skills WHERE id=$1 AND user_id=$2",[id,userId]);if(!r.rows[0])return null;return rowTo(r.rows[0]);}const s=mem.get(id);if(!s||s.userId!==userId)return null;return s;}
export async function createSkill(userId:string,data:any):Promise<Skill>{
  if(useDb()){
    try{
      const r=await getPool()!.query(`INSERT INTO skills (user_id, name, category, visibility) VALUES ($1,$2,$3,$4) RETURNING *`,[userId,data.name,data.category??null,data.visibility||"public"]);
      return rowTo(r.rows[0]);
    }catch(e:any){
      if(e.code==="23505") throw new Error("Skill already exists");
      throw e;
    }
  }
  // memory: check duplicate
  for(const s of mem.values()) if(s.userId===userId && s.name.toLowerCase()===data.name.toLowerCase()) throw new Error("Skill already exists");
  const id=globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`;const s:Skill={id,userId,name:data.name,category:data.category??null,visibility:data.visibility||"public",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};mem.set(id,s);return s;
}
export async function updateSkill(id:string,userId:string,data:any):Promise<Skill|null>{if(useDb()){const r=await getPool()!.query(`UPDATE skills SET name=COALESCE($3,name), category=COALESCE($4,category), visibility=COALESCE($5,visibility), updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`,[id,userId,data.name??null,data.category??null,data.visibility??null]);if(!r.rows[0])return null;return rowTo(r.rows[0]);}const ex=mem.get(id);if(!ex||ex.userId!==userId)return null;const upd={...ex,...data,updatedAt:new Date().toISOString()};mem.set(id,upd);return upd;}
export async function deleteSkill(id:string,userId:string):Promise<boolean>{if(useDb()){const r=await getPool()!.query("DELETE FROM skills WHERE id=$1 AND user_id=$2",[id,userId]);return (r.rowCount??0)>0;}const ex=mem.get(id);if(!ex||ex.userId!==userId)return false;mem.delete(id);return true;}
