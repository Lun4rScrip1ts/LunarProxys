import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";

const router = express.Router();
const DATA_DIR = process.env.LUNAR_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "spotify-auth.json");
const PLAYLIST_FILE = path.join(DATA_DIR, "spotify-lunar-playlists.json");
const oauthStates = new Map();
const authCache = new Map();

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch (error) { if (error.code !== "ENOENT") console.warn("[Spotify] Read failed:", error.message); return fallback; }
}
async function writeJson(file, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const temp = file + ".tmp";
  await fs.writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temp, file);
}
function credentials() { return { clientId: process.env.SPOTIFY_CLIENT_ID || "", clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "" }; }
function redirectUri(req) { return process.env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/spotify/callback`; }
function currentUser(req) {
  const token = req.cookies?.lunar_session;
  if (!token) return null;
  const data = req.__spotifyCommunityData;
  if (data) return data.sessions?.[token] && data.users?.[data.sessions[token].userId] ? data.users[data.sessions[token].userId] : null;
  return null;
}
async function loadCommunity() { return readJson(path.join(DATA_DIR, "community.json"), { users: {}, sessions: {} }); }
async function requireUser(req, res, next) {
  const data = await loadCommunity();
  req.__spotifyCommunityData = data;
  const token = req.cookies?.lunar_session;
  const session = token ? data.sessions?.[token] : null;
  const user = session && Date.now() <= Number(session.expiresAt || 0) ? data.users?.[session.userId] : null;
  if (!user) return res.status(401).json({ error: "You need to log in to use the music player." });
  req.user = user;
  next();
}
function cleanPlaylist(value) {
  return { id: String(value.id), name: String(value.name || "My Playlist").slice(0, 80), description: String(value.description || "").slice(0, 300), tracks: Array.isArray(value.tracks) ? value.tracks.slice(0, 500) : [], createdAt: value.createdAt || Date.now(), updatedAt: value.updatedAt || Date.now() };
}
async function getPlaylists() { return readJson(PLAYLIST_FILE, {}); }
async function spotifyTokenFor(userId) {
  const cached = authCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;
  const all = await readJson(AUTH_FILE, {});
  const record = all[userId];
  if (!record?.refreshToken) return null;
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) return null;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: record.refreshToken }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) return null;
  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  authCache.set(userId, { accessToken: data.access_token, expiresAt });
  if (data.refresh_token) { record.refreshToken = data.refresh_token; all[userId] = record; await writeJson(AUTH_FILE, all); }
  return data.access_token;
}
async function spotifyApi(userId, url, options = {}) {
  const token = await spotifyTokenFor(userId);
  if (!token) return { ok: false, status: 401, data: { error: "Connect your Spotify account first." } };
  const response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

router.get("/spotify/auth/status", requireUser, async (req, res) => {
  const all = await readJson(AUTH_FILE, {});
  const record = all[req.user.id];
  return res.json({ connected: Boolean(record?.refreshToken), spotifyUser: record?.spotifyUser || null, redirectUri: redirectUri(req) });
});
router.get("/spotify/auth", requireUser, (req, res) => {
  const { clientId } = credentials();
  if (!clientId) return res.status(503).send("Spotify OAuth is not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  const state = randomBytes(24).toString("hex");
  oauthStates.set(state, { userId: req.user.id, expiresAt: Date.now() + 10 * 60 * 1000 });
  const scope = ["streaming", "user-read-email", "user-read-private", "user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"].join(" ");
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri(req), scope, state, show_dialog: "true" });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});
router.get("/spotify/callback", async (req, res) => {
  const state = oauthStates.get(String(req.query.state || ""));
  oauthStates.delete(String(req.query.state || ""));
  if (!state || state.expiresAt < Date.now()) return res.status(400).send("Spotify authorization expired. Go back to Lunar and connect again.");
  if (req.query.error) return res.redirect("/spotify?spotify_error=" + encodeURIComponent(String(req.query.error)));
  const { clientId, clientSecret } = credentials();
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: String(req.query.code || ""), redirect_uri: redirectUri(req) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token || !data.refresh_token) throw new Error(data.error_description || "Spotify token exchange failed.");
    const meResponse = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${data.access_token}` } });
    const me = await meResponse.json().catch(() => ({}));
    const all = await readJson(AUTH_FILE, {});
    all[state.userId] = { refreshToken: data.refresh_token, spotifyUser: { id: me.id || "", displayName: me.display_name || "Spotify user" }, connectedAt: Date.now() };
    await writeJson(AUTH_FILE, all);
    authCache.set(state.userId, { accessToken: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 });
    res.redirect("/spotify?spotify_connected=1");
  } catch (error) {
    console.error("Spotify OAuth callback:", error);
    res.redirect("/spotify?spotify_error=" + encodeURIComponent("connection_failed"));
  }
});
router.get("/spotify/token", requireUser, async (req, res) => {
  const token = await spotifyTokenFor(req.user.id);
  if (!token) return res.status(401).json({ error: "Connect your Spotify account first." });
  res.setHeader("Cache-Control", "no-store");
  res.json({ accessToken: token });
});
router.post("/spotify/player/play", requireUser, async (req, res) => {
  const uri = String(req.body?.uri || "");
  const deviceId = String(req.body?.deviceId || "");
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(uri)) return res.status(400).json({ error: "Choose a Spotify track." });
  const payload = { uris: [uri] };
  if (deviceId) payload.device_id = deviceId;
  const result = await spotifyApi(req.user.id, "https://api.spotify.com/v1/me/player/play" + (deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ""), { method: "PUT", body: JSON.stringify({ uris: payload.uris }) });
  if (!result.ok) return res.status(result.status).json({ error: result.data?.error?.message || result.data?.error || "Spotify playback failed." });
  res.json({ ok: true });
});
router.post("/spotify/player/action", requireUser, async (req, res) => {
  const action = String(req.body?.action || "");
  const paths = { pause: ["pause", "PUT"], resume: ["play", "PUT"], next: ["next", "POST"], previous: ["previous", "POST"] };
  if (!paths[action]) return res.status(400).json({ error: "Unsupported playback action." });
  const [name, method] = paths[action];
  const result = await spotifyApi(req.user.id, `https://api.spotify.com/v1/me/player/${name}`, { method });
  if (!result.ok) return res.status(result.status).json({ error: result.data?.error?.message || "Playback action failed." });
  res.json({ ok: true });
});

router.get("/spotify/playlists", requireUser, async (req, res) => {
  const all = await getPlaylists();
  res.json({ playlists: Object.values(all[req.user.id] || {}).map(cleanPlaylist) });
});
router.post("/spotify/playlists", requireUser, async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: "Give your playlist a name." });
  const all = await getPlaylists();
  all[req.user.id] ||= {};
  const id = randomBytes(12).toString("hex");
  const playlist = cleanPlaylist({ id, name, description: req.body?.description, tracks: [] });
  all[req.user.id][id] = playlist;
  await writeJson(PLAYLIST_FILE, all);
  res.status(201).json({ playlist });
});
router.post("/spotify/playlists/:playlistId/tracks", requireUser, async (req, res) => {
  const all = await getPlaylists();
  const playlist = all[req.user.id]?.[req.params.playlistId];
  const track = req.body?.track;
  if (!playlist) return res.status(404).json({ error: "Playlist not found." });
  if (!track?.id || !track?.name) return res.status(400).json({ error: "Invalid track." });
  if (playlist.tracks.some(item => item.id === String(track.id))) return res.status(409).json({ error: "That song is already in the playlist." });
  playlist.tracks.push({ id: String(track.id), uri: String(track.uri || `spotify:track:${track.id}`), name: String(track.name).slice(0, 200), artists: String(track.artists || "").slice(0, 200), album: String(track.album || "").slice(0, 200), image: String(track.image || "").slice(0, 1000), duration_ms: Number(track.duration_ms || 0) });
  playlist.updatedAt = Date.now();
  await writeJson(PLAYLIST_FILE, all);
  res.status(201).json({ playlist: cleanPlaylist(playlist) });
});
router.delete("/spotify/playlists/:playlistId/tracks/:trackId", requireUser, async (req, res) => {
  const all = await getPlaylists();
  const playlist = all[req.user.id]?.[req.params.playlistId];
  if (!playlist) return res.status(404).json({ error: "Playlist not found." });
  playlist.tracks = playlist.tracks.filter(track => track.id !== String(req.params.trackId));
  playlist.updatedAt = Date.now();
  await writeJson(PLAYLIST_FILE, all);
  res.json({ playlist: cleanPlaylist(playlist) });
});
router.delete("/spotify/playlists/:playlistId", requireUser, async (req, res) => {
  const all = await getPlaylists();
  if (!all[req.user.id]?.[req.params.playlistId]) return res.status(404).json({ error: "Playlist not found." });
  delete all[req.user.id][req.params.playlistId];
  await writeJson(PLAYLIST_FILE, all);
  res.json({ ok: true });
});

export default router;
