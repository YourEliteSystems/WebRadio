function parseTitle(title) {
  if (!title || typeof title !== "string") {
    return {
      artist: "Unbekannt",
      song: "Unbekannt"
    };
  }

  let clean = title.trim();

  clean = clean.replace(/\s+/g, " ");
  clean = clean.replace(/–|—/g, "-");

  let artist = "Unbekannt";
  let song = clean;

  if (clean.includes(" - ")) {
    const parts = clean.split(" - ");
    artist = parts.shift().trim();
    song = parts.join(" - ").trim();
  } else if (clean.includes(": ")) {
    const parts = clean.split(": ");
    artist = parts.shift().trim();
    song = parts.join(": ").trim();
  }

  if (!artist || artist.length < 2) artist = "Unbekannt";
  if (!song || song.length < 2) song = "Unbekannt";

  return {
    artist,
    song
  };
}

module.exports = {
  parseTitle
};