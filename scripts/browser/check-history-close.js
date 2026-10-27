async (page) => {
  await page.goto('http://127.0.0.1:5000/admin/overview');
  await page.locator('.group-card').first().getByRole('button', { name: 'View submissions', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const requested = new Promise(resolve => { started = resolve; });
  const pattern = '**/api/v2/groups/*/submissions?**';
  await page.route(pattern, async route => {
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await dialog.locator('.group-reviewer-filter').nth(1).click();
    await requested;
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    const received = page.waitForResponse(response => response.url().includes('/groups/') && response.url().includes('/submissions?'));
    release();
    await received;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await page.getByRole('dialog').count()) throw new Error('Group history reopened after dismissal');
  } finally { release(); await page.unroute(pattern); }
}
