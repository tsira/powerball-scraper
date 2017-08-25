import express from 'express';
import request from 'request';
import Promise from 'bluebird';
import NodeCache from 'node-cache';

// var express = require('express');
// var cheerio = require('cheerio');
// var request = require('request');
// var Promise = require('bluebird');
// var NodeCache = require('node-cache');


// Constants
const PORT = 3008;
const POWERBALL_WINNUMS_URL = 'http://www.powerball.com/powerball/winnums-text.txt';
const CACHE_UPDATE_PERIOD = 1000 * 60;
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
