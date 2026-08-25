// Space AI chat handler, ported from the SpaceEdu Next.js app
// (app/api/space-chat/route.ts) so the static export's /api/space-chat
// calls work on this server and on Vercel.

const SPACE_KEYWORDS = [
  'space', 'universe', 'planet', 'star', 'galaxy', 'moon', 'sun', 'nasa', 'astronomy',
  'black hole', 'comet', 'asteroid', 'orbit', 'gravity', 'telescope', 'rocket', 'cosmos',
  'astronaut', 'mission', 'eclipse', 'nebula', 'supernova', 'mercury', 'venus', 'earth',
  'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ceres', 'eris', 'voyager',
  'apollo', 'artemis', 'perseverance', 'hubble', 'webb', 'jwst', 'sky', 'meteor', 'alien', 'ufo',
];

const OPENERS = [
  "That's a fascinating topic! Here is what I found:",
  'Great question! Based on my astronomical databases:',
  'Let me share what I know about that.',
  'Here is the information I retrieved from the space archives:',
];

async function fetchSpaceData(query) {
  const queryLower = query.toLowerCase();
  const isSpaceRelated = SPACE_KEYWORDS.some((keyword) => queryLower.includes(keyword));

  if (!isSpaceRelated && query.trim().length > 0) {
    return "I'm a specialized Space AI, so I can only answer questions about the universe, planets, and astronomy! Could you ask me something about the cosmos instead?";
  }

  const randomOpener = OPENERS[Math.floor(Math.random() * OPENERS.length)];

  // Strip conversational filler so Wikipedia search gets the actual topic
  // ("Tell me about Saturn's rings" -> "Saturn's rings").
  const cleaned = query
    .replace(/\b(tell me about|what is|what are|who is|who was|explain|describe|how do|how does|how are|can you|please|i want to know about)\b/gi, ' ')
    .replace(/[?!.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || query;

  try {
    // Attempt Wikipedia query
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&generator=search&gsrsearch=${encodeURIComponent(cleaned)}&gsrlimit=1`;
    const wikiRes = await fetch(wikiUrl);
    const wikiData = await wikiRes.json();

    if (wikiData.query && wikiData.query.pages) {
      const pages = wikiData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract;

      if (extract && extract.trim().length > 10) {
        return `${randomOpener}\n\n${extract}\n\nIs there anything else about space you'd like to explore?`;
      }
    }

    // Fallback to NASA image API
    const nasaUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(cleaned)}&media_type=image`;
    const nasaRes = await fetch(nasaUrl);
    const nasaData = await nasaRes.json();

    if (nasaData.collection && nasaData.collection.items && nasaData.collection.items.length > 0) {
      const item = nasaData.collection.items[0];
      if (item.data && item.data.length > 0) {
        return `According to NASA's mission logs:\n\n${item.data[0].description || item.data[0].title}\n\nWould you like to know about any other space missions?`;
      }
    }

    return "I searched through my astronomical databases, but I couldn't find specific details on that exact topic. It sounds like a great area of space research though! What else can I help you discover?";
  } catch (error) {
    console.log('[v0] space-chat fetch error:', error && error.message);
    return "My communication arrays are currently experiencing interference. I'm having trouble connecting to the data networks right now. Please try asking me again in a moment!";
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const prompt = req.body && req.body.prompt;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  const text = await fetchSpaceData(prompt.slice(0, 500));
  return res.status(200).json({ text });
};
