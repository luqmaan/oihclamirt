// Parallel example for @sixsneakers
//
// How do you keep scraping a bunch of sites non-stop all at once?
// Here's one way to do it.

const { meow } = require('./scraper');

const searches = [
  {
    keywords: ['melange'],
    exclude: ['HOODIE'],
    sizes: ['*'],
  },
];

const slackToken = 'https://hooks.slack.com/services/BLAH';

const sites = [
  { oembed: 'https://yeezysupply.com/collections/all.oembed' },
  { atom: 'https://shopnicekicks.com/collections/all.atom' },
];

function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  })
}

async function scrapeSiteInfinitely(site) {
  console.log('Starting scraping site:', site);

  await meow(searches, site.oembed, site.atom, slackToken);

  console.log('Done scraping site:', site);

  const randomDelaySeconds = Math.max(3000, Math.random() * 15000);
  console.log(`Delaying for ${randomDelaySeconds / 1000} seconds`);
  await delay(randomDelaySeconds);

  // Use recursion to repeat this function forever
  scrapeSiteInfinitely(site);
}

sites.map(site => scrapeSiteInfinitely(site));
