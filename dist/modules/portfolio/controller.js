import { getPool } from "../../config/db.js";
import { redisGet, redisSet } from "../../config/redis.js";
import { findUserByUsername } from "../../stores/userStore.js";
export async function getPublicPortfolio(req, res) {
    const username = req.params.username?.toLowerCase();
    if (!username)
        return res.status(400).json({ message: "Username required" });
    const cacheKey = `portfolio:${username}`;
    try {
        const cached = await redisGet(cacheKey);
        if (cached) {
            res.setHeader("X-Cache", "HIT");
            res.setHeader("Cache-Control", "public, max-age=60");
            return res.json(JSON.parse(cached));
        }
    }
    catch { }
    const user = await findUserByUsername(username);
    if (!user)
        return res.status(404).json({ message: "Portfolio not found" });
    const userId = user.id;
    const pool = getPool();
    // For memory fallback, we use stores (import dynamically to avoid circular)
    let profile = null;
    let projects = [];
    let activities = [];
    let certificates = [];
    let courses = [];
    let experiences = [];
    let achievements = [];
    let skills = [];
    if (pool) {
        try {
            const [profRes, projRes, actRes, certRes, courseRes, expRes, achRes, skillRes] = await Promise.all([
                pool.query("SELECT * FROM profiles WHERE user_id=$1", [userId]),
                pool.query("SELECT * FROM projects WHERE user_id=$1 AND visibility='public' ORDER BY created_at DESC LIMIT 5", [userId]),
                pool.query("SELECT * FROM activities WHERE user_id=$1 AND visibility='public' ORDER BY created_at DESC", [userId]),
                pool.query("SELECT * FROM certificates WHERE user_id=$1 AND visibility='public' ORDER BY created_at DESC", [userId]),
                pool.query("SELECT * FROM courses WHERE user_id=$1 AND visibility='public' ORDER BY created_at DESC", [userId]),
                pool.query("SELECT * FROM experiences WHERE user_id=$1 AND visibility='public' ORDER BY start_date DESC", [userId]),
                pool.query("SELECT * FROM achievements WHERE user_id=$1 AND visibility='public' ORDER BY date DESC", [userId]),
                pool.query("SELECT * FROM skills WHERE user_id=$1 AND visibility='public' ORDER BY created_at DESC", [userId]),
            ]);
            const rowToProfile = (row) => row ? { headline: row.headline, bio: row.bio, location: row.location, education: row.education, interests: row.interests, socials: row.socials, avatarKey: row.avatar_key } : null;
            const mapProject = (row) => {
                let links = null;
                try {
                    links = row.links ? (typeof row.links === "string" ? JSON.parse(row.links) : row.links) : null;
                }
                catch { }
                if ((!links || links.length === 0) && (row.github_url || row.live_url)) {
                    links = [];
                    if (row.github_url)
                        links.push({ platform: "GitHub", url: row.github_url });
                    if (row.live_url)
                        links.push({ platform: "Live", url: row.live_url });
                }
                return {
                    id: row.id,
                    title: row.title,
                    description: row.description,
                    coverImage: row.cover_image,
                    technologies: row.technologies,
                    skills: row.skills,
                    githubUrl: row.github_url,
                    liveUrl: row.live_url,
                    links,
                    featured: row.featured,
                    createdAt: row.created_at,
                };
            };
            profile = profRes.rows[0] ? rowToProfile(profRes.rows[0]) : null;
            projects = projRes.rows.map(mapProject);
            activities = actRes.rows.map((r) => ({
                id: r.id,
                activityName: r.activity_name,
                category: r.category,
                organization: r.organization,
                role: r.role,
                description: r.description,
                skills: r.skills,
                images: r.images ?? [],
            }));
            certificates = certRes.rows.map((r) => ({
                id: r.id,
                name: r.name,
                organization: r.organization,
                issueDate: r.issue_date,
                credentialId: r.credential_id,
                credentialUrl: r.credential_url,
                skills: r.skills,
                documentKey: r.document_key,
                documentName: r.document_name,
            }));
            courses = courseRes.rows.map((r) => ({
                id: r.id,
                name: r.name,
                provider: r.provider,
                instructor: r.instructor,
                description: r.description,
                skills: r.skills,
                certificateId: r.certificate_id,
            }));
            experiences = expRes.rows.map((r) => ({
                id: r.id,
                position: r.position,
                organization: r.organization,
                location: r.location,
                startDate: r.start_date,
                endDate: r.end_date,
                current: r.current,
                description: r.description,
                skills: r.skills,
            }));
            achievements = achRes.rows.map((r) => ({
                id: r.id,
                title: r.title,
                category: r.category,
                organization: r.organization,
                date: r.date,
                description: r.description,
            }));
            skills = skillRes.rows.map((r) => ({
                id: r.id,
                name: r.name,
                category: r.category,
            }));
        }
        catch (e) {
            console.error("[portfolio] query failed", e);
        }
    }
    else {
        // Memory fallback — use stores
        try {
            const { getProfile } = await import("../../stores/profileStore.js");
            const { listProjects } = await import("../../stores/projectStore.js");
            const { listActivities } = await import("../../stores/activityStore.js");
            const { listCertificates } = await import("../../stores/certificateStore.js");
            const { listCourses } = await import("../../stores/courseStore.js");
            const { listExperiences } = await import("../../stores/experienceStore.js");
            const { listAchievements } = await import("../../stores/achievementStore.js");
            const { listSkills } = await import("../../stores/skillStore.js");
            const [prof, projs, acts, certs, crs, exps, achs, sks] = await Promise.all([
                getProfile(userId).catch(() => null),
                listProjects(userId).catch(() => []),
                listActivities(userId).catch(() => []),
                listCertificates(userId).catch(() => []),
                listCourses(userId).catch(() => []),
                listExperiences(userId).catch(() => []),
                listAchievements(userId).catch(() => []),
                listSkills(userId).catch(() => []),
            ]);
            profile = prof ? { headline: prof.headline, bio: prof.bio, location: prof.location, education: prof.education, interests: prof.interests, socials: prof.socials, avatarKey: prof.avatarKey } : null;
            projects = projs.filter((p) => p.visibility !== "private").slice(0, 5);
            activities = acts.filter((a) => a.visibility !== "private");
            certificates = certs.filter((c) => c.visibility !== "private");
            courses = crs.filter((c) => c.visibility !== "private");
            experiences = exps.filter((e) => e.visibility !== "private");
            achievements = achs.filter((a) => a.visibility !== "private");
            skills = sks.filter((s) => s.visibility !== "private");
        }
        catch { }
    }
    const body = {
        user: { id: user.id, username: user.username, fullName: user.fullName, email: user.email },
        profile,
        projects,
        activities,
        certificates,
        courses,
        experiences,
        achievements,
        skills,
    };
    try {
        await redisSet(cacheKey, JSON.stringify(body), 60);
    }
    catch { }
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(body);
}
