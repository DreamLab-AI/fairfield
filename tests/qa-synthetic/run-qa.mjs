#!/usr/bin/env node
/**
 * Master QA Orchestrator
 * Coordinates synthetic data generation and comprehensive testing
 */

import { generateAndPublish } from './data-generator.mjs';
import { runQATests } from './qa-test-runner.mjs';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/qa-screenshots';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     NOSTR BBS - COMPREHENSIVE QA TEST SUITE                ║');
  console.log('║     Testing Calendar, Messages, Link Previews, and Roles   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  // Clean screenshot directory
  if (fs.existsSync(SCREENSHOT_DIR)) {
    fs.rmSync(SCREENSHOT_DIR, { recursive: true });
  }
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Phase 1: Generate and publish synthetic data
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 1: Generating Synthetic Data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let dataConfig;
  try {
    dataConfig = await generateAndPublish();
    fs.writeFileSync(
      `${SCREENSHOT_DIR}/test-config.json`,
      JSON.stringify(dataConfig, null, 2)
    );
    console.log('\n✓ Phase 1 Complete: Synthetic data generated\n');
  } catch (error) {
    console.error('⚠ Phase 1 Warning: Data generation encountered issues');
    console.error('  Error:', error.message);
    console.log('  Continuing with existing data...\n');
  }

  // Phase 2: Run comprehensive QA tests
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2: Running Comprehensive QA Tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let testReport;
  try {
    testReport = await runQATests();
    console.log('\n✓ Phase 2 Complete: QA tests finished\n');
  } catch (error) {
    console.error('✗ Phase 2 Error:', error.message);
    testReport = { summary: { passed: 0, failed: 1, total: 1 } };
  }

  // Final summary
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FINAL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Duration: ${duration} seconds`);
  console.log(`Tests Passed: ${testReport.summary.passed}`);
  console.log(`Tests Failed: ${testReport.summary.failed}`);
  console.log(`Total Tests: ${testReport.summary.total}`);
  console.log(`Pass Rate: ${Math.round((testReport.summary.passed / testReport.summary.total) * 100)}%`);
  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  console.log(`Report: ${SCREENSHOT_DIR}/qa-report.json`);

  // List screenshots
  const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nScreenshots captured: ${screenshots.length}`);

  return testReport;
}

// Run
main()
  .then(report => {
    process.exit(report.summary.failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
