async (page) => {
  await page.goto('http://127.0.0.1:5000/admin/overview');
  const accounts = await page.evaluate(async () => {
    const headers = { 'X-Reviewroom-Audience': 'admin' };
    const session = await (await fetch('/api/v2/auth/session', { headers })).json();
    if (session.organizationName !== 'Group workflow verification') throw new Error('Expected isolated workflow fixture');
    const members = await (await fetch('/api/v2/members', { headers })).json();
    return { admin: session.user.email, reviewer: members.data.find(member => member.user.displayName === 'Amina').user.email };
  });
  for (const audience of ['admin', 'reviewer']) {
    const context = await page.context().browser().newContext();
    try {
      const tab = await context.newPage();
      await tab.goto(`http://127.0.0.1:5000/${audience}/login`);
      await tab.locator('input[name="email"]').fill(accounts[audience]);
      const password = tab.locator('input[name="password"]');
      await password.fill('SyntheticBrowserOnly27!');
      await tab.getByRole('button', { name: 'Show password', exact: true }).click();
      if (await password.getAttribute('type') !== 'text') throw new Error(`${audience}: password visibility control failed`);
      await tab.getByRole('button', { name: 'Hide password', exact: true }).click();
      if (await password.getAttribute('type') !== 'password') throw new Error(`${audience}: password hide failed`);
      await tab.getByRole('button', { name: 'Sign in securely', exact: true }).click();
      await tab.waitForURL(url => url.pathname.startsWith(`/${audience}/`) && !url.pathname.endsWith('/login'));
      if (new URL(tab.url()).searchParams.has('password')) throw new Error('Password leaked in hydrated sign-in URL');
      const authCookies = (await context.cookies()).filter(cookie => cookie.name.startsWith('reviewroom-'));
      if (!authCookies.length || authCookies.some(cookie => !cookie.httpOnly)) throw new Error('Expected HttpOnly sign-in cookie');
    } finally { await context.close(); }
  }
}
