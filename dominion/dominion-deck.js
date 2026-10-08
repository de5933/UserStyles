#!/usr/bin/env node
// Reconstructs each player's deck (every card they own) from a Dominion game log.
// Works with logs copied from dominion.games (text split across many lines),
// the log pane's raw HTML, or one-entry-per-line logs.
//
// Usage: node dominion-deck.js log.txt     (or pipe the log on stdin)
// Browser: paste this file into the console, then call parseDominionLog(text).

const VERBS = /^ ?(starts with|buys and gains|gains|trashes|returns|passes|takes|plays|draws|shuffles|reveals|discards|topdecks|sets aside|puts|receives|exiles|buys)\b/;

// Raw HTML from the log pane: one entry per <div class="log-line">, tags stripped.
function htmlToEntries(html) {
  return html
    .split(/<div[^>]*class="log-line(?:\s[^"]*)?"[^>]*>/)
    .slice(1)
    .map(chunk => chunk
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);
}

// Turn the raw text into one string per log entry.
function toEntries(text) {
  if (/class="log-line[\s"]/.test(text)) return htmlToEntries(text);
  const lines = text.split(/\r?\n/);
  const split = lines.some(l => /^ /.test(l) && VERBS.test(l));
  if (!split) return lines.map(l => l.trim()).filter(Boolean);

  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] || '';
    const startsEntry = (/^\S+$/.test(line) && /^ /.test(next) && VERBS.test(next)) || /^Turn \d+/.test(line);
    if (startsEntry || !entries.length) entries.push(line);
    else entries[entries.length - 1] += line;
  }
  return entries.map(e => e.trim()).filter(Boolean);
}

// "3 Coppers, an Estate, and a Lucky Coin" -> [{count, name}]
function parseCards(list, known) {
  return list
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const m = s.match(/^(an?|\d+)\s+(.+)$/i);
      if (!m) return { count: 1, name: s };
      const count = /^an?$/i.test(m[1]) ? 1 : parseInt(m[1], 10);
      return { count, name: count === 1 ? m[2] : singular(m[2], known) };
    })
    .filter(c => !/^cards?$/i.test(c.name)); // hidden draws like "5 cards"
}

function singular(name, known) {
  const candidates = [name.replace(/ies$/, 'y'), name.replace(/es$/, ''), name.replace(/s$/, '')];
  return candidates.find(c => known.has(c)) || name.replace(/s$/, '');
}

function parseDominionLog(text) {
  const decks = {};   // player -> { card: count }
  const vp = {};      // player -> VP tokens
  const names = {};   // full player names (from "Turn N - name")
  const known = new Set();

  const add = (p, cards, sign) => {
    const deck = (decks[p] = decks[p] || {});
    for (const { count, name } of cards) {
      known.add(name);
      deck[name] = (deck[name] || 0) + sign * count;
      if (deck[name] <= 0) delete deck[name];
    }
  };

  for (const entry of toEntries(text)) {
    const turn = entry.match(/^Turn \d+ - (.+)$/);
    if (turn) { names[turn[1]] = true; continue; }

    const m = entry.match(/^(\S+) (.*?)\.?$/);
    if (!m) continue;
    const [, player, rest] = m;
    let r;

    if ((r = rest.match(/^starts with (.+)$/))) add(player, parseCards(r[1], known), +1);
    else if ((r = rest.match(/^(?:buys and )?gains (.+?)(?: (?:onto|into|on|to|in) (?:their|your|the) .*)?$/))) add(player, parseCards(r[1], known), +1);
    else if ((r = rest.match(/^trashes (.+?)(?: from .*)?$/))) add(player, parseCards(r[1], known), -1);
    else if ((r = rest.match(/^returns (.+?) to (?:the|its|their) (?:.* )?(?:pile|Supply)$/i))) add(player, parseCards(r[1], known), -1);
    else if ((r = rest.match(/^passes (.+) to (\S+)$/))) {
      const cards = parseCards(r[1], known);
      add(player, cards, -1);
      add(r[2], cards, +1);
    } else if ((r = rest.match(/^takes (\d+) VP/))) vp[player] = (vp[player] || 0) + parseInt(r[1], 10);
    else decks[player] = decks[player] || {};
  }

  // Keep only real players (those who started with cards), keyed by full name when known.
  const result = {};
  for (const [p, deck] of Object.entries(decks)) {
    if (!Object.keys(deck).length && !vp[p]) continue;
    const full = Object.keys(names).find(n => n.startsWith(p)) || p;
    result[full === p ? p : `${full} (${p})`] = { cards: deck, total: Object.values(deck).reduce((a, b) => a + b, 0), vpTokens: vp[p] || 0 };
  }
  return result;
}

function format(result) {
  return Object.entries(result).map(([p, { cards, total, vpTokens }]) => {
    const lines = Object.entries(cards).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `  ${String(n).padStart(2)} ${c}`);
    return `${p} — ${total} cards${vpTokens ? `, ${vpTokens} VP tokens` : ''}\n${lines.join('\n')}`;
  }).join('\n\n');
}

if (typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const text = fs.readFileSync(process.argv[2] || 0, 'utf8');
  console.log(format(parseDominionLog(text)));
} else if (typeof module !== 'undefined') {
  module.exports = { parseDominionLog, format };
}
