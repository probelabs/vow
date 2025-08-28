// Cloudflare Worker for routing probelabs.com/vow/* to Vow Pages site
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check if this is a request to probelabs.com/vow or /vow/*
    if (url.hostname === 'probelabs.com' && url.pathname.startsWith('/vow')) {
      // Handle /vow without trailing slash by redirecting to /vow/
      if (url.pathname === '/vow') {
        return Response.redirect(url.origin + '/vow/', 301);
      }
      
      // Remove /vow from the path and proxy to the Pages site
      const newPath = url.pathname.replace('/vow', '') || '/';
      const pagesUrl = `https://cf5fe899.vow-site.pages.dev${newPath}${url.search}`;
      
      // Fetch from the Pages deployment
      const response = await fetch(pagesUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });
      
      // Create new response with same content but updated headers
      const newResponse = new Response(response.body, response);
      
      // Update any absolute links in HTML content to include /vow prefix
      if (response.headers.get('content-type')?.includes('text/html')) {
        const html = await response.text();
        const updatedHtml = html
          .replace(/href="\//g, 'href="/vow/')
          .replace(/src="\//g, 'src="/vow/')
          .replace(/url\(\//g, 'url(/vow/');
        return new Response(updatedHtml, {
          status: response.status,
          headers: response.headers
        });
      }
      
      return newResponse;
    }
    
    // For any other requests, pass through
    return fetch(request);
  },
};