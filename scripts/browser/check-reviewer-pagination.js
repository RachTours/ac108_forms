async (page) => {
  await page.goto('http://127.0.0.1:5000/admin/overview');
  const review = (id, name) => ({ id, submittedAt: '2026-10-27T00:00:00Z', reviewedAt: null, target: { displayName: name }, form: { title: 'Synthetic latency fixture' }, formVersion: { version: 1 } });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const requested = new Promise(resolve => { started = resolve; });
  const pattern = '**/api/v2/submissions**';
  await page.route(pattern, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/archived')) {
      await route.fulfill({ json: { data: [review('archived-only', 'Archived only')], nextCursor: null } });
    } else if (url.searchParams.has('cursor')) {
      started();
      await gate;
      await route.fulfill({ json: { data: [review('active-late', 'Active late')], nextCursor: 'bad-active-cursor' } });
    } else {
      await route.fulfill({ json: { data: [review('active-first', 'Active first')], nextCursor: 'first-cursor' } });
    }
  });
  try {
    await page.getByRole('button', { name: 'View reviews by Amina', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Load more reviews', exact: true }).click();
    await requested;
    await dialog.getByRole('button', { name: 'Archived', exact: true }).click();
    await dialog.getByText('Archived only', { exact: true }).waitFor();
    const received = page.waitForResponse(response => new URL(response.url()).searchParams.has('cursor'));
    release();
    await received;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (await dialog.getByText('Active late', { exact: true }).count()) throw new Error('Active pagination result contaminated archived view');
    if (await dialog.getByRole('button', { name: 'Load more reviews', exact: true }).count()) throw new Error('Active cursor contaminated archived view');
  } finally { release(); await page.unroute(pattern); }
}
