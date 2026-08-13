// Latest Space Developments feed for students and researchers.
// Pulls from the NASA Breaking News RSS feed via the public rss2json
// proxy so we can display real ongoing mission updates without an API key.

const FEED_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.nasa.gov/news-release/feed/';
let cachedItems = [];
let fetchFailed = false;

export async function loadLatestNews() {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (data?.status === 'ok' && Array.isArray(data.items)) {
      cachedItems = data.items.slice(0, 12);
      return cachedItems;
    }
    throw new Error('feed malformed');
  } catch (_err) {
    fetchFailed = true;
    return [];
  }
}

export function renderNewsFeed(limit = 4) {
  const container = document.getElementById('latest-developments');
  if (!container) return;

  // Render a static educational fallback linking to reliable sources.
  const renderFallback = () => {
    const links = [
      { label: 'NASA News', url: 'https://www.nasa.gov/news/' },
      { label: 'JPL Missions', url: 'https://www.jpl.nasa.gov/missions' },
      { label: 'ESA Latest', url: 'https://www.esa.int/News' },
      { label: 'SpaceX Updates', url: 'https://www.spacex.com/updates/' },
      { label: 'Hubble News', url: 'https://science.nasa.gov/mission/hubble/' },
      { label: 'Webb News', url: 'https://webb.nasa.gov/' }
    ];
    container.innerHTML =
      '<div class="news-fallback">Live feed unavailable — explore these authoritative sources:</div>' +
      links.map(l => `<a class="news-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label} ↗</a>`).join('');
  };

  if (fetchFailed || !cachedItems.length) {
    renderFallback();
    return;
  }

  container.innerHTML = cachedItems.slice(0, limit).map(item => {
    const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString(undefined, {
      month: 'short', day: '2-digit', year: 'numeric'
    }) : '';
    const stripped = (item.description || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
      .slice(0, 130) + '…';
    return `
      <a class="news-card" href="${item.link}" target="_blank" rel="noopener noreferrer">
        <div class="news-date">${date}</div>
        <div class="news-title">${item.title}</div>
        <div class="news-snippet">${stripped}</div>
      </a>`;
  }).join('');
}
