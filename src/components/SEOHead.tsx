import { Helmet } from 'react-helmet-async';

interface BreadcrumbItem { name: string; path: string }

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
  type?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
  keywords?: string;
  breadcrumbs?: BreadcrumbItem[];
  noindex?: boolean;
}

const SITE_NAME = 'Cheapest Premiums';
const BASE_URL = 'https://cheapest-premiums.in';
const DEFAULT_IMAGE = 'https://storage.googleapis.com/gpt-engineer-file-uploads/qhRC6ydFEbT1CBH14wV2AO45vol1/social-images/social-1767178360219-1000099182.jpg';

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description = 'Buy cheapest premium subscriptions in India — Netflix, Spotify, YouTube, Canva, ChatGPT & more at lowest prices. Instant delivery.',
  canonicalPath = '/',
  ogImage = DEFAULT_IMAGE,
  type = 'website',
  jsonLd,
  keywords,
  breadcrumbs,
  noindex,
}) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Buy Premium Subscriptions at Lowest Price in India`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  const jsonLdArray: Record<string, any>[] = [];
  if (jsonLd) {
    if (Array.isArray(jsonLd)) jsonLdArray.push(...jsonLd);
    else jsonLdArray.push(jsonLd);
  }
  if (breadcrumbs && breadcrumbs.length > 0) {
    jsonLdArray.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: `${BASE_URL}${b.path}`,
      })),
    });
  }

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" href={canonicalUrl} hrefLang="en-IN" />
      <link rel="alternate" href={canonicalUrl} hrefLang="x-default" />

      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLdArray.map((data, idx) => (
        <script key={idx} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
};

export default SEOHead;
