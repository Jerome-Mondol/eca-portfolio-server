import type { Response } from "express";
import type { AuthedRequest } from "../../middleware/auth.js";
import { projectSchema, zodErrorMessage } from "../../utils/validation.js";
import * as store from "../../stores/projectStore.js";
import { sendCachedList, clearListCache } from "../../utils/listCache.js";
import { clearDashboardCache } from "../dashboard/controller.js";

const scope = "projects";

export async function list(req: AuthedRequest, res: Response) {
  return sendCachedList(res, scope, req.user!.sub, () => store.listProjects(req.user!.sub));
}

const invalidate = (userId: string) => {
  clearListCache(scope, userId);
  void clearDashboardCache(userId);
};
export async function getOne(req: AuthedRequest, res: Response) {
  const item = await store.getProject(req.params.id, req.user!.sub);
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json({ data: item });
}
export async function create(req: AuthedRequest, res: Response) {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  if ((parsed.data.visibility ?? "public") === "public") {
    const publicCount = (await store.listProjects(req.user!.sub)).filter((project) => project.visibility !== "private").length;
    if (publicCount >= 5) return res.status(400).json({ message: "You can show up to 5 projects on your portfolio. Hide another project first." });
  }
  const item = await store.createProject(req.user!.sub, parsed.data);
  invalidate(req.user!.sub);
  res.status(201).json({ data: item });
}
export async function update(req: AuthedRequest, res: Response) {
  const parsed = projectSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: zodErrorMessage(parsed.error) });
  const existing = await store.getProject(req.params.id, req.user!.sub);
  if (!existing) return res.status(404).json({ message: "Not found" });
  const willBePublic = (parsed.data.visibility ?? existing.visibility ?? "public") === "public";
  if (willBePublic && existing.visibility === "private") {
    const publicCount = (await store.listProjects(req.user!.sub)).filter((project) => project.visibility !== "private").length;
    if (publicCount >= 5) return res.status(400).json({ message: "You can show up to 5 projects on your portfolio. Hide another project first." });
  }
  const item = await store.updateProject(req.params.id, req.user!.sub, parsed.data);
  if (!item) return res.status(404).json({ message: "Not found" });
  invalidate(req.user!.sub);
  res.json({ data: item });
}
export async function remove(req: AuthedRequest, res: Response) {
  const ok = await store.deleteProject(req.params.id, req.user!.sub);
  if (!ok) return res.status(404).json({ message: "Not found" });
  invalidate(req.user!.sub);
  res.json({ message: "Deleted" });
}

export async function verifyLink(req: AuthedRequest, res: Response) {
  let targetUrl = req.body?.url || req.query?.url;
  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).json({ valid: false, message: "URL is required" });
  }

  targetUrl = targetUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return res.json({ valid: false, url: targetUrl, message: "Invalid domain format" });
    }

    let response: globalThis.Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      response = await fetch(targetUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timeoutId);

      if (response.status === 405 || response.status === 403) {
        const controllerGet = new AbortController();
        const timeoutIdGet = setTimeout(() => controllerGet.abort(), 4000);
        response = await fetch(targetUrl, {
          method: "GET",
          signal: controllerGet.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        clearTimeout(timeoutIdGet);
      }
    } catch {
      const controllerGet = new AbortController();
      const timeoutIdGet = setTimeout(() => controllerGet.abort(), 4000);
      response = await fetch(targetUrl, {
        method: "GET",
        signal: controllerGet.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timeoutIdGet);
    }

    if (response.status >= 200 && response.status < 400) {
      return res.json({
        valid: true,
        url: targetUrl,
        status: response.status,
        statusText: response.statusText || "OK",
        domain: parsed.hostname,
        message: "Link verified & active",
      });
    } else {
      return res.json({
        valid: false,
        url: targetUrl,
        status: response.status,
        statusText: response.statusText,
        domain: parsed.hostname,
        message: `HTTP ${response.status} — ${response.statusText || "Page not found or restricted"}`,
      });
    }
  } catch (err: any) {
    return res.json({
      valid: false,
      url: targetUrl,
      message: err.name === "AbortError" ? "Verification timed out" : "Could not connect to domain",
    });
  }
}
