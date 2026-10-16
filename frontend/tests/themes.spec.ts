import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('test-results/themes');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const DEMO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwiZW1haWwiOiJzdHVkZW50QGFkYXB0aXZlbGVhcm4uYWkiLCJyb2xlIjoic3R1ZGVudCIsImV4cCI6MTc5Mjc4MDA4Nn0.qSkyUgbbh3m08lua64089gG66c0-ZmRLHbNGccPo8Gw';

async function setMode(page: Page, mode: 'light' | 'dark') {
  await page.evaluate((themeMode) => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, mode);
  await page.waitForTimeout(200);
}

async function verifyNavBgDiffers(page: Page) {
  await setMode(page, 'light');
  const lightBg = await page.locator('header').evaluate((el) => window.getComputedStyle(el).backgroundColor);
  
  await setMode(page, 'dark');
  const darkBg = await page.locator('header').evaluate((el) => window.getComputedStyle(el).backgroundColor);

  expect(lightBg).not.toBe(darkBg);
  return { lightBg, darkBg };
}

async function captureAndAudit(page: Page, name: string) {
  // Light theme
  await setMode(page, 'light');
  await page.waitForTimeout(300);
  const lightScreenshotPath = path.join(SCREENSHOT_DIR, `${name}-light.png`);
  await page.screenshot({ path: lightScreenshotPath, fullPage: true });

  const lightAxe = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  expect(lightAxe.violations, `Color contrast violations in ${name} (light mode)`).toEqual([]);

  // Dark theme
  await setMode(page, 'dark');
  await page.waitForTimeout(300);
  const darkScreenshotPath = path.join(SCREENSHOT_DIR, `${name}-dark.png`);
  await page.screenshot({ path: darkScreenshotPath, fullPage: true });

  const darkAxe = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  expect(darkAxe.violations, `Color contrast violations in ${name} (dark mode)`).toEqual([]);
}

test.describe('Theme & Accessibility Verification', () => {
  test('Login Page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('text=Welcome to AdaptiveLearn');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'login');
  });

  test('Register Page', async ({ page }) => {
    await page.goto('/register');
    await page.waitForSelector('text=Create Student Account');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'register');
  });

  test('My Courses Page', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/courses');
    await page.waitForSelector('text=Course Library & Prerequisite Map');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'my-courses');
  });

  test('Course Detail & Practice Modal', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/courses');
    await page.waitForSelector('text=Practice Problems');
    await verifyNavBgDiffers(page);
    // Open practice problems modal
    await page.locator('text=Practice Problems').first().click();
    await page.waitForSelector('text=Suggested Practice Problems');
    await captureAndAudit(page, 'course-detail-practice');
  });

  test('Upload Page', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/upload');
    await page.waitForSelector('text=Multimodal Knowledge Ingestion');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'upload');
  });

  test('Tutor with Answer & Open Citation', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/tutor');
    await page.waitForSelector('text=What would you like to explore?');
    await verifyNavBgDiffers(page);
    // Click starter question
    const starterBtn = page.locator('text=Can you explain').first();
    if (await starterBtn.isVisible()) {
      await starterBtn.click();
      await page.waitForTimeout(2000);
    }
    // Check if citation exists or open quick revise
    const citationBtn = page.locator('button:has-text(".pdf"), button:has-text(".pptx")').first();
    if (await citationBtn.isVisible()) {
      await citationBtn.click();
      await page.waitForSelector('text=Verified Citation Grounding');
    }
    await captureAndAudit(page, 'tutor-active');
  });

  test('Quiz Builder Page', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/quiz');
    await page.waitForSelector('text=Adaptive Practice & Diagnostic Drills');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'quiz-builder');
  });

  test('Quiz In Progress', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/quiz');
    await page.waitForSelector('text=Begin Adaptive Assessment');
    await page.click('text=Begin Adaptive Assessment');
    await page.waitForSelector('text=Question 1 of');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'quiz-in-progress');
  });

  test('Quiz Results & Summary', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/assessment/1');
    await page.waitForSelector('text=Assessment Results Summary', { timeout: 10000 });
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'quiz-results');
  });

  test('My Understanding Page', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/understanding');
    await page.waitForSelector('text=My Understanding');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'my-understanding');
  });

  test('Revise Flashcards Modal', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/tutor');
    await page.waitForSelector('text=Quick Revise');
    await verifyNavBgDiffers(page);
    await page.click('button:has-text("Quick Revise")');
    await page.waitForSelector('text=Quick Revise Flashcards');
    await captureAndAudit(page, 'revise-flashcards');
  });

  test('System Evaluation (Analytics)', async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('adaptivelearn_token', t), DEMO_TOKEN);
    await page.goto('/analytics');
    await page.waitForSelector('text=Learning Analytics & Mastery Tracing');
    await verifyNavBgDiffers(page);
    await captureAndAudit(page, 'system-evaluation');
  });
});
