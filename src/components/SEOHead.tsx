import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogImage?: string;
  type?: string;
  jsonLd?: Record<string, any>;
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
}) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Buy Premium Subscriptions at Lowest Price`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SEOHead;
