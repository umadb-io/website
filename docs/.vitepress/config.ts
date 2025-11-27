import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'My Product',
    description: 'A very basic VitePress website',
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'About', link: '/about' }
        ],
        sidebar: [
            { text: 'Home', link: '/' },
            { text: 'About', link: '/about' }
        ]
    }
})
