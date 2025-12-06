/**
 * Customer Merging AI Service (Refactored v2)
 *
 * AI-powered customer duplicate detection and merge suggestion engine.
 *
 * V2 Enhancements:
 * - O(n^2) performance fixed using Phonetic Blocking.
 * - Greedy clustering replaced with Graph-based Connected Components for accuracy.
 * - Added stubs for a feedback loop (rejection handling).
 * - Corrected Jaro-Winkler implementation.
 */

const { pool } = require('../database/config');
const logger = require('../utils/logger');
const stringSimilarity = require('string-similarity');
const natural = require('natural');
const metaphone = natural.Metaphone;

class CustomerMergingAI {
  constructor() {
    this.pool = pool;

    // Configuration
    this.config = {
      minConfidenceThreshold: 0.65,      // 65% minimum to suggest merge
      highConfidenceThreshold: 0.90,     // 90%+ = very confident
      cacheEnabled: true,

      // Algorithm weights (must sum to 1.0)
      weights: {
        levenshtein: 0.10,
        jaroWinkler: 0.10,        // Now uses correct algorithm
        tokenSet: 0.15,
        businessSuffix: 0.08,
        nGramPrefix: 0.23,
        coreBrand: 0.22,
        phonetic: 0.12
      }
    };

    // --- (All helper arrays and maps remain the same) ---
    // Common business suffixes to normalize (legal entities only - not descriptors)
    this.businessSuffixes = [
      'llc', 'l.l.c', 'l.l.c.', 'll.c', 'l l c',
      'ltd', 'limited', 'ltd.',
      'inc', 'incorporated', 'inc.',
      'corp', 'corporation', 'corp.',
      'co', 'company', 'co.',
      'est', 'establishment',
      'fze', 'fzc', 'fzco',
      'plc', 'pllc'
    ];

    // Common descriptive words that appear after brand name
    this.brandStopWords = [
      'center', 'centre', 'manufacturing', 'trading', 'general',
      'store', 'shop', 'outlet', 'mart', 'market', 'supermarket',
      'international', 'enterprises', 'industries', 'services',
      'solutions', 'systems', 'technologies', 'group', 'holdings',
      'distribution', 'distributors', 'wholesale', 'retail',
      'sales', 'products', 'supplies', 'equipment'
    ];

    // Common abbreviations and their expansions
    this.abbreviationMap = {
      // International variants
      'intl': 'international',
      "int'l": 'international',
      'int': 'international',
      // Company variants
      'co': 'company',
      'cos': 'companies',
      // General variants
      'gen': 'general',
      'mfg': 'manufacturing',
      'mfr': 'manufacturer',
      'dist': 'distribution',
      'distr': 'distribution',
      'trdg': 'trading',
      'trd': 'trading',
      // Location abbreviations (UAE specific)
      'dxb': 'dubai',
      'shj': 'sharjah',
      'auh': 'abu dhabi',
      // Other common
      'dept': 'department',
      'mgmt': 'management',
      'svcs': 'services',
      'tech': 'technology',
      'elec': 'electronics',
      'auto': 'automotive'
    };

    // Common location keywords to optionally remove
    this.locationKeywords = [
      'dubai', 'uae', 'sharjah', 'abu dhabi', 'ajman', 'ras al khaimah',
      'fujairah', 'umm al quwain', 'dxb', 'shj', 'auh'
    ];
  }

  /**
   * Main entry point: Scan division and suggest merges
   * --- REFACTOR ---
   * Now fetches rejected pairs to feed into the new clustering logic.
   */
  async scanAndSuggestMerges(division, options = {}) {
    logger.info(`\n🤖 AI Scan: Finding customer duplicates in ${division}...`);

    const startTime = Date.now();

    try {
      // 1. Get all unique customers from database
      const customers = await this.getAllCustomers(division);
      logger.info(`   📊 Found ${customers.length} unique customers`);

      if (customers.length < 2) {
        logger.info('   ℹ️  Not enough customers to find duplicates');
        return [];
      }

      // 2. Get existing rules to avoid duplicates
      const existingRules = await this.getActiveMergeRules(division);
      const existingRuleCustomers = new Set();
      existingRules.forEach(rule => {
        rule.original_customers.forEach(customer => {
          existingRuleCustomers.add(customer.toLowerCase());
        });
      });
      logger.info(`   📋 Found ${existingRules.length} existing rules covering ${existingRuleCustomers.size} customers`);

      // --- NEW (FEEDBACK LOOP) ---
      // 3. Get manually rejected pairs
      const rejectedPairs = await this.getRejectedPairs(division);
      if (rejectedPairs.size > 0) {
        logger.info(`   🚫 Found ${rejectedPairs.size} manually rejected pairs (will be skipped)`);
      }
      // --- END NEW ---

      // 4. Find potential duplicates
      // --- REFACTOR ---
      // Pass existing customers and rejected pairs to the new logic
      const suggestions = await this.findPotentialDuplicates(
        customers,
        existingRuleCustomers,
        rejectedPairs,
        options
      );
      logger.info(`   🔍 Found ${suggestions.length} potential merge groups`);

      // 5. Filter by confidence threshold
      const minThreshold = options.minConfidence || this.config.minConfidenceThreshold;
      let filtered = suggestions.filter(s => s.confidence >= minThreshold);
      logger.info(`   ✅ ${filtered.length} suggestions above ${(minThreshold * 100).toFixed(0)}% confidence`);

      // 6. Filter out suggestions that overlap with existing rules
      // Note: This is now a safety check, as findPotentialDuplicates
      // should already be skipping customers in existingRuleCustomers.
      const beforeFilter = filtered.length;
      filtered = filtered.filter(suggestion => {
        const hasOverlap = suggestion.customers.some(customer =>
          existingRuleCustomers.has(customer.toLowerCase())
        );
        return !hasOverlap;
      });
      const filteredOut = beforeFilter - filtered.length;
      if (filteredOut > 0) {
        logger.info(`   🚫 Filtered out ${filteredOut} suggestions (already have active rules)`);
      }

      // 7. Save to database
      if (filtered.length > 0) {
        await this.saveSuggestions(division, filtered);
        logger.info(`   💾 Saved ${filtered.length} new suggestions to database`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`   ⏱️  Completed in ${elapsed}s\n`);

      return filtered;

    } catch (error) {
      logger.error('❌ AI scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Find potential duplicate customer groups
   * --- REFACTOR (MAJOR) ---
   * Replaced O(n^2) nested loop with a 3-pass system:
   * 1. Blocking: Group customers by a phonetic key.
   * 2. Pairwise Comparison: Run expensive similarity *only* on pairs within a block.
   * 3. Graph Clustering: Build a graph from matching pairs and find groups.
   */
  async findPotentialDuplicates(customers, existingRuleCustomers, rejectedPairs, options = {}) {
    const blocks = new Map();
    const metaphoneInstance = new natural.Metaphone();

    // --- PASS 1: BLOCKING ---
    logger.info('   🏭 Building phonetic blocks...');
    for (const customer of customers) {
      // Skip customers already in an active merge rule
      if (existingRuleCustomers.has(customer.toLowerCase())) {
        continue;
      }

      try {
        // Get a "block key" (e.g., phonetic code of the first significant word)
        const normalized = this.normalizeCustomerName(customer);
        const firstWord = normalized.split(' ').find(w => w.length > 1);
        if (!firstWord) continue;

        const key = metaphoneInstance.process(firstWord);

        if (key) {
          if (!blocks.has(key)) blocks.set(key, []);
          blocks.get(key).push(customer);
        }
      } catch (e) {
        /* ignore phonetic errors */
      }
    }

    const edges = [];
    const customerNodes = new Set(customers);
    let comparisonCount = 0;
    const totalNaiveComparisons = (customers.length * (customers.length - 1)) / 2;

    logger.info(`   Comparing pairs within ${blocks.size} blocks...`);

    // --- PASS 2: PAIRWISE COMPARISON (Within Blocks) ---
    for (const [key, blockCustomers] of blocks.entries()) {
      // No pairs to compare if block is too small
      if (blockCustomers.length < 2) continue;

      for (let i = 0; i < blockCustomers.length; i++) {
        for (let j = i + 1; j < blockCustomers.length; j++) {
          const customer1 = blockCustomers[i];
          const customer2 = blockCustomers[j];

          // --- FEEDBACK LOOP (REJECTIONS) ---
          const pairKey1 = `${customer1}|${customer2}`.toLowerCase();
          const pairKey2 = `${customer2}|${customer1}`.toLowerCase();
          if (rejectedPairs.has(pairKey1) || rejectedPairs.has(pairKey2)) {
            continue; // Skip this manually rejected pair
          }
          // --- END FEEDBACK ---

          comparisonCount++;
          const similarity = this.calculateSimilarity(customer1, customer2);

          // If similar enough, create an "edge" in our graph
          if (similarity.score >= this.config.minConfidenceThreshold) {
            edges.push([customer1, customer2]);
          }
        }
      }
    }

    logger.info(`   Total comparisons made: ${comparisonCount} (vs. ${totalNaiveComparisons} naive)`);

    // --- PASS 3: GRAPH CLUSTERING ---
    logger.info(`   Building clusters from ${edges.length} matching edges...`);
    const groups = this._findConnectedComponents(edges, customerNodes);

    // --- 4. Format Groups ---
    const potentialGroups = [];
    for (const group of groups) {
      // Limit group size
      if (group.length > (options.maxGroupSize || 5)) continue;

      const groupConfidence = this.calculateGroupConfidence(group);

      // Final check on group's average confidence
      if (groupConfidence >= this.config.minConfidenceThreshold) {
        potentialGroups.push({
          customers: group,
          mergedName: this.suggestMergedName(group),
          confidence: groupConfidence,
          matchDetails: this.getMatchDetails(group),
          customerCount: group.length
        });
      }
    }

    // Sort by confidence (highest first)
    return potentialGroups.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * --- NEW HELPER ---
   * Finds connected components in a graph using DFS.
   * This identifies all clusters of related customers.
   * @param {Array<Array<string>>} edges - List of pairs, e.g., [['A', 'B'], ['B', 'C']]
   * @param {Set<string>} allNodes - Set of all customer names
   * @returns {Array<Array<string>>} - List of components, e.g., [['A', 'B', 'C']]
   */
  _findConnectedComponents(edges, allNodes) {
    const adj = new Map();
    const visited = new Set();
    const components = [];

    // Initialize adjacency list for all nodes
    allNodes.forEach(node => adj.set(node, []));

    // Build adjacency list from matching pairs (edges)
    for (const [u, v] of edges) {
      adj.get(u).push(v);
      adj.get(v).push(u);
    }

    // DFS function to explore a component
    function dfs(node, currentComponent) {
      visited.add(node);
      currentComponent.push(node);
      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, currentComponent);
        }
      }
    }

    // Iterate over all nodes to find all components
    for (const node of allNodes) {
      if (!visited.has(node)) {
        const currentComponent = [];
        dfs(node, currentComponent);
        // We only care about groups of 2 or more
        if (currentComponent.length >= 2) {
          components.push(currentComponent);
        }
      }
    }
    return components;
  }


  /**
   * Calculate similarity between two customer names
   * (Algorithm weights and logic remain the same)
   */
  calculateSimilarity(customer1, customer2) {
    const normalized1 = this.normalizeCustomerName(customer1);
    const normalized2 = this.normalizeCustomerName(customer2);

    if (normalized1 === normalized2) {
      return { score: 1.0, details: { exactMatch: true } };
    }

    const levenshtein = stringSimilarity.compareTwoStrings(normalized1, normalized2);
    const jaroWinkler = this.jaroWinklerSimilarity(normalized1, normalized2); // <-- Now fixed
    const tokenSet = this.tokenSetSimilarity(normalized1, normalized2);
    const withoutSuffix = this.compareWithoutBusinessSuffixes(customer1, customer2);
    const nGramPrefix = this.nGramPrefixSimilarity(normalized1, normalized2, 2);
    const coreBrand = this.coreBrandSimilarity(customer1, customer2);
    const phonetic = this.phoneticSimilarity(customer1, customer2);

    let score = (
      levenshtein * this.config.weights.levenshtein +
      jaroWinkler * this.config.weights.jaroWinkler +
      tokenSet * this.config.weights.tokenSet +
      withoutSuffix * this.config.weights.businessSuffix +
      nGramPrefix * this.config.weights.nGramPrefix +
      coreBrand * this.config.weights.coreBrand +
      phonetic * this.config.weights.phonetic
    );

    if (coreBrand >= 0.90) {
      score = Math.min(1.0, score * 1.08);
    }

    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      details: {
        levenshtein: levenshtein.toFixed(3),
        jaroWinkler: jaroWinkler.toFixed(3),
        tokenSet: tokenSet.toFixed(3),
        withoutSuffix: withoutSuffix.toFixed(3),
        nGramPrefix: nGramPrefix.toFixed(3),
        coreBrand: coreBrand.toFixed(3),
        phonetic: phonetic.toFixed(3),
        normalized1,
        normalized2
      }
    };
  }

  // --- (expandAbbreviations remains the same) ---
  expandAbbreviations(name) {
    if (!name) return '';
    let expanded = name.toLowerCase();
    Object.entries(this.abbreviationMap).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      expanded = expanded.replace(regex, full);
    });
    return expanded;
  }

  // --- (removeAddressNoise remains the same) ---
  removeAddressNoise(name, removeLocations = false) {
    if (!name) return '';
    let cleaned = name.toLowerCase();
    cleaned = cleaned.replace(/\b(po|p\.o\.?)\s*box[:\s]*\d+/gi, '');
    cleaned = cleaned.replace(/\bpobox\s*\d+/gi, '');
    cleaned = cleaned.replace(/\b(shop|office|unit|suite|room)\s*(no\.?|number|#)?\s*:?\s*\d+/gi, '');
    cleaned = cleaned.replace(/\bstore\s*(no\.?|number|#)\s*:?\s*\d+/gi, '');
    cleaned = cleaned.replace(/\b(building|floor|level|block)\s*:?\s*\d+/gi, '');
    cleaned = cleaned.replace(/\b\d{3,}\b/g, '');
    cleaned = cleaned.replace(/\b(tel|phone|mob|mobile|fax)[:\s]*[\d\s\-\+\(\)]+/gi, '');
    cleaned = cleaned.replace(/[\+\(]?\d{2,4}[\)\-\s]?\d{3,4}[\-\s]?\d{3,4}/g, '');
    cleaned = cleaned.replace(/\S+@\S+\.\S+/gi, '');
    if (removeLocations) {
      const locRegex = new RegExp(`\\b(${this.locationKeywords.join('|')})\\b`, 'gi');
      cleaned = cleaned.replace(locRegex, '');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  // --- (normalizeCustomerName remains the same) ---
  normalizeCustomerName(name, removeLocations = false) {
    if (!name) return '';
    let cleaned = this.expandAbbreviations(name);
    cleaned = this.removeAddressNoise(cleaned, removeLocations);
    if (!cleaned || cleaned.trim() === '') {
      cleaned = name;
    }
    const result = cleaned
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .replace(new RegExp(`\\b(${this.businessSuffixes.join('|')})\\b`, 'gi'), '')
      .replace(/\s+/g, ' ')
      .trim();
    return result || cleaned.toLowerCase().trim();
  }

  // --- (extractCoreBrand remains the same) ---
  extractCoreBrand(name) {
    if (!name) return '';
    const normalized = this.normalizeCustomerName(name);
    const tokens = normalized.split(' ').filter(t => t.length > 2);
    if (tokens.length === 0) return '';
    const coreTokens = [];
    for (const token of tokens) {
      if (this.brandStopWords.includes(token)) break;
      coreTokens.push(token);
      if (coreTokens.length >= 4) break;
    }
    if (coreTokens.length === 0 && tokens.length > 0) {
      return tokens.slice(0, Math.min(2, tokens.length)).join(' ');
    }
    return coreTokens.join(' ');
  }

  /**
   * Jaro-Winkler similarity
   * --- REFACTOR ---
   * Now uses the correct Jaro-Winkler implementation from 'natural'
   */
  jaroWinklerSimilarity(s1, s2) {
    // This is the actual Jaro-Winkler algorithm.
    // It returns 1.0 for a perfect match.
    return natural.JaroWinklerDistance(s1, s2, { ignoreCase: true });
  }

  // --- (tokenSetSimilarity remains the same) ---
  tokenSetSimilarity(s1, s2) {
    const tokens1 = new Set(s1.split(' ').filter(t => t.length > 0));
    const tokens2 = new Set(s2.split(' ').filter(t => t.length > 0));
    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;
    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);
    return intersection.size / union.size;
  }

  // --- (nGramPrefixSimilarity remains the same) ---
  nGramPrefixSimilarity(s1, s2, n = 2) {
    const tokens1 = s1.split(' ').filter(t => t.length > 2);
    const tokens2 = s2.split(' ').filter(t => t.length > 2);
    const compareN = Math.min(n, tokens1.length, tokens2.length);
    if (compareN === 0) return 0.0;
    const prefix1 = tokens1.slice(0, compareN).join(' ');
    const prefix2 = tokens2.slice(0, compareN).join(' ');
    if (prefix1 === prefix2) return 1.0;
    return stringSimilarity.compareTwoStrings(prefix1, prefix2);
  }

  // --- (coreBrandSimilarity remains the same) ---
  coreBrandSimilarity(name1, name2) {
    const core1 = this.extractCoreBrand(name1);
    const core2 = this.extractCoreBrand(name2);
    if (!core1 && !core2) return 1.0;
    if (!core1 || !core2) return 0.0;
    if (core1 === core2) return 1.0;
    return stringSimilarity.compareTwoStrings(core1, core2);
  }

  // --- (phoneticSimilarity remains the same) ---
  phoneticSimilarity(name1, name2) {
    try {
      const normalized1 = this.normalizeCustomerName(name1);
      const normalized2 = this.normalizeCustomerName(name2);
      if (!normalized1 || !normalized2) return 0.0;
      const words1 = normalized1.split(' ').filter(w => w.length > 2);
      const words2 = normalized2.split(' ').filter(w => w.length > 2);
      if (words1.length === 0 || words2.length === 0) return 0.0;
      const metaphoneInstance = new metaphone();
      const phonetic1 = words1.map(w => {
        try {
          return metaphoneInstance.process(w) || w;
        } catch (e) {
          return w;
        }
      });
      const phonetic2 = words2.map(w => {
        try {
          return metaphoneInstance.process(w) || w;
        } catch (e) {
          return w;
        }
      });
      const set1 = new Set(phonetic1);
      const set2 = new Set(phonetic2);
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      if (union.size === 0) return 0.0;
      return intersection.size / union.size;
    } catch (error) {
      return 0.0;
    }
  }

  // --- (compareWithoutBusinessSuffixes remains the same) ---
  compareWithoutBusinessSuffixes(name1, name2) {
    let clean1 = name1.toLowerCase().trim();
    let clean2 = name2.toLowerCase().trim();
    this.businessSuffixes.forEach(suffix => {
      const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
      clean1 = clean1.replace(regex, '');
      clean2 = clean2.replace(regex, '');
    });
    clean1 = clean1.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    clean2 = clean2.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    if (clean1 === clean2) return 1.0;
    return stringSimilarity.compareTwoStrings(clean1, clean2);
  }

  // --- (suggestMergedName remains the same) ---
  suggestMergedName(customerGroup) {
    if (!customerGroup || customerGroup.length === 0) return '';
    const sorted = [...customerGroup].sort((a, b) => a.length - b.length);
    let suggested = sorted[0];
    this.businessSuffixes.forEach(suffix => {
      const regex = new RegExp(`\\s+${suffix}\\s*$`, 'gi');
      suggested = suggested.replace(regex, '');
    });
    suggested = suggested.trim();
    if (suggested.length < 3) {
      suggested = sorted[0];
    }
    return suggested;
  }

  // --- (calculateGroupConfidence remains the same) ---
  calculateGroupConfidence(customerGroup) {
    if (customerGroup.length < 2) return 0;
    if (customerGroup.length === 2) {
      return this.calculateSimilarity(customerGroup[0], customerGroup[1]).score;
    }
    let totalSimilarity = 0;
    let comparisons = 0;
    for (let i = 0; i < customerGroup.length; i++) {
      for (let j = i + 1; j < customerGroup.length; j++) {
        const sim = this.calculateSimilarity(customerGroup[i], customerGroup[j]);
        totalSimilarity += sim.score;
        comparisons++;
      }
    }
    return totalSimilarity / comparisons;
  }

  // --- (getMatchDetails remains the same) ---
  getMatchDetails(customerGroup) {
    const details = [];
    for (let i = 0; i < customerGroup.length; i++) {
      for (let j = i + 1; j < customerGroup.length; j++) {
        const sim = this.calculateSimilarity(customerGroup[i], customerGroup[j]);
        details.push({
          pair: [customerGroup[i], customerGroup[j]],
          similarity: (sim.score * 100).toFixed(1) + '%',
          breakdown: sim.details
        });
      }
    }
    return details;
  }

  // --- (validateMergeRules and helpers remain the same) ---
  async validateMergeRules(division, newCustomerList) {
    logger.info(`\n🔍 Validating merge rules for ${division}...`);
    const existingRules = await this.getActiveMergeRules(division);
    logger.info(`   Found ${existingRules.length} active rules to validate`);
    const validationResults = [];
    for (const rule of existingRules) {
      const status = this.validateSingleRule(rule, newCustomerList);
      if (status.status === 'NEEDS_UPDATE' || status.status === 'ORPHANED') {
        const suggestions = await this.findReplacementSuggestions(
          rule,
          status.missing,
          newCustomerList
        );
        status.suggestions = suggestions;
      }
      validationResults.push({
        ruleId: rule.id,
        ruleName: rule.merged_customer_name,
        ...status
      });
      await this.updateRuleValidationStatus(rule.id, status);
    }
    const valid = validationResults.filter(r => r.status === 'VALID').length;
    const needsUpdate = validationResults.filter(r => r.status === 'NEEDS_UPDATE').length;
    const orphaned = validationResults.filter(r => r.status === 'ORPHANED').length;
    logger.info(`   ✅ Valid: ${valid}`);
    logger.info(`   ⚠️  Needs Update: ${needsUpdate}`);
    logger.info(`   ❌ Orphaned: ${orphaned}\n`);
    return validationResults;
  }

  validateSingleRule(rule, currentCustomerList) {
    const found = [];
    const missing = [];
    rule.original_customers.forEach(customer => {
      if (currentCustomerList.includes(customer)) {
        found.push(customer);
      } else {
        missing.push(customer);
      }
    });
    if (missing.length === 0) {
      return { status: 'VALID', found, missing: [] };
    } else if (found.length === 0) {
      return { status: 'ORPHANED', found: [], missing };
    } else {
      return { status: 'NEEDS_UPDATE', found, missing };
    }
  }

  async findReplacementSuggestions(rule, missingCustomers, currentCustomerList) {
    const suggestions = [];
    for (const missingCustomer of missingCustomers) {
      const candidates = currentCustomerList
        .filter(c => !rule.original_customers.includes(c))
        .map(candidate => {
          const sim = this.calculateSimilarity(missingCustomer, candidate);
          return { name: candidate, similarity: sim.score, details: sim.details };
        })
        .filter(c => c.similarity >= 0.70)
        .sort((a, b) => b.similarity - a.similarity);
      if (candidates.length > 0) {
        suggestions.push({
          missing: missingCustomer,
          replacement: candidates[0].name,
          confidence: (candidates[0].similarity * 100).toFixed(1) + '%',
          alternatives: candidates.slice(1, 3).map(c => ({
            name: c.name,
            confidence: (c.similarity * 100).toFixed(1) + '%'
          }))
        });
      }
    }
    return suggestions;
  }

  async updateRuleValidationStatus(ruleId, validationStatus) {
    try {
      await this.pool.query(`
        UPDATE division_customer_merge_rules
        SET
          validation_status = $1,
          last_validated_at = CURRENT_TIMESTAMP,
          validation_notes = $2
        WHERE id = $3
      `, [
        validationStatus.status,
        JSON.stringify({
          found: validationStatus.found,
          missing: validationStatus.missing,
          suggestions: validationStatus.suggestions || []
        }),
        ruleId
      ]);
    } catch (error) {
      logger.error(`Error updating validation status for rule ${ruleId}:`, error.message);
    }
  }

  // --- (getAllCustomers remains the same) ---
  async getAllCustomers(division) {
    const query = `
      SELECT DISTINCT customername
      FROM fp_data_excel
      WHERE division = $1
      AND customername IS NOT NULL
      AND customername != ''
      ORDER BY customername
    `;
    const result = await this.pool.query(query, [division]);
    return result.rows.map(row => row.customername);
  }

  // --- (getActiveMergeRules remains the same) ---
  async getActiveMergeRules(division) {
    const query = `
      SELECT
        id,
        merged_customer_name,
        original_customers
      FROM division_customer_merge_rules
      WHERE division = $1 AND status = 'ACTIVE' AND is_active = true
    `;
    const result = await this.pool.query(query, [division]);
    return result.rows;
  }

  /**
   * --- NEW (STUB) ---
   * Get all manually rejected pairs for the feedback loop.
   * This requires a new database table.
   */
  async getRejectedPairs(division) {
    // TODO: You must implement this.
    // This requires a new table, e.g., 'merge_rule_rejections'
    // with columns: id, division, customer_a, customer_b

    /*
    // --- Example Implementation ---
    const query = `
      SELECT customer_a, customer_b
      FROM merge_rule_rejections
      WHERE division = $1
    `;
    
    try {
      const result = await this.pool.query(query, [division]);
      
      // Return a Set for fast O(1) lookups
      const rejectedSet = new Set();
      result.rows.forEach(row => {
        // Add both permutations
        rejectedSet.add(`${row.customer_a}|${row.customer_b}`.toLowerCase());
        rejectedSet.add(`${row.customer_b}|${row.customer_a}`.toLowerCase());
      });
      return rejectedSet;
      
    } catch (error) {
      logger.error('Could not load rejected pairs:', error.message);
      return new Set();
    }
    */

    // Stub: Return an empty set for now so the code runs
    return new Set();
  }


  /**
   * Save AI suggestions to database
   * --- REFACTOR ---
   * Wrapped all inserts in a single transaction for much better performance.
   */
  async saveSuggestions(division, suggestions) {
    const client = await this.pool.connect();

    try {
      // Start a transaction
      await client.query('BEGIN');

      const query = `
        INSERT INTO merge_rule_suggestions (
          division,
          suggested_merge_name,
          customer_group,
          confidence_score,
          matching_algorithm,
          match_details
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `;

      for (const suggestion of suggestions) {
        await client.query(query, [
          division,
          suggestion.mergedName,
          JSON.stringify(suggestion.customers),
          suggestion.confidence,
          'MULTI_ALGORITHM_V2_GRAPH', // Updated algorithm name
          JSON.stringify(suggestion.matchDetails)
        ]);
      }

      // Commit the transaction
      await client.query('COMMIT');
    } catch (error) {
      // Roll back on error
      await client.query('ROLLBACK');
      logger.error('Error saving suggestions (rolled back):', error.message);
    } finally {
      // Release the client back to the pool
      client.release();
    }
  }
}

module.exports = new CustomerMergingAI();