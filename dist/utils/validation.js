import { z } from "zod";
export const registerSchema = z.object({
    fullName: z.string().min(2).max(80),
    email: z.string().email().max(255),
    username: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/, "username: lowercase letters, numbers, hyphen only"),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const profileSchema = z.object({
    headline: z.string().max(120).optional().nullable(),
    bio: z.string().max(1000).optional().nullable(),
    location: z.string().max(120).optional().nullable(),
    education: z.any().optional().nullable(),
    interests: z.array(z.string()).optional().nullable(),
    socials: z.any().optional().nullable(),
    avatarKey: z.string().max(500).optional().nullable(),
});
export const projectSchema = z.object({
    title: z.string().min(2).max(120),
    description: z.string().max(500).optional().nullable(),
    detailedDescription: z.string().max(5000).optional().nullable(),
    coverImage: z.string().max(1000).optional().nullable(),
    technologies: z.array(z.string()).optional().nullable(),
    skills: z.array(z.string()).optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    githubUrl: z.string().url().optional().nullable().or(z.literal("")),
    liveUrl: z.string().url().optional().nullable().or(z.literal("")),
    demoVideo: z.string().max(500).optional().nullable(),
    role: z.string().max(80).optional().nullable(),
    featured: z.boolean().optional(),
    visibility: z.enum(["public", "private"]).optional(),
    links: z.array(z.object({ platform: z.string().min(1).max(40), url: z.string().min(3).max(500) })).optional().nullable(),
});
export const activitySchema = z.object({
    activityName: z.string().min(2).max(120),
    category: z.string().max(50).optional().nullable(),
    organization: z.string().max(120).optional().nullable(),
    role: z.string().max(80).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    achievements: z.string().max(1000).optional().nullable(),
    skills: z.array(z.string()).optional().nullable(),
    images: z.array(z.string().max(1000)).max(5, "Max 5 images").optional().nullable(),
    visibility: z.enum(["public", "private"]).optional(),
});
export const certificateSchema = z.object({
    name: z.string().min(2).max(150),
    organization: z.string().max(120).optional().nullable(),
    issueDate: z.string().optional().nullable(),
    credentialId: z.string().max(120).optional().nullable(),
    credentialUrl: z.string().url().optional().nullable().or(z.literal("")),
    skills: z.array(z.string()).optional().nullable(),
    documentKey: z.string().max(500).optional().nullable(),
    visibility: z.enum(["public", "private"]).optional(),
});
export const courseSchema = z.object({
    name: z.string().min(2).max(150),
    provider: z.string().max(120).optional().nullable(),
    instructor: z.string().max(120).optional().nullable(),
    startDate: z.string().optional().nullable(),
    completionDate: z.string().optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    skills: z.array(z.string()).optional().nullable(),
    certificateId: z.string().max(120).optional().nullable(),
    credentialUrl: z.string().url().optional().nullable().or(z.literal("")),
    visibility: z.enum(["public", "private"]).optional(),
});
export const experienceSchema = z.object({
    position: z.string().min(2).max(120),
    organization: z.string().max(120).optional().nullable(),
    location: z.string().max(120).optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    current: z.boolean().optional(),
    description: z.string().max(2000).optional().nullable(),
    achievements: z.string().max(1000).optional().nullable(),
    skills: z.array(z.string()).optional().nullable(),
    visibility: z.enum(["public", "private"]).optional(),
});
export const achievementSchema = z.object({
    title: z.string().min(2).max(150),
    category: z.string().max(50).optional().nullable(),
    organization: z.string().max(120).optional().nullable(),
    date: z.string().optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    visibility: z.enum(["public", "private"]).optional(),
});
export const skillSchema = z.object({
    name: z.string().min(1).max(80),
    category: z.enum(["Technical", "Creative", "Leadership", "Communication", "Languages", "Other"]).optional(),
    visibility: z.enum(["public", "private"]).optional(),
});
export const documentSchema = z.object({
    filename: z.string().min(1).max(255),
    originalName: z.string().max(255).optional().nullable(),
    mimeType: z.string().max(120).optional().nullable(),
    fileSize: z.number().int().min(0).optional().nullable(),
    storageKey: z.string().max(500).optional().nullable(),
    category: z.enum(["Certificates", "Projects", "Awards", "Other"]).optional(),
});
export function zodErrorMessage(err) {
    return err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
}
