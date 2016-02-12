import express from 'express';
import cheerio from 'cheerio';
import request from 'request';
import Promise from 'bluebird';
import NodeCache from 'node-cache';

// Constants
const PORT = 3008;
const POWERBALL_URL = 'http://www.powerball.com/pb_home.asp';
const POWERBALL_WINNUMS_URL = 'http://www.powerball.com/powerball/winnums-text.txt';
const MILLION_STR = 'million';
const MILLION = 1000000;
const CENTS_IN_DOLLAR = 100;
const CACHE_UPDATE_PERIOD = 1000 * 60;
const JACKPOT_KEY = 'jackpot';
const WINNUMS_KEY = 'winnums';

// Init objects
const app = express();
const jackPotCache = new NodeCache();

// Get page content and returns promise
function getPageContent(url) {
  return new Promise((resolve, reject) => {
    request(url, (err, res, body) => {
      if (!err) {
        resolve(body);
      } else {
        reject(err);
      }
    });
  });
}

// Parse homepage of the site
function parseJackpot(source) {
  const $ = cheerio.load(source, {
    decodeEntities: false,
    normalizeWhitespace: false,
    xmlMode: false,
  });

  let jackpot;

  try {
    // try to get specific text from DOM
    jackpot = $('div[class=content] > table').children().eq(1).children().last().children().text();
    jackpot = jackpot.toLowerCase();

    // potentially text might be updated and author will remove 'Million'
    const isMillion = jackpot.indexOf(MILLION_STR) > -1;

    // get only digits
    let numb = jackpot.match(/\d/g);
    numb = numb.join('');

    jackpot = Number(numb) * CENTS_IN_DOLLAR;

    if (isMillion) {
      jackpot = jackpot * MILLION;
    }
  } catch (err) {
    throw new Error('Parsing failed. Cause:', err.message);
  }

  return jackpot;
}

// Gets jackpot
async function getJackpot() {
  let result = {};

  const pageContent = await getPageContent(POWERBALL_URL);
  result.powerBallJackpot = parseJackpot(pageContent);
  result.lastUpdate = new Date();

  return result;
}

// Get first row from winners list
async function getWinnerNums() {
  let result = {};

  const pageContent = await getPageContent(POWERBALL_WINNUMS_URL);
  const lines = pageContent.split('\n');
  if (lines.length > 1) {
    result.winnersNums = lines[1].trim().split('  ');
    result.lastUpdate = new Date();
  }

  return result;
}

// Gets jackpot from cache or updates it
async function tryToFetchJackpot() {
  return await tryToFetchCachedData(JACKPOT_KEY, getJackpot);
}

// Gets jackpot from cache or updates it
async function tryToFetchWinnerSum() {
  return await tryToFetchCachedData(WINNUMS_KEY, getWinnerNums);
}

// Fetch and cache data
async function tryToFetchCachedData(key, getter) {
  let val = jackPotCache.get(key);

  if (!val || (new Date() - val.lastUpdate > CACHE_UPDATE_PERIOD)) {
    val = await getter();
    jackPotCache.set(key, val);
  }

  return val;
}

app.get('/powerboll-jackpot', (req, res) => {
  tryToFetchJackpot().then((data) => {
    res.json(data);
  }, (err) => {
    res.status(500).json(err);
  });
});

app.get('/powerboll-winner-nums', (req, res) => {
  tryToFetchWinnerSum().then((data) => {
    res.json(data.winnersNums);
  }, (err) => {
    res.status(500).json(err);
  });
});

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).json({error: 'not found'});
});

// Start app
app.listen(PORT, () => {
  console.log('Powerball Scrapper App listening on port', PORT);
});
