import { Router } from "express";
const r = Router();
/**
 * Cron ping — a deliberately trivial endpoint for external schedulers
 * (cron-job.org, UptimeRobot, platform-native cron, a Windows Task Scheduler
 * curl job) to call every few minutes.
 *
 * Two jobs exist because a free-tier host that sleeps shuts the whole box
 * down: pinging both the API and the frontend keeps each one awake and proves
 * the deploy is still live.
 *
 * Contract: 200 with the body `ok`, in well under a millisecond of work. No
 * database, no Redis, no auth, no AI — if any of those are down the ping still
 * succeeds, because a warm process is all this is here to prove. Anything
 * that needs real dependency checks belongs on `/api/health`.
 */
r.get("/", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.type("text/plain").send("ok");
});
export default r;
