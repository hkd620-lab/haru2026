self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    await Promise.all(clients.map((client) => {
      const url = new URL(client.url);
      const isLanding = url.origin === self.location.origin
        && (url.pathname === '/' || url.pathname === '/index.html');

      return isLanding ? client.navigate(client.url) : undefined;
    }));
  })());
});
