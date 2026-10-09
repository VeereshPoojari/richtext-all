import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';

export default [
  // 1. Core Bundle (ESM, CJS, UMD)
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'es',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'RichTextAll',
        sourcemap: true,
        exports: 'named',
        plugins: [terser()]
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      postcss({
        extract: 'richtext-all.css',
        minimize: true
      })
    ]
  },

  // 2. React Adapter
  {
    input: 'src/react/index.js',
    external: ['react', 'react-dom'],
    output: [
      {
        file: 'dist/react/index.esm.js',
        format: 'es',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/react/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      resolve({ extensions: ['.js', '.jsx'] }),
      commonjs()
    ]
  },

  // 3. Vue Adapter
  {
    input: 'src/vue/index.js',
    external: ['vue'],
    output: [
      {
        file: 'dist/vue/index.esm.js',
        format: 'es',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/vue/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      resolve(),
      commonjs()
    ]
  },

  // 4. Angular Adapter
  {
    input: 'src/angular/index.js',
    external: ['@angular/core'],
    output: [
      {
        file: 'dist/angular/index.esm.js',
        format: 'es',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/angular/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named'
      }
    ],
    plugins: [
      resolve(),
      commonjs()
    ]
  }
];
