const axios = require("axios");
const querystring = require("querystring");
const { some, every, get, head, shuffle } = require("lodash");
const xml2js = require("xml2js");
const url = require("url");
const fs = require("fs");

const xmlParser = new xml2js.Parser();

const parseXml = string =>
  new Promise((resolve, reject) => {
    xmlParser.parseString(string, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });

async function scrapeAtomFeed(url) {
  const res = await axios.get(url);
  return await parseXml(res.data);
}

async function loadOEmbedFeed(oEmbedFeedLink) {
  const res = await axios.get(oEmbedFeedLink);
  const products = parseOEmbedFeed(res.data, oEmbedFeedLink);
  return products;
}

async function loadAtomFeed(atomFeedLink) {
  const data = await scrapeAtomFeed(atomFeedLink);
  const products = parseAtomFeed(data);
  return products;
}

function productMatchesSearch(search, product) {
  const keywordsMatch = every(
    search.keywords.map(
      keyword =>
        product.title.toLowerCase().indexOf(keyword.toLowerCase()) !== -1 ||
        product.summary.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
    ),
    Boolean
  );

  const isExcluded = some(
    search.exclude.map(
      keyword =>
        product.title.toLowerCase().indexOf(keyword.toLowerCase()) !== -1 ||
        product.summary.toLowerCase().indexOf(keyword.toLowerCase()) !== -1
    ),
    Boolean
  );

  return keywordsMatch && !isExcluded;
}

function searchProducts(products, searches) {
  return products.filter(product =>
    searches.find(search => {
      if (productMatchesSearch(search, product)) {
        return Object.assign(product, { search });
      }
    })
  );
}

function parseAtomFeed(feed) {
  return feed.feed.entry.map(entry => ({
    id: head(entry.id),
    title: head(entry.title) || "",
    productLink: head(entry.link).$.href,
    summary: JSON.stringify(entry.summary) || ""
  }));
}

function parseOEmbedFeed(feed, feedLink) {
  return feed.products.map(entry => ({
    id: entry.product_id,
    title: entry.title || "",
    productLink: resolveLink(
      feedLink,
      url.resolve("/products/", entry.product_id)
    ),
    summary: entry.description || "",
    offers: entry.offers
  }));
}

function titleMatchesSize(title, size, search) {
  const isExcluded = !!search.exclude.find(
    exclude => title.toLowerCase().indexOf(exclude.toLowerCase()) !== -1
  );

  if (isExcluded) {
    return false;
  }

  if (size === "*") {
    return true;
  }
  return title.indexOf(`${size}`) !== -1;
}

function resolveLink(feedLink, pathname) {
  return url.format(
    Object.assign(url.parse(feedLink), {
      pathname
    })
  );
}

function getAddToCartLink(offer, feedLink) {
  return resolveLink(feedLink, `/cart/${offer.offer_id}:1/`);
}

async function createCheckout(offer, feedLink) {
  try {
    const cartStartLink = resolveLink(feedLink, `/cart`);

    const res = await axios.post(
      cartStartLink,
      querystring.stringify({
        [`updates[${offer.offer_id}]`]: "1",
        ["address[country]"]: "United States",
        ["address[province]"]: "Alabama",
        ["address[zip]"]: "",
        ["note"]: "",
        ["goto_pp"]: "paypal_express"
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    // We could search the set-cookie header or the html for the checkout link
    // But the URL we end up being redirected to is the checkout link, so just use that since its easy
    const responseUrl = res.request.res.responseUrl;

    if (responseUrl.indexOf("stock_problems") !== -1) {
      return null;
    }

    if (responseUrl.indexOf("paypal")) {
      return responseUrl;
    }

    if (responseUrl.indexOf("/checkouts/") === -1) {
      console.error(
        `Error checking out, invalid checkout url: ${responseUrl}`,
        responseUrl
      );
      return null;
    }

    return responseUrl;
  } catch (err) {
    if (err.response) {
      const responseUrl = err.response.request.res.responseUrl;
      console.log(`CheckoutError: ${err.message} - ${responseUrl}`);
      return responseUrl;
    } else {
      console.error(`CheckoutError: ${err.message}`, err);
    }
    return null;
  }
}

async function getCheckoutLinksForEntry(product, feedLink, offers) {
  const matchingOffers = offers.filter(
    offer =>
      offer.in_stock &&
      some(
        product.search.sizes.map(size =>
          titleMatchesSize(offer.title, size, product.search)
        )
      )
  );

  const offersWithLinks = [];

  await Promise.all(
    matchingOffers.map(async offer => {
      const checkoutLink = await createCheckout(offer, feedLink);
      if (checkoutLink) {
        offersWithLinks.push(Object.assign(offer, { checkoutLink }));
      }
    })
  );

  return offersWithLinks;
}

async function getOffers(product) {
  if (product.offers) {
    return product.offers;
  }
  const res = await axios.get(`${product.productLink}.oembed`);
  const offers = res.data.offers;
  return offers;
}

async function checkoutAndNotify(product, feedLink, slackToken) {
  const offers = await getOffers(product);

  const offersWithLinks = await getCheckoutLinksForEntry(
    product,
    feedLink,
    offers
  );

  if (offersWithLinks.length === 0) {
    return;
  }

  let slackMessage = {
    text: `
  *${product.title}*
  *Feed:* ${feedLink}
  *Link:* ${product.productLink}
  *Keywords:* ${product.search.keywords.join(" ")}
  `.trim()
  };

  console.log(feedLink);
  console.log(product.title);
  console.log(product.productLink);
  console.log(product.search.keywords);

  if (offersWithLinks.length === 0) {
    console.log(
      "No matching sizes in stock, but there may be other sizes. Searched for",
      product.search.sizes
    );
    slackMessage.text = `
  ${slackMessage.text}
  No matching sizes in stock, but there may be other sizes. Searched for ${product.search.sizes.join(
    ", "
  )}
  `.trim();
  }

  offersWithLinks.forEach(offer => {
    const addToCartLink = getAddToCartLink(offer, feedLink);
    console.log(
      `${offer.title} - $${offer.price} - ${offer.checkoutLink} - ${addToCartLink}`
    );
    slackMessage.text = `
  ${slackMessage.text}
  ${offer.title} - $${offer.price} - ${offer.checkoutLink} - ${addToCartLink}
      `.trim();
  });

  slackMessage.text = slackMessage.text
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;");

  await axios.post(slackToken, slackMessage);
}

async function meow(searches, oEmbedFeedLink, atomFeedLink, slackToken) {
  try {
    const feedLink = oEmbedFeedLink || atomFeedLink;
    const allProducts = oEmbedFeedLink
      ? await loadOEmbedFeed(oEmbedFeedLink)
      : await loadAtomFeed(atomFeedLink);

    const matchingProducts = searchProducts(allProducts, searches);

    await Promise.all(
      matchingProducts.map(async product =>
        checkoutAndNotify(product, feedLink, slackToken)
      )
    );
  } catch (err) {
    if (err.response) {
      const responseUrl = err.response.request.res.responseUrl;
      console.error(`RequestError: ${err.message} - ${responseUrl}`);
    } else {
      console.error(`Error: ${err.message}`, err);
    }
  }
}

module.exports = {
  scrapeAtomFeed,
  loadOEmbedFeed,
  loadAtomFeed,
  productMatchesSearch,
  searchProducts,
  parseAtomFeed,
  parseOEmbedFeed,
  titleMatchesSize,
  resolveLink,
  getAddToCartLink,
  createCheckout,
  getCheckoutLinksForEntry,
  getOffers,
  checkoutAndNotify,
  meow
};
