/**
 * Customer Merging AI Service (Enhanced Version)
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
 * - Performance blocking for large datasets
 * - Numeric variance detection for branch/location variants
 * - Enhanced confidence calibration
 * - Batch database operations
 *
 * @version 2.0
 * @enhanced 2024
 */

const { pool } = require('../database/config');
const stringSimilarity = require('string-similarity');
const natural = require('natural');
const metaphone = natural.Metaphone;
const soundex = natural.SoundEx;

class CustomerMergingAI {
  constructor() {
    this.pool = pool;

    // Configuration
    this.config = {
      minConfidenceThreshold: 0.65,      // 65% minimum to suggest merge (lowered for better recall)
      highConfidenceThreshold: 0.90,     // 90%+ = very confident
      cacheEnabled: true,
      performanceMode: true,             // Enable blocking optimization for large datasets
      debugMode: false,                  // Set to true for detailed logging

      // Algorithm weights (must sum to 1.0)
      weights: {
        levenshtein: 0.10,        // Character-level
        jaroWinkler: 0.10,        // Prefix matching
        tokenSet: 0.15,           // Word-level matching (enhanced with position awareness)
        businessSuffix: 0.08,     // Suffix removal
        nGramPrefix: 0.23,        // First N words matching
        coreBrand: 0.22,          // Core brand extraction
        phonetic: 0.12            // Phonetic matching for typos/misspellings (enhanced)
      },

      // Edge case adjustments
      edgeCases: {
        singleWordMultiplier: 0.85,    // Higher bar for single-word names
        shortNameMultiplier: 0.90,     // Penalty for names < 4 chars
        lengthMismatchMultiplier: 0.85, // Penalty if length differs by 50%+
        numericVarianceMultiplier: 0.80 // Penalty for numeric variants (branches)
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

    // Numeric pattern for detecting branch/location variants
    this.numberPattern = /\b(\d+|one|two|three|four|five|first|second|third|fourth|fifth|branch|br\.)\b/gi;

    // Performance cache
    this.cache = new Map();
  }

  /**
   * Main entry point: Scan division and suggest merges
   */
  async scanAndSuggestMerges(division, options = {}) {
    console.log(`\n🤖 AI Scan: Finding customer duplicates in ${division}...`);

    const startTime = Date.now();

    try {
      // 1. Get all unique customers from database
      const customers = await this.getAllCustomers(division);
      console.log(`   📊 Found ${customers.length} unique customers`);

      if (customers.length < 2) {
        console.log('   ℹ️  Not enough customers to find duplicates');
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
      console.log(`   📋 Found ${existingRules.length} existing rules covering ${existingRuleCustomers.size} customers`);

      // 3. Find potential duplicates
      const suggestions = await this.findPotentialDuplicates(customers, options);
      console.log(`   🔍 Found ${suggestions.length} potential merge groups`);

      // 4. Filter by confidence threshold
      const minThreshold = options.minConfidence || this.config.minConfidenceThreshold;
      let filtered = suggestions.filter(s => s.confidence >= minThreshold);
      console.log(`   ✅ ${filtered.length} suggestions above ${(minThreshold * 100).toFixed(0)}% confidence`);

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
        console.log(`   🚫 Filtered out ${filteredOut} suggestions (already have active rules)`);
      }

      // 6. Save to database (batch operation)
      if (filtered.length > 0) {
        await this.saveSuggestions(division, filtered);
        console.log(`   💾 Saved ${filtered.length} new suggestions to database`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`   ⏱️  Completed in ${elapsed}s\n`);

      return filtered;

    } catch (error) {
      console.error('❌ AI scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Find potential duplicate customer groups (with performance optimization)
   */
  async findPotentialDuplicates(customers, options = {}) {
    const potentialGroups = [];
    const processed = new Set();
    const maxGroupSize = options.maxGroupSize || 5;

    // Performance optimization: Use blocking for large datasets
    if (this.config.performanceMode && customers.length > 100) {
      return this.findPotentialDuplicatesWithBlocking(customers, options);
    }

    // Standard algorithm for smaller datasets
    for (let i = 0; i < customers.length; i++) {
      if (processed.has(customers[i])) continue;

      const group = [customers[i]];
      processed.add(customers[i]);

      // Find similar customers
      for (let j = i + 1; j < customers.length; j++) {
        if (processed.has(customers[j])) continue;
        if (group.length >= maxGroupSize) break;

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

    // Sort by confidence (highest first)
    return potentialGroups.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Performance-optimized duplicate finding using blocking technique
   * Reduces O(n²) to approximately O(n) for large datasets
   */
  async findPotentialDuplicatesWithBlocking(customers, options = {}) {
    console.log('   🚀 Using performance mode (blocking optimization)');
    
    const potentialGroups = [];
    const processed = new Set();
    const maxGroupSize = options.maxGroupSize || 5;

    // Create blocks by first 3 characters
    const blocks = this.createBlocks(customers);
    const blockKeys = Array.from(blocks.keys()).sort();

    for (let blockIdx = 0; blockIdx < blockKeys.length; blockIdx++) {
      const blockKey = blockKeys[blockIdx];
      const blockCustomers = blocks.get(blockKey);

      // Get adjacent blocks for comparison
      const compareSet = new Set(blockCustomers);
      
      // Add previous block
      if (blockIdx > 0) {
        const prevBlock = blocks.get(blockKeys[blockIdx - 1]) || [];
        prevBlock.forEach(c => compareSet.add(c));
      }
      
      // Add next block
      if (blockIdx < blockKeys.length - 1) {
        const nextBlock = blocks.get(blockKeys[blockIdx + 1]) || [];
        nextBlock.forEach(c => compareSet.add(c));
      }

      const compareArray = Array.from(compareSet);

      // Compare within block and adjacent blocks
      for (let i = 0; i < compareArray.length; i++) {
        if (processed.has(compareArray[i])) continue;

        const group = [compareArray[i]];
        processed.add(compareArray[i]);

        for (let j = i + 1; j < compareArray.length; j++) {
          if (processed.has(compareArray[j])) continue;
          if (group.length >= maxGroupSize) break;

          const similarity = this.calculateSimilarity(compareArray[i], compareArray[j]);

          if (similarity.score >= this.config.minConfidenceThreshold) {
            group.push(compareArray[j]);
            processed.add(compareArray[j]);
          }
        }

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

    return potentialGroups.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create blocking index by first N characters
   */
  createBlocks(customers, blockSize = 3) {
    const blocks = new Map();
    
    customers.forEach(customer => {
      if (!customer) return;
      
      const normalized = this.normalizeCustomerName(customer);
      const blockKey = normalized.substring(0, blockSize).toLowerCase();
      
      if (!blocks.has(blockKey)) {
        blocks.set(blockKey, []);
      }
      blocks.get(blockKey).push(customer);
    });

    if (this.config.debugMode) {
      console.log(`   📦 Created ${blocks.size} blocks for ${customers.length} customers`);
    }

    return blocks;
  }

  /**
   * Calculate similarity between two customer names (Enhanced)
   */
  calculateSimilarity(customer1, customer2) {
    // Input validation
    if (!customer1 || !customer2) {
      return { score: 0, details: { error: 'Invalid input' } };
    }

    // Check cache first
    const cacheKey = `${customer1}|${customer2}`;
    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const normalized1 = this.normalizeCustomerName(customer1);
    const normalized2 = this.normalizeCustomerName(customer2);

    // Quick exit for exact matches
    if (normalized1 === normalized2) {
      const result = {
        score: 1.0,
        details: {
          exactMatch: true
        }
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Check for numeric variance (branch/location variants)
    const numVariance = this.hasNumericVariance(customer1, customer2);

    try {
      // Algorithm 1: Levenshtein-based (Dice coefficient)
      const levenshtein = stringSimilarity.compareTwoStrings(normalized1, normalized2);

      // Algorithm 2: Jaro-Winkler approximation
      const jaroWinkler = this.jaroWinklerSimilarity(normalized1, normalized2);

      // Algorithm 3: Token Set Ratio (enhanced with position awareness)
      const tokenSet = this.tokenSetSimilarity(normalized1, normalized2);

      // Algorithm 4: Business suffix removal comparison
      const withoutSuffix = this.compareWithoutBusinessSuffixes(customer1, customer2);

      // Algorithm 5: N-Gram Prefix Matching (first 2 words)
      const nGramPrefix = this.nGramPrefixSimilarity(normalized1, normalized2, 2);

      // Algorithm 6: Core Brand Similarity
      const coreBrand = this.coreBrandSimilarity(customer1, customer2);

      // Algorithm 7: Enhanced Phonetic Similarity
      const phonetic = this.phoneticSimilarity(customer1, customer2);

      // Weighted average
      const weightedScore = (
        levenshtein * this.config.weights.levenshtein +
        jaroWinkler * this.config.weights.jaroWinkler +
        tokenSet * this.config.weights.tokenSet +
        withoutSuffix * this.config.weights.businessSuffix +
        nGramPrefix * this.config.weights.nGramPrefix +
        coreBrand * this.config.weights.coreBrand +
        phonetic * this.config.weights.phonetic
      );

      // Apply confidence calibration adjustments
      const { finalScore, adjustments } = this.calibrateConfidence(
        weightedScore,
        normalized1,
        normalized2,
        numVariance
      );

      const result = {
        score: Math.min(1.0, Math.max(0, finalScore)),
        details: {
          algorithms: {
            levenshtein: (levenshtein * 100).toFixed(1) + '%',
            jaroWinkler: (jaroWinkler * 100).toFixed(1) + '%',
            tokenSet: (tokenSet * 100).toFixed(1) + '%',
            businessSuffix: (withoutSuffix * 100).toFixed(1) + '%',
            nGramPrefix: (nGramPrefix * 100).toFixed(1) + '%',
            coreBrand: (coreBrand * 100).toFixed(1) + '%',
            phonetic: (phonetic * 100).toFixed(1) + '%'
          },
          normalized: {
            name1: normalized1,
            name2: normalized2
          },
          adjustments,
          numericVariance: numVariance?.hasVariance ? numVariance : undefined,
          confidenceExplanation: this.explainConfidence(finalScore, adjustments)
        }
      };

      // Cache result
      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, result);
      }

      return result;

    } catch (error) {
      console.error('Error calculating similarity:', error.message);
      return {
        score: 0,
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Apply confidence calibration based on edge cases
   */
  calibrateConfidence(baseScore, normalized1, normalized2, numVariance) {
    let finalScore = baseScore;
    const adjustments = [];

    // Single word names need higher confidence
    const words1 = normalized1.split(/\s+/).filter(w => w.length > 0).length;
    const words2 = normalized2.split(/\s+/).filter(w => w.length > 0).length;
    
    if (words1 === 1 || words2 === 1) {
      finalScore *= this.config.edgeCases.singleWordMultiplier;
      adjustments.push({
        type: 'single_word_penalty',
        multiplier: this.config.edgeCases.singleWordMultiplier,
        reason: 'Single-word names require higher confidence'
      });
    }

    // Very short names need higher bar
    if (normalized1.length < 4 || normalized2.length < 4) {
      finalScore *= this.config.edgeCases.shortNameMultiplier;
      adjustments.push({
        type: 'short_name_penalty',
        multiplier: this.config.edgeCases.shortNameMultiplier,
        reason: 'Short names (<4 chars) require higher confidence'
      });
    }

    // Significant length mismatch
    const lengthRatio = Math.min(normalized1.length, normalized2.length) / 
                        Math.max(normalized1.length, normalized2.length);
    
    if (lengthRatio < 0.5) {
      finalScore *= this.config.edgeCases.lengthMismatchMultiplier;
      adjustments.push({
        type: 'length_mismatch_penalty',
        multiplier: this.config.edgeCases.lengthMismatchMultiplier,
        reason: 'Length differs by >50%'
      });
    }

    // Numeric variance indicates branch/location variants
    if (numVariance?.hasVariance) {
      finalScore *= this.config.edgeCases.numericVarianceMultiplier;
      adjustments.push({
        type: 'numeric_variance_penalty',
        multiplier: this.config.edgeCases.numericVarianceMultiplier,
        reason: 'Numeric difference suggests branch/location variant',
        details: numVariance
      });
    }

    return { finalScore, adjustments };
  }

  /**
   * Explain confidence score in human-readable format
   */
  explainConfidence(score, adjustments) {
    const percentage = (score * 100).toFixed(1);
    let explanation = `${percentage}% confidence`;

    if (score >= 0.95) {
      explanation += ' - Extremely high match';
    } else if (score >= 0.85) {
      explanation += ' - Very strong match';
    } else if (score >= 0.75) {
      explanation += ' - Strong match';
    } else if (score >= 0.65) {
      explanation += ' - Good match';
    } else if (score >= 0.50) {
      explanation += ' - Moderate match';
    } else {
      explanation += ' - Weak match';
    }

    if (adjustments.length > 0) {
      explanation += ` (${adjustments.length} adjustment${adjustments.length > 1 ? 's' : ''} applied)`;
    }

    return explanation;
  }

  /**
   * Detect numeric variance (branch/location variants)
   */
  hasNumericVariance(customer1, customer2) {
    const num1 = (customer1.match(this.numberPattern) || []).map(n => n.toLowerCase());
    const num2 = (customer2.match(this.numberPattern) || []).map(n => n.toLowerCase());

    // If only one has numbers and the other doesn't
    if ((num1.length > 0 && num2.length === 0) || (num1.length === 0 && num2.length > 0)) {
      return {
        hasVariance: true,
        type: 'presence_mismatch',
        numbers: { name1: num1, name2: num2 }
      };
    }

    // If both have numbers but different values
    if (num1.length > 0 && num2.length > 0) {
      const hasDifference = num1.length !== num2.length || 
                           num1.some((n, i) => n !== num2[i]);
      
      if (hasDifference) {
        return {
          hasVariance: true,
          type: 'value_mismatch',
          numbers: { name1: num1, name2: num2 }
        };
      }
    }

    return { hasVariance: false };
  }

  /**
   * Normalize customer name for comparison
   */
  normalizeCustomerName(name) {
    if (!name) return '';

    let normalized = name.toLowerCase().trim();

    // Remove special characters but keep spaces
    normalized = normalized.replace(/[^\w\s]/g, ' ');

    // Collapse multiple spaces
    normalized = normalized.replace(/\s+/g, ' ');

    // Expand common abbreviations
    Object.keys(this.abbreviationMap).forEach(abbr => {
      const pattern = new RegExp(`\\b${abbr}\\b`, 'gi');
      normalized = normalized.replace(pattern, this.abbreviationMap[abbr]);
    });

    // Remove extra spaces after expansion
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Jaro-Winkler Similarity (using string-similarity approximation)
   */
  jaroWinklerSimilarity(str1, str2) {
    // string-similarity uses Dice coefficient, approximate Jaro-Winkler with prefix bonus
    const baseScore = stringSimilarity.compareTwoStrings(str1, str2);
    
    // Add prefix bonus (Winkler modification)
    let prefixLength = 0;
    const maxPrefix = Math.min(4, str1.length, str2.length);
    
    for (let i = 0; i < maxPrefix; i++) {
      if (str1[i] === str2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }

    const prefixBonus = prefixLength * 0.1 * (1 - baseScore);
    return Math.min(1.0, baseScore + prefixBonus);
  }

  /**
   * Enhanced Token Set Similarity (with position awareness)
   */
  tokenSetSimilarity(str1, str2) {
    const tokens1 = str1.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    const tokens2 = str2.toLowerCase().split(/\s+/).filter(t => t.length > 0);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Calculate Jaccard similarity
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    const jaccard = intersection.size / union.size;

    // Add position bonus for matching first tokens (brand names typically come first)
    let positionBonus = 0;
    const minLen = Math.min(tokens1.length, tokens2.length);
    
    for (let i = 0; i < Math.min(3, minLen); i++) {
      if (tokens1[i] === tokens2[i]) {
        // First word gets highest bonus, decreasing for subsequent words
        positionBonus += (3 - i) * 0.05;
      }
    }

    return Math.min(1.0, jaccard + positionBonus);
  }

  /**
   * Compare without business suffixes
   */
  compareWithoutBusinessSuffixes(customer1, customer2) {
    const without1 = this.removeBusinessSuffixes(customer1);
    const without2 = this.removeBusinessSuffixes(customer2);

    const normalized1 = this.normalizeCustomerName(without1);
    const normalized2 = this.normalizeCustomerName(without2);

    return stringSimilarity.compareTwoStrings(normalized1, normalized2);
  }

  /**
   * Remove business suffixes from name
   */
  removeBusinessSuffixes(name) {
    let cleaned = name.toLowerCase();

    this.businessSuffixes.forEach(suffix => {
      // Match suffix at end of string (with optional punctuation/spaces)
      const pattern = new RegExp(`\\b${suffix}\\b[\\s,.-]*$`, 'i');
      cleaned = cleaned.replace(pattern, '').trim();
    });

    return cleaned;
  }

  /**
   * N-Gram Prefix Similarity (compare first N words)
   */
  nGramPrefixSimilarity(str1, str2, n = 2) {
    const tokens1 = str1.split(/\s+/).slice(0, n);
    const tokens2 = str2.split(/\s+/).slice(0, n);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const prefix1 = tokens1.join(' ');
    const prefix2 = tokens2.join(' ');

    return stringSimilarity.compareTwoStrings(prefix1, prefix2);
  }

  /**
   * Core Brand Similarity (extract and compare brand essence)
   */
  coreBrandSimilarity(customer1, customer2) {
    const core1 = this.extractCoreBrand(customer1);
    const core2 = this.extractCoreBrand(customer2);

    if (!core1 || !core2) return 0;

    return stringSimilarity.compareTwoStrings(core1, core2);
  }

  /**
   * Extract core brand name (remove suffixes and stop words)
   */
  extractCoreBrand(name) {
    let cleaned = this.removeBusinessSuffixes(name);
    cleaned = this.normalizeCustomerName(cleaned);

    const tokens = cleaned.split(/\s+/);

    // Remove brand stop words from the end
    let coreTokens = [...tokens];
    while (coreTokens.length > 1 && this.brandStopWords.includes(coreTokens[coreTokens.length - 1])) {
      coreTokens.pop();
    }

    return coreTokens.join(' ');
  }

  /**
   * Enhanced Phonetic Similarity (Multi-algorithm approach)
   */
  phoneticSimilarity(customer1, customer2) {
    const normalized1 = this.normalizeCustomerName(customer1);
    const normalized2 = this.normalizeCustomerName(customer2);

    const tokens1 = normalized1.split(/\s+/).filter(t => t.length > 0);
    const tokens2 = normalized2.split(/\s+/).filter(t => t.length > 0);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Use both Metaphone and Soundex for better coverage
    const metaphoneScore = this.comparePhoneticTokens(tokens1, tokens2, (t) => metaphone.process(t));
    const soundexScore = this.comparePhoneticTokens(tokens1, tokens2, (t) => soundex.process(t));

    // Weighted combination (Metaphone is generally more accurate)
    return (metaphoneScore * 0.6 + soundexScore * 0.4);
  }

  /**
   * Compare tokens using phonetic algorithm
   */
  comparePhoneticTokens(tokens1, tokens2, algorithm) {
    try {
      const phonetic1 = tokens1.map(t => algorithm(t));
      const phonetic2 = tokens2.map(t => algorithm(t));

      let matches = 0;
      const checked = new Set();

      phonetic1.forEach(p1 => {
        phonetic2.forEach((p2, idx) => {
          if (!checked.has(idx) && p1 === p2) {
            matches++;
            checked.add(idx);
          }
        });
      });

      return matches / Math.max(phonetic1.length, phonetic2.length);
    } catch (error) {
      if (this.config.debugMode) {
        console.error('Phonetic comparison error:', error.message);
      }
      return 0;
    }
  }

  /**
   * Suggest merged customer name from group
   */
  suggestMergedName(customerGroup) {
    if (customerGroup.length === 0) return '';
    if (customerGroup.length === 1) return customerGroup[0];

    // Find the shortest name (often the cleanest)
    let shortest = customerGroup[0];
    customerGroup.forEach(customer => {
      if (customer.length < shortest.length) {
        shortest = customer;
      }
    });

    // Find the most complete name (most words)
    let mostComplete = customerGroup[0];
    let maxWords = mostComplete.split(/\s+/).length;
    
    customerGroup.forEach(customer => {
      const wordCount = customer.split(/\s+/).length;
      if (wordCount > maxWords) {
        mostComplete = customer;
        maxWords = wordCount;
      }
    });

    // Prefer the most complete unless it's significantly longer
    if (mostComplete.length <= shortest.length * 1.5) {
      return mostComplete;
    }

    return shortest;
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
    console.log(`\n🔍 Validating merge rules for ${division}...`);

    const existingRules = await this.getActiveMergeRules(division);
    console.log(`   Found ${existingRules.length} active rules to validate`);

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

    console.log(`   ✅ Valid: ${valid}`);
    console.log(`   ⚠️  Needs Update: ${needsUpdate}`);
    console.log(`   ❌ Orphaned: ${orphaned}\n`);

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
      console.error(`Error updating validation status for rule ${ruleId}:`, error.message);
    }
  }

  /**
   * Get all unique customers from database
   */
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

  /**
   * Get active merge rules
   */
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
   * Save AI suggestions to database (Batch optimized)
   */
  async saveSuggestions(division, suggestions) {
    if (suggestions.length === 0) return;

    try {
      // Try batch insert first (more efficient)
      const values = suggestions.map((s, idx) => {
        const base = idx * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      }).join(', ');

      const params = suggestions.flatMap(s => [
        division,
        s.mergedName,
        JSON.stringify(s.customers),
        s.confidence,
        'MULTI_ALGORITHM',
        JSON.stringify(s.matchDetails)
      ]);

      await this.pool.query(`
        INSERT INTO merge_rule_suggestions (
          division,
          suggested_merge_name,
          customer_group,
          confidence_score,
          matching_algorithm,
          match_details
        ) VALUES ${values}
        ON CONFLICT DO NOTHING
      `, params);

    } catch (error) {
      // Fallback to individual inserts if batch fails
      console.warn('Batch insert failed, using individual inserts:', error.message);
      
      for (const suggestion of suggestions) {
        try {
          await this.pool.query(`
            INSERT INTO merge_rule_suggestions (
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
        } catch (individualError) {
          console.error('Error saving individual suggestion:', individualError.message);
        }
      }
    }
  }

  /**
   * Run accuracy test with known test cases
   */
  async runAccuracyTest(testCases) {
    console.log('\n🧪 Running Accuracy Test...\n');

    const results = {
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0,
      details: []
    };

    for (const testCase of testCases) {
      const sim = this.calculateSimilarity(testCase.name1, testCase.name2);
      const predicted = sim.score >= this.config.minConfidenceThreshold;
      const actual = testCase.shouldMatch;

      let resultType = '';
      if (predicted && actual) {
        results.truePositives++;
        resultType = 'TP';
      } else if (predicted && !actual) {
        results.falsePositives++;
        resultType = 'FP';
      } else if (!predicted && !actual) {
        results.trueNegatives++;
        resultType = 'TN';
      } else if (!predicted && actual) {
        results.falseNegatives++;
        resultType = 'FN';
      }

      results.details.push({
        name1: testCase.name1,
        name2: testCase.name2,
        expected: actual,
        predicted,
        score: (sim.score * 100).toFixed(1) + '%',
        result: resultType
      });
    }

    // Calculate metrics
    const precision = results.truePositives / (results.truePositives + results.falsePositives) || 0;
    const recall = results.truePositives / (results.truePositives + results.falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const accuracy = (results.truePositives + results.trueNegatives) / testCases.length || 0;

    console.log('📊 Test Results:');
    console.log(`   Total Cases: ${testCases.length}`);
    console.log(`   True Positives: ${results.truePositives}`);
    console.log(`   False Positives: ${results.falsePositives}`);
    console.log(`   True Negatives: ${results.trueNegatives}`);
    console.log(`   False Negatives: ${results.falseNegatives}`);
    console.log(`\n   Precision: ${(precision * 100).toFixed(1)}%`);
    console.log(`   Recall: ${(recall * 100).toFixed(1)}%`);
    console.log(`   F1 Score: ${(f1Score * 100).toFixed(1)}%`);
    console.log(`   Accuracy: ${(accuracy * 100).toFixed(1)}%\n`);

    return {
      ...results,
      metrics: { precision, recall, f1Score, accuracy }
    };
  }

  /**
   * Clear performance cache
   */
  clearCache() {
    this.cache.clear();
    console.log('✅ Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      enabled: this.config.cacheEnabled
    };
  }
}

module.exports = new CustomerMergingAI();
