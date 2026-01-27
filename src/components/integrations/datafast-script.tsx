import Script from 'next/script';

export function DataFastScript() {
  const websiteId = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID;
  const domain = process.env.NEXT_PUBLIC_DATAFAST_DOMAIN;

  if (!websiteId) {
    return null;
  }

  return (
    <Script
      defer
      src="https://datafa.st/js/script.js"
      data-website-id={websiteId}
      data-domain={domain}
    />
  );
}
