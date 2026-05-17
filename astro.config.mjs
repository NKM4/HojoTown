// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://hojotown.jp',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/d9k2m7x/'),
    }),
  ],
});
