
/**
 * CustomerMergingAI_enhanced.js
 *
 * Enhanced Customer Merging AI module
 * - Adds blocking/indexing to avoid O(N^2) comparisons
 * - Uses Double Metaphone phonetic matching (via `double-metaphone` npm package)
 * - Unicode normalization & diacritics removal
 * - Batch DB write placeholders (replace with your DB client)
 * - Configurable weights and thresholds via the `config` parameter
 *
 * Usage:
 * 1) npm install double-metaphone
 * 2) const CustomerMergingAI = require('./CustomerMergingAI_enhanced');
 * 3) const ai = new CustomerMergingAI(config);
 * 4) const candidates = await ai.findPotentialDuplicates(customersArray);
 *
 * NOTE: Replace DB placeholders (bulkInsertSuggestions, applyMergeTransaction) with your real DB client code.
 */

const crypto = require('crypto');
const doubleMetaphone = require('double-metaphone'); // npm install double-metaphone
const assert = require('assert');

/**
 * Default configuration (tweak weights/thresholds to suit your data)
 */
const DEFAULT_CONFIG = {
  nTokensBlocking: 2,
  localThreshold: 0.72,
  minConfidenceThreshold: 0.65,
  weights: {
    exactMatch: 1.0,
    tokenJaccard: 0.35,
    levenshtein: 0.30,
    phonetic: 0.6,
    prefixMatch: 0.2,
    suffixMatch: 0.15,
  },
  batchWriteSize: 500,
  cacheEnabled: true,
  cacheTTLms: 1000 * 60 * 30 // 30 minutes
};

class CustomerMergingAI {
  constructor(config = {}) {
    this.config = Object.assign({}, DEFAULT_CONFIG, config);
    this.cache = new Map(); // simple in-memory cache
    this._initCacheCleanup();
  }

  // ---- Cache helpers ----
  _initCacheCleanup() {
    if (!this.config.cacheEnabled) return;
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (v.ts + this.config.cacheTTLms < now) this.cache.delete(k);
      }
    }, Math.min(60000, this.config.cacheTTLms));
  }

  _cacheGet(key) {
    if (!this.config.cacheEnabled) return null;
    const v = this.cache.get(key);
    if (!v) return null;
    if (v.ts + this.config.cacheTTLms < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return v.val;
  }

  _cacheSet(key, val) {
    if (!this.config.cacheEnabled) return;
    this.cache.set(key, { val, ts: Date.now() });
  }

  // ---- Normalization ----
  /**
   * Normalize name: lowercase, trim, collapse whitespace, remove diacritics,
   * expand common abbreviations if needed, remove punctuation (conservative),
   * and strip excessive address noise according to a permissive/strict mode.
   */
  normalizeCustomerName(name, options = { permissive: false }) {
    if (!name && name !== '') return '';
    // 1) unicode normalize and remove diacritics
    let s = String(name).normalize('NFKD').replace(/\p{M}/gu, '');
    // 2) toLower and trim
    s = s.toLowerCase().trim();
    // 3) replace common punctuation with space
    s = s.replace(/[.,\/#!$%\^&\*;:{}=\_`~()@\+\[\]\?<>|]/g, ' ');
    // 4) collapse multiple spaces
    s = s.replace(/\s{2,}/g, ' ');
    // 5) remove common noisy tokens conservatively (numbers like PO Box etc)
    if (!options.permissive) {
      s = s.replace(/\b(p\.?o\.?\s?box|po box|box no|unit|fl|floor|bldg|building)\b/g, ' ');
    }
    // 6) remove standalone numeric tokens longer than 6 (likely phone/ids) but keep short numbers (like '3m')
    s = s.split(' ').filter(tok => {
      if (/^\d+$/.test(tok) && tok.length > 6) return false;
      return true;
    }).join(' ').trim();
    // 7) final collapse
    s = s.replace(/\s{2,}/g, ' ');
    return s;
  }

  // ---- Blocking / Indexing ----

  /**
   * buildBlockingIndex(customers, nTokens)
   * Returns: { index: Map<blockKey, string[]>, customerToBlocks: Map<customerName, string[]> }
   */
  buildBlockingIndex(customers, nTokens = null) {
    nTokens = nTokens || this.config.nTokensBlocking;
    const index = new Map();
    const customerToBlocks = new Map();

    for (const raw of customers) {
      const normalized = this.normalizeCustomerName(raw);
      const tokens = normalized.split(' ').filter(t => t.length > 0);

      const blocks = new Set();

      if (tokens.length > 0) {
        const prefix = tokens.slice(0, Math.min(nTokens, tokens.length)).join(' ');
        blocks.add(`PFX:${prefix}`);

        // hash to split large buckets
        const short = tokens[0].slice(0, 6);
        const h = crypto.createHash('sha1').update(tokens[0]).digest('hex').slice(0, 6);
        blocks.add(`HASH:${short}:${h}`);

        // token blocks for each significant token (first 3)
        for (let i = 0; i < Math.min(3, tokens.length); i++) {
          blocks.add(`TOK:${tokens[i]}`);
        }

        // phonetic block using double-metaphone for first token
        try {
          const [p, alt] = doubleMetaphone(tokens[0]);
          if (p) blocks.add(`PHON:${p}`);
          if (alt) blocks.add(`PHON:${alt}`);
        } catch (err) {
          // ignore phonetic failures
        }
      } else {
        blocks.add('EMPTY');
      }

      customerToBlocks.set(raw, Array.from(blocks));
      for (const b of blocks) {
        if (!index.has(b)) index.set(b, []);
        index.get(b).push(raw);
      }
    }

    return { index, customerToBlocks };
  }

  // ---- Similarity metrics ----

  /**
   * tokenJaccard: Jaccard similarity between token sets
   */
  tokenJaccard(a, b) {
    const aa = new Set(this.normalizeCustomerName(a).split(' ').filter(Boolean));
    const bb = new Set(this.normalizeCustomerName(b).split(' ').filter(Boolean));
    if (aa.size === 0 && bb.size === 0) return 1.0;
    const inter = [...aa].filter(x => bb.has(x)).length;
    const union = new Set([...aa, ...bb]).size;
    return union === 0 ? 0.0 : inter / union;
  }

  /**
   * prefixSimilarity: 1 if first token equal, partial otherwise
   */
  prefixSimilarity(a, b) {
    const t1 = this.normalizeCustomerName(a).split(' ').filter(Boolean)[0] || '';
    const t2 = this.normalizeCustomerName(b).split(' ').filter(Boolean)[0] || '';
    if (!t1 || !t2) return 0.0;
    if (t1 === t2) return 1.0;
    // partial prefix match
    if (t1.startsWith(t2) || t2.startsWith(t1)) return 0.6;
    return 0.0;
  }

  /**
   * suffixSimilarity: checks last meaningful token
   */
  suffixSimilarity(a, b) {
    const toksA = this.normalizeCustomerName(a).split(' ').filter(Boolean);
    const toksB = this.normalizeCustomerName(b).split(' ').filter(Boolean);
    const s1 = toksA[toksA.length - 1] || '';
    const s2 = toksB[toksB.length - 1] || '';
    if (!s1 || !s2) return 0.0;
    if (s1 === s2) return 1.0;
    // common suffixes e.g., llc, ltd, inc are not strong signals; handle conservatively
    return 0.0;
  }

  /**
   * levenshteinDistance (iterative DP) and normalized similarity
   */
  levenshteinDistance(a, b) {
    const s = this.normalizeCustomerName(a);
    const t = this.normalizeCustomerName(b);
    const n = s.length;
    const m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;
    let v0 = new Array(m + 1).fill(0);
    let v1 = new Array(m + 1).fill(0);
    for (let j = 0; j <= m; j++) v0[j] = j;
    for (let i = 0; i < n; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < m; j++) {
        const cost = s[i] === t[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      const tmp = v0;
      v0 = v1;
      v1 = tmp;
    }
    return v0[m];
  }

  levenshteinSimilarity(a, b) {
    const s = this.normalizeCustomerName(a);
    const t = this.normalizeCustomerName(b);
    if (!s && !t) return 1.0;
    const dist = this.levenshteinDistance(s, t);
    const maxLen = Math.max(s.length, t.length);
    if (maxLen === 0) return 1.0;
    return 1.0 - (dist / maxLen);
  }

  /**
   * phoneticSimilarityDoubleMetaphone
   * returns a value in [0,1]
   */
  phoneticSimilarityDoubleMetaphone(a, b) {
    try {
      const n1 = this.normalizeCustomerName(a);
      const n2 = this.normalizeCustomerName(b);
      if (!n1 || !n2) return 0.0;
      const w1 = n1.split(' ').filter(w => w.length > 0);
      const w2 = n2.split(' ').filter(w => w.length > 0);
      const codes1 = new Set();
      const codes2 = new Set();
      for (const w of w1) {
        const [p, alt] = doubleMetaphone(w);
        if (p) codes1.add(p);
        if (alt) codes1.add(alt);
      }
      for (const w of w2) {
        const [p, alt] = doubleMetaphone(w);
        if (p) codes2.add(p);
        if (alt) codes2.add(alt);
      }
      const inter = [...codes1].filter(x => codes2.has(x)).length;
      const union = new Set([...codes1, ...codes2]).size;
      if (union === 0) return 0.0;
      return inter / union;
    } catch (err) {
      return 0.0;
    }
  }

  /**
   * exactMatch: binary exact equality on normalized names
   */
  exactMatch(a, b) {
    return this.normalizeCustomerName(a) === this.normalizeCustomerName(b) ? 1.0 : 0.0;
  }

  // ---- Combined similarity function ----

  calculateSimilarity(a, b) {
    // Use cache key
    const cacheKey = `sim:${a}||${b}`;
    const cached = this._cacheGet(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const w = this.config.weights;
    const scores = {};

    scores.exactMatch = this.exactMatch(a, b);
    scores.tokenJaccard = this.tokenJaccard(a, b);
    scores.levenshtein = this.levenshteinSimilarity(a, b);
    scores.phonetic = this.phoneticSimilarityDoubleMetaphone(a, b);
    scores.prefix = this.prefixSimilarity(a, b);
    scores.suffix = this.suffixSimilarity(a, b);

    // Weighted sum
    const totalWeight = Object.values(w).reduce((s, v) => s + v, 0);
    let weighted = 0;
    weighted += (w.exactMatch || 0) * scores.exactMatch;
    weighted += (w.tokenJaccard || 0) * scores.tokenJaccard;
    weighted += (w.levenshtein || 0) * scores.levenshtein;
    weighted += (w.phonetic || 0) * scores.phonetic;
    weighted += (w.prefix || 0) * scores.prefix;
    weighted += (w.suffix || 0) * scores.suffix;

    const normalizedScore = totalWeight > 0 ? weighted / totalWeight : weighted;
    const out = { score: normalizedScore, breakdown: scores };
    this._cacheSet(cacheKey, out);
    return out;
  }

  // ---- Grouping using blocking ----

  /**
   * useBlockingToFindCandidates(customers, options)
   * Returns array of candidate groups with metadata
   */
  async useBlockingToFindCandidates(customers, options = {}) {
    const localThreshold = options.localThreshold || this.config.localThreshold;
    const { index, customerToBlocks } = this.buildBlockingIndex(customers, options.nTokens || this.config.nTokensBlocking);

    const processed = new Set();
    const candidates = [];

    for (const customer of customers) {
      if (processed.has(customer)) continue;

      const blocks = customerToBlocks.get(customer) || [];
      const bucketSet = new Set();
      for (const b of blocks) {
        const members = index.get(b) || [];
        for (const m of members) bucketSet.add(m);
      }

      const bucket = Array.from(bucketSet).filter(x => x !== customer);
      const group = [customer];
      processed.add(customer);

      for (const other of bucket) {
        if (processed.has(other)) continue;
        const sim = this.calculateSimilarity(customer, other);
        if (sim.score >= localThreshold) {
          group.push(other);
          processed.add(other);
        }
      }

      if (group.length >= 2) {
        const groupConfidence = this.calculateGroupConfidence(group);
        candidates.push({
          customers: group,
          mergedName: this.suggestMergedName(group),
          confidence: groupConfidence,
          matchDetails: group.map((c, i) => ({ name: c })) // minimal; can be expanded
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * calculateGroupConfidence: simple average of pairwise top scores
   */
  calculateGroupConfidence(group) {
    const pairs = [];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push(this.calculateSimilarity(group[i], group[j]).score);
      }
    }
    if (pairs.length === 0) return 0;
    const avg = pairs.reduce((s, v) => s + v, 0) / pairs.length;
    return avg;
  }

  /**
   * suggestMergedName: heuristic suggestion: choose the longest common tokens or most frequent token set
   */
  suggestMergedName(group) {
    // naive: pick the longest normalized name (often most complete)
    const normalized = group.map(g => this.normalizeCustomerName(g));
    normalized.sort((a, b) => b.length - a.length);
    return normalized[0];
  }

  // ---- Public API ----

  /**
   * findPotentialDuplicates(customers, options)
   * - customers: array of raw customer name strings
   * returns array of candidate clusters
   */
  async findPotentialDuplicates(customers, options = {}) {
    assert(Array.isArray(customers), 'customers must be an array of strings');
    // Simple quick path: if small dataset, optionally do full pairwise scan
    if (customers.length < 2000 && options.forcePairwise) {
      return this._pairwiseFind(customers, options);
    }
    return this.useBlockingToFindCandidates(customers, options);
  }

  /**
   * _pairwiseFind: fallback full-pairwise comparison (useful for small datasets/testing)
   */
  _pairwiseFind(customers, options = {}) {
    const minConfidence = options.minConfidence || this.config.minConfidenceThreshold;
    const visited = new Set();
    const groups = [];

    for (let i = 0; i < customers.length; i++) {
      const a = customers[i];
      if (visited.has(a)) continue;
      const group = [a];
      visited.add(a);
      for (let j = i + 1; j < customers.length; j++) {
        const b = customers[j];
        if (visited.has(b)) continue;
        const sim = this.calculateSimilarity(a, b);
        if (sim.score >= minConfidence) {
          group.push(b);
          visited.add(b);
        }
      }
      if (group.length > 1) {
        groups.push({
          customers: group,
          mergedName: this.suggestMergedName(group),
          confidence: this.calculateGroupConfidence(group),
          matchDetails: group.map(n => ({ name: n }))
        });
      }
    }
    return groups.sort((x, y) => y.confidence - x.confidence);
  }

  // ---- DB placeholders: replace with your DB client implementation ----

  /**
   * bulkInsertSuggestions(suggestions)
   * suggestions: array of { customers, mergedName, confidence, matchDetails }
   *
   * Implement this to use your preferred DB (batch insert/upsert).
   */
  async bulkInsertSuggestions(suggestions) {
    // Placeholder: implement using your DB client. Example (pseudo):
    // await db.transaction(async tx => {
    //   await tx.query('INSERT INTO merge_suggestions (...) VALUES ...', [...]);
    // });
    console.log(`bulkInsertSuggestions called with ${suggestions.length} suggestions`);
    // Simulate async op
    return Promise.resolve(true);
  }

  /**
   * applyMergeTransaction(mergeInstruction)
   * - mergeInstruction: { targetName, sourceNames, user, comments }
   * Implement transactional merge with audit trail and rollback.
   */
  async applyMergeTransaction(mergeInstruction) {
    // Placeholder: implement DB transaction that:
    // 1) Creates audit record with before/after
    // 2) Moves references (FK updates) from sourceNames to targetName (or canonical id)
    // 3) Deletes or marks merged records
    // 4) Commits or rolls back on error
    console.log('applyMergeTransaction called', mergeInstruction);
    return Promise.resolve({ ok: true });
  }

  // ---- Small utilities ----

  /**
   * calculateMatchDetails: returns detailed breakdown for a pair or group
   */
  calculateMatchDetails(a, b) {
    const sim = this.calculateSimilarity(a, b);
    return {
      pair: [a, b],
      score: sim.score,
      breakdown: sim.breakdown
    };
  }
}

module.exports = CustomerMergingAI;

// If executed directly, run a small demo when node CustomerMergingAI_enhanced.js
if (require.main === module) {
  (async () => {
    const demo = new CustomerMergingAI();
    const sample = [
      'Acme Trading LLC',
      'Acme Trading Limited',
      'Acme Intl Trading',
      'Acme Trading Co.',
      'ACME TRADING',
      'Global Widgets LLC',
      'Global Widgets Ltd',
      'Globall Widgets'
    ];
    const res = await demo.findPotentialDuplicates(sample);
    console.log('Candidates:', JSON.stringify(res, null, 2));
  })();
}
