import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:8081/');
  await page.goto('http://localhost:8081/#/');
  await page.goto('http://localhost:8000/accounts/login/?next=/oauth/authorize/%3Fredirect_uri%3Dhttp%253A%252F%252Flocalhost%253A8081%252F%26client_id%3DcBmD6D6F2YAmMWHNQZFPUr4OpaXVpW5w4Thod6Kj%26response_type%3Dcode%26state%3DmcMoX3FcyQ%26response_mode%3Dquery%26code_challenge%3D88xrbfdgpVchHmEb8q4mEQE6eRO0BnlDCYcWQxRGNpA%26code_challenge_method%3DS256');
  await page.getByPlaceholder('E-mail address').click();
  await page.getByPlaceholder('E-mail address').fill('dave@davemackey.net');
  await page.getByPlaceholder('Password').click();
  await page.getByPlaceholder('Password').fill('password');
  await page.getByRole('button', { name: 'Sign In ' }).click();
  await page.getByText('Test').click();
  await page.getByRole('link', { name: 'coronacases_001.nii.gz' }).click();
});
