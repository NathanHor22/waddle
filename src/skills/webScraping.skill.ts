import { LuaSkill } from 'lua-cli';
import { scrapePublicPageTool } from '../tools/scrapePublicPage.tool.js';
import { scrapeAuthenticatedPageTool } from '../tools/scrapeAuthenticatedPage.tool.js';
import { extractProductDataTool } from '../tools/extractProductData.tool.js';

/**
 * Web scraping skill for Waddle.
 *
 * Gives the agent the ability to navigate supplier websites — both public
 * and login-protected — and extract structured product and pricing data.
 *
 * Typical flow the agent follows:
 * 1. scrape_public_page  OR  scrape_authenticated_page  →  get raw page text
 * 2. extract_product_data  →  turn text into structured listings
 */
export const webScrapingSkill = new LuaSkill({
  name: 'web-scraping',
  description:
    'Scrapes supplier websites to retrieve live product listings, pricing, and availability.',
  context:
    'Use this skill whenever the user asks you to find, compare, or verify product information ' +
    'from a specific supplier URL. ' +
    'Always start with scrape_public_page unless you know the page requires a login. ' +
    'If the scrape returns a login wall or fails with an auth error, switch to ' +
    'scrape_authenticated_page and ask the user for the credentialsKey if not provided. ' +
    'After scraping, always call extract_product_data to produce structured results before ' +
    'presenting information to the user. ' +
    'Never expose raw credentials or environment variable values in responses.',
  tools: [scrapePublicPageTool, scrapeAuthenticatedPageTool, extractProductDataTool],
});
