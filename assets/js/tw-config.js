// Tailwind (Play CDN) settings shared by every page; colours come from site.css
tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'IBM Plex Sans Thai', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // quoted: unquoted, the "4" makes this an invalid family name and the rule is dropped
        serif: ['"Source Serif 4"', 'Iowan Old Style', 'Georgia', 'serif'],
      },
      colors: {
        paper: 'var(--paper)',
        sheet: 'var(--sheet)',
        graphite: 'var(--graphite)',
        pencil: 'var(--pencil)',
        rule: 'var(--rule)',
        ink: 'var(--ink)',
        'ink-deep': 'var(--ink-deep)',
      },
      maxWidth: { content: 'var(--content)' },
    },
  },
};
