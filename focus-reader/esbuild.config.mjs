import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: false,
  minify: !isWatch,
  logLevel: 'info',
};

const configs = [
  {
    ...sharedConfig,
    entryPoints: ['src/content.js'],
    outfile: 'dist/content.js',
  },
  {
    ...sharedConfig,
    entryPoints: ['src/detector.js'],
    outfile: 'dist/detector.js',
  },
  {
    ...sharedConfig,
    entryPoints: ['src/background.js'],
    outfile: 'dist/background.js',
  },
];

if (isWatch) {
  const contexts = await Promise.all(configs.map(c => esbuild.context(c)));
  await Promise.all(contexts.map(c => c.watch()));
  console.log('Watching for changes...');
} else {
  await Promise.all(configs.map(c => esbuild.build(c)));
}
