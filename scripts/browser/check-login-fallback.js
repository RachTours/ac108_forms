async (page) => {
  await page.goto('http://127.0.0.1:5000/admin/overview');
  const context = await page.context().browser().newContext({ javaScriptEnabled: false });
  try {
    for (const audience of ['admin', 'reviewer']) {
      const tab = await context.newPage();
      await tab.goto(`http://127.0.0.1:5000/${audience}/login`);
      await tab.locator('input[name="email"]').fill('synthetic-fallback@reviewroom.test');
      await tab.locator('input[name="password"]').fill('SyntheticFallbackOnly123!');
      let submitted;
      await tab.route(`**/${audience}/login**`, async route => {
        submitted = { method: route.request().method(), url: route.request().url() };
        await route.fulfill({ contentType: 'text/html', body: '<p>Safe synthetic fallback capture</p>' });
      });
      await Promise.all([tab.waitForURL(url => url.pathname === `/${audience}/login`, { waitUntil: 'load' }), tab.locator('button[type="submit"]').click()]);
      await tab.waitForLoadState('load');
      if (!submitted || submitted.method !== 'POST' || new URL(submitted.url).search) throw new Error(`${audience}: native submission must use POST without credentials in URL`);
      console.log(`PASS: ${audience} native fallback uses POST without URL credentials`);
      await tab.close();
    }
    const reset = await context.newPage();
    await reset.goto('http://127.0.0.1:5000/reset-password');
    await reset.locator('input[name="email"]').fill('synthetic-fallback@reviewroom.test');
    await reset.locator('input[name="token"]').fill('a'.repeat(48));
    await reset.locator('input[name="password"]').fill('SyntheticFallbackOnly123!');
    let resetRequest;
    await reset.route('**/reset-password**', async route => {
      resetRequest = { method: route.request().method(), url: route.request().url() };
      await route.fulfill({ contentType: 'text/html', body: '<p>Safe synthetic reset capture</p>' });
    });
    await reset.locator('button[type="submit"]').click();
    await reset.waitForLoadState('load');
    if (!resetRequest || resetRequest.method !== 'POST' || new URL(resetRequest.url).search) throw new Error('reset: native submission must use POST without URL secrets');
    // The signed-in parent page belongs to the isolated workflow fixture.
    const invitationUrl = await page.evaluate(async () => {
      const session = await (await fetch('/api/v2/auth/session', { headers: { 'X-Reviewroom-Audience': 'admin' } })).json();
      if (session.organizationName !== 'Group workflow verification') throw new Error('Refusing to create invitation outside isolated workflow fixture');
      const response = await fetch('/api/v2/members/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Reviewroom-Audience': 'admin', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify({ role: 'REVIEWER' }) });
      if (response.status !== 201) throw new Error('Failed to create isolated invitation fixture');
      return (await response.json()).data.inviteUrl;
    });
    const invitation = await context.newPage();
    await invitation.goto(invitationUrl);
    await invitation.locator('input[name="displayName"]').fill('Synthetic fallback');
    await invitation.locator('input[name="email"]').fill('synthetic-invite@reviewroom.test');
    await invitation.locator('input[name="password"]').fill('SyntheticFallbackOnly123!');
    await invitation.locator('input[name="confirmPassword"]').fill('SyntheticFallbackOnly123!');
    let invitationRequest;
    await invitation.route('**/invite/**', async route => {
      invitationRequest = { method: route.request().method(), url: route.request().url() };
      await route.fulfill({ contentType: 'text/html', body: '<p>Safe synthetic invitation capture</p>' });
    });
    await invitation.locator('button.button-primary').click();
    await invitation.waitForLoadState('load');
    if (!invitationRequest || invitationRequest.method !== 'POST' || new URL(invitationRequest.url).search) throw new Error('invitation: native submission must use POST without URL credentials');
  } finally { await context.close(); }
}
