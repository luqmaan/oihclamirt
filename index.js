const fs = require("fs");
const minimist = require("minimist");

const { meow } = require("./scraper");

const argv = minimist(process.argv.slice(2));

if (argv.h) {
  console.log(
    `
  Usage
  $ node index

  Options
  --oembed      the oembed feed link
  --atomfeed    the atom feed link
  --slack       slack webhook url
  --searches    path to .json file containing search preferences
                (default searches.json)

  Example
  $ node index.js \\
      --oembed=https://shopnicekicks.com/collections/all.oembed \\
      --searches=searches.json \\
      --slack=https://hooks.slack.com/services/BLAH \\
  `
  );
  process.exit();
}

const atomFeedLink = argv.atomfeed;
const oEmbedFeedLink = argv.oembed;
const slackToken = argv.slack;

if (!atomFeedLink && !oEmbedFeedLink) {
  console.error("Missing --atomfeed=<uri> or --oembed option");
  process.exit(1);
}

if (!slackToken) {
  console.error("Missing --slack=<uri>");
  process.exit(1);
}
1;
let searches = argv.searches;
if (!searches) {
  searches = "searches.json";
}

searches = fs.readFileSync(searches, "utf8");
try {
  searches = JSON.parse(searches);
} catch (e) {
  console.error("Could not read searches file!", e);
  process.exit(1);
}

meow(searches, oEmbedFeedLink, atomFeedLink, slackToken);
