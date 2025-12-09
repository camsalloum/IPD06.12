# HTML Export Responsive Design Rules

## Overview
This document outlines the comprehensive rules and best practices for creating responsive HTML exports that work seamlessly across all device types (Desktop, Tablet, Mobile) and orientations (Portrait, Landscape).

**Last Updated:** 2025-10-25
**Applies To:** All exported HTML charts, tables, and dashboards

---

## Table of Contents
1. [Core Principles](#core-principles)
2. [Chart Responsiveness](#chart-responsiveness)
3. [Table Responsiveness](#table-responsiveness)
4. [Mobile-Specific Optimizations](#mobile-specific-optimizations)
5. [Z-Index Hierarchy](#z-index-hierarchy)
6. [Offline Support](#offline-support)
7. [User Experience Enhancements](#user-experience-enhancements)

---

## Core Principles

### 1. Multi-Device Support
All HTML exports must support:
- **Desktop**: Full-width layouts, hover interactions
- **Tablet**: Responsive layouts, touch-friendly controls
- **Mobile**: Optimized for small screens, swipe gestures, proper zoom levels
- **Very Small Screens** (≤480px): Enhanced mobile optimizations

### 2. Viewport Configuration
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Rules:**
- ✅ Allow user zoom (DO NOT use `maximum-scale` or `user-scalable=no`)
- ✅ Set initial scale to 1.0
- ❌ Never prevent zoom - users need accessibility options

---

## Chart Responsiveness

### 1. Embedded Libraries (Offline Support)

**Rule: All chart libraries MUST be embedded inline**

```javascript
// Fetch and embed ECharts library
const getEChartsInlineScript = async () => {
  try {
    const response = await fetch('/echarts.min.js');
    const echartsContent = await response.text();
    return echartsContent;
  } catch (error) {
    console.error('Failed to fetch ECharts library:', error);
    return null; // Fallback to CDN
  }
};
```

**Benefits:**
- Charts work without internet connection
- No external dependencies
- Faster loading on slow connections

### 2. Chart Container Sizing

**Desktop/Tablet:**
```css
.full-screen-chart-container {
    width: 100%;
    height: auto;
    min-height: 60vh;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
}
```

**Mobile Portrait (≤768px):**
```css
@media (max-width: 768px) and (orientation: portrait) {
    .full-screen-chart-container {
        min-width: 150%; /* Initial zoom for better readability */
    }

    .full-screen-chart-container > div {
        min-width: 150%;
        width: 150%;
    }
}
```

**Very Small Portrait (≤480px):**
```css
@media (max-width: 480px) and (orientation: portrait) {
    .full-screen-chart-container {
        min-width: 200%; /* Even larger zoom for small screens */
    }

    .full-screen-chart-container > div {
        min-width: 200%;
        width: 200%;
    }
}
```

**Mobile Landscape (≤768px):**
```css
@media (max-width: 768px) and (orientation: landscape) {
    .full-screen-chart-container {
        min-height: 400px;
        height: auto;
        min-width: 150%;
    }

    .full-screen-chart-container > div {
        min-width: 800px; /* Force proper width for charts */
        width: 100%;
    }
}
```

### 3. Gauge Chart Sizing

**Desktop/Tablet:**
```css
.modern-gauge-container {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 15px;
}

.modern-gauge-card {
    width: 100%;
    max-width: 260px;
}

.gauge-container {
    height: 160px;
}
```

**Tablet (≤1400px):**
```css
@media (max-width: 1400px) {
    .modern-gauge-container {
        grid-template-columns: repeat(3, 1fr);
    }
}
```

**Small Tablet (≤992px):**
```css
@media (max-width: 992px) {
    .modern-gauge-container {
        grid-template-columns: repeat(2, 1fr);
    }
}
```

**Mobile (≤768px):**
```css
@media (max-width: 768px) {
    .modern-gauge-container {
        grid-template-columns: 1fr; /* Stack vertically */
    }

    .modern-gauge-card {
        max-width: 100%;
        min-width: 280px; /* Larger for readability */
    }

    .gauge-container {
        height: 200px; /* Taller gauges */
    }

    .gauge-label {
        font-size: 16px;
    }

    .gauge-value {
        font-size: 26px;
    }

    .gauge-percent {
        font-size: 20px;
    }
}
```

**Very Small (≤480px):**
```css
@media (max-width: 480px) and (orientation: portrait) {
    .modern-gauge-card {
        min-width: 320px; /* Even larger */
    }

    .gauge-container {
        height: 220px;
    }

    .gauge-value {
        font-size: 28px;
    }

    .gauge-percent {
        font-size: 22px;
    }
}
```

**Mobile Landscape:**
```css
@media (max-width: 768px) and (orientation: landscape) {
    .modern-margin-gauge-panel {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .modern-gauge-container {
        min-width: 800px;
        display: flex;
        flex-wrap: nowrap !important;
        gap: 20px;
    }
}
```

### 4. Landscape Orientation Hint

**CRITICAL: Show landscape hint only on first view (mobile portrait only)**

```css
.landscape-hint {
    display: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 50px 12px 20px;
    text-align: center;
    font-size: 14px;
    border-radius: 8px;
    margin: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: pulse 2s infinite;
    position: relative;
}

@media (max-width: 768px) and (orientation: portrait) {
    .full-screen-chart.active .landscape-hint:not(.dismissed) {
        display: block;
    }
}

.landscape-hint.dismissed {
    display: none !important;
}
```

**JavaScript for dismissal:**
```javascript
function dismissLandscapeHint() {
    try {
        localStorage.setItem('landscapeHintDismissed', 'true');
        var hints = document.querySelectorAll('.landscape-hint');
        hints.forEach(function(hint) {
            hint.classList.add('dismissed');
        });
    } catch(e) {
        // Fallback without localStorage
        var hints = document.querySelectorAll('.landscape-hint');
        hints.forEach(function(hint) {
            hint.classList.add('dismissed');
        });
    }
}

// Check on page load
(function() {
    try {
        if (localStorage.getItem('landscapeHintDismissed') === 'true') {
            document.addEventListener('DOMContentLoaded', function() {
                var hints = document.querySelectorAll('.landscape-hint');
                hints.forEach(function(hint) {
                    hint.classList.add('dismissed');
                });
            });
        }
    } catch(e) {
        // Continue without localStorage
    }
})();
```

---

## Table Responsiveness

### 1. Horizontal Scrolling

**RULE: All tables MUST support horizontal scrolling on mobile**

```css
.table-container {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch; /* Smooth iOS scrolling */
}
```

### 2. Sticky Headers (First 4 Rows)

**RULE: First 4 header rows MUST be sticky/frozen**

```css
/* Base styling for all header cells */
.financial-table thead tr th {
    position: sticky;
    z-index: 5; /* Lower than sticky first column */
    font-weight: bold;
}

/* Row 1 */
.financial-table thead tr:nth-child(1) th {
    top: 0px;
    z-index: 5;
}

/* Row 2 */
.financial-table thead tr:nth-child(2) th {
    top: 18px; /* Adjust based on row height */
    z-index: 5;
}

/* Row 3 */
.financial-table thead tr:nth-child(3) th {
    top: 36px;
    z-index: 5;
}

/* Row 4 */
.financial-table thead tr:nth-child(4) th {
    top: 54px;
    z-index: 5;
}
```

**Note:** Adjust `top` values based on actual row heights (18px, 24px, etc.)

### 3. Sticky First Column

**RULE: First column MUST be sticky/frozen on ALL devices**

```css
/* Sticky first column headers - HIGHEST z-index */
.financial-table thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 20 !important; /* Above everything */
    background-color: #fff;
    box-shadow: 2px 0 4px rgba(0,0,0,0.1);
}

/* Sticky first column body - MEDIUM z-index */
.financial-table tbody td:first-child {
    position: sticky;
    left: 0;
    z-index: 6 !important; /* Above regular cells, below headers */
    background-color: #fff;
    box-shadow: 2px 0 4px rgba(0,0,0,0.1);
}
```

### 4. Cell Min-Width (Prevent Compression)

**RULE: Set min-width to prevent figures from overlapping**

```css
/* Regular data cells */
.financial-table th,
.financial-table td {
    min-width: 80px;
    white-space: nowrap;
}

/* First column (labels) - wider */
.financial-table th:first-child,
.financial-table td:first-child {
    min-width: 150px;
    text-align: left;
    padding-left: 15px;
}

/* Customer names or long text - even wider */
.sales-by-customer-table th:first-child,
.sales-by-customer-table td:first-child {
    min-width: 200px;
    max-width: 300px;
    text-align: left;
    white-space: normal; /* Allow wrapping for long names */
    word-wrap: break-word;
}
```

---

## Z-Index Hierarchy

### CRITICAL RULE: Proper Z-Index Layering

**This is the MOST IMPORTANT rule to prevent visual glitches when scrolling**

```
┌─────────────────────────────────────────────┐
│ Sticky First Column Headers: z-index: 20   │ ← TOP (always visible)
├─────────────────────────────────────────────┤
│ Sticky First Column Body: z-index: 6       │ ← MIDDLE
├─────────────────────────────────────────────┤
│ Regular Sticky Headers: z-index: 5         │ ← BOTTOM (scroll behind column)
├─────────────────────────────────────────────┤
│ Regular Body Cells: z-index: 1 (default)   │ ← BASE
└─────────────────────────────────────────────┘
```

**Complete Implementation:**

```css
/* Regular header cells - scroll behind sticky column */
.table thead tr th {
    position: sticky;
    z-index: 5; /* CRITICAL: Lower than sticky column */
}

/* Sticky first column body */
.table tbody td:first-child {
    position: sticky;
    left: 0;
    z-index: 6 !important; /* Above regular headers */
    background-color: #fff;
}

/* Sticky first column headers */
.table thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 20 !important; /* Above everything */
    background-color: #fff;
}
```

**Why This Matters:**
- ❌ **Wrong:** Regular headers with z-index 10+ will appear OVER sticky column body (z-index 6)
- ✅ **Correct:** Regular headers with z-index 5 slide BEHIND sticky column body (z-index 6)

---

## Mobile-Specific Optimizations

### 1. Row Interactions

**Desktop/Tablet Only (≥769px):**
```css
@media (min-width: 769px) {
    .financial-table tbody tr:hover {
        background-color: #f0f7ff; /* Lighter hover */
    }
}
```

**Mobile Only (≤768px):**
```css
@media (max-width: 768px) {
    .financial-table tbody tr:active {
        background-color: #e3f2fd; /* Tap highlight */
    }
}
```

### 2. Row Alternation

**ALL Devices:**
```css
.financial-table tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}
```

### 3. Back Button

**Very Small Screens Only (≤480px):**
```css
@media (max-width: 480px) {
    .back-to-cards-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        border-radius: 50%;
        width: 56px;
        height: 56px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
}
```

**Desktop/Tablet:**
```css
.back-to-cards-btn {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid white;
    border-radius: 8px;
    padding: 10px 20px;
    cursor: pointer;
}
```

### 4. Content Overflow

**RULE: Allow both horizontal and vertical scrolling**

```css
.full-screen-content {
    flex: 1;
    padding: 20px;
    overflow: auto; /* Both directions */
    height: auto;
    min-height: calc(100vh - 80px);
    -webkit-overflow-scrolling: touch;
}
```

---

## Offline Support

### 1. Embedded Chart Libraries

**RULE: Never rely on CDN for production exports**

```javascript
// Embed library inline
${echartsLibrary ? `<script>
/* ECharts Library - Embedded for offline use */
${echartsLibrary}
</script>` : '<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>'}
```

**Steps:**
1. Copy library to `/public/echarts.min.js`
2. Fetch and embed in HTML generation
3. Include CDN fallback for development

### 2. Font Fallbacks

```css
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
```

---

## User Experience Enhancements

### 1. Smooth Scrolling (iOS)

```css
-webkit-overflow-scrolling: touch;
```

### 2. Visual Scroll Indicators

```css
.table-container::after {
    content: '← Swipe to see more →';
    display: block;
    text-align: center;
    color: #999;
    font-size: 12px;
    padding: 10px;
}

@media (min-width: 769px) {
    .table-container::after {
        display: none; /* Hide on desktop */
    }
}
```

### 3. Loading States

```javascript
console.log('✅ Chart library loaded');
console.log('✅ Data rendered');
```

---

## Responsive Breakpoints

### Standard Breakpoints

| Device Type | Max Width | Orientation | Use Case |
|-------------|-----------|-------------|----------|
| Desktop | N/A | Any | Full layout |
| Large Tablet | 1400px | Any | 3-column grids → 2-column |
| Tablet | 992px | Any | 2-column grids → 1-column |
| Mobile | 768px | Portrait | Stacked layouts, initial zoom |
| Mobile | 768px | Landscape | Horizontal scroll, proper sizing |
| Very Small | 480px | Portrait | Enhanced mobile, larger elements |

### Media Query Template

```css
/* Desktop - default styles */

/* Large Tablet */
@media (max-width: 1400px) {
    /* Reduce columns */
}

/* Tablet */
@media (max-width: 992px) {
    /* Stack layouts */
}

/* Mobile Portrait */
@media (max-width: 768px) and (orientation: portrait) {
    /* Zoom charts, stack gauges */
}

/* Mobile Landscape */
@media (max-width: 768px) and (orientation: landscape) {
    /* Horizontal scroll, proper widths */
}

/* Very Small Portrait */
@media (max-width: 480px) and (orientation: portrait) {
    /* Larger text, fixed buttons */
}
```

---

## Testing Checklist

### Desktop Testing
- [ ] All charts render correctly
- [ ] Tables scroll horizontally
- [ ] Hover effects work
- [ ] Sticky headers/columns work
- [ ] No horizontal page scroll

### Tablet Testing
- [ ] Charts resize properly
- [ ] Touch interactions work
- [ ] Orientation change handled
- [ ] No content cutoff

### Mobile Portrait Testing
- [ ] Charts open with proper zoom (150-200%)
- [ ] Landscape hint appears (first time only)
- [ ] Gauges display large and readable
- [ ] Tables scroll horizontally
- [ ] Sticky column stays on top
- [ ] No header overlap on scroll
- [ ] Figures not compressed

### Mobile Landscape Testing
- [ ] Charts maintain 800px min-width
- [ ] Gauges scroll horizontally
- [ ] Landscape hint disappears
- [ ] Proper chart proportions
- [ ] Tables fully accessible

### Offline Testing
- [ ] Charts work without internet
- [ ] No CDN errors
- [ ] All libraries embedded
- [ ] Fast loading

---

## Common Issues and Solutions

### Issue 1: Header Cells Overlap Sticky Column

**Problem:** Regular headers appear over sticky first column when scrolling right

**Solution:**
```css
/* Lower z-index for regular headers */
.table thead tr th {
    z-index: 5; /* Not 10+ */
}

/* Higher z-index for sticky column */
.table thead th:first-child {
    z-index: 20;
}

.table tbody td:first-child {
    z-index: 6;
}
```

### Issue 2: Charts Too Small on Mobile

**Problem:** Charts appear compressed/tiny on first open

**Solution:**
```css
@media (max-width: 768px) and (orientation: portrait) {
    .chart-container {
        min-width: 150%; /* Force larger initial view */
    }
}
```

### Issue 3: Landscape Hint Shows Every Time

**Problem:** Hint appears on every chart open

**Solution:** Use localStorage to remember dismissal (see JavaScript section above)

### Issue 4: Table Figures Overlapping

**Problem:** Numbers squeeze together and become unreadable

**Solution:**
```css
.table th,
.table td {
    min-width: 80px; /* Prevent compression */
    white-space: nowrap;
}
```

### Issue 5: Charts Don't Work Offline

**Problem:** Charts show blank when no internet

**Solution:** Embed ECharts library inline (see Offline Support section)

---

## Implementation Priority

### Phase 1: Critical (Must Have)
1. ✅ Embedded chart libraries (offline support)
2. ✅ Proper z-index hierarchy
3. ✅ Sticky headers (4 rows)
4. ✅ Sticky first column
5. ✅ Table horizontal scroll
6. ✅ Cell min-width

### Phase 2: Important (Should Have)
1. ✅ Chart initial zoom (mobile)
2. ✅ Gauge responsive sizing
3. ✅ Landscape orientation hint
4. ✅ Mobile tap highlights
5. ✅ Proper overflow handling

### Phase 3: Enhancement (Nice to Have)
1. ✅ Smooth scrolling (iOS)
2. ✅ Visual scroll indicators
3. ✅ Hover effects (desktop)
4. ✅ Fixed back button (mobile)
5. ✅ Loading states

---

## Version History

### Version 2.0 - 2025-10-25
- ✅ Fixed z-index hierarchy for all tables
- ✅ Added landscape hint with localStorage
- ✅ Implemented proper chart zoom for mobile
- ✅ Fixed gauge sizing on mobile devices
- ✅ Added 4th sticky header row to all tables
- ✅ Fixed compressed figures in tables
- ✅ Implemented offline chart support

### Version 1.0 - Initial
- Basic responsive layout
- Table horizontal scroll
- Sticky first column
- Basic mobile support

---

## Related Files

- **Main Implementation:** `src/components/dashboard/MultiChartHTMLExport.js`
- **Chart Library:** `public/echarts.min.js`
- **Test Environments:** Desktop, Tablet, Mobile (Portrait/Landscape)

---

## Contact & Support

For questions or issues with responsive HTML exports, refer to this document first. All rules here are tested and production-ready.

**Remember:** Always test on real devices, not just browser dev tools!

---

**END OF DOCUMENT**
