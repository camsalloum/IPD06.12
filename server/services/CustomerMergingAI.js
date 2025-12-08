/**
 * Customer Merging AI Service
 *
 * AI-powered customer duplicate detection and merge suggestion engine.
 * Uses multiple fuzzy matching algorithms to find potential customer duplicates.
 *
 * Features:
 * - Multi-algorithm similarity scoring (Levenshtein, Jaro-Winkler, Token Set)
 * - Business name normalization (removes LLC, Ltd, Inc, etc.)
 * - Phonetic matching for name variations
 * - Configurable confidence thresholds
 * - Caching for performance
 * - Database upload validation
 */

const { pool } = require('../database/config');
const logger = require('../utils/logger');
const { getDivisionPool } = require('../utils/divisionDatabaseManager');
const stringSimilarity = require('string-similarity');
const natural = require('natural');
const metaphone = natural.Metaphone;
const doubleMetaphone = require('double-metaphone');

/**
 * Helper function to extract division code from full division name
 */
function extractDivisionCode(division) {
  if (!division) return 'fp';
  return division.split('-')[0].toLowerCase();
}

/**
 * Helper function to get table name for a division
 */
function getDataExcelTable(division) {
  const code = extractDivisionCode(division);
  return `${code}_data_excel`;
}

/**
 * Helper function to get all division-specific table names
 */
function getTableNames(division) {
  const code = extractDivisionCode(division);
  return {
    dataExcel: `${code}_data_excel`,
    divisionMergeRules: `${code}_division_customer_merge_rules`,
    mergeRuleSuggestions: `${code}_merge_rule_suggestions`,
    mergeRuleRejections: `${code}_merge_rule_rejections`
  };
}

class CustomerMergingAI {
  constructor() {
    this.pool = pool; // Keep default pool for backward compatibility

    // Configuration
    this.config = {
      minConfidenceThreshold: 0.35,      // 35% minimum to suggest merge (lowered to catch more potential duplicates - users manually approve each)
      highConfidenceThreshold: 0.90,     // 90%+ = very confident
      cacheEnabled: true,

      // Algorithm weights (must sum to 1.0)
      weights: {
        levenshtein: 0.10,        // Character-level
        jaroWinkler: 0.10,        // Prefix matching
        tokenSet: 0.15,           // Word-level matching
        businessSuffix: 0.08,     // Suffix removal
        nGramPrefix: 0.23,        // First N words matching
        coreBrand: 0.22,          // Core brand extraction
        phonetic: 0.12            // Phonetic matching for typos/misspellings (Double Metaphone)
      },

      // Edge case adjustments (confidence penalties)
      edgeCases: {
        singleWordPenalty: 0.85,      // Reduce confidence for single-word names (e.g., "Nike" vs "Mike")
        shortNamePenalty: 0.90,       // Penalty for very short names (< 4 chars)
        lengthMismatchPenalty: 0.85,  // Penalty if length differs by >50%
        numericVariancePenalty: 0.80  // Penalty for numeric variants (branch numbers)
      }
    };

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

      // 3. Get rejected pairs for feedback loop
      const rejectedPairs = await this.getRejectedPairs(division);
      if (rejectedPairs.size > 0) {
        logger.info(`   🚫 Found ${rejectedPairs.size} manually rejected pairs (will be skipped)`);
      }

      // 4. Find potential duplicates (pass rejected pairs)
      const suggestions = await this.findPotentialDuplicates(customers, rejectedPairs, options);
      logger.info(`   🔍 Found ${suggestions.length} potential merge groups`);

      // 4. Filter by confidence threshold
      const minThreshold = options.minConfidence || this.config.minConfidenceThreshold;
      let filtered = suggestions.filter(s => s.confidence >= minThreshold);
      logger.info(`   ✅ ${filtered.length} suggestions above ${(minThreshold * 100).toFixed(0)}% confidence`);

      // 5. Filter out suggestions that overlap with existing rules
      const beforeFilter = filtered.length;
      filtered = filtered.filter(suggestion => {
        // Check if any customer in this suggestion is already in an active rule
        const hasOverlap = suggestion.customers.some(customer =>
          existingRuleCustomers.has(customer.toLowerCase())
        );
        return !hasOverlap;
      });
      const filteredOut = beforeFilter - filtered.length;
      if (filteredOut > 0) {
        logger.info(`   🚫 Filtered out ${filteredOut} suggestions (already have active rules)`);
      }

      // 6. Save to database
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
   * Find potential duplicate customer groups (with rejection feedback)
   * Uses blocking/indexing optimization for better performance
   */
  async findPotentialDuplicates(customers, rejectedPairs = new Set(), options = {}) {
    const potentialGroups = [];
    const processed = new Set();
    const maxGroupSize = options.maxGroupSize || 5;

    // OPTIMIZATION: Block customers by first significant word
    // This reduces comparisons from O(n²) to O(n×k) where k is average block size
    const useBlocking = options.useBlocking !== false; // Default true

    if (useBlocking) {
      logger.info('   🚀 Using blocking optimization for faster scanning...');
      const blocks = this.createBlocks(customers);
      logger.info(`   📦 Created ${blocks.size} blocks (avg ${Math.round(customers.length / blocks.size)} customers per block)`);

      // Process each block independently
      for (const [blockKey, blockCustomers] of blocks.entries()) {
        // Only process blocks with 2+ customers
        if (blockCustomers.length < 2) continue;

        // Compare customers within the same block
        for (let i = 0; i < blockCustomers.length; i++) {
          if (processed.has(blockCustomers[i])) continue;

          const group = [blockCustomers[i]];
          processed.add(blockCustomers[i]);

          for (let j = i + 1; j < blockCustomers.length; j++) {
            if (processed.has(blockCustomers[j])) continue;
            if (group.length >= maxGroupSize) break;

            // Skip if this pair was manually rejected
            const pairKey = `${blockCustomers[i].toLowerCase()}||${blockCustomers[j].toLowerCase()}`;
            if (rejectedPairs.has(pairKey)) continue;

            const similarity = this.calculateSimilarity(blockCustomers[i], blockCustomers[j]);

            if (similarity.score >= this.config.minConfidenceThreshold) {
              group.push(blockCustomers[j]);
              processed.add(blockCustomers[j]);
            }
          }

          if (group.length >= 2) {
            // Calculate group confidence and create proper suggestion object
            const groupConfidence = this.calculateGroupConfidence(group);
            potentialGroups.push({
              customers: group,
              mergedName: this.suggestMergedName(group),
              confidence: groupConfidence,
              matchDetails: this.getMatchDetails(group),
              customerCount: group.length
            });
          }
        }
      }
    } else {
      // Original O(n²) algorithm (for comparison/testing)
      logger.info('   ⚠️  Using full O(n²) comparison (blocking disabled)');

      for (let i = 0; i < customers.length; i++) {
        if (processed.has(customers[i])) continue;

        const group = [customers[i]];
        processed.add(customers[i]);

        // Find similar customers
        for (let j = i + 1; j < customers.length; j++) {
          if (processed.has(customers[j])) continue;
          if (group.length >= maxGroupSize) break; // Limit group size

          // Skip if this pair was manually rejected
          const pairKey = `${customers[i].toLowerCase()}||${customers[j].toLowerCase()}`;
          if (rejectedPairs.has(pairKey)) {
            continue; // Skip rejected pairs
          }

          const similarity = this.calculateSimilarity(customers[i], customers[j]);

          // Check if similar enough to group
          if (similarity.score >= this.config.minConfidenceThreshold) {
            group.push(customers[j]);
            processed.add(customers[j]);
          }
        }

        // Only suggest groups with 2+ customers
        if (group.length >= 2) {
          const groupConfidence = this.calculateGroupConfidence(group);

          potentialGroups.push({
            customers: group,
            mergedName: this.suggestMergedName(group),
            confidence: groupConfidence,
            matchDetails: this.getMatchDetails(group),
            customerCount: group.length
          });
        }
      }
    }

    // Sort by confidence (highest first)
    return potentialGroups.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create blocks for faster duplicate detection
   * Groups customers by first significant word (normalized)
   * Reduces comparisons from O(n²) to O(n×k) where k is average block size
   */
  createBlocks(customers) {
    const blocks = new Map();

    for (const customer of customers) {
      // Get blocking key: first significant word after normalization
      const blockKey = this.getBlockingKey(customer);

      if (!blocks.has(blockKey)) {
        blocks.set(blockKey, []);
      }
      blocks.get(blockKey).push(customer);
    }

    return blocks;
  }

  /**
   * Generate blocking key for a customer
   * Uses first 2 significant words for better accuracy
   */
  getBlockingKey(customer) {
    const normalized = this.normalizeCustomerName(customer);
    const tokens = normalized.split(' ').filter(t => t.length > 2); // Ignore short words

    if (tokens.length === 0) {
      // Fallback to first char of original name
      return customer.charAt(0).toLowerCase();
    }

    // Use first 2 significant words as block key (or 1 if that's all we have)
    const keyWords = tokens.slice(0, Math.min(2, tokens.length));
    return keyWords.join(' ');
  }

  /**
   * Calculate similarity between two customer names
   */
  calculateSimilarity(customer1, customer2) {
    const normalized1 = this.normalizeCustomerName(customer1);
    const normalized2 = this.normalizeCustomerName(customer2);

    // Quick exit for exact matches
    if (normalized1 === normalized2) {
      return {
        score: 1.0,
        details: {
          exactMatch: true
        }
      };
    }

    // Algorithm 1: Levenshtein-based (Dice coefficient)
    const levenshtein = stringSimilarity.compareTwoStrings(normalized1, normalized2);

    // Algorithm 2: Jaro-Winkler approximation (using library's best match)
    const jaroWinkler = this.jaroWinklerSimilarity(normalized1, normalized2);

    // Algorithm 3: Token Set Ratio (word-level matching)
    const tokenSet = this.tokenSetSimilarity(normalized1, normalized2);

    // Algorithm 4: Business suffix removal comparison
    const withoutSuffix = this.compareWithoutBusinessSuffixes(customer1, customer2);

    // Algorithm 5: N-Gram Prefix Matching (first 2 words)
    const nGramPrefix = this.nGramPrefixSimilarity(normalized1, normalized2, 2);

    // Algorithm 6: Core Brand Similarity
    const coreBrand = this.coreBrandSimilarity(customer1, customer2);

    // Algorithm 7: Phonetic Similarity (for typos/misspellings)
    const phonetic = this.phoneticSimilarity(customer1, customer2);

    // Weighted average
    let score = (
      levenshtein * this.config.weights.levenshtein +
      jaroWinkler * this.config.weights.jaroWinkler +
      tokenSet * this.config.weights.tokenSet +
      withoutSuffix * this.config.weights.businessSuffix +
      nGramPrefix * this.config.weights.nGramPrefix +
      coreBrand * this.config.weights.coreBrand +
      phonetic * this.config.weights.phonetic
    );

    // Boost: If core brand matches highly (90%+), boost overall score slightly
    if (coreBrand >= 0.90) {
      score = Math.min(1.0, score * 1.08); // 8% boost for strong brand match
    }

    // Apply edge case penalties for better accuracy
    const penalties = this.detectEdgeCases(customer1, customer2, normalized1, normalized2);
    let finalScore = score;

    // Only apply single-word penalty if BOTH are actually suspicious
    if (penalties.singleWord && score < 0.85) {
      finalScore *= this.config.edgeCases.singleWordPenalty;
    }
    // Only apply short name penalty if actually very short
    if (penalties.shortName && score < 0.90) {
      finalScore *= this.config.edgeCases.shortNamePenalty;
    }
    // Only apply length mismatch penalty if EXTREME difference
    if (penalties.lengthMismatch) {
      finalScore *= this.config.edgeCases.lengthMismatchPenalty;
    }
    // Only apply numeric variance penalty if confident they differ
    if (penalties.numericVariance && score < 0.80) {
      finalScore *= this.config.edgeCases.numericVariancePenalty;
    }

    return {
      score: Math.min(1.0, Math.max(0.0, finalScore)), // Clamp to [0, 1]
      baseScore: score, // Score before penalties
      penalties: penalties,
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

  /**
   * Detect edge cases that should reduce confidence
   */
  detectEdgeCases(customer1, customer2, normalized1, normalized2) {
    const penalties = {
      singleWord: false,
      shortName: false,
      lengthMismatch: false,
      numericVariance: false
    };

    // Check for single-word names
    const tokens1 = normalized1.split(' ').filter(Boolean);
    const tokens2 = normalized2.split(' ').filter(Boolean);

    if (tokens1.length === 1 && tokens2.length === 1) {
      penalties.singleWord = true;
    }

    // Check for very short names (< 4 chars after normalization)
    if (normalized1.length < 4 || normalized2.length < 4) {
      penalties.shortName = true;
    }

    // Check for length mismatch (>70% difference - very extreme)
    const maxLen = Math.max(normalized1.length, normalized2.length);
    const minLen = Math.min(normalized1.length, normalized2.length);
    if (maxLen > 0 && (maxLen - minLen) / maxLen > 0.70) {
      penalties.lengthMismatch = true;
    }

    // Check for numeric variance (branch/location indicators)
    // Use NORMALIZED names to avoid false positives from address numbers that were removed
    const numPattern = /\b(\d+|one|two|three|four|five|branch|br\.)\b/gi;
    const hasNum1 = numPattern.test(normalized1);
    numPattern.lastIndex = 0; // Reset regex
    const hasNum2 = numPattern.test(normalized2);

    // If one has numbers in the NORMALIZED name and the other doesn't, might be branch variant
    if (hasNum1 !== hasNum2) {
      penalties.numericVariance = true;
    }

    return penalties;
  }

  /**
   * Expand common abbreviations in text
   */
  expandAbbreviations(name) {
    if (!name) return '';

    let expanded = name.toLowerCase();

    // Replace each abbreviation with its expanded form
    Object.entries(this.abbreviationMap).forEach(([abbr, full]) => {
      // Match whole words only, case-insensitive
      const regex = new RegExp(`\\b${abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      expanded = expanded.replace(regex, full);
    });

    return expanded;
  }

  /**
   * Remove address noise and irrelevant data from customer name
   */
  removeAddressNoise(name, removeLocations = false) {
    if (!name) return '';

    let cleaned = name.toLowerCase();

    // PREPROCESSING: Add space before common address keywords if they're stuck to other words
    // This handles cases like "LLCNo 4" -> "LLC No 4", "LLCStreet" -> "LLC Street"
    cleaned = cleaned.replace(/([a-z])(no|street|shop|floor|building|unit|suite|room|office)\s*(\d+|\.)/gi, '$1 $2 $3');

    // Remove PO Box patterns
    cleaned = cleaned.replace(/\b(po|p\.o\.?)\s*box[:\s]*\d+/gi, '');
    cleaned = cleaned.replace(/\bpobox\s*\d+/gi, '');

    // Remove "No" followed by number (common in addresses) - add space before removal
    cleaned = cleaned.replace(/\bno\.?\s*\d+/gi, ' ');
    cleaned = cleaned.replace(/\bnumber\.?\s*\d+/gi, ' ');
    cleaned = cleaned.replace(/\b#\s*\d+/gi, ' ');

    // Remove shop/office/unit numbers (but only when followed by a number)
    cleaned = cleaned.replace(/\b(shop|office|unit|suite|room)\s*(no\.?|number|#)?\s*:?\s*\d+/gi, ' ');
    cleaned = cleaned.replace(/\bstore\s*(no\.?|number|#)\s*:?\s*\d+/gi, ' '); // "Store" separately to avoid removing brand names

    // Remove "Street" followed by number
    cleaned = cleaned.replace(/\bstreet\s*\d+/gi, ' ');
    cleaned = cleaned.replace(/\bst\.?\s*\d+/gi, ' ');

    // Remove building/floor numbers
    cleaned = cleaned.replace(/\b(building|floor|level|block)\s*:?\s*\d+/gi, ' ');

    // Remove standalone numbers (likely addresses/phone - 3+ digits)
    cleaned = cleaned.replace(/\b\d{3,}\b/g, ' ');

    // Remove phone patterns
    cleaned = cleaned.replace(/\b(tel|phone|mob|mobile|fax)[:\s]*[\d\s\-\+\(\)]+/gi, ' ');
    cleaned = cleaned.replace(/[\+\(]?\d{2,4}[\)\-\s]?\d{3,4}[\-\s]?\d{3,4}/g, ' ');

    // Remove email patterns
    cleaned = cleaned.replace(/\S+@\S+\.\S+/gi, ' ');

    // Optionally remove location keywords (if enabled)
    if (removeLocations) {
      const locRegex = new RegExp(`\\b(${this.locationKeywords.join('|')})\\b`, 'gi');
      cleaned = cleaned.replace(locRegex, ' ');
    }

    // Clean up extra spaces and commas
    cleaned = cleaned.replace(/[,;]+/g, ' '); // Remove commas and semicolons
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Normalize customer name for comparison (enhanced with address removal)
   */
  normalizeCustomerName(name, removeLocations = false) {
    if (!name) return '';

    // PASS 0: Unicode normalization and diacritics removal
    // Convert accented characters: café → cafe, José → Jose
    let cleaned = String(name).normalize('NFKD').replace(/\p{M}/gu, '');

    // PASS 1: Expand abbreviations
    cleaned = this.expandAbbreviations(cleaned);

    // PASS 2: Remove address noise
    cleaned = this.removeAddressNoise(cleaned, removeLocations);

    // Safety check: if everything was removed, use original
    if (!cleaned || cleaned.trim() === '') {
      cleaned = String(name).normalize('NFKD').replace(/\p{M}/gu, '');
    }

    // PASS 3: Standard normalization
    const result = cleaned
      .toLowerCase()
      .trim()
      // Remove multiple spaces
      .replace(/\s+/g, ' ')
      // Remove special characters but keep spaces
      .replace(/[^\w\s]/g, '')
      // Remove common business suffixes
      .replace(new RegExp(`\\b(${this.businessSuffixes.join('|')})\\b`, 'gi'), '')
      // Clean up extra spaces after suffix removal
      .replace(/\s+/g, ' ')
      .trim();

    // Safety check: if result is empty, return original cleaned
    return result || cleaned.toLowerCase().trim();
  }

  /**
   * Extract core brand name (first significant words before descriptors)
   */
  extractCoreBrand(name) {
    if (!name) return '';

    // First normalize to remove noise
    const normalized = this.normalizeCustomerName(name);
    const tokens = normalized.split(' ').filter(t => t.length > 2); // Ignore very short words

    if (tokens.length === 0) return '';

    // Take words until we hit a brand stop word, or max 4 words
    const coreTokens = [];

    for (const token of tokens) {
      if (this.brandStopWords.includes(token)) break;
      coreTokens.push(token);
      if (coreTokens.length >= 4) break;
    }

    // If we got nothing, return first 2 words
    if (coreTokens.length === 0 && tokens.length > 0) {
      return tokens.slice(0, Math.min(2, tokens.length)).join(' ');
    }

    return coreTokens.join(' ');
  }

  /**
   * Jaro-Winkler similarity (approximation using best match)
   */
  jaroWinklerSimilarity(s1, s2) {
    // Use string-similarity's compareTwoStrings as approximation
    // It uses Dice's coefficient which is similar to Jaro-Winkler for our use case
    return stringSimilarity.compareTwoStrings(s1, s2);
  }

  /**
   * Token-based matching (word order independent)
   */
  tokenSetSimilarity(s1, s2) {
    const tokens1 = new Set(s1.split(' ').filter(t => t.length > 0));
    const tokens2 = new Set(s2.split(' ').filter(t => t.length > 0));

    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  /**
   * N-Gram Prefix Similarity - Check if first N significant words match
   */
  nGramPrefixSimilarity(s1, s2, n = 2) {
    const tokens1 = s1.split(' ').filter(t => t.length > 2); // Ignore short words (a, in, of)
    const tokens2 = s2.split(' ').filter(t => t.length > 2);

    // If either string has fewer than N words, compare what we have
    const compareN = Math.min(n, tokens1.length, tokens2.length);
    if (compareN === 0) return 0.0;

    const prefix1 = tokens1.slice(0, compareN).join(' ');
    const prefix2 = tokens2.slice(0, compareN).join(' ');

    // Exact match of first N words
    if (prefix1 === prefix2) return 1.0;

    // Partial match using Dice coefficient
    return stringSimilarity.compareTwoStrings(prefix1, prefix2);
  }

  /**
   * Core Brand Similarity - Compare extracted brand cores
   */
  coreBrandSimilarity(name1, name2) {
    const core1 = this.extractCoreBrand(name1);
    const core2 = this.extractCoreBrand(name2);

    // Both empty
    if (!core1 && !core2) return 1.0;
    if (!core1 || !core2) return 0.0;

    // Exact match
    if (core1 === core2) return 1.0;

    // Use Dice coefficient for partial match
    return stringSimilarity.compareTwoStrings(core1, core2);
  }

  /**
   * Phonetic Similarity - Compare how names sound (catches typos/misspellings)
   * Uses Double Metaphone for better accuracy (primary + alternate codes)
   */
  phoneticSimilarity(name1, name2) {
    try {
      const normalized1 = this.normalizeCustomerName(name1);
      const normalized2 = this.normalizeCustomerName(name2);

      if (!normalized1 || !normalized2) return 0.0;

      // Split into words and get phonetic codes
      const words1 = normalized1.split(' ').filter(w => w.length > 2);
      const words2 = normalized2.split(' ').filter(w => w.length > 2);

      if (words1.length === 0 || words2.length === 0) return 0.0;

      // Get double metaphone codes for each word (primary + alternate)
      const codes1 = new Set();
      const codes2 = new Set();

      for (const word of words1) {
        try {
          const [primary, alternate] = doubleMetaphone(word);
          if (primary) codes1.add(primary);
          if (alternate) codes1.add(alternate);
        } catch (e) {
          // Fallback to word itself
          codes1.add(word);
        }
      }

      for (const word of words2) {
        try {
          const [primary, alternate] = doubleMetaphone(word);
          if (primary) codes2.add(primary);
          if (alternate) codes2.add(alternate);
        } catch (e) {
          // Fallback to word itself
          codes2.add(word);
        }
      }

      // Calculate Jaccard similarity of phonetic codes
      const intersection = new Set([...codes1].filter(x => codes2.has(x)));
      const union = new Set([...codes1, ...codes2]);

      if (union.size === 0) return 0.0;

      return intersection.size / union.size;
    } catch (error) {
      // If phonetic matching fails, fall back to 0
      return 0.0;
    }
  }

  /**
   * Compare after removing business suffixes (more aggressive)
   */
  compareWithoutBusinessSuffixes(name1, name2) {
    let clean1 = name1.toLowerCase().trim();
    let clean2 = name2.toLowerCase().trim();

    // Remove all suffixes
    this.businessSuffixes.forEach(suffix => {
      const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
      clean1 = clean1.replace(regex, '');
      clean2 = clean2.replace(regex, '');
    });

    // Remove punctuation and extra spaces
    clean1 = clean1.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    clean2 = clean2.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

    if (clean1 === clean2) return 1.0;

    // Use Dice coefficient for partial match
    return stringSimilarity.compareTwoStrings(clean1, clean2);
  }

  /**
   * Suggest the best merged name from a group
   */
  suggestMergedName(customerGroup) {
    if (!customerGroup || customerGroup.length === 0) return '';

    // Strategy 1: Use shortest name (usually cleanest)
    const sorted = [...customerGroup].sort((a, b) => a.length - b.length);
    let suggested = sorted[0];

    // Strategy 2: Remove trailing business suffixes from shortest name
    this.businessSuffixes.forEach(suffix => {
      const regex = new RegExp(`\\s+${suffix}\\s*$`, 'gi');
      suggested = suggested.replace(regex, '');
    });

    // Clean up
    suggested = suggested.trim();

    // If suggestion is too short, use original shortest
    if (suggested.length < 3) {
      suggested = sorted[0];
    }

    return suggested;
  }

  /**
   * Calculate overall confidence for a group of customers
   */
  calculateGroupConfidence(customerGroup) {
    if (customerGroup.length < 2) return 0;
    if (customerGroup.length === 2) {
      return this.calculateSimilarity(customerGroup[0], customerGroup[1]).score;
    }

    // For groups of 3+, calculate average pairwise similarity
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

  /**
   * Get detailed match explanation
   */
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

  /**
   * Validate existing merge rules after database upload
   */
  async validateMergeRules(division, newCustomerList) {
    logger.info(`\n🔍 Validating merge rules for ${division}...`);

    const existingRules = await this.getActiveMergeRules(division);
    logger.info(`   Found ${existingRules.length} active rules to validate`);

    const validationResults = [];

    for (const rule of existingRules) {
      const status = this.validateSingleRule(rule, newCustomerList);

      // If needs update, try to find replacement suggestions
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

      // Update validation status in database
      await this.updateRuleValidationStatus(rule.id, status);
    }

    // Summary
    const valid = validationResults.filter(r => r.status === 'VALID').length;
    const needsUpdate = validationResults.filter(r => r.status === 'NEEDS_UPDATE').length;
    const orphaned = validationResults.filter(r => r.status === 'ORPHANED').length;

    logger.info(`   ✅ Valid: ${valid}`);
    logger.info(`   ⚠️  Needs Update: ${needsUpdate}`);
    logger.info(`   ❌ Orphaned: ${orphaned}\n`);

    return validationResults;
  }

  /**
   * Validate a single merge rule
   */
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
      return {
        status: 'VALID',
        found,
        missing: []
      };
    } else if (found.length === 0) {
      return {
        status: 'ORPHANED',
        found: [],
        missing
      };
    } else {
      return {
        status: 'NEEDS_UPDATE',
        found,
        missing
      };
    }
  }

  /**
   * Find replacement suggestions for missing customers
   */
  async findReplacementSuggestions(rule, missingCustomers, currentCustomerList) {
    const suggestions = [];

    for (const missingCustomer of missingCustomers) {
      // Find similar customers in current list
      const candidates = currentCustomerList
        .filter(c => !rule.original_customers.includes(c)) // Exclude already in rule
        .map(candidate => {
          const sim = this.calculateSimilarity(missingCustomer, candidate);
          return {
            name: candidate,
            similarity: sim.score,
            details: sim.details
          };
        })
        .filter(c => c.similarity >= 0.70) // 70% threshold
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

  /**
   * Update rule validation status in database
   */
  async updateRuleValidationStatus(division, ruleId, validationStatus) {
    const divisionPool = getDivisionPool(extractDivisionCode(division).toUpperCase());
    const tables = getTableNames(division);
    
    try {
      await divisionPool.query(`
        UPDATE ${tables.divisionMergeRules}
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

  /**
   * Get all unique customers from ALL relevant tables in the division database
   * This includes: data_excel, sales_rep_budget, sales_rep_budget_draft
   */
  async getAllCustomers(division) {
    const code = extractDivisionCode(division);
    const divisionPool = getDivisionPool(code.toUpperCase());
    
    // All tables that contain customer names
    const tables = [
      { name: `${code}_data_excel`, column: 'customername', divisionFilter: true },
      { name: `${code}_sales_rep_budget`, column: 'customername', divisionFilter: true },
      { name: `${code}_sales_rep_budget_draft`, column: 'customername', divisionFilter: true }
    ];
    
    const allCustomers = new Set();
    
    for (const table of tables) {
      try {
        let query;
        let params;
        
        if (table.divisionFilter) {
          query = `
            SELECT DISTINCT ${table.column}
            FROM ${table.name}
            WHERE division = $1
            AND ${table.column} IS NOT NULL
            AND TRIM(${table.column}) != ''
          `;
          params = [division];
        } else {
          query = `
            SELECT DISTINCT ${table.column}
            FROM ${table.name}
            WHERE ${table.column} IS NOT NULL
            AND TRIM(${table.column}) != ''
          `;
          params = [];
        }
        
        const result = await divisionPool.query(query, params);
        result.rows.forEach(row => {
          if (row[table.column]) {
            allCustomers.add(row[table.column]);
          }
        });
        
        logger.info(`   📊 Found ${result.rows.length} customers in ${table.name}`);
      } catch (tableError) {
        // Table might not exist, skip it
        logger.warn(`   ⚠️ Could not query ${table.name}: ${tableError.message}`);
      }
    }
    
    const customerArray = Array.from(allCustomers).sort();
    logger.info(`   📊 Total unique customers from all tables: ${customerArray.length}`);
    
    return customerArray;
  }

  /**
   * Get rejected customer pairs for feedback loop
   * Returns Set of "customer1||customer2" keys (normalized lowercase)
   */
  async getRejectedPairs(division) {
    try {
      const divisionPool = getDivisionPool(extractDivisionCode(division).toUpperCase());
      const tables = getTableNames(division);
      
      const query = `
        SELECT LOWER(customer1) as c1, LOWER(customer2) as c2
        FROM ${tables.mergeRuleRejections}
        WHERE division = $1
      `;

      const result = await divisionPool.query(query, [division]);
      const rejectedSet = new Set();

      result.rows.forEach(row => {
        // Store both directions to handle order-independent lookup
        rejectedSet.add(`${row.c1}||${row.c2}`);
        rejectedSet.add(`${row.c2}||${row.c1}`);
      });

      return rejectedSet;
    } catch (error) {
      // Table might not exist yet, return empty set
      logger.warn('   ⚠️  Could not load rejected pairs (table may not exist):', error.message);
      return new Set();
    }
  }

  /**
   * Get active merge rules
   */
  async getActiveMergeRules(division) {
    const divisionPool = getDivisionPool(extractDivisionCode(division).toUpperCase());
    const tables = getTableNames(division);
    
    const query = `
      SELECT
        id,
        merged_customer_name,
        original_customers
      FROM ${tables.divisionMergeRules}
      WHERE division = $1 AND status = 'ACTIVE' AND is_active = true
    `;

    const result = await divisionPool.query(query, [division]);
    return result.rows;
  }

  /**
   * Save AI suggestions to database
   */
  async saveSuggestions(division, suggestions) {
    const divisionPool = getDivisionPool(extractDivisionCode(division).toUpperCase());
    const tables = getTableNames(division);
    
    for (const suggestion of suggestions) {
      try {
        await divisionPool.query(`
          INSERT INTO ${tables.mergeRuleSuggestions} (
            division,
            suggested_merge_name,
            customer_group,
            confidence_score,
            matching_algorithm,
            match_details
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [
          division,
          suggestion.mergedName,
          JSON.stringify(suggestion.customers),
          suggestion.confidence,
          'MULTI_ALGORITHM',
          JSON.stringify(suggestion.matchDetails)
        ]);
      } catch (error) {
        logger.error('Error saving suggestion:', error.message);
      }
    }
  }
}

module.exports = new CustomerMergingAI();
