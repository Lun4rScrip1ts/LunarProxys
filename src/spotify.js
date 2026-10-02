import express from "express";

const router = express.Router();
const tokenCache = { accessToken: "", expiresAt: 0 };

const getCredentials = () => ({
  clientId: process.env.SPOTIFY_CLIENT_ID || "",
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
});

async function getAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  if (!clientId || !clientSecret) {
    const error = new Error("Spotify API credentials are not configured.");
    error.code = "SPOTIFY_NOT_CONFIGURED";
    throw error;
  }

  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    const error = new Error(data.error_description || "Spotify authorization failed.");
    error.status = response.status;
    throw error;
  }

  tokenCache.accessToken = data.access_token;
  tokenCache.expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
  return tokenCache.accessToken;
}

router.get("/spotify/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 120);
  const requestedTypes = String(req.query.type || "track,album,artist,playlist")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const allowedTypes = new Set(["track", "album", "artist", "playlist"]);
  const types = requestedTypes.filter(type => allowedTypes.has(type));
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 8, 1), 10);

  if (!q) return res.status(400).json({ error: "Enter a song, artist, album, or playlist to search." });
  if (!types.length) return res.status(400).json({ error: "No valid Spotify result types were requested." });

  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      q,
      type: types.join(","),
      limit: String(limit),
      market: "US",
    });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      tokenCache.accessToken = "";
      tokenCache.expiresAt = 0;
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Spotify search failed." });
    }

    res.setHeader("Cache-Control", "private, max-age=30");
    return res.json({
      tracks: data.tracks?.items || [],
      albums: data.albums?.items || [],
      artists: data.artists?.items || [],
      playlists: data.playlists?.items || [],
    });
  } catch (error) {
    if (error.code === "SPOTIFY_NOT_CONFIGURED") {
      return res.status(503).json({
        error: "Spotify search is not configured yet. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to the server environment.",
      });
    }
    console.error("Spotify search error:", error);
    return res.status(502).json({ error: "Spotify is temporarily unavailable. Try again in a moment." });
  }
});

export default router;
