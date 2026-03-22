'use strict';
/**
 * migrate-phase-1-5.js — Phase 1.5 database migration
 *
 * Run once via: docker compose run --rm api node src/migrate-phase-1-5.js
 *
 * Adds:
 *   - layers.parent_slug  (sub-layer → parent lookup)
 *   - layers.is_composite (hides composite parents from the sidebar)
 *
 * Inserts all Phase 1.5 sub-layer rows for:
 *   EJScreen (10 sub-layers), HUD CHAS (3), Eviction Lab (7), SVI (5)
 *
 * Marks the four composite parent layers as is_composite = true.
 *
 * Safe to re-run — all inserts use ON CONFLICT (slug) DO NOTHING.
 */
require('dotenv').config();
const db = require('./db');

async function run() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Add columns if they don't exist ──────────────────────────────────
    await client.query(`
      ALTER TABLE layers
        ADD COLUMN IF NOT EXISTS parent_slug  TEXT REFERENCES layers(slug),
        ADD COLUMN IF NOT EXISTS is_composite BOOLEAN DEFAULT false
    `);
    console.log('[migrate] Added parent_slug, is_composite columns');

    // ── 2. Mark composite parents ────────────────────────────────────────────
    await client.query(`
      UPDATE layers
         SET is_composite = true
       WHERE slug IN ('ejscreen', 'svi', 'hud-chas', 'eviction-lab')
    `);
    console.log('[migrate] Marked 4 composite parent layers');

    // ── 3. Insert sub-layers ─────────────────────────────────────────────────
    // ejscreen sub-layers
    const ejScreenLayers = [
      {
        slug: 'ejscreen-ej-score',
        name: 'Environmental Justice Score',
        description: 'EPA EJScreen 2-factor EJ Index — combines environmental burden (pollution, hazards) with demographic vulnerability (low-income %). Higher percentile = greater compounding of environmental and economic disadvantage. Block-group level.',
        color: '#006d2c',
      },
      {
        slug: 'ejscreen-minority',
        name: 'People of Color',
        description: 'Percentage of block-group population that identifies as a racial or ethnic minority (non-white or Hispanic/Latino). Source: EPA EJScreen 2024 (PEOPCOLORPCT).',
        color: '#6a0dad',
      },
      {
        slug: 'ejscreen-under5',
        name: 'Children Under 5',
        description: 'Percentage of block-group population under 5 years old. Young children face disproportionate health risks from environmental exposures. Source: EPA EJScreen 2024.',
        color: '#e65c00',
      },
      {
        slug: 'ejscreen-over64',
        name: 'Adults Over 64',
        description: 'Percentage of block-group population over 64 years old. Older adults face increased vulnerability during extreme weather and environmental events. Source: EPA EJScreen 2024.',
        color: '#c05600',
      },
      {
        slug: 'ejscreen-low-income',
        name: 'Low Income Population',
        description: 'Percentage of block-group population below 200% of the federal poverty level. Income is a primary modifier of environmental health risk. Source: EPA EJScreen 2024.',
        color: '#a63603',
      },
      {
        slug: 'ejscreen-less-hs',
        name: 'Education Below High School',
        description: 'Percentage of adults (25+) without a high school diploma or equivalent. Educational attainment correlates with lower health literacy and reduced access to resources. Source: EPA EJScreen 2024.',
        color: '#c0392b',
      },
      {
        slug: 'ejscreen-ozone',
        name: 'Ozone Burden',
        description: 'National percentile for ozone concentration (ppb). Ozone causes respiratory harm, particularly for children and people with asthma. Source: EPA EJScreen 2024.',
        color: '#2166ac',
      },
      {
        slug: 'ejscreen-pm25',
        name: 'PM2.5 Fine Particulates',
        description: 'National percentile for fine particulate matter (PM2.5) concentration. PM2.5 penetrates deep into lungs and is associated with heart and lung disease. Source: EPA EJScreen 2024.',
        color: '#1a6ea8',
      },
      {
        slug: 'ejscreen-traffic',
        name: 'Traffic Proximity',
        description: 'National percentile for proximity and volume of traffic on major roads. Traffic emissions are a primary source of local air pollutants in urban areas. Source: EPA EJScreen 2024.',
        color: '#b8860b',
      },
      {
        slug: 'ejscreen-rmp',
        name: 'Industrial Hazard Facilities',
        description: 'National percentile for proximity to Risk Management Plan (RMP) facilities — industrial sites that handle hazardous chemicals and are required to file emergency plans with the EPA. Source: EPA EJScreen 2024.',
        color: '#8b1a1a',
      },
    ];

    for (const layer of ejScreenLayers) {
      await client.query(`
        INSERT INTO layers
          (slug, name, description, source, source_url, trust_rating, claim_type,
           update_frequency, aggregation_level, geometry_type, color,
           data_vintage, parent_slug, is_composite)
        VALUES ($1,$2,$3,'EPA EJScreen',
          'https://www.epa.gov/ejscreen',
          5, 'CORRELATION', 'annual', 'block_group', 'polygon',
          $4, '2024', 'ejscreen', false)
        ON CONFLICT (slug) DO NOTHING
      `, [layer.slug, layer.name, layer.description, layer.color]);
    }
    console.log(`[migrate] Inserted ${ejScreenLayers.length} EJScreen sub-layers`);

    // hud-chas sub-layers
    const chasLayers = [
      {
        slug: 'chas-cost-burdened',
        name: 'Cost-Burdened Households',
        description: 'Percentage of all households (owner and renter) paying 30% or more of income on housing costs. The 30% threshold is the federal standard for "cost burdened." Source: HUD CHAS 2018–2022.',
        color: '#2171b5',
      },
      {
        slug: 'chas-severe-burden',
        name: 'Severely Cost Burdened',
        description: 'Percentage of all households paying 50% or more of income on housing — the "severely cost burdened" threshold. These households have very little income left for food, healthcare, or emergencies. Source: HUD CHAS 2018–2022.',
        color: '#084594',
      },
      {
        slug: 'chas-renter-burden',
        name: 'Renter Cost Burden',
        description: 'Percentage of renter-occupied households paying 30% or more of income on rent. Renters face disproportionate displacement risk when rent burden is high. Source: HUD CHAS 2018–2022.',
        color: '#4292c6',
      },
    ];

    for (const layer of chasLayers) {
      await client.query(`
        INSERT INTO layers
          (slug, name, description, source, source_url, trust_rating, claim_type,
           update_frequency, aggregation_level, geometry_type, color,
           data_vintage, parent_slug, is_composite)
        VALUES ($1,$2,$3,'HUD CHAS',
          'https://www.huduser.gov/portal/datasets/cp.html',
          4, 'DOCUMENTED', 'annual', 'tract', 'polygon',
          $4, '2018–2022', 'hud-chas', false)
        ON CONFLICT (slug) DO NOTHING
      `, [layer.slug, layer.name, layer.description, layer.color]);
    }
    console.log(`[migrate] Inserted ${chasLayers.length} HUD CHAS sub-layers`);

    // eviction-lab sub-layers
    const evictionLayers = [
      {
        slug: 'eviction-filing-rate',
        name: 'Eviction Filing Rate',
        description: 'Rate of eviction filings per renter-occupied household. Filings include cases that were dismissed or settled — higher than completed evictions. Attribution required: Data from The Eviction Lab at Princeton University. License: CC BY 4.0.',
        color: '#cb181d',
        prop: 'eviction_filing_rate',
      },
      {
        slug: 'eviction-rate',
        name: 'Completed Eviction Rate',
        description: 'Rate of completed (court-ordered) evictions per renter-occupied household. Source: Eviction Lab, Princeton University. Attribution required (CC BY 4.0). 2018 data — historical snapshot.',
        color: '#ef3b2c',
        prop: 'eviction_rate',
      },
      {
        slug: 'eviction-rent-burden',
        name: 'Rent Burden',
        description: 'Median gross rent as a percentage of median household income. High rent burden is a leading indicator of eviction risk. Source: Eviction Lab (Census-derived). 2018 data — historical snapshot.',
        color: '#fc4e2a',
        prop: 'rent_burden',
      },
      {
        slug: 'eviction-renter-pct',
        name: 'Renter-Occupied Households',
        description: 'Percentage of occupied households that are renter-occupied. Tracts with high renter rates have more residents exposed to eviction risk. Source: Eviction Lab (Census-derived). 2018 data — historical snapshot.',
        color: '#fd8d3c',
        prop: 'pct_renter_occupied',
      },
      {
        slug: 'eviction-poverty',
        name: 'Poverty Rate',
        description: 'Percentage of population living below the federal poverty line. Poverty rate strongly correlates with eviction risk and housing instability. Source: Eviction Lab (Census-derived). 2018 data — historical snapshot.',
        color: '#e6550d',
        prop: 'pct_poverty',
      },
      {
        slug: 'eviction-median-rent',
        name: 'Median Gross Rent',
        description: 'Median gross monthly rent in dollars. This is a dollar-amount layer (not a percentile). Note: 2018 historical snapshot — not current market conditions. Source: Eviction Lab (Census-derived).',
        color: '#fdae6b',
        prop: 'median_gross_rent',
      },
      {
        slug: 'eviction-median-income',
        name: 'Median Household Income',
        description: 'Median annual household income in dollars. This is a dollar-amount layer (not a percentile). Note: 2018 historical snapshot — not current conditions. Source: Eviction Lab (Census-derived).',
        color: '#fdd0a2',
        prop: 'median_household_income',
      },
    ];

    for (const layer of evictionLayers) {
      await client.query(`
        INSERT INTO layers
          (slug, name, description, source, source_url, trust_rating, claim_type,
           update_frequency, aggregation_level, geometry_type, color,
           data_vintage, parent_slug, is_composite)
        VALUES ($1,$2,$3,'Eviction Lab (Princeton University)',
          'https://evictionlab.org/get-the-data/',
          4, 'DOCUMENTED', 'annual', 'tract', 'polygon',
          $4, '2018', 'eviction-lab', false)
        ON CONFLICT (slug) DO NOTHING
      `, [layer.slug, layer.name, layer.description, layer.color]);
    }
    console.log(`[migrate] Inserted ${evictionLayers.length} Eviction Lab sub-layers`);

    // SVI sub-layers
    const sviLayers = [
      {
        slug: 'svi-overall',
        name: 'Social Vulnerability: Overall',
        description: 'CDC SVI overall percentile ranking (0–1, higher = more vulnerable). Composite of all 4 themes: socioeconomic status, household characteristics, race/language, and housing/transport. Source: CDC SVI 2022.',
        color: '#bd0026',
      },
      {
        slug: 'svi-socioeconomic',
        name: 'SVI: Socioeconomic Status',
        description: 'CDC SVI Theme 1 percentile — measures poverty rate, unemployment, income, and lack of high school diploma. Source: CDC SVI 2022.',
        color: '#f03b20',
      },
      {
        slug: 'svi-household',
        name: 'SVI: Household Vulnerability',
        description: 'CDC SVI Theme 2 percentile — measures age 65+, age 17 and under, disability status, and single-parent households. Source: CDC SVI 2022.',
        color: '#fd8d3c',
      },
      {
        slug: 'svi-minority-language',
        name: 'SVI: Race & Language',
        description: 'CDC SVI Theme 3 percentile — measures racial and ethnic minority population and households with limited English proficiency. Source: CDC SVI 2022.',
        color: '#6a0dad',
      },
      {
        slug: 'svi-housing-transit',
        name: 'SVI: Housing & Transport',
        description: 'CDC SVI Theme 4 percentile — measures multi-unit structures, mobile homes, crowding, no-vehicle households, and group quarters population. Source: CDC SVI 2022.',
        color: '#2171b5',
      },
    ];

    for (const layer of sviLayers) {
      await client.query(`
        INSERT INTO layers
          (slug, name, description, source, source_url, trust_rating, claim_type,
           update_frequency, aggregation_level, geometry_type, color,
           data_vintage, parent_slug, is_composite)
        VALUES ($1,$2,$3,'CDC SVI',
          'https://www.atsdr.cdc.gov/placeandhealth/svi/',
          5, 'CORRELATION', 'biennial', 'tract', 'polygon',
          $4, '2022', 'svi', false)
        ON CONFLICT (slug) DO NOTHING
      `, [layer.slug, layer.name, layer.description, layer.color]);
    }
    console.log(`[migrate] Inserted ${sviLayers.length} SVI sub-layers`);

    await client.query('COMMIT');
    console.log('[migrate] Phase 1.5 migration complete.');
    console.log('[migrate] Total new sub-layers: 25');
    console.log('[migrate] Composite parents hidden from sidebar: ejscreen, svi, hud-chas, eviction-lab');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
}

run();
