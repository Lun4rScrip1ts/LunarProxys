import path from "node:path";
import { promises as fs } from "node:fs";
import express from "express";

const router = express.Router();
const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const COMMUNITY_FILE = path.join(DATA_DIR, "community.json");

async function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function actualCounts() {
  const state = await readJson(COMMUNITY_FILE, { users: {}, sessions: {} });
  const users = state.users && typeof state.users === "object" ? state.users : {};
  const sessions = state.sessions && typeof state.sessions === "object" ? state.sessions : {};
  const cutoff = Date.now() - 2 * 60 * 1000;
  const onlineUsers = new Set();

  for (const session of Object.values(sessions)) {
    if (session?.kind === "active" && Number(session.lastSeen) > cutoff && users[session.userId]) {
      onlineUsers.add(session.userId);
    }
  }

  const memberList = Object.values(users).map(user => ({
    id: user.id,
    username: String(user.username || ""),
    displayName: String(user.displayName || user.username || ""),
    avatarUrl: String(user.avatarUrl || ""),
    bannerUrl: String(user.bannerUrl || ""),
    backgroundUrl: String(user.backgroundUrl || ""),
    isOnline: onlineUsers.has(user.id),
  })).sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.username.localeCompare(b.username);
  });
  const members = memberList.length;
  const online = onlineUsers.size;
  return { online, offline: Math.max(0, members - online), members, memberList };
}

router.get("/member-display", async (req, res) => {
  const counts = await actualCounts();
  res.set("Cache-Control", "no-store");
  res.json({ ...counts, actual: counts, canEdit: false });
});

export default router;
